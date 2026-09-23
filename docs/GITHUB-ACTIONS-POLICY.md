# GitHub Actions Policy

GitHub Actions in AIConversationCore exist to validate repository state and to
publish narrowly defined generated artifacts or immutable result tags.  They are
not a remote editor for production source, tests, or documentation.

## Permanent workflow set

Maintained repository lines may contain only these workflow paths:

- `.github/workflows/ci.yml` — repository validation and result-tag publication.
- `.github/workflows/build-browser-artifact.yml` — deterministic publication of
  `dist/aiconversationcore.chatgpt.browser.js` only.
- `.github/workflows/branch-policy.yml` — read-only branch/dependency validation.
- `.github/workflows/phase8-validation.yml` — read-only integration validation.

`ci.yml` is required.  The other workflows are optional on lineages where their
specific responsibility exists.

Issue-specific, temporary, migration, repair, patch, instrumentation, apply, or
other one-shot workflows are prohibited.  Development changes must be made
through a normal checked-out working tree or the GitHub repository API/connector,
not by an Action that rewrites and commits project files.

## Repository-write exceptions

Repository write permission is restricted to two mechanisms:

1. `ci.yml` may publish the tested result tag only through
   `python scripts/ci_contract.py finalize ... --tag --push`.  It must not run
   direct `git add`, `git commit`, or `git push` commands.
2. `build-browser-artifact.yml` may rebuild, stage, commit, and push only
   `dist/aiconversationcore.chatgpt.browser.js`.  The workflow must reject any
   other working-tree mutation and verify that the staged path is exactly that
   generated artifact before committing.

The browser-artifact workflow defaults to read-only permission.  Its policy job
is read-only, and only the artifact-publication job receives `contents: write`
after the policy job succeeds.

## Enforcement

`scripts/check-actions-policy.mjs` enforces the workflow allow-list and the
write-path restrictions.  `tests/actions-policy.test.js` provides positive and
negative regression coverage against both synthetic counterexamples and the
actual checked-out workflow set.

The browser-artifact workflow is triggered by changes under
`.github/workflows/**` and runs the policy regression before its write-capable
job.  The request-gated CI path also runs the policy regression before
validation.  `npm test` discovers the policy regression as part of the normal
repository test suite.

An in-repository check cannot prevent GitHub from registering or scheduling a
new unauthorized workflow from the same commit before another workflow reports
the policy failure.  The repository guard therefore makes the violation visible
and blocks the maintained write paths, while review/ruleset controls remain the
only way to preclude that first scheduling event entirely.

Historical workflow runs are separate GitHub Actions metadata.  Purging obsolete
run history does not rewrite Git history or change commit SHAs.
