# AICC Agent Plugin Architecture

## Status

This document records the provider-neutral agent/plugin architecture for
`AIConversationCore` (AICC).  Runtime repository access, authentication, cache,
artifact verification, browser Blob loading, and local-loader behaviour are split
into `AGENT-PLUGIN-LOADING.md`.

The first concrete provider is ChatGPT Web, with `Chat-Gpt-Plugin-2` as the
provider-owned implementation.  The same boundary is intended to support Claude
Web, Claude Code, Codex, and future agents without provider-specific logic leaking
into canonical Core semantics or consumers.

## Goals

The plugin system must:

- keep AICC's public agent PI small and provider-neutral;
- keep provider recognition, normalization, lifecycle interpretation, recovery,
  reconciliation, and diagnostics inside the provider boundary;
- keep canonical identity, turn derivation, projection, and rendering in Core;
- create one mutable provider state per Core/agent instance;
- expose plugin implementation identity/version for compatibility and diagnostics;
- allow provider implementations to be distributed independently from Core.

## Responsibility boundary

The intended flow is:

```text
provider-native observations / provider operations
                |
                v
         provider plugin
                |
                v
          AICC canonical
       conversation + state
                |
                v
       consumers/projections
```

AICC owns:

- plugin registration/lookup and plugin API versioning;
- canonical conversation/event/resource/lifecycle types and invariants;
- canonical identity and turn derivation rules;
- generic session/orchestration infrastructure;
- shared projections/renderers and consumer-facing APIs;
- validation of plugin descriptors and created agent instances.

A provider plugin owns:

- source/provider recognition;
- persisted/native record normalization;
- retained/incremental provider state;
- provider-native message/turn identity mapping;
- provider-specific submission/control operations;
- live lifecycle interpretation;
- recovery/reconciliation;
- duplicate, stale, reordered, and concurrent observation handling;
- provider-specific tool/reasoning/resource provenance;
- provider diagnostics.

Consumers call Core rather than provider plugins directly for canonical rendering
and application semantics.

## Plugin descriptor and registration

A runtime plugin module exposes a default descriptor.  The descriptor identifies
the provider implementation, declares the plugin API version, optionally exposes a
recognizer, and creates one mutable agent instance per Core/agent instance.

Representative shape:

```js
export default {
  id: "chatgpt-web",
  apiVersion: 1,
  recognize(input) {
    return Boolean(input);
  },
  create(context) {
    return new ChatGPTAgent(context);
  }
};
```

`recognize()` is identification only.  It does not normalize a conversation,
create canonical state, or replace an explicitly supplied provider/plugin ID.

Core validates descriptors before registration.  Duplicate IDs and incompatible
plugin API versions are rejected rather than silently replaced or coerced.

Imported modules may be registered through the same descriptor path.  No provider
name switch is required in generic Core registration code.

## Core-owned creation services

Provider factories receive a creation context from Core.  Core may expose
provider-neutral canonical services through `context.core`.

`deriveTurns` is currently supplied this way.  The registry owns that service and
must not allow a caller to replace it with provider-specific turn grouping.  A
provider plugin may retain its own normalized canonical events, but canonical turn
derivation remains a Core responsibility.

This establishes the causal path:

```text
provider source
    |
    v
provider normalization
    |
    v
canonical events retained by provider instance
    |
    v
Core deriveTurns
    |
    v
shared Core projections/renderers/consumers
```

## Public AICC agent PI

The public provider-independent interface is:

```text
sendMessage(text, timeout?, options?)
getResponse(timeout?)
getTurns(query)
currentState()
observeState(callback)
commTraffic(data)
version()
```

Provider-specific helper methods remain internal unless a demonstrated
cross-provider requirement requires a new public PI.

### `sendMessage(text, timeout?, options?)`

Submits a message through the provider-specific mechanism and returns a Promise
resolving to a structured submission result.

Example success:

```js
{
  ok: true,
  turnId: "..."
}
```

Example refusal:

```js
{
  ok: false,
  reason: "FOLLOWUP_NOT_ACCEPTED"
}
```

`ok: true` means the provider accepted/committed the message, not merely that AICC
attempted submission.  Provider/application refusals are normal results.  Promise
rejection is reserved for failures where Core/plugin execution cannot reliably
perform or interpret the operation.

### `getResponse(timeout?)`

Waits for the relevant response/outcome.  It derives completion from the same
authoritative lifecycle state used by `currentState()` and `observeState()` rather
than maintaining an independent completion detector.

