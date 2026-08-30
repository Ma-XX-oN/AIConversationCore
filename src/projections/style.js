export const STYLE_ROLES = Object.freeze({
  USER_HEADING: 'user-heading',
  ASSISTANT_HEADING: 'assistant-heading',
  TIMESTAMP: 'timestamp',
  RECORD_NUMBER: 'record-number',
  TURN_ID: 'turn-id'
});

const DEFAULT_THEME = Object.freeze({
  ansi: Object.freeze({
    [STYLE_ROLES.USER_HEADING]: '\u001b[33m',
    [STYLE_ROLES.ASSISTANT_HEADING]: '\u001b[32m',
    [STYLE_ROLES.TIMESTAMP]: '\u001b[36m',
    [STYLE_ROLES.RECORD_NUMBER]: '\u001b[2m',
    [STYLE_ROLES.TURN_ID]: '\u001b[35m',
    reset: '\u001b[0m'
  }),
  html: Object.freeze({
    [STYLE_ROLES.USER_HEADING]: 'transcript-user-heading',
    [STYLE_ROLES.ASSISTANT_HEADING]: 'transcript-assistant-heading',
    [STYLE_ROLES.TIMESTAMP]: 'transcript-timestamp',
    [STYLE_ROLES.RECORD_NUMBER]: 'transcript-record-number',
    [STYLE_ROLES.TURN_ID]: 'transcript-turn-id'
  })
});

let configuredTheme = cloneTheme(DEFAULT_THEME);

/**
 * Handles clone theme.
  *
 * @param {Object} theme - The theme value used by this operation.
 * @returns {void} No value is returned.
 */
function cloneTheme(theme) {
  return {
    ansi: { ...(theme?.ansi ?? {}) },
    html: { ...(theme?.html ?? {}) }
  };
}

/**
 * Handles merge theme.
  *
 * @param {Object} base - The base value used by this operation.
 * @param {Object} overrides - The overrides value used by this operation.
 * @returns {void} No value is returned.
 */
function mergeTheme(base, overrides) {
  return {
    ansi: { ...base.ansi, ...(overrides?.ansi ?? {}) },
    html: { ...base.html, ...(overrides?.html ?? {}) }
  };
}

/**
 * Gets default projection theme.
  *
 * @returns {Object|null} The value produced by `getDefaultProjectionTheme`, or `null` when no value is available.
 */
export function getDefaultProjectionTheme() {
  return cloneTheme(configuredTheme);
}

/**
 * Configures projection theme.
  *
 * @param {Object} overrides - The overrides value used by this operation.
 * @returns {void} No value is returned.
 */
export function configureProjectionTheme(overrides = {}) {
  configuredTheme = mergeTheme(configuredTheme, overrides);
  return getDefaultProjectionTheme();
}

/**
 * Resets projection theme.
  *
 * @returns {void} No value is returned.
 */
export function resetProjectionTheme() {
  configuredTheme = cloneTheme(DEFAULT_THEME);
  return getDefaultProjectionTheme();
}

/**
 * Handles resolve projection theme.
  *
 * @param {Object|null} overrides - The overrides value used by this operation.
 * @returns {void} No value is returned.
 */
export function resolveProjectionTheme(overrides = null) {
  return mergeTheme(configuredTheme, overrides);
}
