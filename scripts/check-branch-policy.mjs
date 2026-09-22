import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { evaluateBranchPolicy } from './branch-policy-lib.mjs';

const root = process.cwd();
const configPath = path.join(root, '.github', 'branch-policy.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * Executes Git and returns trimmed stdout.
 *
 * @param {string[]} args - Git arguments.
 * @returns {string} Trimmed standard output.
 */
function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

/**
 * Returns whether one commit is an ancestor of another ref.
 *
 * @param {string} ancestor - Candidate ancestor commit.
 * @param {string} descendant - Candidate descendant ref/commit.
 * @returns {boolean} True when Git establishes the ancestry relation.
 */
function isAncestor(ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: root,
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds a stable branch label for an imported merge parent.
 *
 * @param {string} importedSha - Imported parent commit SHA.
 * @param {string[]} declaredDependencies - Allowed dependency branch names.
 * @returns {string} Declared dependency name when matched, otherwise a remote label/SHA.
 */
function importedBranchLabel(importedSha, declaredDependencies) {
  for (const dependency of declaredDependencies) {
    if (isAncestor(importedSha, `origin/${dependency}`)) {
      return dependency;
    }
  }

  const containing = git([
    'branch', '-r', '--contains', importedSha, '--format=%(refname:short)'
  ]).split(/\r?\n/).filter(Boolean);
  const preferred = containing.find((name) => name.startsWith('origin/'));
  return preferred ? preferred.slice('origin/'.length) : importedSha;
}

const branch = process.env.BRANCH_POLICY_BRANCH
  || process.env.GITHUB_HEAD_REF
  || process.env.GITHUB_REF_NAME
  || git(['rev-parse', '--abbrev-ref', 'HEAD']);
const branchConfig = config.branches?.[branch] ?? {};
const declaredParent = branchConfig.parent ?? config.default_parent;
const allowedDependencies = branchConfig.allowed_dependencies ?? [];
const prBase = process.env.BRANCH_POLICY_PR_BASE || process.env.GITHUB_BASE_REF || null;
const headSha = process.env.BRANCH_POLICY_HEAD_SHA || git(['rev-parse', 'HEAD']);
const parentRef = `origin/${declaredParent}`;
const mergeBase = git(['merge-base', headSha, parentRef]);
const mergeLines = git([
  'rev-list', '--reverse', '--merges', '--parents', `${mergeBase}..${headSha}`
]);
const mergeCommits = [];

for (const line of mergeLines.split(/\r?\n/).filter(Boolean)) {
  const [sha, firstParent, ...importedParents] = line.trim().split(/\s+/);
  void firstParent;
  for (const importedSha of importedParents) {
    mergeCommits.push({
      sha,
      imported_sha: importedSha,
      imported_branch: importedBranchLabel(importedSha, allowedDependencies),
      imported_is_ancestor_of_declared_parent: isAncestor(importedSha, parentRef)
    });
  }
}

const violations = evaluateBranchPolicy({
  branch,
  declared_parent: declaredParent,
  pr_base: prBase,
  umbrella: branchConfig.umbrella === true,
  allowed_dependency_branches: allowedDependencies,
  merge_commits: mergeCommits
});

if (violations.length > 0) {
  process.stderr.write(`Branch policy failed for ${branch}:\n`);
  for (const violation of violations) {
    process.stderr.write(`- ${violation}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Branch policy passed: ${branch} -> ${declaredParent}; `
  + `${mergeCommits.length} imported merge parent(s) checked.\n`
);
