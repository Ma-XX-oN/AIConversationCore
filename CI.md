# CI request and result contract

This repository uses an explicit CI request instead of running expensive validation on every development push.

## Development cycle

1. Work on an issue branch using `x.y.z-issue.<issue>.<iteration>`.
2. Make ordinary source/documentation commits without requesting CI.
3. Run focused/local checks while developing.
4. When the candidate is ready, set `.ci/run-ci-request` to the exact authoritative development version and push that change.
5. GitHub Actions validates the exact requested commit.

Authoritative version source: `package.json`.

## Local validation

The same repository-owned contract used by Actions is available locally:

```text
python scripts/ci_contract.py preflight
python scripts/ci_contract.py matrix
python scripts/ci_contract.py run --environment <environment-id> --result <outside-repo-result.json>
```

The working tree must be a clean checkout before validation starts. Store result JSON outside the repository so finalization can also assert a clean checkout. Results record the exact commit/version plus actual OS/runtime probes.

Required environment: `ubuntu-node22-python313` (Ubuntu, Node 22, Python 3.13). The committed declaration is `.ci/test-matrix.json`; every required entry must report for the same commit/version before any result tag is permitted.

To aggregate result files collected from required machines/VMs/runners:

```text
python scripts/ci_contract.py finalize --results-dir <results-directory>
```

Adding `--tag` authorizes tag creation only after matrix completeness is proven. It never bypasses a missing required environment. `--push` additionally publishes that tag and requires `--tag`.

## Result semantics

- **PASS**: every required environment reported and all required validation passed. With `--tag`, create `v<version>`.
- **FAIL**: every required environment reported, at least one genuine validation gate failed, and no required gate was incomplete. With `--tag`, create `v<version>-CI-FAIL`.
- **INCOMPLETE**: a required environment/result is absent or a prerequisite such as required network, credentials, or platform availability prevented valid execution. Emit warnings and create no tag.

PASS and CI-FAIL tags are immutable result landmarks. Once either result tag exists for an issue iteration, the opposite result tag cannot be created and source changes require the next issue iteration.

A GitHub runner/service failure is not a source CI failure. Re-run the existing workflow/jobs against the same commit; do not bump the issue iteration merely to retry infrastructure.

## Gate behaviour

Independent validation gates continue after another independent gate fails, so one RED does not hide the remaining initial failure surface. A prerequisite failure stops dependent gates and produces INCOMPLETE. A source-defined setup failure is a genuine FAIL and stops gates that depend on that setup.

GitHub workflows are orchestration only: checkout, runtime setup, invoking `scripts/ci_contract.py`, collecting result artifacts, and final result tagging. Test semantics live in repository files. Validation jobs have read-only repository permission; only finalization may write tags. Repository writes for deterministic generated artifacts, when explicitly required, are a separate narrowly allow-listed exception.
