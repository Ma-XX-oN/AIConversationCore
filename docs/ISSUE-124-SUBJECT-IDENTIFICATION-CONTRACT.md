# AICC #124 — Subject-identification observer contract (V1)

Status: FROZEN FOR #125/#126 IMPLEMENTATION; source-grounded specification only.
No production observer or identity producer is introduced in #124.

## Exact existing API and source inventory

- AICC `src/plugins/registry.js` (`f0fc2a2da143dc64afca2d7c26f73dde434e9042`) requires `observeState` in `PUBLIC_PI` and returns an agent through `AgentPluginRegistry.create()`. It does not implement state observation itself.
- AICC `src/plugins/loading.js` (`ad567d2eecbf7fa8404403e5c0350f3345ad7550`) returns `{agent,session,registry,artifact}`; its catalogue currently pins ChatGPT plugin commit `6805ea7240c38160386a591cf3a72439226ab675`. Implementers must verify the pinned distributable independently of plugin `main`.
- Chat-Gpt-Plugin-2 `src/agent.js` on `main`, blob `6d03e8be62c509cbaa9d1a1b8481d5c028e73b1a`, implements `observeState(callback)`, `currentState()`, `commTraffic(data)`.
- AICC `src/index.js` exports the registry and loader, **not** a top-level `observe` method. Accordingly the supported spelling for this work is **`agent.observeState(callback, 'subject-identification')`**; `observe(callback)` from the epic is a conceptual shorthand, not an existing public symbol.
- DC `src/userscript/04-conversation-rendering/08-agent-plugin-bridge.js` (`3d3b029573648cbe44846c1b974bc760dfff4fe4`) calls `core.loadAgent('chatgpt-web', ...)`, retains `loaded.agent`, invokes `agent.commTraffic({type:'persisted_records',records})`, then uses the Core-owned session. This bridge does **not** currently subscribe to `observeState`.

### Existing default observer — exact behaviour to preserve

`agent.observeState(callback)` validates that callback is a function, inserts it into an instance-local `Set`, **synchronously invokes** `callback(agent.currentState())`, and returns a zero-argument unsubscribe closure removing that callback from the Set. Repeated registration of the exact same function shares Set identity (one registered callback); each register call still synchronously invokes it. Unsubscribe is idempotent at the Set level; a closure from either duplicate registration removes the shared subscription. `currentState()` JSON-clones the retained state. Later `#publish()` creates one clone and passes that same clone to each registered callback in Set iteration order. No Promise is returned. An exception thrown by the initial callback escapes `observeState` **after registration**, leaving the callback registered; an exception thrown on later publication propagates and halts that publication loop. Reentrant Set mutation follows native JS Set iteration behaviour. No documented error-isolation guarantee exists. All those are observed legacy semantics, not proposed improvements.

Initial state is `{exchange:{id:null,status:'UNKNOWN',error:null,result:null},transport:{status:'IDLE',streamComplete:false,recoverable:null},control:{stopRequested:false},diagnostics:[]}`.
The legacy lifecycle observer is invoked for accepted traffic and persisted-record publication; its existing update/dedup/exception behaviour must remain unchanged.

### Frozen optional subject selector

- `agent.observeState(callback)`: **unchanged** legacy default, including argument shape, synchronous first callback, returned unsubscribe, Set duplicate/reentrancy behaviour and errors.
- `agent.observeState(callback, 'subject-identification')`: register for a separate, instance-local identity subject. Callback receives **one complete identity snapshot** (not a lifecycle state or an event delta). Return a synchronous, idempotent `() => void` unsubscribe; after unsubscribe no later identity deliveries.
- Selector value denotes a **category**, not project/conversation/document ID. An unsupported selector throws `TypeError`; callback must be callable. `undefined` selects legacy default.
- Registration delivers exactly one current identity snapshot synchronously before returning unsubscribe; this snapshot exists even before provider identity resolution. Subsequent meaningful identity changes are delivered in commit order, after canonical state update; no notification for equal public payload. Subscription during a currently running publication receives its initial snapshot immediately; nested updates must serialize so each notification represents a complete committed snapshot.
- New identity deliveries are not affected by throwing lifecycle subscribers. Identity callbacks receive independent deeply immutable value snapshots; throwing callbacks cannot suppress notifications to other identity callbacks. Propagate/aggregate exceptions only after the full identity delivery batch (implementation to specify and test exact report channel). Initial callback throws must remove the newly registered identity subscription before rethrowing. Legacy default exception behaviour is explicitly **not** changed.
- The new subject is optional, not a new method required by `PUBLIC_PI`; changes must be coordinated across AICC catalogue/registry contract, Chat-Gpt-Plugin-2 source and pinned browser artifact. Existing agent implementations remain PI-valid with the original required method set.

