# AICC #126 — authoritative identity ingress evidence (V1)

Status: INCOMPLETE. Source audit, not production certification.
Scope: producer-normalization only; #125 owns observer dispatch.

## Verified source paths

- Frozen #124 contract: `fbf9fa9da323c8d189cf397ec23acf8e9e065a57`, `docs/ISSUE-124-SUBJECT-IDENTIFICATION-CONTRACT.md`.
- AICC `src/plugins/registry.js` (`f0fc2a2da143dc64afca2d7c26f73dde434e9042`) supplies `deriveTurns` and `publishEvents` to a provider; it does not supply identity acquisition.
- Chat-Gpt-Plugin-2 `src/agent.js` has `observeState(callback)` and `commTraffic(data)`; its existing `persisted_records` path publishes canonical records, not project or conversation display names.
- DC `src/userscript/04-conversation-rendering/08-agent-plugin-bridge.js` (`3d3b029573648cbe44846c1b974bc760dfff4fe4`) injects a route-derived `conversationId` during plugin creation. That is not proof of backend identity.
- DC `src/userscript/01-runtime/02-shared-network-transition.js` recognizes `/backend-api/conversations/<id>` and optional `/messages`; `currentConversationId()` reads a route segment and `conversationTitle()` reads DOM/document title. Neither gives authoritative project title or membership.
- DC `src/userscript/02-network-communication/01-stock-network-identities.js` summarizes provider JSON `conversation_id` or top-level `id` but drops title, project membership, project ID and project name. Its nested message traversal is unrelated to project authority.
- DC `src/userscript/02-network-communication/08-communication-xhr.js` records XHR response bodies for communication logging and retains request/response correlation. This demonstrates an existing ingress seam but does NOT establish identity field content.

## Missing provider evidence

No inspected source or provider fixture proves the exact authenticated backend response fields for **all** of conversation ID, conversation title, project ID, project name and affirmative no-project membership. Consequently the producer must not publish guessed names, route IDs as proven backend facts or `project.status='none'` from the absence of a field. A `commTraffic({type:'subject_identification',...})` message remains proposed rather than shipped.

Required next evidence: a redacted, exact request/response fixture from the already-observed same-origin conversation metadata endpoint, plus project metadata/membership endpoint if independent; record HTTP method/path, observed field paths, null/absent semantics, and event triggers for title/project rename. Sensitive bearer tokens and personal message bodies must not be retained.

## Independent executable RED inventory

1. Before metadata response: complete snapshot unresolved with null names/IDs.
2. Backend conversation ID known, title pending: identified ID and null title.
3. Later title arrives: exactly one name-only change.
4. Project membership affirmative: backend ID/name separate and resolved; absent membership is NOT an affirmative no-project answer.
5. Standalone affirmative: project `none` only on explicit backend proof.
6. A→B→A: each navigation changes generation; late A1 response never overwrites A2.
7. Overlapping responses and rapid navigation: reject earlier generation/expected-ID mismatch.
8. Reload: unresolved until current-generation backend evidence, never resurrect stale title.
9. Duplicate identical verified response: no revision change.
10. Project rename: same project ID, changed project name only.
11. Provider → agent → Core/observer: exact artifact, source, and complete immutable snapshot match.

These are RED acceptance specifications, NOT assertions that tests were executed or passed. Do not close #126 or #127 based on this audit. Coordinate with #125 and the Chat-Gpt-Plugin-2 owner before changing provider interfaces.

## P/H/A/L

Problem: DC currently displays DOM-derived names despite the requirement for backend authority.
Hypothesis: the existing same-origin network capture seam can pass verified metadata to the plugin without DOM polling.
Action: inspected frozen Core contract, plugin observer and bridge, and DC network interception/identity-summary sources.
Learning: a suitable observation seam exists but authoritative project fields, source trigger, live fixture, and acceptance tests remain unverified. Implement only after provider response evidence fixes the schema.

## Independent publicly recorded provider response evidence (not local live certification)

The following external response investigations establish plausible, concrete provider field paths, but do **not** replace exact-revision live browser evidence in this repository:

