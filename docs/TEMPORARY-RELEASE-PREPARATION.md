# Temporary AICC release preparation

This is a temporary GitHub Actions bridge for release preparation until
RepoWorkflow (RWF) owns the same operation. Remove the workflow, trigger
file, and corresponding test exception together at migration.

## Why there are three version-bearing files

AICC release preparation updates three **separate committed outputs**:

| File | Responsibility |
| --- | --- |
| `package.json` | Authoritative Node package metadata. Its `version` describes the released Core API/library. |
| `package-lock.json` | Dependency lock and reproducible npm installation metadata. Its root and top-level package version must match `package.json`. |
| `dist/aiconversationcore.chatgpt.browser.js` | Generated, self-contained browser distribution consumed by DC and other classic-script clients. Its embedded `VERSION` must match the package metadata. |

These are **not three independent versions**. A release must keep all three
synchronized. Do not manually edit generated browser code: the release script
rebuilds it from authoritative source. Consumers pin the generated artifact by
commit and verify its identity; changing the bundle changes that evidence.

## Trigger file: .ci/aicc-release-prepare

The file contains exactly one request on its first line:

```text
1.1.1 # 3
```

- Text **before** `#` is the target plain semantic version, `MAJOR.MINOR.PATCH`.
- The `#` and **everything after it** are ignored by the workflow parser.
  Conventionally that suffix is the retry count.
- Change the retry count and commit/push the file to request another run for
  the same version. The contents are not executable code.
- The workflow rejects empty or malformed versions.
- Preparation is restricted to `issue-*` branches, not `main`.

## Workflow and sequence

The temporary workflow is
`.github/workflows/aicc-release-prepare.yml`.

On a push that changes the request file (or manual workflow dispatch),
GitHub Actions checks out the issue branch with submodules, installs Node 22,
parses the version before `#`, and runs in Bash:

```bash
npm ci
npm run release:prepare -- "<requested-version>"
```

The repository's existing `scripts/prepare-release.mjs` does the substantive
work: verifies a clean checkout and an available stable tag name, updates both
JSON version files, regenerates the browser bundle, verifies the embedded
version, runs the Node tests, stages precisely those three files, then commits
and pushes the prepared release back to that issue branch.

The script **does not merge** into `main` or create the final stable tag.
After its successful run, review the new commit SHA, hosted CI, and downstream
artifact pins before an authorized merge. GitHub's RWF CI and this temporary
workflow are different checks; the release-preparation workflow does not
silently convert a failed CI result into PASS.

## Removal when migrated to RWF

Delete `.ci/aicc-release-prepare` and
`.github/workflows/aicc-release-prepare.yml`, remove the temporary allowance
in `tests/repoworkflow-adoption.test.js`, and replace the release bridge with
the tested RWF mechanism. Preserve release-version invariants and avoid
running two competing preparation workflows.
