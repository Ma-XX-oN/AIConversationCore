/** Canonical presentation-model schema version. */
export const PRESENTATION_SCHEMA_VERSION = 1;

/**
 * Returns whether one canonical event is eligible for visible presentation.
 *
 * @param {Object<string, *>} event - Canonical event being considered for presentation.
 * @returns {boolean} True when the event participates in the visible projection.
 */
function isVisibleEvent(event) {
  return event?.visibility !== 'hidden' && event?.kind !== 'system_context';
}

/**
 * Returns whether one canonical event participates in an Assistant response.
 *
 * @param {Object<string, *>} event - Canonical event being considered for Assistant grouping.
 * @returns {boolean} True when the event belongs to Assistant-side response activity.
 */
function isAssistantActivity(event) {
  return event?.role === 'assistant' ||
    event?.kind === 'tool_call' ||
    event?.kind === 'tool_result' ||
    event?.kind === 'subagent';
}

/**
 * Builds one stable source identity descriptor from a canonical event.
 *
 * @param {Object<string, *>} event - Canonical event whose source identity is required.
 * @returns {Object<string, *>} Presentation source identity retaining canonical and provider provenance.
 */
function sourceIdentity(event) {
  return {
    event_id: event?.id ?? null,
    provider: event?.provider ?? null,
    record_id: event?.source_record_id ?? null,
    record_index: Number.isInteger(event?.source_index) ? event.source_index : null
  };
}

/**
 * Builds the deterministic identity for a presentation unit.
 *
 * @param {string} kind - Semantic presentation-unit kind.
 * @param {Array<Object<string, *>>} events - Canonical events owned by the presentation unit.
 * @param {number} ordinal - Zero-based unit ordinal used only when source identity is unavailable.
 * @returns {string} Deterministic presentation-unit identifier.
 */
function unitId(kind, events, ordinal) {
  const first = events.find(event => event?.id || event?.source_record_id);
  const last = [...events].reverse().find(event => event?.id || event?.source_record_id);
  const start = first?.id ?? first?.source_record_id ?? `ordinal-${ordinal}`;
  const end = last?.id ?? last?.source_record_id ?? start;
  return `${kind}:${start}:${end}`;
}

/**
 * Creates one immutable-shape presentation unit from canonical events.
 *
 * @param {string} kind - Semantic presentation-unit kind.
 * @param {Array<Object<string, *>>} events - Canonical events represented by this unit.
 * @param {number} ordinal - Zero-based unit ordinal within the current model construction.
 * @param {Object<string, *>} options - Unit options containing parent identity, boundary policy, label, and children.
 * @returns {Object<string, *>} Canonical presentation unit with source aliases and structural metadata.
 */
function createUnit(kind, events, ordinal, options = {}) {
  const sourceEvents = events.filter(Boolean);
  return {
    id: unitId(kind, sourceEvents, ordinal),
    kind,
    provider: sourceEvents.find(event => event?.provider)?.provider ?? options.provider ?? null,
    parent_id: options.parent_id ?? null,
    boundary: options.boundary ?? 'normal',
    label: options.label ?? null,
    source_event_ids: sourceEvents.map(event => event?.id ?? null).filter(Boolean),
    sources: sourceEvents.map(sourceIdentity),
    children: options.children ?? []
  };
}

/**
 * Returns the human-readable grouped-reasoning disclosure label.
 *
 * @param {number} count - Number of reasoning records represented by the disclosure.
 * @returns {string} Canonical singular or plural disclosure label.
 */
function reasoningLabel(count) {
  return `Having ${count} thought${count === 1 ? '' : 's'}`;
}

/**
 * Converts one Assistant response segment into canonical presentation children.
 *
 * Consecutive reasoning and tool activity is represented as one atomic structural
 * group whenever at least one reasoning event participates. Commentary and final
 * messages terminate the current reasoning group. The grouping mirrors the
 * canonical renderer's disclosure boundary while exposing it independently of
 * Markdown or HTML syntax.
 *
 * @param {Array<Object<string, *>>} segment - Ordered canonical events forming one Assistant response segment.
 * @param {string} parentId - Stable parent response-unit identifier.
 * @param {Object<string, number>} state - Mutable per-build ordinal state for deterministic fallback identities.
 * @returns {Array<Object<string, *>>} Ordered canonical child presentation units.
 */
