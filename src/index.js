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
export {
  markdownToHtml,
  renderCanonicalHtml,
  renderCanonicalStylesheet
} from './projections/html.js';
export {
  PRESENTATION_SCHEMA_VERSION,
  buildCanonicalPresentation
} from './projections/presentation.js';
export {
  RENDER_FORMATS,
  RENDER_INPUT_KINDS,
  renderConversation
} from './render.js';

export { deriveTurns } from './derive/turns.js';
export { adaptChatGPTRecords } from './adapters/chatgpt.js';
export { adaptClaudeRecords, adaptClaudeToolEvents } from './adapters/claude.js';
export { adaptCodexRecords, adaptCodexToolEvents } from './adapters/codex.js';
