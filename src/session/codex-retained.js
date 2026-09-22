import { adaptSpeechSessionRecords } from '../adapters/speech-session-normalized.js';

/**
 * Builds the heading suffix used by canonical Codex revision presentation.
 *
 * @param {Object<string, *>} interaction - Retained Codex interaction state.
 * @returns {string} Parenthesized heading suffix or an empty string.
 */
function interactionHeadingSuffix(interaction) {
  const statuses = [];
  if (interaction.revision_status !== 'normal') {
    statuses.push(Number.isInteger(interaction.revision_depth)
      ? `${interaction.revision_status} ${interaction.revision_depth}`
      : interaction.revision_status);
  }
  if (interaction.execution_status === 'aborted') statuses.push('aborted');
  return statuses.length ? ` (${statuses.join(', ')})` : '';
}

/**
 * Formats one provider model identifier for a user-visible model-change notice.
 *
 * @param {*} value - Provider model identifier.
 * @returns {string} Display model label.
 */
function modelLabel(value) {
  return String(value ?? '').replace(/^gpt-/i, 'GPT-');
}

/**
 * Creates the canonical model-change notice emitted when a replacement Codex
 * turn changes model relative to the rolled-back revision it replaces.
 *
 * @param {Object<string, *>} record - Replacement User source record.
 * @param {number} sourceIndex - Replacement User source index.
 * @param {string} previousModel - Previous revision model identifier.
 * @param {string} currentModel - Replacement revision model identifier.
 * @returns {Object<string, *>} Canonical model-change notice.
 */
function modelChangeEvent(record, sourceIndex, previousModel, currentModel) {
  const source = {
    provider: 'codex',
    record_id: null,
    record_index: sourceIndex
  };
  const text = `Model changed from ${modelLabel(previousModel)} to ${modelLabel(currentModel)}`;
  return {
    id: `codex:record:${sourceIndex}:model_change`,
    provider: 'codex',
    source_record_id: null,
    source_index: sourceIndex,
    kind: 'notice',
    role: 'system',
    channel: null,
    visibility: 'visible',
    content_type: 'model_change',
    blocks: [{
      id: `codex:record:${sourceIndex}:model_change:block`,
      type: 'text',
      text,
      source
    }],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source
  };
}

/**
 * Maintains only the revision state required to apply future Codex records to a
 * retained canonical event inventory.
 */
class CodexRevisionTracker {
  /**
   * Creates tracker state from one initial record inventory.
   *
   * @param {Array<Object<string, *>>} records - Initial ordered Codex records.
   */
  constructor(records) {
    this.currentModel = null;
    this.currentInteraction = null;
    this.active = [];
    this.pendingHistory = [];
    this.interactionBySource = new Map();
    this.modelNotices = new Map();
    for (let index = 0; index < records.length; index += 1) {
      this.processRecord(records[index], index);
    }
    this.finalizePendingHistory();
  }

  /**
   * Processes one newly observed Codex record and updates revision state.
   *
   * @param {Object<string, *>} record - New Codex source record.
   * @param {number} sourceIndex - Stable source-record index.
   * @returns {void}
   */
  processRecord(record, sourceIndex) {
    const payload = record?.payload;
    if (record?.type === 'turn_context' && typeof payload?.model === 'string') {
      this.currentModel = payload.model;
      return;
    }

    if (record?.type === 'event_msg' && payload?.type === 'turn_aborted') {
      if (this.currentInteraction) this.currentInteraction.execution_status = 'aborted';
      return;
    }

    if (record?.type === 'event_msg' && payload?.type === 'thread_rolled_back') {
      const count = Number.isInteger(payload?.num_turns) && payload.num_turns > 0
        ? payload.num_turns
        : 0;
      const popped = [];
      for (let index = 0; index < count && this.active.length; index += 1) {
        const interaction = this.active.pop();
        interaction.rolled_back = true;
        popped.unshift(interaction);
      }
      if (popped.length) {
        const inherited = popped.flatMap(interaction => interaction.history.length
          ? [...interaction.history, interaction]
          : [interaction]);
        this.pendingHistory = inherited.filter((interaction, index, list) =>
          list.indexOf(interaction) === index);
        this.currentInteraction = this.active.at(-1) ?? null;
        this.finalizePendingHistory();
      }
      return;
    }

    if (record?.type === 'event_msg' && payload?.type === 'user_message') {
      const previous = this.pendingHistory.at(-1) ?? null;
      const interaction = {
        model: this.currentModel,
        history: this.pendingHistory,
        rolled_back: false,
        revision_status: this.pendingHistory.length ? 'edited' : 'normal',
        revision_depth: this.pendingHistory.length ? this.pendingHistory.length : null,
        execution_status: 'completed'
      };
      this.finalizePendingHistory();
      if (previous?.model && interaction.model && previous.model !== interaction.model) {
        this.modelNotices.set(sourceIndex, {
          record,
          previousModel: previous.model,
          currentModel: interaction.model
        });
      }
      this.pendingHistory = [];
      this.active.push(interaction);
      this.currentInteraction = interaction;
    }

    if (this.currentInteraction) {
      this.interactionBySource.set(sourceIndex, this.currentInteraction);
    }
  }

  /**
   * Assigns stable original/superseded status and zero-based depth to pending history.
   *
   * @returns {void}
   */
  finalizePendingHistory() {
    this.pendingHistory.forEach((historical, index) => {
      historical.revision_status = index === 0 ? 'original' : 'superseded';
      historical.revision_depth = index;
    });
  }
}