function buildAssistantChildren(segment, parentId, state) {
  const children = [];
  let activityRun = [];
  let reasoningEvents = [];

  /**
   * Flushes the current reasoning/tool activity run into canonical presentation units.
   *
   * @returns {void} No value is returned.
   */
  function flushActivityRun() {
    if (!activityRun.length) return;
    if (reasoningEvents.length) {
      children.push(createUnit('reasoning_group', activityRun, state.ordinal++, {
        parent_id: parentId,
        boundary: 'atomic',
        label: reasoningLabel(reasoningEvents.length)
      }));
    } else {
      for (const event of activityRun) {
        children.push(createUnit('tool_activity', [event], state.ordinal++, {
          parent_id: parentId,
          boundary: 'atomic'
        }));
      }
    }
    activityRun = [];
    reasoningEvents = [];
  }

  for (const event of segment) {
    if (event?.kind === 'reasoning_summary') {
      activityRun.push(event);
      reasoningEvents.push(event);
      continue;
    }
    if (event?.kind === 'tool_call' || event?.kind === 'tool_result') {
      activityRun.push(event);
      continue;
    }
    flushActivityRun();
    if (event?.kind === 'commentary') {
      children.push(createUnit('commentary', [event], state.ordinal++, {
        parent_id: parentId,
        boundary: 'normal'
      }));
      continue;
    }
    if (event?.kind === 'subagent') {
      children.push(createUnit('subagent', [event], state.ordinal++, {
        parent_id: parentId,
        boundary: 'atomic'
      }));
      continue;
    }
    if (event?.kind === 'message' && event?.role === 'assistant') {
      children.push(createUnit('message', [event], state.ordinal++, {
        parent_id: parentId,
        boundary: 'normal'
      }));
    }
  }
  flushActivityRun();
  return children;
}

/**
 * Builds the canonical presentation model for an ordered canonical event stream.
 *
 * The model separates provider/source record identity from presentation
 * structure. Atomic units are safe indivisible rendering/virtualization
 * boundaries; every source identity participating in such a unit is retained as
 * an alias so consumers never need to infer grouping from rendered markup.
 *
 * @param {Array<Object<string, *>>} events - Ordered canonical events to project into structural presentation units.
 * @param {Object<string, *>} options - Reserved presentation options; unknown fields are retained only by the caller and do not alter grouping.
 * @returns {Object<string, *>} Versioned canonical presentation model containing ordered top-level units and structural children.
 */
export function buildCanonicalPresentation(events, options = {}) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');
  const units = [];
  const state = { ordinal: 0 };
  let assistantSegment = [];

  /**
   * Flushes the current Assistant segment into one response presentation unit.
   *
   * @returns {void} No value is returned.
   */
  function flushAssistant() {
    if (!assistantSegment.length) return;
    const response = createUnit('assistant_response', assistantSegment, state.ordinal++, {
      provider: assistantSegment.find(event => event?.provider)?.provider ?? null
    });
    response.children = buildAssistantChildren(assistantSegment, response.id, state);
    units.push(response);
    assistantSegment = [];
  }

  for (const event of events) {
    if (!isVisibleEvent(event)) continue;
    if (event?.kind === 'notice') {
      flushAssistant();
      units.push(createUnit('notice', [event], state.ordinal++, { boundary: 'atomic' }));
      continue;
    }
    if (event?.role === 'user' && event?.kind === 'message') {
      flushAssistant();
      units.push(createUnit('user_message', [event], state.ordinal++, { boundary: 'normal' }));
      continue;
    }
    if (!isAssistantActivity(event)) continue;
    assistantSegment.push(event);
    if (event?.role === 'assistant' && event?.kind === 'message' && event?.provider !== 'claude') {
      flushAssistant();
    }
  }
  flushAssistant();

  return {
    schema_version: PRESENTATION_SCHEMA_VERSION,
    options: { ...options },
    units
  };
}
