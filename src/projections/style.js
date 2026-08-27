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

function cloneTheme(theme) {
  return {
    ansi: { ...(theme?.ansi ?? {}) },
    html: { ...(theme?.html ?? {}) }
  };
}

function mergeTheme(base, overrides) {
  return {
    ansi: { ...base.ansi, ...(overrides?.ansi ?? {}) },
    html: { ...base.html, ...(overrides?.html ?? {}) }
  };
}

export function getDefaultProjectionTheme() {
  return cloneTheme(configuredTheme);
}

export function configureProjectionTheme(overrides = {}) {
  configuredTheme = mergeTheme(configuredTheme, overrides);
  return getDefaultProjectionTheme();
}

export function resetProjectionTheme() {
  configuredTheme = cloneTheme(DEFAULT_THEME);
  return getDefaultProjectionTheme();
}

export function resolveProjectionTheme(overrides = null) {
  return mergeTheme(configuredTheme, overrides);
}
