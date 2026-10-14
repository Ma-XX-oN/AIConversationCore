# AICC #126 — authenticated provider replay evidence

Verified 14 October 2026 from the user's existing 12 October recordings.
The compressed archives were mounted, decompressed with zstd, and parsed.
Do not publish full archives: they contain private bodies and network tokens.

## Direct successful backend source

- Three completed 200 JSON responses at GET /backend-api/conversations/{id}
  contain conversation_id, title and gizmo_id.
- One completed 200 JSON response at GET /backend-api/gizmos/{id}
  contains gizmo.id and gizmo.display.name.
- The proven subject is conversation "Version provenance design",
  project "Download Conversation". The host had wrongly logged
  "Skip to content" as the conversation name.
- Project detail completed at 21:38:09.846Z, before conversation detail
  completed at 21:38:24.412Z and 21:38:28.494Z.
- The project-conversation list endpoint is NOT a project detail endpoint.
- No standalone gizmo_id:null is witnessed by these particular recordings.

## Provider work

Draft provider PR #4 now has an event-driven network response adapter
and tests. It validates same-origin GET endpoints, returned IDs,
request/status, navigation generation, response order and project membership.
Project metadata arriving before proven membership is cached within the
current navigation only and promoted once membership is verified.

Four isolated local source modules match their exact published Git blob hashes,
including network adapter blob 423095d008b201cd1229715dbc311a48a2775125.
Eight local adapter assertions PASS. Actual recorded successful JSON
responses were replayed through those exact source bytes: 3 observed
request/response pairs parsed, 2 canonical publications, final readiness
resolved with both correct names. This is **not** full-repository CI or
live host-to-Core integration certification.

## Acceptance disposition

| Gate | Status |
| --- | --- |
| Authenticated source fields for project chat | PASS |
| Project-first recorded response-order replay | PASS, local |
| Isolated adapter replay and negative tests | PASS, local |
| Standalone current-browser response | INCOMPLETE |
| Real host event wiring into provider | INCOMPLETE |
| Actual #125 subject observer/Core integration | INCOMPLETE |
| Full latest-candidate hosted tests and artifact parity | INCOMPLETE |
| Integration certification #127 | INCOMPLETE |

No merge and no issue closure. The 12 October audit ledger remains
historical evidence, superseded only as to the source-response gap.

## Exact local source-and-test replay update

At 2026-10-14 12:15 EDT, a local minimal provider fixture contains
four production source modules with exact Git blob hashes:

- subject-identity.js: 60c5d63be0b6fac8c95a705dc8f5e3dee18733cd
- chatgpt-subject-source.js: 00a8a9fd404f25b85df4d304f12b473ff99ec073
- chatgpt-subject-ingress.js: b5b7e0df959b5d7d36dd37a642da5aa35803d5bd
- chatgpt-subject-network-ingress.js: 423095d008b201cd1229715dbc311a48a2775125

The original three provider test files also exactly match GitHub blobs
968aba6b37c2250e76a7299c84c30a31449ebb31,
65a472965b0042127c2a9e19d777cf5ff2ffdb21 and
8dce7c860b69c53a41c7367b03f98d08cbd48186.

Executed Node `--test` on this minimal fixture: 23/23 PASS.
The 15 pre-existing assertions are byte-identical test copies.
The eight new adapter assertions are equivalent local test logic,
not an exact Git blob copy. This does not prove a full repository test,
hosted CI, browser artifact or actual Core/observer integration pass.

The most recent PR workflow found for provider source commit
cbaf41c7141e3643beaccc4b38fb2d111666b112 was run
38595507247: policy SUCCESS, validate/prepare/finalize SKIPPED.
A later exact-candidate request commit e21320305a0463276b2988446ec4d2645d1ac2a3
has PR run 38595891912 with the same policy-only result.
The connector only exposes PR-triggered runs; no push-mode hosted
functional PASS is claimed.

## 14 October continuation: deterministic browser bundle repair

Before this continuation, the provider `scripts/build-plugin.mjs` only
bundled the old four modules and entirely omitted the #126 identity
source modules.  This concrete artifact defect has been corrected on
the existing provider PR #4, without changing #125's agent observer.

Current generator adds reducer, mapper, ingress and network ingress in
dependency order.  The self-contained artifact now exports the new
identity adapter.  Its source-derived build output was compared
character-for-character to the committed artifact: exact equality
(62,106 chars at initial repair; subsequently regenerated for a
malformed-percent-encoded URL fail-closed fix).  Browser execution tests
and source/artifact parity assertions were added to the repository.

The host handoff itself is **not yet live-wired**.  The adapter exposes
`begin(conversationId)`, `request(method,url)` and
`response(observation,status,parsedJson)`, but DC must provide the
observed traffic from its existing fetch/XHR network seams and pair it
with the #125 observer.  Simply exporting an adapter does not prove
the browser data path was assembled.

The latest visible GitHub PR run for the 14 October candidate was
`38606012599`: policy SUCCESS, prepare/validate/finalize SKIPPED.
The `.ci/run-ci-request` push trigger was updated, but available
GitHub connected workflow lookup is PR-triggered only, so no hosted
functional PASS is asserted.

