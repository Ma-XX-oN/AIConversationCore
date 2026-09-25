/**
 * Normalizes an optional list-valued policy field to an array.
 *
 * @param {*} value - Candidate policy value supplied by parsed configuration/input.
 * @returns {Array<*>} The original array, or an empty array when the value is not an array.
 */
const normalizeList = (value) => Array.isArray(value) ? value : [];

/**
 * Evaluates one branch against the repository's declared parent/dependency policy.
 * The caller supplies already-established Git ancestry facts so this function stays
 * deterministic and independently testable.
 *
 * @param {Object<string, *>} input - Branch policy facts established by the caller.
 * @returns {string[]} Human-readable policy violations; empty means policy-compliant.
 */
export function evaluateBranchPolicy(input) {
  const branch = String(input?.branch ?? '');
  const declaredParent = String(input?.declared_parent ?? '');
  const prBase = input?.pr_base == null ? null : String(input.pr_base);
  const allowedDependencies = new Set(normalizeList(input?.allowed_dependency_branches));
  const mergeCommits = normalizeList(input?.merge_commits);
  const violations = [];

  if (!branch) {
    violations.push('branch name is required');
  }
  if (!declaredParent) {
    violations.push('declared parent branch is required');
  }
  if (prBase && declaredParent && prBase !== declaredParent) {
    violations.push(`pull request base ${prBase} does not match declared parent ${declaredParent}`);
  }

  for (const merge of mergeCommits) {
    if (merge?.imported_is_ancestor_of_declared_parent === true) {
      continue;
    }
    const importedBranch = String(merge?.imported_branch ?? merge?.imported_sha ?? 'unknown');
    if (allowedDependencies.has(importedBranch)) {
      continue;
    }
    violations.push(`merge ${String(merge?.sha ?? 'unknown')} imports undeclared branch ${importedBranch}`);
  }

  return violations;
}
