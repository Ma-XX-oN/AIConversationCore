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
