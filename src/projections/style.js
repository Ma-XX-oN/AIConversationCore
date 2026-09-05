/** Stable semantic style-role names exposed to projection consumers. */
export const STYLE_ROLES = Object.freeze({
  BODY: 'body',
  SURFACE: 'surface',
  USER_HEADING: 'user-heading',
  ASSISTANT_HEADING: 'assistant-heading',
  TIMESTAMP: 'timestamp',
  RECORD_NUMBER: 'record-number',
  TURN_ID: 'turn-id',
  REASONING: 'reasoning',
  TOOL: 'tool',
  CITATION: 'citation',
  CODE: 'code',
  LINK: 'link',
  BORDER: 'border'
});

/** Immutable default projection theme used as the reset and merge baseline. */
const DEFAULT_THEME = Object.freeze({
  ansi: Object.freeze({
    [STYLE_ROLES.USER_HEADING]: '\u001b[33m',
    [STYLE_ROLES.ASSISTANT_HEADING]: '\u001b[32m',
    [STYLE_ROLES.TIMESTAMP]: '\u001b[36m',
    [STYLE_ROLES.RECORD_NUMBER]: '\u001b[2m',
    [STYLE_ROLES.TURN_ID]: '\u001b[35m',
    [STYLE_ROLES.REASONING]: '\u001b[2m',
    [STYLE_ROLES.TOOL]: '\u001b[36m',
    [STYLE_ROLES.CITATION]: '\u001b[34m',
    [STYLE_ROLES.CODE]: '',
    [STYLE_ROLES.LINK]: '\u001b[34m',
    reset: '\u001b[0m'
  }),
  html: Object.freeze({
    [STYLE_ROLES.BODY]: 'transcript-body',
    [STYLE_ROLES.SURFACE]: 'transcript-surface',
    [STYLE_ROLES.USER_HEADING]: 'transcript-user-heading',
    [STYLE_ROLES.ASSISTANT_HEADING]: 'transcript-assistant-heading',
    [STYLE_ROLES.TIMESTAMP]: 'transcript-timestamp',
    [STYLE_ROLES.RECORD_NUMBER]: 'transcript-record-number',
    [STYLE_ROLES.TURN_ID]: 'transcript-turn-id',
    [STYLE_ROLES.REASONING]: 'transcript-reasoning',
    [STYLE_ROLES.TOOL]: 'transcript-tool',
    [STYLE_ROLES.CITATION]: 'transcript-citation',
    [STYLE_ROLES.CODE]: 'transcript-code',
    [STYLE_ROLES.LINK]: 'transcript-link',
    [STYLE_ROLES.BORDER]: 'transcript-border'
  }),
  css: Object.freeze({
    font_family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    monospace_font_family: "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace",
    font_size: '16px',
    line_height: '1.5',
    foreground: '#202124',
    background: '#f7f7f5',
    surface: '#ffffff',
    user_heading: '#8a5a00',
    assistant_heading: '#176b3a',
    metadata: '#5f6368',
    reasoning: '#4b5563',
    tool: '#245b78',
    citation: '#275dad',
    code_foreground: '#202124',
    code_background: '#f0f1f2',
    link: '#275dad',
    border: '#d7d9dc',
    border_radius: '6px',
    content_max_width: 'none',
    paragraph_gap: '0.75rem',
    section_gap: '1.25rem'
  })
});

/** Mutable process-wide projection theme produced by applying consumer overrides to the default. */
let configuredTheme = cloneTheme(DEFAULT_THEME);

/**
 * Clones one projection theme without sharing mutable role/style maps.
 *
 * @param {Object<string, *>} theme - Projection theme containing ANSI, HTML class, and CSS value mappings.
 * @returns {Object<string, *>} Detached projection-theme object containing copied ANSI, HTML, and CSS maps.
 */
function cloneTheme(theme) {
  return {
    ansi: { ...(theme?.ansi ?? {}) },
    html: { ...(theme?.html ?? {}) },
    css: { ...(theme?.css ?? {}) }
  };
}

/**
 * Merges projection-theme overrides into one detached effective theme.
 *
 * @param {Object<string, *>} base - Base projection theme on which overrides are applied.
 * @param {Object<string, *>|null} overrides - Optional ANSI, HTML class, and CSS overrides supplied by the consumer.
 * @returns {Object<string, *>} New projection theme formed by overlaying supplied role/style maps on the base theme.
 */
function mergeTheme(base, overrides) {
  return {
    ansi: { ...base.ansi, ...(overrides?.ansi ?? {}) },
    html: { ...base.html, ...(overrides?.html ?? {}) },
    css: { ...base.css, ...(overrides?.css ?? {}) }
  };
}

/**
 * Gets the currently configured default projection theme.
 *
 * @returns {Object<string, *>} Detached copy of the currently configured projection theme.
 */
export function getDefaultProjectionTheme() {
  return cloneTheme(configuredTheme);
}

/**
 * Configures process-wide projection-theme defaults.
 *
 * @param {Object<string, *>} overrides - ANSI, HTML class, or CSS role overrides to merge with the current default theme.
 * @returns {Object<string, *>} Detached copy of the newly configured projection theme.
 */
export function configureProjectionTheme(overrides = {}) {
  configuredTheme = mergeTheme(configuredTheme, overrides);
  return getDefaultProjectionTheme();
}

/**
 * Resets the process-wide projection theme to built-in defaults.
 *
 * @returns {Object<string, *>} Detached copy of the restored built-in projection theme.
 */
export function resetProjectionTheme() {
  configuredTheme = cloneTheme(DEFAULT_THEME);
  return getDefaultProjectionTheme();
}

/**
 * Resolves one per-call projection theme without mutating configured defaults.
 *
 * @param {Object<string, *>|null} overrides - Optional per-call ANSI, HTML class, and CSS role overrides.
 * @returns {Object<string, *>} New effective projection theme combining configured defaults with per-call overrides.
 */
export function resolveProjectionTheme(overrides = null) {
  return mergeTheme(configuredTheme, overrides);
}