### `getTurns(query)`

Retrieves canonical turns without requiring the caller to know an exact turn ID in
advance.

Supported cursor forms are:

```js
getTurns({ cursor: turnId, get: -20 })
getTurns({ cursor_index: -1, get: -20 })
```

Exactly one of `cursor` or `cursor_index` is supplied.

Semantics:

- `get > 0` walks forward;
- `get < 0` walks backward;
- `abs(get)` is the requested number of turns;
- the cursor turn is included;
- `cursor_index` uses Python-style indexing;
- returned turns remain in chronological order.

Provider plugins translate history acquisition onto their native model but do not
redefine canonical turn grouping.

### `currentState()`

Returns the current authoritative canonical agent/exchange state immediately.
Lifecycle taxonomy is based on evidence rather than presentation heuristics.

### `observeState(callback)`

Provides an event-driven view of the same authoritative state returned by
`currentState()`.  It must not independently infer provider lifecycle state.

### `commTraffic(data)`

Feeds provider-native communication observations into the provider plugin.
Acquisition remains separate from interpretation: request/response/stream/control
observations are forwarded as provider evidence and the provider plugin decides
what those observations mean.

### `version()`

Returns side-effect-free plugin identity/version information for compatibility,
testing, diagnostics, and logs.

Representative result:

```js
{
  plugin: "chatgpt-web",
  version: "0.4.0",
  ref: "test/current",
  apiVersion: 1
}
```

The symbolic ref is human-readable and may be mutable.  The implementation version
and API version identify what was actually loaded and whether it is compatible
with Core.

## State and response authority

The public state/response APIs project one authoritative provider-owned reducer:

```text
commTraffic(data) -> provider reducer/state
                       |          |          |
                       v          v          v
                 currentState  observeState  getResponse
```

`getTurns()` reads canonical turn data derived from normalized provider events
through Core-owned turn derivation.

Transport completion is not automatically an exchange outcome.  For example,
stream completion, `[DONE]`-equivalent transport markers, and stop requests are
evidence that provider plugins interpret according to provider semantics; they are
not generic Core success/cancel rules.

## Instance lifetime

Mutable provider/session state is created per Core/agent instance.  The module
itself is a descriptor/factory, not a mutable provider singleton.

Distribution and module-source caching may be shared by a host environment, but a
live provider instance belongs to the Core/agent instance that created it.  See
`AGENT-PLUGIN-LOADING.md` for browser/local module and cache lifetime.

## Runtime distribution

Provider repositories produce self-contained ESM runtime artifacts.  AICC selects
artifacts through readable symbolic refs and validates identity/API compatibility
before registration.

Browser/Tampermonkey and local loading use the same plugin ABI.  Authentication,
shared source caching, Blob import, cache revalidation, loader failure states, and
artifact-integrity policy are specified in `AGENT-PLUGIN-LOADING.md`.

## Required contract verification

The provider-neutral contract is not complete until tests cover at least:

- descriptor registration and duplicate-ID rejection;
- incompatible plugin API rejection;
- imported-module default descriptor registration;
- recognition without constructing provider state;
- complete public PI validation on created instances;
- created-instance identity matching its descriptor;
- Core canonical service injection without caller override;
- separate mutable provider state per created instance;
- `sendMessage()` success/refusal semantics;
- positive/negative `getTurns()` cursor semantics;
- `currentState()`/`observeState()` consistency;
- `getResponse()` using the same canonical state authority;
- provider-native `commTraffic()` interpretation staying inside the provider;
- `version()` reporting the loaded implementation/ref/API;
- no provider-name conditionals in generic Core render/consumer paths.

Loader/distribution verification requirements are maintained separately in
`AGENT-PLUGIN-LOADING.md`.

## Design constraints

1. Provider plugins are genuine runtime plugins, not provider strategy classes
   permanently compiled into Core.
2. Public and private plugins use the same ABI.
3. Private plugin source/artifacts are not embedded in public AICC artifacts.
4. Symbolic refs are authoritative selectors; opaque SHAs are not required merely
   for immutability.
5. Core owns canonical identity, turn derivation, projection, and rendering.
6. Provider interpretation remains behind the plugin boundary.
7. Canonical state is the single authority for `currentState()`, `observeState()`,
   and `getResponse()`.
8. Hosts forward provider-native communication evidence through `commTraffic()`.
9. Failed/invalid plugins do not silently fall back to another implementation.
10. Provider implementation detail must not leak into generic Core consumers.