| Additional check | Classification |
| --- | --- |
| Generated artifact includes identity adapter | PASS, exact build parity |
| Artifact runtime parity tests committed | PASS implementation, execution pending |
| Malformed encoded URL handling | PASS source correction, final isolated replay pending |
| Full hosted tests on exact latest candidate | INCOMPLETE |
| Real browser host → provider event delivery | INCOMPLETE |
| #125 assembled observer / #127 pinned artifact | INCOMPLETE |

No merge and no closure.

## 14 October exact-candidate RED→GREEN verification

A new malformed-percent-encoding regression failed against the then-published
provider adapter.  `request('GET', '/backend-api/gizmos/g-p-%E0%A4%A')`
produced an observation whose expected project ID was null rather than
rejecting the request.  The local Node fixture recorded **11 PASS, 1 FAIL**.
After the added post-decode null guard, all 12 extended cases passed.

The exact final four source files and original four test files were copied
from GitHub and every `git hash-object` verified against the corresponding
published blob SHA, including latest adapter:
`b287a93603be440638638584135edb9db591695c`.
The final minimal isolated fixture ran **36/36 Node tests PASS** (24 exact
committed test files + 12 additional source-evidence/negative tests).
This is now exact-source isolated execution, unlike the earlier
non-byte-identical V1 fixture.  It is not full-repository or hosted proof.

The regenerated browser artifact blob is
`42f4812e791acb242ad1eef47985d562f4e4581e`;
generation and source/artefact parity were separately inspected, while
hosted executable artifact validation is still outstanding.

Latest observed provider PR workflow `38607233904` for CI request commit
`fa08926bdd251178720f4b2d0bd4e42bc4028ff3` reported
policy SUCCESS, validate/prepare/finalize SKIPPED.  The connection's
commit-run lookup excludes push-triggered runs; do not infer their result.

The separate #125 observer PR #3 remains open/draft/unmerged; #127 is an
independent convergence gate and DC #270 explicitly depends on #127.
Actual DC host/observer assembly must not be falsely claimed from the
producer's isolated tests.  No merges authorised.


## 14 October: real hosted CI certification, source candidate and remaining gates

The earlier "hosted functional INCOMPLETE" evidence above has been
superseded by an authenticated, full push-mode GitHub Actions run.

Previous forced hosted invocations failed in RepoWorkflow prepare with
"invalid CI request version: issue=126".  The pinned RepoWorkflow guard
requires that .ci/run-ci-request contain only a matching development
version.  The previous development version 0.1.0-issue.1.9 was already
terminal-tagged and could not be reused.  Repaired the version contract
instead of disabling any CI guard.

The provider package and runtime version were advanced together to unused
0.1.0-issue.1.16; the committed browser artifact was regenerated; the
CI request contained exactly that one version string.  Invocation:
91e1f10a137d4b46ff485786961bab497b0b7b69.

Run: https://github.com/Ma-XX-oN/Chat-Gpt-Plugin-2/actions/runs/38610861050
All four hosted jobs PASS: policy, prepare, portable-node22 validation,
finalize.  Prep created one artifact-only materialization commit:
293e00dcaff507ada0893f8c6d992388d6dfdd91, removing one extra
blank line in dist/chatgpt-plugin.mjs.  The test artifact JSON names
that exact source commit and version 0.1.0-issue.1.16, with
node scripts/validate.mjs: 63/63 TAP tests PASS, zero failures.
Generated-artifact verification also PASS.

CI finalizer recorded PASS and created immutable annotated development
tag v0.1.0-issue.1.16, whose tag-object SHA is
ae4c4a6240a1cfd12ff7d546600dda2cd46fc452, pointing at the
exact materialized and tested SHA 293e00dcaff507ada0893f8c6d992388d6dfdd91.
Provider PR #4 remains OPEN, DRAFT, UNMERGED.

Additional independently reproduced RED→GREEN: early cached project
name could leak after the conversation established *another* project
membership then switched back.  Original source: 36 PASS/1 FAIL in
an isolated fixture.  Corrected project membership invalidates all
pre-membership name cache entries; updated isolated source: 37/37 PASS.
The exact hosted candidate includes this fix.

An independently assembled source-level cross-lane harness using the
exact #125 observer class source SHA
e91930e67adabfe314a8c6278934ee0ffd241fa1 and the exact four #126
source modules passed 11 interface assertions.  The harness used a
minimal URL shim; this is not an authenticated live browser/Core run.

Latest classification:
- Project-conversation backend evidence: PASS
- RED-to-GREEN source regression and local tests: PASS
- Full hosted Node22 suite: PASS 63/63
- Generated browser-artifact provenance and annotated terminal tag: PASS
- #125/#126 interface smoke: PASS isolated, not live
- Actual host network event wiring into the provider: INCOMPLETE
- Core catalogue pin and browser observer convergence: INCOMPLETE (#127)
- Authenticated standalone-chat absence-of-project trace: INCOMPLETE

No merge, issue closure or production activation.  DC #270 subscription
remains gated on independent #127 integration certification.
