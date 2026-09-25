// Plain semantic version accepted for stable releases.
const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
// Browser-bundle VERSION declaration used for release verification.
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
 * Requires a valid non-empty Git branch name without whitespace.
 *
 * @param {string} branch - Current branch name.
 * @returns {string} The validated branch name.
 */
function validatedBranch(branch) {
  if (typeof branch !== 'string' || !branch.trim() || branch !== branch.trim() || /\s/.test(branch)) {
    throw new Error('Release branch must be a non-empty branch name without whitespace.');
  }
  return branch;
}

/**
 * Builds the stable-version preparation plan for an issue-owned branch.
 *
 * @param {string} version - Requested plain semantic release version.
 * @param {string} branch - Current issue-owned development branch.
 * @returns {Object<string, *>} Exact release-preparation commit/staging/push plan.
 */
export function buildPreparePlan(version, branch) {
  const releaseVersion = parseReleaseVersion(version);
  const releaseBranch = validatedBranch(branch);
  if (!/^issue-\d+-/.test(releaseBranch)) {
    throw new Error('Release preparation must run on an issue branch.');
  }
  return {
    version: releaseVersion,
    branch: releaseBranch,
    commitMessage: `release: prepare v${releaseVersion}`,
    stagedPaths: [
      'package.json',
      'dist/aiconversationcore.chatgpt.browser.js'
    ],
    pushArgs: [
      'push',
      'origin',
      `HEAD:${releaseBranch}`
    ]
  };
}

/**
 * Builds the post-merge stable-tag publication plan.
 *
 * @param {string} version - Requested plain semantic release version.
 * @param {string} branch - Current branch, which must be `main`.
 * @returns {Object<string, *>} Exact annotated-tag identity and atomic push plan.
 */
export function buildReleasePlan(version, branch) {
  const releaseVersion = parseReleaseVersion(version);
  const releaseBranch = validatedBranch(branch);
  if (releaseBranch !== 'main') {
    throw new Error('Final release tagging must run on main after the issue is closed and merged.');
  }
  const tag = `v${releaseVersion}`;
  return {
    version: releaseVersion,
    tag,
    branch: releaseBranch,
    tagMessage: `AIConversationCore ${tag}`,
    pushArgs: [
      'push',
      '--atomic',
      'origin',
      'HEAD:main',
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
 * Requires package.json to report the requested release version.
 *
 * @param {string} packageText - package.json source text.
 * @param {string} version - Requested plain semantic release version.
 * @returns {void}
 */
export function assertPackageVersion(packageText, version) {
  const releaseVersion = parseReleaseVersion(version);
  const metadata = JSON.parse(packageText);
  const actual = metadata?.version;
  if (actual !== releaseVersion) {
    throw new Error(`package version ${actual ?? '(missing)'} does not match release version ${releaseVersion}.`);
  }
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
