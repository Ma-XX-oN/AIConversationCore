# Branching and Integration

This document defines the durable branch/issue integration contract for AIConversationCore.

## Normal issue lifecycle

The normal parent is `main`.

1. Create or identify the owning issue.
2. Create the issue branch from its declared parent.
3. Record any non-default parent/dependency exception in `.github/branch-policy.json` before importing that history.
4. Establish the required RED regression before production correction for behavioural work.
5. Implement only issue-owned changes plus explicitly declared dependencies.
6. Run the complete applicable Core gate.
7. When external/browser acceptance is required, tag the exact verified issue-branch commit so the user tests the exact code that passed CI.
8. After acceptance, merge the issue branch back into the same parent it branched from.
9. Re-verify the integrated parent when required by the issue/test contract.

A later stable/mainline publication is distinct from the external-testing tag. Do not delay user acceptance testing merely because an issue branch is not yet merged to `main`.

## Parent-branch invariant

Every issue branch has exactly one declared parent.

- Default parent: `main`.
- A child of an explicit umbrella branch declares that umbrella branch as its parent.
- A compatibility branch from an exact historical/pinned commit must document that special parent lineage and return its completed work to the lineage it branched from.
- An issue branch must not silently become the parent of future unrelated work.

The PR base must equal the declared parent.

## Dependency imports

An issue branch may import:

- updates already present on its declared parent; and
- explicitly declared dependency branches recorded in `.github/branch-policy.json`.

It may not import unrelated issue histories merely because another repository currently pins them or because doing so is convenient for testing.

The permanent Branch policy workflow checks merge ancestry on issue/feature pushes and pull requests. `scripts/check-branch-policy.mjs` is the executable policy gate; `scripts/branch-policy-lib.mjs` contains the deterministic policy evaluator covered by unit tests.

## Umbrella/integration branches

An umbrella branch is exceptional and must be explicit.

Its owning issue/configuration must state:

- the umbrella branch name;
- its parent/integration target;
- which child/dependency branches may be imported;
- the completion gate for returning the reconciled work to its parent.

Children branch from the umbrella only when the umbrella issue explicitly owns their shared integration sequence. Completed child work returns to the umbrella, not to an unrelated sibling branch.

An umbrella is temporary integration structure, not a replacement for `main`.

## External-testing tags

A testable release means an exact verified commit that can be consumed externally before merge.

The tag must identify the same semantic/development version embedded in the code/artifact and must point at the exact issue-branch commit that passed the required gate. For development versions, use the project development form `x.y.z-issue.<issue>.<iteration>` and the corresponding `v...` Git tag unless a future explicit release decision changes the tag grammar.

After user acceptance, the branch is merged to its declared parent. Stable/plain-semver publication can be performed separately when that is actually required.

## Generated browser artifact

`dist/aiconversationcore.chatgpt.browser.js` is a committed deterministic generated artifact.

`.github/workflows/build-browser-artifact.yml` is the permanent allowed Actions mutation path for it. The workflow:

- runs the repository browser-bundle generator;
- fails if generation changes any path other than the browser artifact;
- commits/pushes only the browser artifact when it changed;
- does not edit authoritative source or documentation.

All other repository edits are made directly through the normal working tree/GitHub repository editing path, not by self-modifying Actions workflows.

## Reconciliation and supersession

When two historical lines diverge, do not choose a winner by recency or bulk-merge both histories.

Build an evidence map:

1. common verified ancestor;
2. unique responsibilities implemented on each line;
3. issue/CI evidence for each unique change;
4. overlapping changes and which implementation supersedes which, with evidence;
5. exact focused deltas to preserve;
6. downstream consumers that pin each line.

Reconcile onto a clean branch from the authoritative parent by integrating verified responsibilities in dependency order. Re-run Core and every maintained dependent repository against the exact candidate SHA before merging the repair.

## Documentation and navigation

Branch/topology changes must update this document and the owning issue. Semantic/module architecture remains documented in `DESIGN.md` and focused cross-referenced design documents.

Documentation and authoritative source should remain below approximately 500 lines per file. Split focused responsibilities before a file becomes difficult to edit or navigate.
