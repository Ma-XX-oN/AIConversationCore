import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { evaluateBranchPolicy } from './branch-policy-lib.mjs';

// Repository root used for policy configuration and Git command execution.
const root = process.cwd();
// Absolute path to the repository-maintained branch policy configuration.
const configPath = path.join(root, '.github', 'branch-policy.json');
// Parsed branch policy configuration used for this invocation.
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

// Branch whose ancestry is being checked, resolved from explicit CI context first.
const branch = process.env.BRANCH_POLICY_BRANCH
  || process.env.GITHUB_HEAD_REF
  || process.env.GITHUB_REF_NAME
  || git(['rev-parse', '--abbrev-ref', 'HEAD']);
// Per-branch policy override, or an empty policy when none is declared.
const branchConfig = config.branches?.[branch] ?? {};
// Declared integration parent for the branch under inspection.
const declaredParent = branchConfig.parent ?? config.default_parent;
// Explicitly allowed dependency branches whose histories may be imported.
const allowedDependencies = branchConfig.allowed_dependencies ?? [];
// Pull-request base supplied by CI when this invocation is validating a PR.
const prBase = process.env.BRANCH_POLICY_PR_BASE || process.env.GITHUB_BASE_REF || null;
// Exact branch head SHA whose merge ancestry is being inspected.
const headSha = process.env.BRANCH_POLICY_HEAD_SHA || git(['rev-parse', 'HEAD']);
// Remote-tracking ref for the declared parent branch.
const parentRef = `origin/${declaredParent}`;
// Common ancestor delimiting the branch-owned commit range.
const mergeBase = git(['merge-base', headSha, parentRef]);
// Merge commits, with parent SHAs, contained in the branch-owned range.
const mergeLines = git([
  'rev-list', '--reverse', '--merges', '--parents', `${mergeBase}..${headSha}`
]);
// Structured imported-parent facts passed into the deterministic policy evaluator.
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

// Final deterministic policy violations established from the collected Git facts.
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
