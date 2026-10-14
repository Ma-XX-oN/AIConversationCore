# #127 authenticated live-witness and private-artifact boundary

## Security / source ownership

`AIConversationCore` is public and `Chat-Gpt-Plugin-2` is private.
Never commit any provider runtime bundle or provider source to Core,
including under tests or generated assets. Core's catalogue only stores
provider artifact *metadata*: commit/ref/version, byte count and hash.
Generic Core PI and catalogue tests use small synthetic mock providers.

Private provider integration and real browser-bundle evidence must be
run in the private provider repository or through approved private,
ephemeral credentials with no uploaded provider artifacts in public CI.
Past tests that embedded the private provider in Core do not justify
retaining private bytes in public Git history.

## Authentic live-browser acceptance

The final certification requires an authenticated `chatgpt.com`
session in which the exact Core-selected provider artifact is loaded.
It must observe existing authorized host network traffic without new
fetches, polling or DOM-derived names.

Verify initial unresolved, delayed backend names, project rename,
navigation A→B→A and project X→Y→X, stale response rejection,
reload, duplication, observer unsubscribe and duplicate suppression.
A real standalone conversation must contain an actual backend
`GET /backend-api/conversations/{id}` 200 response with affirmative
`gizmo_id: null`; the observer must emit matching
`project.status='none'`. Missing `gizmo_id` is not sufficient.

Use a privacy-minimized witness carrying only origin, network sequence,
method, endpoint class, status and pseudonymized identity fields.
Strip authorization tokens, cookies, headers, prompt/response bodies,
and unrelated user data. Do not upload raw HAR files to public CI.
A synthetic browser test, fixture, or replay is not evidence of
authenticated live origin.

The no-credentials, offline helper can extract candidate identity
responses from a locally available HAR:

```sh
zstd -d --stdout chatgpt.com2.har.zst > chatgpt.com2.har
node tools/extract-subject-har.mjs chatgpt.com2.har > candidates.json
```

Its output does not certify authenticity, event subscription, or source.
Source-verified integration belongs to the private provider test lane.
Record exact plugin and Core SHA, loaded artifact hash, node/browser
versions, observed events, independent reviewer and provider provenance.

Do not close #127 or unblock DC #270 until both live authenticated
acceptance gates pass. Neither staged PR is authorized for merge.
