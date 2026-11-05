# AICC #126 — Core loader and observer preflight

Date: 2026-10-14, America/Toronto.
Status: Producer-only acceptance evidence. NOT #127 certification.

## Authoritative source identities

| Component | Exact Git blob / commit |
| --- | --- |
| AICC main browser Core bundle | `47efb4f379f5bb27ae710a53d1cb84388aeeb1a2` |
| AICC main plugin registry | `f0fc2a2da143dc64afca2d7c26f73dde434e9042` |
| AICC main provider catalogue | `ad567d2eecbf7fa8404403e5c0350f3345ad7550` |
| #125 independently owned agent source | `e91930e67adabfe314a8c6278934ee0ffd241fa1` |
| #126 producer candidate | `fcd2107a9b0dc95b7ba84505d656e121b39cdc11` |
| #126 self-contained ESM artifact | `8c505406d7035d3fee1e639a73bf0c2dd4025031` |
| #126 network-identity source | `7c16257365e89b4b5a4994d3ed437353f5ad736c` |

Certified #126 source: `0.1.0-issue.1.20`.
Terminal tag: `v0.1.0-issue.1.20`.
Hosted run: https://github.com/Ma-XX-oN/Chat-Gpt-Plugin-2/actions/runs/38621461635
Full Node22 validation: 75/75 PASS; artifact generated before testing.

## Exact published components: negative test

Load the unmodified AICC browser Core bundle into an isolated JS
realm and register the unmodified, exact #126 .20 browser module as
the host-provided plugin. Invoking the **actual**
`core.loadAgent('chatgpt-web', {loadModule})` returns the expected
`agent plugin chatgpt-web artifact identity mismatch`, because
Core main currently pins provider `0.1.0-issue.1.9`.

This failure is a **protective correctness result**, not a provider
functional regression or permission to alter main.

## Non-published shadow assembly: positive test

For a read-only interface smoke, transform exact #125 `src/agent.js`
with the same import/export stripping used by provider's bundle
generator. In memory only, substitute the resulting `__agent`
closure into the .20 provider bundle. Separately construct a shadow
Core browser bundle where ONLY the configured catalogue version
string is changed in memory from .1.9 to .20.

Execute the actual bundled `core.loadAgent`, which creates the Core
registry, validates the public plugin PI, builds a canonical session
and invokes the agent's `version()` contract.

**12/12 assertions PASS** in the V8 source-execution fixture:

1. Initial subject observer synchronously emits unresolved state.
2. Early project-detail request is recognized.
3. Project detail is withheld before membership is proven.
4. Conversation-detail request is recognized.
5. Backend conversation membership is consumed.
6. Both names are published after source corroboration.
7. Navigation resets state to unresolved.
8. Late previous-conversation response is rejected.
9. New conversation request is recognized.
10. New conversation with explicit null membership resolves.
11. Standalone project.status is `none`, not fabricated.
12. Unsubscribe prevents further observer events.

The real Core loader and session were exercised. However, Core
catalogue metadata was modified **only in memory**, and the
assembled artifact was never committed, published, pinned by Core,
hash-certified, loaded through DC's real browser transport, or
executed against authenticated ChatGPT backend traffic. This
preflight is not a substitute for #127's independent certification.

## Scope boundary and final remaining gates

- #125 owns the observer source and remains an independent draft PR.
- #126 has green current production-source tests and exact hosted CI.
- #127 owns committed immutable combined provider/Core catalogue pin,
  full Core/browser integration verification, and independent signoff.
- DC #270 owns downstream subscriptions and filename consumers.
- A directly observed authenticated standalone `gizmo_id:null`
  backend response was absent from available October 12 logs; synthetic
  explicit-null and fail-closed negative tests pass.
- In local headless Chromium, `chatgpt.com` navigation was blocked by
  administrator policy; real browser-origin certification remains
  INCOMPLETE. The exact #126 source ran 322/322 Chromium assertions
  at an accessible local `about:blank` page.

Do not close #126 until its issue-level acceptance is legitimately
resolved, or silently reinterpret these preflight checks as #127 PASS.
Do not merge, alter protected main, or publish stable release tags.
