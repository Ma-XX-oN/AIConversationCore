# GitHub Actions Policy

GitHub Actions in AIConversationCore exist to execute the pinned RepoWorkflow lifecycle. They are not a remote editor for production source, tests, or documentation.

## Permanent workflow set

The maintained repository contains exactly one workflow:

- `.github/workflows/ci.yml` — the byte-for-byte canonical adapter from the pinned `RepoWorkflow/templates/github/ci.yml`.

Additional workflow files are prohibited in steady state. RepoWorkflow's repository-policy gate enforces that invariant before validation or publication.

## Repository writes

Repository write permission is available only inside the canonical RepoWorkflow adapter for two narrow publication boundaries:

1. committing and pushing a declared deterministic generated artifact after its generator and independent verifier pass; and
2. publishing an immutable development result tag or stable release tag after required result aggregation succeeds.

Core source, tests, and documentation are never edited by Actions. The committed browser bundle is the only declared generated artifact and its output path is allow-listed in `.ci/repoworkflow.json`.

## Enforcement

The pinned RepoWorkflow engine enforces the exact workflow set, canonical adapter bytes, branch/dependency policy, explicit development request semantics, artifact output boundaries, exact candidate identity, required result completeness, and immutable terminal tags.

`tests/repoworkflow-adoption.test.js` independently asserts the RepoWorkflow gitlink, Core configuration, canonical adapter identity, single-workflow steady state, and absence of the superseded Core-local generic CI engines and publishers.

Repository-specific validation remains owned by Core through `scripts/repoworkflow-validate.py`. The deterministic browser build remains owned by Core through `scripts/repoworkflow-build-browser.py` and is independently verified by `tests/browser-bundle.test.js`.

Historical workflow runs are GitHub Actions metadata only. Removing superseded workflow definitions from the repository does not rewrite Git history or historical run records.
