import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/** Repository root for release validation and mutation. */
export const RELEASE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Executes one child process in the repository and returns its completed result.
 *
 * @param {string} command - Executable to run.
 * @param {Array<string>} args - Exact argument vector.
 * @param {boolean} capture - Whether stdout/stderr should be captured instead of inherited.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} Completed child-process result.
 */
export function commandResult(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: RELEASE_ROOT,
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
export function run(command, args, capture = false) {
  const result = commandResult(command, args, capture);
  if (result.status !== 0) {
    const detail = capture ? `\n${result.stderr || result.stdout || ''}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}.${detail}`);
  }
  return capture ? result.stdout : '';
}

/**
 * Executes one required-success Git command.
 *
 * @param {Array<string>} args - Exact Git argument vector.
 * @param {boolean} capture - Whether stdout should be returned.
 * @returns {string} Captured stdout, or an empty string for inherited output.
 */
export function git(args, capture = false) {
  return run('git', args, capture);
}

/**
 * Splits Git path-list output into stable repository-relative paths.
 *
 * @param {string} output - Newline-delimited Git path output.
 * @returns {Array<string>} Non-empty repository-relative paths in output order.
 */
export function pathList(output) {
  return output.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}

/**
 * Requires two path lists to contain the same entries.
 *
 * @param {Array<string>} actual - Actual repository-relative paths.
 * @param {Array<string>} expected - Expected repository-relative paths.
 * @param {string} label - Failure-context label.
 * @returns {void}
 */
export function assertPaths(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${label}: expected ${right.join(', ')}, found ${left.join(', ') || '(none)'}.`);
  }
}

/**
 * Requires the repository working tree and index to be clean.
 *
 * @returns {void}
 */
export function assertCleanWorkingTree() {
  const status = git(['status', '--porcelain=v1', '--untracked-files=all'], true);
  if (status.trim()) {
    throw new Error('Release operation requires a completely clean working tree.');
  }
}

/**
 * Returns the current named Git branch and rejects detached HEAD.
 *
 * @returns {string} Current branch name.
 */
export function currentBranch() {
  const branch = git(['branch', '--show-current'], true).trim();
  if (!branch) throw new Error('Release operation requires a named branch; detached HEAD is not allowed.');
  return branch;
}

/**
 * Returns whether a local tag ref exists.
 *
 * @param {string} tag - Release tag name.
 * @returns {boolean} Whether the local tag exists.
 */
export function localTagExists(tag) {
  const result = commandResult('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`], true);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(`Could not determine whether local tag ${tag} exists.`);
}

/**
 * Returns whether a tag already exists on origin.
 *
 * @param {string} tag - Release tag name.
 * @returns {boolean} Whether the remote tag exists.
 */
export function remoteTagExists(tag) {
  const result = commandResult(
    'git',
    ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`],
    true
  );
  if (result.status === 0) return true;
  if (result.status === 2) return false;
  throw new Error(`Could not determine whether origin tag ${tag} exists: ${result.stderr || result.stdout || ''}`);
}

/**
 * Requires a release tag to be absent locally and on origin.
 *
 * @param {string} tag - Release tag name.
 * @returns {void}
 */
export function assertTagAbsent(tag) {
  if (localTagExists(tag)) throw new Error(`Release tag ${tag} already exists locally.`);
  if (remoteTagExists(tag)) throw new Error(`Release tag ${tag} already exists on origin.`);
}