/**
 * Applies retained revision state to one canonical Codex event.
 *
 * @param {Object<string, *>} event - Canonical Codex event.
 * @param {CodexRevisionTracker} tracker - Current retained revision tracker.
 * @returns {Object<string, *>} Event with current revision metadata.
 */
function applyTrackedRevision(event, tracker) {
  const interaction = tracker.interactionBySource.get(event?.source_index);
  if (!interaction) return event;
  const headingSuffix = event.kind === 'message' &&
    (event.role === 'user' || event.role === 'assistant')
      ? interactionHeadingSuffix(interaction)
      : '';
  const projection = { ...(event?.projection ?? {}) };
  if (headingSuffix) projection.heading_suffix = headingSuffix;
  else delete projection.heading_suffix;

  return {
    ...event,
    revision_status: interaction.revision_status,
    revision_depth: interaction.revision_depth,
    execution_status: interaction.execution_status,
    model: interaction.model,
    ...(Object.keys(projection).length ? { projection } : {})
  };
}

/**
 * Applies speech-selection options to already-normalized Codex blocks.
 *
 * @param {Array<Object<string, *>>} events - Retained canonical events.
 * @param {Object<string, *>} options - Projection options.
 * @returns {Array<Object<string, *>>} Projection-local event clones.
 */
function applySpeechSelection(events, options) {
  const includeUserContext = options?.includeUserContext === true;
  return events.map(event => {
    if (event?.provider !== 'codex' || event?.kind !== 'message' || event?.role !== 'user') {
      return event;
    }
    let changed = false;
    const blocks = (event.blocks ?? []).map(block => {
      if (block?.type !== 'user_context') return block;
      changed = true;
      return {
        ...block,
        speech: {
          ...(block?.speech ?? {}),
          eligible: includeUserContext,
          voice_role: 'user_context'
        }
      };
    });
    return changed ? { ...event, blocks } : event;
  });
}

/**
 * Normalizes only newly appended Codex records while preserving absolute indexes.
 *
 * @param {number} firstSourceIndex - Absolute source index of the first new record.
 * @param {Array<Object<string, *>>} records - Newly appended Codex records.
 * @returns {Array<Object<string, *>>} Canonical events created by the appended records.
 */
function normalizeAppendedCodexRecords(firstSourceIndex, records) {
  const sparse = new Array(firstSourceIndex + records.length);
  records.forEach((record, offset) => {
    sparse[firstSourceIndex + offset] = record;
  });
  return adaptSpeechSessionRecords('codex', sparse, { includeUserContext: true });
}

/**
 * Owns Codex-specific retained revision, append, and speech-selection state.
 */
class CodexRetainedAdapter {
  /**
   * Creates retained Codex state from the initial provider record inventory.
   *
   * @param {Array<Object<string, *>>} records - Initial ordered Codex records.
   */
  constructor(records) {
    this.tracker = new CodexRevisionTracker(records);
    this.initialEvents = adaptSpeechSessionRecords(
      'codex', records, { includeUserContext: true });
  }

  /**
   * Applies Codex-specific projection options without changing retained events.
   *
   * @param {Array<Object<string, *>>} events - Retained canonical event inventory.
   * @param {Object<string, *>} options - Projection options.
   * @returns {Array<Object<string, *>>} Projection-local canonical events.
   */
  projectEvents(events, options) {
    return applySpeechSelection(events, options);
  }

  /**
   * Appends Codex provider records to a retained canonical inventory.
   *
   * The source representation is an append-only Codex provider record slice. The
   * output representation is the complete updated canonical event inventory with
   * revision metadata and model-change notices applied.
   *
   * @param {Array<Object<string, *>>} events - Existing canonical event inventory.
   * @param {Array<Object<string, *>>} records - Newly appended provider records.
   * @param {number} firstSourceIndex - Absolute source index of the first new record.
   * @returns {Array<Object<string, *>>} Complete updated canonical event inventory.
   */
  append(events, records, firstSourceIndex) {
    const appendedEvents = normalizeAppendedCodexRecords(firstSourceIndex, records);
    records.forEach((record, offset) => {
      this.tracker.processRecord(record, firstSourceIndex + offset);
    });
    this.tracker.finalizePendingHistory();

    const existingById = new Map(events.map(event => [event.id, event]));
    for (const event of appendedEvents) existingById.set(event.id, event);
    for (const [sourceIndex, notice] of this.tracker.modelNotices.entries()) {
      const event = modelChangeEvent(
        notice.record,
        sourceIndex,
        notice.previousModel,
        notice.currentModel);
      existingById.set(event.id, event);
    }

    return [...existingById.values()]
      .map(event => applyTrackedRevision(event, this.tracker))
      .sort((left, right) => {
        const sourceOrder = (left.source_index ?? 0) - (right.source_index ?? 0);
        if (sourceOrder !== 0) return sourceOrder;
        const leftNotice = left.content_type === 'model_change' ? 0 : 1;
        const rightNotice = right.content_type === 'model_change' ? 0 : 1;
        return leftNotice - rightNotice;
      });
  }
}

/**
 * Creates the retained Codex adapter used by the provider-neutral session layer.
 *
 * @param {Array<Object<string, *>>} records - Initial ordered Codex records.
 * @returns {CodexRetainedAdapter} Retained Codex adapter and initial canonical inventory.
 */
export function createCodexRetainedAdapter(records) {
  return new CodexRetainedAdapter(records);
}
