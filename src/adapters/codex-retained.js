import {
  adaptCodexRecords as adaptLegacyCodexRecords,
  adaptCodexToolEvents,
  resolveCodexSessionMetadata
} from './codex.js';

/**
 * Adapts Codex records into the complete canonical revision inventory.
 *
 * Visibility is intentionally not a normalization option.  The legacy adapter
 * still understands `includeRolledBackTurns`; this retained adapter always asks
 * it for the complete revision history so projection settings can change later
 * without reparsing provider input or renumbering canonical events.
 *
 * @param {Array<Object<string, *>>} records - Ordered Codex source records.
 * @param {Object<string, *>} _options - Reserved normalization options.
 * @returns {Array<Object<string, *>>} Complete canonical Codex event inventory.
 */
export function adaptCodexRecords(records, _options = {}) {
  return adaptLegacyCodexRecords(records, { includeRolledBackTurns: true });
}

export {
  adaptCodexToolEvents,
  resolveCodexSessionMetadata
};