- GPTSpy (observed through 10 October 2026): `GET /backend-api/conversations/{id}?include_has_versions=true&num_turns=100`, response top-level `conversation_id`, `title`, `gizmo_id`, `conversation_template_id`, `messages`, `page_info`. Source: https://gptspy.alinr.com/knowledge/endpoint/backend-api-conversations-id/
- ChatGPT-Web2API live capture (2 June 2026): top-level standalone conversation example includes `conversation_id`, `title`, `gizmo_id: null`; project detail `GET /backend-api/gizmos/{id}` includes `gizmo.id` and `gizmo.display.name`. Source: https://github.com/Octo-Lex/ChatGPT-Web2API/blob/master/docs/protocol-reference.md
- An independent project conversation listing documents `GET /backend-api/gizmos/{gizmo_id}/conversations`, `items[].id`, `items[].title`, `items[].gizmo_id`. Source: https://github.com/brianjlacy/export-chatgpt/blob/main/_docs/PROJECTS_FILES_RESEARCH.md

Cross-source field mapping for isolated producer fixture tests:
`conversation_id` -> conversation.id; `title` -> conversation.name;
`gizmo_id` -> project.id (only identified when a valid project ID is explicitly present);
explicit `gizmo_id: null` -> standalone, pending exact current-provider confirmation;
`gizmo.id` and `gizmo.display.name` -> confirmed project identifier/name.

The provider implementation remains fail-closed if `gizmo_id` is absent. Never mistake public reverse-engineering documentation for proof that the user's running ChatGPT version emits these fields, nor an inferred project ID for an authenticated project-name response. No new periodic network polling is authorized.

## V1 acceptance ledger — 12 October 2026, 19:39 EDT

| Gate | Exact evidence | Status |
| --- | --- | --- |
| #124 frozen contract available | AICC `fbf9fa9da323c8d189cf397ec23acf8e9e065a57` | PASS as input; #124 separate issue disposition |
| Backend field research | GPTSpy 2026-10-10 + independent project API captures linked above | PASS as external field research, NOT local live proof |
| Isolated snapshot normalization | Chat-Gpt-Plugin-2 `7799901667737c5ccd4a8ef506826d369a325c83` | PASS in local isolated fixture, 15/15 |
| Stale generation and request sequence | Same source, A→B→A and same-generation late-response tests | PASS in isolated fixture |
| Historical hosted functional validation | Provider `1e4dd5f9029773f116a2c7f7393afc0d311de4f4`, run `38323058718` `npm test` and `npm run validate` | PASS at historical 14-test revision only |
| Latest candidate canonical policy | Provider `7799901667737c5ccd4a8ef506826d369a325c83`, run `38323194384` | PASS policy only; functional stages skipped |
| Latest candidate hosted functional tests | No exact-hosted run after final 15th regression test | INCOMPLETE |
| Authenticated live browser source response | No exact response fixture from the user's running ChatGPT | INCOMPLETE |
| Actual network event ingress and project metadata trigger | DC existing network seam known, no #126 producer wire in production | INCOMPLETE |
| Source → #125 observer/Core notification | #125 separately owns agent observer; integration not assembled | INCOMPLETE |
| Browser artifact alignment and #127 certification | No assembled exact candidate | INCOMPLETE |

The exploratory standalone test workflow did run actual hosted tests, but RepoWorkflow policy rejected the additional workflow file. The temporary file was removed; the policy failure is repaired. Do not treat green policy-only CI as hosted functional proof.

Next owner action: obtain a privacy-redacted live `/backend-api/conversations/{id}` response with `conversation_id`, `title`, `gizmo_id`; for a project chat, obtain the `/backend-api/gizmos/{id}` response containing `gizmo.id` and `gizmo.display.name`. Exclude authentication headers, cookies, message bodies, owner identities and files. Then wire the existing network ingress to the provider helpers, coordinate merge resolution only at #127, and run exact-candidate functional/browser tests.

## Fixture-byte qualification (2026-10-12 19:43 EDT)

Subsequent independent `git hash-object` verification against GitHub `fetch_file` blob SHAs identified differences in four of six isolated local fixture files: source mapper and three test files. Only the immutable accumulator source and ingress source matched GitHub exact blob SHAs. The local 15/15 test result therefore demonstrates the isolated fixture's behaviour, **not** a byte-identical run on final provider revision `7799901667737c5ccd4a8ef506826d369a325c83`. Treat exact-final functional validation INCOMPLETE. This qualification supersedes any earlier phrasing implying that the full local fixture was identical to the committed source.

A canonical development-mode push trigger was committed at provider `5a0819df5176f00415914f31cef9562a143c3b1a` by changing `.ci/run-ci-request`. Connected workflow lookup surfaced PR policy-only run `38323433686` (success), but no observable push-mode validation evidence; no final-candidate hosted functional pass is claimed.
