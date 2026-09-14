import packageMetadata from '../package.json' with { type: 'json' };

/**
 * Returns the authoritative AIConversationCore version.
 *
 * The value is sourced from package.json so module callers do not maintain a
 * second Core version literal.
 *
 * @returns {string} The authoritative AIConversationCore version.
 */
export function getVersion() {
  return packageMetadata.version;
}

export {
  STYLE_ROLES,
  configureProjectionTheme,
  getDefaultProjectionTheme,
  resetProjectionTheme,
  resolveProjectionTheme
} from './projections/style.js';

export {
  buildTurnHeaderComponents,
  renderTurnHeader
} from './projections/turn-header.js';

export { renderCanonicalMarkdown } from './projections/markdown.js';

export { deriveTurns } from './derive/turns.js';
export { adaptChatGPTRecords } from './adapters/chatgpt.js';
export { adaptClaudeRecords, adaptClaudeToolEvents } from './adapters/claude-normalized.js';
export { adaptCodexRecords, adaptCodexToolEvents } from './adapters/codex.js';
