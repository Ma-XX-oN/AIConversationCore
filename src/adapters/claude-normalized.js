import {
  adaptClaudeRecordSlice,
  adaptClaudeToolEvents,
  createClaudeAdapterState
} from './claude.js';

// Matches Claude Code XML blocks that are injected into text but are not user-visible transcript content.
const CLAUDE_SYSTEM_TAG_RE = /<(?:ide_opened_file|ide_selection|system[-_]reminder|system|env|claude_background_info|user[-_]prompt[-_]submit[-_]hook|command[-_]name|antml:[a-z_]+)[^>]*>.*?<\/[^>]+>/gis;

/**
 * Removes Claude Code's system-injected XML blocks from provider text.
 *
 * The source representation is a Claude text block that may contain injected XML
 * alongside user-visible text. The canonical representation is only visible text.
 *
 * @param {string} text - Provider text to normalize.
 * @returns {string} Visible Claude text with injected XML removed and whitespace trimmed.
 */
function stripClaudeSystemText(text) {
  return text.replace(CLAUDE_SYSTEM_TAG_RE, '').trim();
}

/**
 * Applies Claude visible-text normalization to already adapted canonical events.
 *
 * @param {Array<Object<string, *>>} events - Canonical Claude events to normalize.
 * @returns {Array<Object<string, *>>} Events with injected system text removed.
 */
function normalizeClaudeEvents(events) {
  const normalized = [];
  for (const event of events) {
    if (event?.kind !== 'message' || !Array.isArray(event.blocks)) {
      normalized.push(event);
      continue;
    }

    const blocks = event.blocks.flatMap(block => {
      if (block?.type !== 'text' || typeof block.text !== 'string') return [block];
      const text = stripClaudeSystemText(block.text);
      if (!text) return [];
      return [{ ...block, text }];
    });

    if (!blocks.length) continue;
    normalized.push({ ...event, blocks });
  }
  return normalized;
}

/**
 * Creates an append-only Claude normalizer with retained cross-record state.
 *
 * @returns {Object<string, *>} Adapter exposing append(records, firstSourceIndex).
 */
export function createClaudeIncrementalAdapter() {
  const state = createClaudeAdapterState();
  return {
    append: (records, firstSourceIndex = 0) => normalizeClaudeEvents(
      adaptClaudeRecordSlice(records, firstSourceIndex, state))
  };
}

/**
 * Adapts a complete Claude record inventory while suppressing injected system XML.
 *
 * The source representation is ordered Claude provider records. The output
 * representation is canonical visible Claude events with correlation preserved.
 *
 * @param {Array<Object<string, *>>} records - Ordered Claude provider records.
 * @returns {Array<Object<string, *>>} Canonical visible Claude events.
 */
export function adaptClaudeRecords(records) {
  return createClaudeIncrementalAdapter().append(records, 0);
}

export { adaptClaudeToolEvents };
