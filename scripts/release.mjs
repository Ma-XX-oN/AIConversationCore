import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  assertBundleVersion,
  buildReleasePlan,
  packageTextWithVersion,
  parseReleaseVersion
} from './release-lib.mjs';

/** Repository root for release validation and mutation. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Authoritative package/version source. */
const PACKAGE_PATH = resolve(ROOT, 'package.json');
/** Committed deterministic browser artifact. */
const BUNDLE_PATH = resolve(ROOT, 'dist/aiconversationcore.chatgpt.browser.js');

/**
 * Executes one child process in the repository and returns its completed result.
 *
 * @param {string} command - Executable to run.
 * @param {Array<string>} args - Exact argument vector.
 * @param {boolean} capture - Whether stdout/stderr should be captured instead of inherited.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} Completed child-process result.
 */
function commandResult(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit'
  });
  if (result.error) throw result.error;
  return result;
}

/**
 * Executes one required-success command and returns captured stdout when requested.
 *
 * @param {string} command - Executable to run.
 * @param {Array<string>} args - Exact argument vector.
 * @param {boolean} capture - Whether stdout should be returned.
 * @returns {string} Captured stdout, or an empty string for inherited output.
 */
function run(command, args, capture = false) {
  const result = commandResult(command, args, capture);
  if (result.status !== 0) {
    const detail = capture ? `\n${result.stderr || result.stdout || ''}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}.${detail}`);
  }
  return capture ? result.stdout : '';
}

/**
 * Executes a required-success Git command.
 *
 * @param {Array<string>} args - Exact Git argument vector.
 * @param {boolean} capture - Whether stdout should be returned.
 * @returns {string} Captured stdout, or an empty string for inherited output.
 */
function git(args, capture = false) {
  return run('git', args, capture);
}

/**
 * Splits Git path-list output into stable repository-relative paths.
 *
 * @param {string} output - Newline-delimited Git path output.
 * @returns {Array<string>} Non-empty repository-relative paths in output order.
 */
function pathList(output) {
  return output.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}

/**
 * Requires two path lists to contain the same entries in the same order.
 *
 * @param {Array<string>} actual - Actual repository-relative paths.
 * @param {Array<string>} expected - Expected repository-relative paths.
 * @param {string} label - Failure-context label.
 * @returns {void}
 */
function assertPaths(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${label}: expected ${right.join(', ')}, found ${left.join(', ') || '(none)'}.`);
  }
}

/**
 * Requires that the requested release tag is absent both locally and on origin.
 *
 * @param {string} tag - Annotated release tag name.
 * @returns {void}
 */
function assertTagAbsent(tag) {
  const ref = `refs/tags/${tag}`;
  const local = commandResult('git', ['show-ref', '--verify', '--quiet', ref], true);
  if (local.status === 0) throw new Error(`Release tag ${tag} already exists locally.`);
  if (local.status !== 1) throw new Error(`Could not determine whether local tag ${tag} exists.`);

  const remote = commandResult(
    'git',
    ['ls-remote', '--exit-code', '--tags', 'origin', ref],
    true
  );
  if (remote.status === 0) throw new Error(`Release tag ${tag} already exists on origin.`);
  if (remote.status !== 2) {
    throw new Error(`Could not determine whether origin tag ${tag} exists: ${remote.stderr || remote.stdout || ''}`);
  }
}

/**
 * Publishes one versioned Core browser artifact, release commit, and matching tag atomically.
 *
 * @param {string} requestedVersion - Requested plain semantic release version.
 * @returns {Promise<void>}
 */
async function release(requestedVersion) {
  const version = parseReleaseVersion(requestedVersion);
  const branch = git(['branch', '--show-current'], true).trim();
  if (!branch) throw new Error('Release requires a named branch; detached HEAD is not allowed.');
  const plan = buildReleasePlan(version, branch);

  const initialStatus = git(['status', '--porcelain=v1', '--untracked-files=all'], true);
  if (initialStatus.trim()) {
    throw new Error('Release requires a completely clean working tree before version/build mutation.');
  }

  git(['fetch', 'origin', '--tags', '--prune']);
  assertTagAbsent(plan.tag);

  const packageText = await readFile(PACKAGE_PATH, 'utf8');
  await writeFile(PACKAGE_PATH, packageTextWithVersion(packageText, version), 'utf8');

  run(process.execPath, ['scripts/build-browser-bundle.mjs']);
  const bundle = await readFile(BUNDLE_PATH, 'utf8');
  assertBundleVersion(bundle, version);

  run(process.execPath, ['--test']);

  const changed = pathList(git(['diff', '--name-only', '--'], true));
  assertPaths(changed, plan.stagedPaths, 'Release changed-path invariant failed');

  git(['add', '--', ...plan.stagedPaths]);
  const staged = pathList(git(['diff', '--cached', '--name-only', '--'], true));
  assertPaths(staged, plan.stagedPaths, 'Release staged-path invariant failed');

  git(['commit', '-m', plan.commitMessage]);
  git(['tag', '-a', plan.tag, '-m', plan.tagMessage]);

  const head = git(['rev-parse', 'HEAD'], true).trim();
  const tagTarget = git(['rev-list', '-n', '1', plan.tag], true).trim();
  if (tagTarget !== head) {
    throw new Error(`Release tag ${plan.tag} does not point to the release commit ${head}.`);
  }

  git(plan.pushArgs);
  console.log(`Published ${plan.tag} from ${branch} at ${head}.`);
}

const requestedVersion = process.argv[2];
if (!requestedVersion || process.argv.length !== 3) {
  console.error('Usage: npm run release -- <version>');
  process.exitCode = 2;
} else {
  try {
    await release(requestedVersion);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
