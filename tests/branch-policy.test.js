import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateBranchPolicy } from '../scripts/branch-policy-lib.mjs';

/**
 * Creates one fixed branch-policy input without deriving expectations from production code.
 *
 * @param {Object<string, *>} overrides - Explicit fixture fields to override.
 * @returns {Object<string, *>} Independent synthetic Git/PR policy fixture.
 */
function policyFixture(overrides = {}) {
  return {
    branch: 'issue-200-example',
    pr_base: 'main',
    declared_parent: 'main',
    umbrella: false,
    allowed_dependency_branches: [],
    merge_commits: [],
    ...overrides
  };
}

test('ordinary issue branch targeting its declared parent is allowed', () => {
  assert.deepEqual(evaluateBranchPolicy(policyFixture()), []);
});

test('ordinary issue branch may merge an update from its declared parent', () => {
  const violations = evaluateBranchPolicy(policyFixture({
    merge_commits: [
      {
        sha: 'merge-parent-update',
        imported_branch: 'main',
        imported_is_ancestor_of_declared_parent: true
      }
    ]
  }));
  assert.deepEqual(violations, []);
});

test('ordinary issue branch rejects unrelated imported history', () => {
  const violations = evaluateBranchPolicy(policyFixture({
    merge_commits: [
      {
        sha: 'merge-unrelated',
        imported_branch: 'issue-999-unrelated',
        imported_is_ancestor_of_declared_parent: false
      }
    ]
  }));
  assert.deepEqual(violations, [
    'merge merge-unrelated imports undeclared branch issue-999-unrelated'
  ]);
});

test('umbrella branch accepts only explicitly declared dependency branches', () => {
  const allowed = evaluateBranchPolicy(policyFixture({
    branch: 'issue-300-umbrella',
    umbrella: true,
    allowed_dependency_branches: ['issue-301-child'],
    merge_commits: [
      {
        sha: 'merge-child',
        imported_branch: 'issue-301-child',
        imported_is_ancestor_of_declared_parent: false
      }
    ]
  }));
  assert.deepEqual(allowed, []);

  const rejected = evaluateBranchPolicy(policyFixture({
    branch: 'issue-300-umbrella',
    umbrella: true,
    allowed_dependency_branches: ['issue-301-child'],
    merge_commits: [
      {
        sha: 'merge-stray',
        imported_branch: 'issue-999-stray',
        imported_is_ancestor_of_declared_parent: false
      }
    ]
  }));
  assert.deepEqual(rejected, [
    'merge merge-stray imports undeclared branch issue-999-stray'
  ]);
});

test('pull request must return to the declared parent branch', () => {
  const violations = evaluateBranchPolicy(policyFixture({
    pr_base: 'feature/other-line'
  }));
  assert.deepEqual(violations, [
    'pull request base feature/other-line does not match declared parent main'
  ]);
});
