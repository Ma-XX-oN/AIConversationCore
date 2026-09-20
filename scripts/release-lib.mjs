const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const BUNDLE_VERSION_PATTERN = /\bconst VERSION = ("(?:\\.|[^"\\])*");/g;

/**
 * Validates and returns one plain semantic release version.
 *
 * @param {string} value - Requested release version without a leading `v`.
 * @returns {string} The validated plain semantic version.
 */
export function parseReleaseVersion(value) {
  if (typeof value !== 'string' || !RELEASE_VERSION_PATTERN.test(value)) {
    throw new Error('Release version must be a plain semantic version such as 1.2.3.');
  }
  return value;
}

/**
 * Builds the immutable release plan used by the release script and its tests.
 *
 * @param {string} version - Requested plain semantic release version.
 * @param {string} branch - Current release branch name.
 * @returns {Object<string, *>} Release paths, commit/tag identities, and atomic push arguments.
 */
export function buildReleasePlan(version, branch) {
  const releaseVersion = parseReleaseVersion(version);
  if (typeof branch !== 'string' || !branch.trim() || branch !== branch.trim() || /\s/.test(branch)) {
    throw new Error('Release branch must be a non-empty branch name without whitespace.');
  }
  const tag = `v${releaseVersion}`;
  return {
    version: releaseVersion,
    tag,
    branch,
    commitMessage: `release: ${tag}`,
    tagMessage: `AIConversationCore ${tag}`,
    stagedPaths: [
      'package.json',
      'dist/aiconversationcore.chatgpt.browser.js'
    ],
    pushArgs: [
      'push',
      '--atomic',
      'origin',
      `HEAD:${branch}`,
      `refs/tags/${tag}`
    ]
  };
}

/**
 * Returns package.json text with exactly the requested release version.
 *
 * @param {string} packageText - Existing package.json source text.
 * @param {string} version - Requested plain semantic release version.
 * @returns {string} Canonically formatted package.json text ending in one newline.
 */
export function packageTextWithVersion(packageText, version) {
  const releaseVersion = parseReleaseVersion(version);
  const metadata = JSON.parse(packageText);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('package.json must contain a JSON object.');
  }
  metadata.version = releaseVersion;
  return `${JSON.stringify(metadata, null, 2)}\n`;
}

/**
 * Extracts the single generated browser-bundle version declaration.
 *
 * @param {string} bundle - Generated browser bundle source text.
 * @returns {string} Embedded browser-bundle semantic version.
 */
export function browserBundleVersion(bundle) {
  const matches = [...String(bundle).matchAll(BUNDLE_VERSION_PATTERN)];
  if (matches.length !== 1) {
    throw new Error('Generated browser bundle must contain exactly one generated VERSION declaration.');
  }
  return JSON.parse(matches[0][1]);
}

/**
 * Requires the generated browser bundle to report the requested release version.
 *
 * @param {string} bundle - Generated browser bundle source text.
 * @param {string} version - Requested plain semantic release version.
 * @returns {void}
 */
export function assertBundleVersion(bundle, version) {
  const releaseVersion = parseReleaseVersion(version);
  const embedded = browserBundleVersion(bundle);
  if (embedded !== releaseVersion) {
    throw new Error(`Generated browser bundle version ${embedded} does not match release version ${releaseVersion}.`);
  }
}