## Snapshot V1

```js
{
  subject: 'subject-identification',
  revision: 0,                 // monotone per agent instance, increments on change
  readiness: 'unresolved',     // 'unresolved' | 'resolved'
  project: {
    status: 'unresolved',      // 'unresolved' | 'none' | 'identified'
    id: null,                 // authoritative opaque project ID or null
    name: null                // backend-confirmed display name or null
  },
  conversation: {
    status: 'unresolved',      // 'unresolved' | 'identified'
    id: null,                 // authoritative opaque conversation ID or null
    name: null                // backend-confirmed display title or null
  }
}
```

Rules: Every notification contains all fields. `id` is stable for the same backend entity, and `name` is a separately mutable backend display name. `null` means not supplied/verified, not an invented string. An identified entity can have a null name while its title is pending. `project.status='none'` means the provider has authoritatively established that this is a standalone chat; it is **not** interchangeable with `unresolved`. `readiness='resolved'` means conversation membership and current entity ID are backend-established; title values may still be null. An unresolved conversation forces `readiness='unresolved'`, but known project evidence can still be retained. `revision` changes only on a changed semantic snapshot; publication does not change revision on identical source updates. Snapshot must be detached and deeply frozen (including nested members) before delivery.

Valid resolved standalone:
```js
{subject:'subject-identification',revision:1,readiness:'resolved',
 project:{status:'none',id:null,name:null},
 conversation:{status:'identified',id:'backend-conversation-id',name:'Backend title'}}
```

Valid project chat before project title arrives:
```js
{subject:'subject-identification',revision:2,readiness:'resolved',
 project:{status:'identified',id:'backend-project-id',name:null},
 conversation:{status:'identified',id:'backend-conversation-id',name:'Backend title'}}
```

No-project must only be emitted after affirmative backend evidence. Project IDs must never be route slugs substituted for canonical IDs; names must never originate from HTML headings, DOM anchors, document.title, cached filenames, URLs, or guessed slugs.

## Authoritative ingress and identified gap

Verified **current** pathway: DC host obtains ChatGPT provider inventory -> `agent.commTraffic({type:'persisted_records',records})` -> ChatGPT plugin adapter -> `context.core.publishEvents()` -> Core `PluginCanonicalSession` -> DC canonical projections.

AICC `creationContext` currently injects `deriveTurns` and `publishEvents`, not an identity service. ChatGPT plugin `src/agent.js` currently reduces exchange/transport/control/diagnostics, not project/conversation names. DC supplies `context.conversationId` using `currentConversationId()` when creating the agent, but that context value alone is **not** backend-verified identity evidence.

DC `src/userscript/01-runtime/03-conversation-identity.js` (`b388e1bf4d01820ef7aff38fc4fb4b731c84a22f`) derives `conversationProjectName()` from project-route plus DOM anchor/heading/document title, and `src/userscript/02-network-communication/02-stock-network-responses.js` (`835efdd5c20e01cd23d6db7f2b9a4eb91a2b4c46`) derives `communicationLogConversationName()` from a DOM title/localStorage. These are explicitly **not acceptable upstream inputs** for the new identity contract.
DC `src/userscript/02-network-communication/01-stock-network-identities.js` (`08f55ed75da27c931a82aee9d961724a646ce9d7`) sees `conversation_id` or top-level `id` in provider JSON responses for diagnostics, but currently retains no authoritative project ID/name or title there.

