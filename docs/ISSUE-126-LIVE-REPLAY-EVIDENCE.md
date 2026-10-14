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
