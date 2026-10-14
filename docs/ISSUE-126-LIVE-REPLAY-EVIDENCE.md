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
