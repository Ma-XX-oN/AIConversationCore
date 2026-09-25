import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { buildBrowserBundle } from './build-browser-bundle.mjs';
import {
  assertBundleVersion,
  assertPackageLockVersion,
  assertPackageVersion,
  buildReleasePlan,
  parseReleaseVersion
} from './release-lib.mjs';
import {
  RELEASE_ROOT,
  assertCleanWorkingTree,
  currentBranch,
  git,
  localTagExists,
  remoteTagExists,
  run
} from './release-ops.mjs';

/** Authoritative package/version source. */
const PACKAGE_PATH = resolve(RELEASE_ROOT, 'package.json');
/** npm lock metadata that mirrors the authoritative package version. */
const PACKAGE_LOCK_PATH = resolve(RELEASE_ROOT, 'package-lock.json');
/** Committed deterministic browser artifact. */
const BUNDLE_PATH = resolve(RELEASE_ROOT, 'dist/aiconversationcore.chatgpt.browser.js');

/**
 * Verifies the post-merge main commit, creates/reuses the exact local release tag, and publishes it atomically.
 *
 * @param {string} requestedVersion - Requested plain semantic release version.
 * @returns {Promise<void>}
 */
async function publishRelease(requestedVersion) {
  const version = parseReleaseVersion(requestedVersion);
  const plan = buildReleasePlan(version, currentBranch());

  assertCleanWorkingTree();
  git(['fetch', 'origin', 'main', '--tags', '--prune']);

  const head = git(['rev-parse', 'HEAD'], true).trim();
  const originMain = git(['rev-parse', 'origin/main'], true).trim();
  if (head !== originMain) {
    throw new Error(`Release requires local main HEAD ${head} to equal origin/main ${originMain}.`);
  }

  if (remoteTagExists(plan.tag)) {
    throw new Error(`Release tag ${plan.tag} already exists on origin.`);
  }

  const packageText = await readFile(PACKAGE_PATH, 'utf8');
  const lockText = await readFile(PACKAGE_LOCK_PATH, 'utf8');
  assertPackageVersion(packageText, version);
  assertPackageLockVersion(lockText, version);

  const bundle = await readFile(BUNDLE_PATH, 'utf8');
  assertBundleVersion(bundle, version);
  const rebuilt = await buildBrowserBundle();
  if (bundle !== rebuilt) {
    throw new Error('Committed browser bundle does not exactly match the deterministic builder output.');
  }

  run(process.execPath, ['--test']);
  assertCleanWorkingTree();

  if (localTagExists(plan.tag)) {
    const localTarget = git(['rev-list', '-n', '1', plan.tag], true).trim();
    if (localTarget !== head) {
      throw new Error(`Existing local tag ${plan.tag} points to ${localTarget}, not verified main ${head}.`);
    }
  } else {
    git(['tag', '-a', plan.tag, '-m', plan.tagMessage]);
  }

  const tagTarget = git(['rev-list', '-n', '1', plan.tag], true).trim();
  if (tagTarget !== head) {
    throw new Error(`Release tag ${plan.tag} does not point to verified main ${head}.`);
  }

  git(plan.pushArgs);
  console.log(`Published ${plan.tag} on merged main commit ${head}.`);
}

/** Requested release version supplied on the command line. */
const requestedVersion = process.argv[2];
if (!requestedVersion || process.argv.length !== 3) {
  console.error('Usage: npm run release -- <version>');
  process.exitCode = 2;
} else {
  try {
    await publishRelease(requestedVersion);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