**Open provider-evidence gap for #126:** before publishing resolved identification, demonstrate an exact ChatGPT backend response/feed that supplies canonical project ID, membership and display name plus canonical conversation ID/title. Record endpoint, response fields, evidence fixture, and update triggers; a backend-confirmed absence of project is required to publish `none`. If names are unavailable, leave them null and keep the corresponding acceptance incomplete. No new polling loop.

Proposed provider-native route: existing host network-acquisition seam -> provider plugin `commTraffic({type:'subject_identification',...})` with backend-provenanced fields -> plugin validates provenance, sequence and subject generation -> instance-owned identity snapshot -> subject observers. The `subject_identification` observation name is **proposed**; it is not yet an implemented `commTraffic` type. Core retains provider-neutral snapshot semantics while the plugin owns ChatGPT-specific field translation and lifecycle evidence. Implementer must test the actual message bridge and avoid passing DOM-derived names.

## Ordering and navigation

- At each navigation/subject switch, immediately publish unresolved for the **new** generation; never retain old names against new IDs.
- Associate every asynchronous backend request/result with an opaque generation + expected conversation ID at request start. Only the current generation may commit. Ignore late responses even when their titles are nonempty.
- Resolve conversation ID/membership from authoritative evidence; fill names when their corresponding authoritative fields arrive. A title rename updates only name and increments revision. A project rename updates only project.name. Identical responses are no-ops.
- Returning to an earlier conversation is a new navigation generation, even if the same ID was seen before. Initial callback always returns **current** generation snapshot. Unsubscribe removes only its subject subscription.
- Do not mutate already persisted files or previous recording identities on later updates; DC #270/#271 control downstream save boundaries and manual overrides.

## Compatibility matrix and RED inventory (before behaviour change)

| Case | Expected | Owner |
| --- | --- | --- |
| `observeState(callback)` initial synchronous lifecycle state, same duplicate callback and unsubscribe semantics | Exact baseline unchanged | #125 |
| `currentState()`, `getResponse()`, `commTraffic()` exchange/terminal flow | Exact baseline unchanged | #125 |
| `observeState(callback,'subject-identification')` initial unresolved full snapshot | One immediate callback | #125 |
| Unsupported subject, nonfunction callback | TypeError; no registered listener | #125 |
| Identity subscriber coexisting with legacy lifecycle subscriber | Strict category isolation | #125 |
| Subscribe, unsubscribe twice, then publish | No later notification | #125 |
| Equal authoritative identity event repeated, reordered older event | No redundant notification or regression | #125/#126 |
| Conversation change while old fetch in flight | New unresolved; old result ignored | #126 |
| Project membership confirmed absent vs pending | `none` distinct from `unresolved` | #126 |
| Backend ID available before title | Identified entity with null name, later one changed snapshot | #126 |
| Backend title/project rename | Same IDs, changed names, one notification each | #126 |
| New subject initial callback throws | No dangling identity subscription | #125 |
| Identity delivery listener throws / reenters | Other listeners still see ordered complete snapshots | #125 |
| Two separately created agents | No shared subscription/identity state | #125 |
| Existing alternative plugin instance implementing PUBLIC_PI only | No new required method | #125 |
| AICC selected pinned artifact vs ChatGPT plugin source | Exact version and artifact compatibility gate | #127 |
| DC navigation, reload, project-to-standalone, filenames and user overrides | Save-boundary correctness; no prior-file rewrites | DC #270-272 |

Tests above are **RED inventory**, not asserted executed results. #125 and #126 must introduce independent failing tests before implementation, then execute them against their exact changed candidates.

## References and boundaries

AICC #104 retains architecture/PI ownership; #125 implements observer; #126 establishes backend ingress and authoritative fields; #127 certifies exact artifact; DC #270–272 consume and test. Do not close #123 or alter protected branches from this ticket.
