import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  assertBundleVersion,
  assertPackageLockVersion,
  buildPreparePlan,
  jsonMetadataWithVersion,
  parseReleaseVersion
} from './release-lib.mjs';
import {
  RELEASE_ROOT,
  assertCleanWorkingTree,
  assertPaths,
  assertTagAbsent,
  currentBranch,
  git,
  pathList,
  run
} from './release-ops.mjs';

/** Authoritative package/version source. */
const PACKAGE_PATH = resolve(RELEASE_ROOT, 'package.json');
/** npm lock metadata that mirrors the authoritative package version. */
const PACKAGE_LOCK_PATH = resolve(RELEASE_ROOT, 'package-lock.json');
/** Committed deterministic browser artifact. */
const BUNDLE_PATH = resolve(RELEASE_ROOT, 'dist/aiconversationcore.chatgpt.browser.js');

/**
 * Prepares the stable version and generated artifact on the issue branch without creating a stable tag.
 *
 * @param {string} requestedVersion - Requested plain semantic release version.
 * @returns {Promise<void>}
 */
async function prepareRelease(requestedVersion) {
  const version = parseReleaseVersion(requestedVersion);
  const plan = buildPreparePlan(version, currentBranch());

  assertCleanWorkingTree();
  git(['fetch', 'origin', '--tags', '--prune']);
  assertTagAbsent(`v${version}`);

  const packageText = await readFile(PACKAGE_PATH, 'utf8');
  const lockText = await readFile(PACKAGE_LOCK_PATH, 'utf8');
  await writeFile(PACKAGE_PATH, jsonMetadataWithVersion(packageText, version), 'utf8');
  await writeFile(PACKAGE_LOCK_PATH, jsonMetadataWithVersion(lockText, version), 'utf8');
  assertPackageLockVersion(await readFile(PACKAGE_LOCK_PATH, 'utf8'), version);

  run(process.execPath, ['scripts/build-browser-bundle.mjs']);
  const bundle = await readFile(BUNDLE_PATH, 'utf8');
  assertBundleVersion(bundle, version);

  run(process.execPath, ['--test']);

  const changed = pathList(git(['diff', '--name-only', '--'], true));
  assertPaths(changed, plan.stagedPaths, 'Release preparation changed-path invariant failed');

  git(['add', '--', ...plan.stagedPaths]);
  const staged = pathList(git(['diff', '--cached', '--name-only', '--'], true));
  assertPaths(staged, plan.stagedPaths, 'Release preparation staged-path invariant failed');

  git(['commit', '-m', plan.commitMessage]);
  git(plan.pushArgs);

  const head = git(['rev-parse', 'HEAD'], true).trim();
  console.log(`Prepared v${version} on ${plan.branch} at ${head}.`);
  console.log('No stable tag was created. Close the owning issue, merge to main, then run:');
  console.log(`npm run release -- ${version}`);
}

/** Requested release version supplied on the command line. */
const requestedVersion = process.argv[2];
if (!requestedVersion || process.argv.length !== 3) {
  console.error('Usage: npm run release:prepare -- <version>');
  process.exitCode = 2;
} else {
  try {
    await prepareRelease(requestedVersion);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
