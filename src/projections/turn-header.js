import {
  STYLE_ROLES,
  resolveProjectionTheme
} from './style.js';

const PROVIDER_LABELS = Object.freeze({
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  codex: 'Codex'
});

/**
 * Implements `htmlEscape`.
 */
function htmlEscape(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Implements `headingLabel`.
 */
function headingLabel(turn) {
  if (turn?.role === 'user') return 'User';
  const provider = turn?.source?.provider ?? turn?.provider ?? null;
  return PROVIDER_LABELS[provider] ?? 'Assistant';
}

/**
 * Builds turn header components.
 */
export function buildTurnHeaderComponents(turn, options = {}) {
  if (!turn?.id) throw new Error('Turn header projection requires a canonical turn id.');

  const components = [{
    type: 'speaker',
    styleRole: turn.role === 'user'
      ? STYLE_ROLES.USER_HEADING
      : STYLE_ROLES.ASSISTANT_HEADING,
    text: `## ${headingLabel(turn)}`
  }];

  if (options.timestamp != null) {
    components.push({
      type: 'timestamp',
      styleRole: STYLE_ROLES.TIMESTAMP,
      text: `[${options.timestamp}]:`
    });
  }

  if (options.recordNumber != null) {
    components.push({
      type: 'record-number',
      styleRole: STYLE_ROLES.RECORD_NUMBER,
      text: `${options.recordNumber}:`
    });
  }

  if (options.showTurnId) {
    components.push({
      type: 'turn-id',
      styleRole: STYLE_ROLES.TURN_ID,
      text: `turn_id=${turn.id}`
    });
  }

  return components;
}

/**
 * Renders plain.
 */
function renderPlain(components) {
  return components.map(component => component.text).join(' ');
}

/**
 * Renders ANSI.
 */
function renderAnsi(components, theme) {
  const reset = theme.ansi.reset ?? '\u001b[0m';
  return components.map(component => {
    const prefix = theme.ansi[component.styleRole] ?? '';
    return prefix ? `${prefix}${component.text}${reset}` : component.text;
  }).join(' ');
}

/**
 * Renders HTML.
 */
function renderHtml(components, theme) {
  return `<h2>${components.map(component => {
    const className = theme.html[component.styleRole];
    const text = htmlEscape(component.text.replace(/^## /, ''));
    return className
      ? `<span class="${htmlEscape(className)}">${text}</span>`
      : `<span>${text}</span>`;
  }).join(' ')}</h2>`;
}

/**
 * Renders turn header.
 */
export function renderTurnHeader(turn, options = {}) {
  const components = buildTurnHeaderComponents(turn, options);
  const format = options.format ?? 'plain';
  const theme = resolveProjectionTheme(options.theme);

  if (format === 'plain') return renderPlain(components);
  if (format === 'ansi') return renderAnsi(components, theme);
  if (format === 'html') return renderHtml(components, theme);
  if (format === 'components') return components;
  throw new Error(`Unsupported turn header format: ${format}`);
}
