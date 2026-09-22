import { adaptChatGPTRecords } from '../adapters/chatgpt.js';
import { createClaudeIncrementalAdapter } from '../adapters/claude-normalized.js';
import { renderCanonicalHtml } from '../projections/html-visibility.js';
import { renderCanonicalMarkdown } from '../projections/markdown-visibility.js';
import { projectCanonicalConversation } from '../projections/structured-visibility.js';
import { createCodexRetainedAdapter } from './codex-retained.js';

/**
 * Creates the initial canonical event inventory for one retained session.
 *
 * Provider-specific retained adapters own incremental state. This coordinator only
 * selects the provider path and returns the already-canonical initial inventory.
 *
 * @param {string} provider - Canonical provider identifier.
 * @param {Array<Object<string, *>>} records - Initial ordered provider records.
 * @param {Object<string, *>|null} claudeAdapter - Retained Claude adapter when applicable.
 * @param {Object<string, *>|null} codexAdapter - Retained Codex adapter when applicable.
 * @returns {Array<Object<string, *>>} Complete initial canonical event inventory.
 */
function initialEvents(provider, records, claudeAdapter, codexAdapter) {
  if (codexAdapter) return codexAdapter.initialEvents;
  if (claudeAdapter) return claudeAdapter.append(records, 0);
  if (provider === 'chatgpt') return adaptChatGPTRecords(records);
  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Retains one normalized canonical conversation so presentation options can be
 * changed repeatedly without reparsing provider input.
 */
class CanonicalConversationSession {
  /**
   * Creates one retained canonical conversation session.
   *
   * @param {Object<string, *>} input - Session construction request.
   * @param {string} input.provider - Canonical provider identifier.
   * @param {Array<Object<string, *>>} input.records - Initial ordered records.
   */
  constructor({ provider, records }) {
    if (typeof provider !== 'string' || !provider) {
      throw new TypeError('provider must be a non-empty string.');
    }
    if (!Array.isArray(records)) {
      throw new TypeError('records must be an array.');
    }

    this.provider = provider;
    this.records = [...records];
    this._claudeAdapter = provider === 'claude'
      ? createClaudeIncrementalAdapter()
      : null;
    this._codexAdapter = provider === 'codex'
      ? createCodexRetainedAdapter(this.records)
      : null;
    this._events = initialEvents(
      provider,
      this.records,
      this._claudeAdapter,
      this._codexAdapter);
    this._projectionCount = 0;
    this._appendedRecordsProcessed = 0;
  }

  /**
   * Returns the retained complete canonical event inventory.
   *
   * @returns {Array<Object<string, *>>} Current canonical events.
   */
  get events() {
    return this._events;
  }

  /**
   * Returns normalization/projection counters used by retained-session regressions.
   *
   * @returns {Object<string, number>} Retained-session diagnostics.
   */
  get diagnostics() {
    return {
      initial_normalization_passes: 1,
      full_renormalization_passes: 0,
      appended_records_processed: this._appendedRecordsProcessed,
      projection_count: this._projectionCount
    };
  }

  /**
   * Projects the retained canonical inventory with presentation/speech options.
   *
   * @param {Object<string, *>} options - Projection options.
   * @returns {Object<string, *>} Structured canonical projection.
   */
  project(options = {}) {
    this._projectionCount += 1;
    const events = this._codexAdapter
      ? this._codexAdapter.projectEvents(this._events, options)
      : this._events;
    return projectCanonicalConversation(events, options);
  }

  /**
   * Renders canonical Markdown from the retained canonical inventory.
   *
   * @param {Object<string, *>} options - Projection options.
   * @returns {string} Canonical Markdown.
   */
  renderMarkdown(options = {}) {
    return renderCanonicalMarkdown(this._events, options);
  }

  /**
   * Renders canonical HTML from the retained canonical inventory.
   *
   * @param {Object<string, *>} options - Projection options.
   * @returns {string} Canonical HTML retaining revision identity.
   */
  renderHtml(options = {}) {
    return renderCanonicalHtml(this._events, options);
  }

  /**
   * Appends provider records without rereading the unchanged session prefix.
   *
   * Claude and Codex append use provider-owned retained state. ChatGPT rejects
   * append until a dedicated incremental adapter exists rather than falling back
   * to whole-session normalization.
   *
   * @param {Array<Object<string, *>>} records - Newly appended provider records.
   * @returns {void}
   */
  append(records) {
    if (!Array.isArray(records)) throw new TypeError('records must be an array.');
    if (!records.length) return;

    const firstSourceIndex = this.records.length;
    if (this._claudeAdapter) {
      const appendedEvents = this._claudeAdapter.append(records, firstSourceIndex);
      this.records.push(...records);
      this._events.push(...appendedEvents);
      this._appendedRecordsProcessed += records.length;
      return;
    }

    if (this._codexAdapter) {
      this._events = this._codexAdapter.append(
        this._events,
        records,
        firstSourceIndex);
      this.records.push(...records);
      this._appendedRecordsProcessed += records.length;
      return;
    }

    throw new Error(`Incremental append is not implemented for provider: ${this.provider}`);
  }
}

/**
 * Creates one retained canonical conversation session.
 *
 * @param {Object<string, *>} input - Session construction request.
 * @param {string} input.provider - Canonical provider identifier.
 * @param {Array<Object<string, *>>} input.records - Initial ordered provider records.
 * @returns {CanonicalConversationSession} Retained canonical session.
 */
export function createCanonicalConversationSession(input) {
  return new CanonicalConversationSession(input);
}
