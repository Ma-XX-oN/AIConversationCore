# AICC #127: authenticated live-witness handoff

## Scope and authority

This is the outstanding browser acceptance gate after the exact provider and
Core hosted tests have passed.  This procedure does not authorize a merge or
substitute fixtures for live evidence.  The witness must originate in a
signed-in
ChatGPT browser with the exact staged Core and provider integration artifacts.

Provider version: `0.1.0-issue.1.21`
Provider commit: `cf521202e78dede9152840193dc5ca140703b240`
Provider blob: `32182498480ba061367ce60dbb4104c0c0d55fe7`
Core PR: #131.  Provider PR: #5.  AICC issue: #127.

## Browser session requirements

1. Confirm the browser is signed in on `https://chatgpt.com`.
2. Verify the actual loaded Core artefact catalogue resolves to the pinned
   commit, blob, byte length (69824) and version above.
3. Bind Core's `loadAgent('chatgpt-web')` to that exact module, then register
   `agent.observeState(callback, 'subject-identification')`.
4. Wire the existing host's correlated, already-authenticated request and
   response observation into `connectChatGPTSubjectHost`.  Never introduce
   polling, scrape names from the DOM, or send a new backend request solely to
   manufacture the acceptance record.
5. Observe initial unresolved, project-chat delayed names/renames, A-B-A,
   X-Y-X, reload, duplicate listeners, unsubscribe, and stale responses.
6. In a real standalone ChatGPT conversation, record the backend's actual
   successful `GET /backend-api/conversations/{id}` identity response.  Its
   payload must explicitly include `gizmo_id: null`.  Missing `gizmo_id`
   is NOT evidence for standalone membership.
7. Correlate the genuine response's network sequence with the next observable
   subject revision whose `project.status` is `none`.

## Privacy and recording

Keep authentication cookies, headers, bearer tokens, unrelated message bodies,
user prompts, private URLs and unneeded identifiers out of the exported file.
Do not upload a raw HAR or browser profile.  Preserve distinct stable
pseudonyms for each conversation and project ID; project pseudonyms must begin
with `g-p-`.  Keep names consistently pseudonymized across observed events.
Retain an independent, user-controlled provenance record (browser run, time and
exact loaded assets); never declare a synthetic replay authenticated.

A minimized capture uses `aicc-subject-capture-v1` JSON with:

- `origin`: `https://chatgpt.com`
- `providerGitBlobSha1`: the exact provider blob above
- `events`: ordered `begin`, `request`, `response`, `expect` items

The `request` must carry the original `network_sequence`, `method: GET`
and `request_url`.  The `response` must use the matching
`network_sequence`, `status: 200`, and a minimized `body` containing only
`conversation_id`, `title`, `gizmo_id` or `gizmo`.  A matching `expect`
contains the exact observer `readiness`, `conversation` and `project` values.

## Executable independent replay

Run from the Core checkout with the exact candidate and verified source:

```sh
node tools/replay-subject-witness.mjs /path/to/redacted-capture.json
```

The command checks the exact provider Git blob, uses real Core's `loadAgent`,
feeds correlated events to the real compiled provider ingress, checks observer
snapshots, and reports how many captured affirmative standalone responses
produced `project.status='none'`.  A `REPLAY_PASS` establishes only replay
consistency.  **It does not establish capture authenticity.**  Independently
review the browser provenance and source before changing #127 to PASS.

## Remaining handoff

Publish redacted witness metadata and the reproducible replay result to #127.
Close #127 and unlock DC #270 only after both live-browser and affirmative
standalone gates are independently certified.  Do not merge either staged PR
without the user's explicit authorization.

## Existing HAR recovery

When an authorized, raw-byte HAR archive becomes readable, decompress it
locally using `zstd` (never send credentials or an unredacted HAR to GitHub):

```sh
zstd -d --stdout chatgpt.com2.har.zst > chatgpt.com2.har
node tools/extract-subject-har.mjs chatgpt.com2.har > candidates.json
```

The extractor reads only successful same-origin GET identity endpoints and
prints pseudonymized conversation/project IDs and names.  It never prints
headers or unrelated messages.  An affirmative standalone count is based
on an actual HAR response body's explicit `gizmo_id: null`; absent response
bodies are counted separately.  The HAR alone has no observer trace or trusted
runtime hook correlation, so its output is **candidate backend evidence**,
not a full #127 browser/live certificate.  Review the source and provenance
before upgrading its evidence class.  Keep originals local and private.
