# AICC Agent Plugin Architecture

## Status

This document records the current design for loading agent/provider plugins into
`AIConversationCore` (AICC).  It is an architecture contract and implementation
plan, not a claim that all described runtime behaviour is implemented yet.

The first concrete provider is ChatGPT Web, with `Chat-Gpt-Plugin-2` as the
provider-owned implementation.  The same AICC boundary is intended to support
Claude Web, Claude Code, Codex, and future agents without provider-specific logic
leaking into canonical Core semantics or consumers.

## Goals

The plugin system must:

- keep AICC's public agent API small and provider-neutral;
- allow a provider plugin repository to be public or private;
- avoid embedding private plugin source or artifacts in AICC source or public
  AICC artifacts;
- load a provider artifact at runtime from its repository;
- support browser/Tampermonkey and local AICC environments;
- avoid one authentication prompt per AICC instance;
- allow multiple browser tabs/windows to share authorization and cached plugin
  source while keeping each page's live module/plugin state local;
- pin plugins by readable symbolic refs rather than opaque commit SHAs;
- make plugin identity/version observable to tests and diagnostics;
- keep provider-specific recognition, normalization, lifecycle interpretation,
  recovery, reconciliation, and diagnostics inside the plugin boundary.

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

AICC owns the plugin registry/loader, canonical conversation and lifecycle types,
canonical invariants, public consumer API, plugin compatibility validation, and
shared rendering/projection behaviour.

A provider plugin owns provider-specific interpretation and operations.  It must
not force downstream consumers to understand provider endpoints, transport
markers, recovery rules, or provider-native record shapes.

## Plugin repositories and artifacts

Each agent/provider implementation may live in a separate repository, for example:

```text
Chat-Gpt-Plugin-2
Claude-Web-Plugin
Claude-Code-Plugin
Codex-Plugin
```

A repository may be public or private.  Privacy is an access-control property and
does not change the plugin ABI.

A provider repository may use many source modules internally, but it should
produce one self-contained ESM runtime artifact, for example:

```text
dist/chatgpt-plugin.mjs
```

The artifact may itself be public or private.  A private artifact remains only in
the private repository and is fetched by authorized users at runtime.  It is not
copied into the AICC repository or public AICC build output.

The single-file ESM artifact avoids runtime relative-module graph rewriting while
still allowing the plugin source repository to use normal modular source code.

## Browser/Tampermonkey runtime loading

A normal Tampermonkey userscript is not treated as an ESM entry point, but a
classic userscript can use the `import()` expression to load a module from a
`blob:` URL.

This was verified in the target environment on 2026-09-30:

```text
Chrome 154 + Tampermonkey 5.5.0 + chatgpt.com

dynamic import(data:)                         FAIL
dynamic import(blob:)                         PASS
injected inline <script type="module">        FAIL
injected blob <script type="module">         PASS
```

The preferred browser loader therefore is:

```text
authenticated/public fetch
        |
        v
plugin source bytes
        |
        v
      Blob
        |
        v
URL.createObjectURL()
        |
        v
 import(blobUrl)
        |
        v
provider module/plugin
```

The preferred path does not insert plugin source into the DOM.

The `Blob`/module instance is local to the page/JavaScript realm.  What is shared
between pages is the verified plugin source/cache and authorization state, not the
live JavaScript object.

## Shared browser cache and cross-tab/domain use

For Tampermonkey-hosted AICC use, userscript storage is the preferred shared
storage boundary because it can be shared by instances of the same userscript
across tabs and supported AI-agent domains.

The shared record should include at least:

```text
plugin ID
symbolic ref
plugin version/API metadata
verified artifact source/bytes
integrity metadata
retrieval/update metadata
authorization state/metadata as appropriate
```

The first page needing a missing artifact may authenticate, fetch, verify, and
store it.  Other pages retrieve the verified source and create/import their own
local Blob/module instance.

Do not attempt to serialize or pass the live imported plugin object between tabs.
Functions and closures are realm-local and are not a suitable Tampermonkey storage
payload.  A permanent broker-tab RPC design is intentionally avoided because tab
closure/reload and callback routing would create unnecessary fragility.

Concurrent first-use tabs must coordinate so that only one performs the initial
authorization/download.  A shared lock/state plus Tampermonkey value-change
notification is sufficient; `BroadcastChannel` or Web Locks may be used where
appropriate but are not required as the cross-domain storage authority.

## Local runtime

Local AICC use, including plugins for Claude Code or Codex, uses the same plugin
ABI and artifact format but has its own local authorization/cache implementation.
The local loader must not require browser/Tampermonkey APIs.

## Repository authentication

Public plugin artifacts require no repository authentication.

Private plugin artifacts should use a GitHub OAuth/GitHub App authorization flow
rather than requesting a password or asking every AICC instance for a personal
access token.

Authorization is owned by the shared loader/cache environment, not by individual
AICC instances.  In the Tampermonkey case, supported browser pages should reuse
that shared authorization/cache state.  Local AICC has one corresponding local
authorization/cache.

The plugin itself does not receive or own repository credentials merely because
it was fetched from a private repository.

## Plugin selection and updates

AICC selects a plugin through a readable symbolic ref, not an opaque commit SHA.
Examples include:

```text
main
develop
release/0.4
test/current
issue-104-agent-plugin-architecture
```

The ref may intentionally be mutable.  The loader must therefore revalidate the
ref/cache according to update policy rather than assuming that a previously seen
ref is immutable.

AICC's plugin descriptor should identify at least:

```text
plugin ID
repository
symbolic ref
artifact path
required plugin API version
```

Optional integrity/version fields may also be present.

Testing can deliberately attach an AICC build to a named plugin branch/channel.
This is preferred over forcing a test to update an opaque SHA after every plugin
commit.

A plugin also exposes its own version information through the public `version()`
PI so tests/logs can confirm what implementation was actually loaded.

## Artifact verification

Before execution, AICC must validate the fetched artifact against the selected
plugin descriptor and plugin ABI.  Validation should include the applicable
subset of:

- plugin ID;
- repository/ref/artifact path;
- plugin API version;
- plugin implementation version;
- integrity hash or equivalent artifact-integrity metadata when configured.

A plugin artifact may carry a manifest, but an artifact must not be allowed to
silently redefine what plugin/ref AICC requested.

If integrity or compatibility validation fails, the artifact must not execute or
register.

## Plugin availability and loader failures

Plugin loading is an explicit state machine rather than an unstructured fetch
exception.  Representative states include:

```text
UNINITIALIZED
AUTH_REQUIRED
AUTHENTICATING
FETCHING
VERIFYING
READY
UNAVAILABLE
```

Representative failure reasons include:

```text
AUTH_DENIED
AUTH_FAILED
ACCESS_DENIED
NETWORK_ERROR
NOT_FOUND
ARTIFACT_INVALID
API_INCOMPATIBLE
```

Required behaviour:

- authentication cancellation/denial leaves the plugin unavailable and must not
  cause a repeated login loop;
- access denial is reported explicitly;
- network failure must not cause a tight retry loop;
- invalid/incompatible artifacts are refused before execution;
- AICC may continue to exist while a specific provider plugin is unavailable;
- use of a previously verified cached artifact while the repository is
  temporarily unreachable is a policy decision and must not become an implicit
  fallback.

## Public AICC agent PI

The current public agent interface is:

```text
sendMessage(text, timeout?, options?)
getResponse(timeout?)
getTurns(query)
currentState()
observeState(callback)
commTraffic(data)
version()
```

These are public provider-independent interaction points.  Provider-specific
helper methods remain internal unless a demonstrated cross-provider requirement
requires a new public PI.

### `sendMessage(text, timeout?, options?)`

Submits a message through the provider-specific mechanism.

It returns a Promise resolving to a structured submission result.  Provider or
application outcomes are normal results, not exceptions merely because the
provider refused the operation.

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
attempted to submit it.  This is particularly important for follow-up/steer cases
where the provider is not currently accepting a follow-up.

Promise rejection is reserved for failures where AICC/plugin execution itself
cannot reliably perform or interpret the requested operation, such as a contract
or invariant failure.  A caller may use either `await` or normal Promise
`.then(...).catch(...)` syntax.

### `getResponse(timeout?)`

Waits for the relevant response/outcome.  It should derive completion from the
same authoritative canonical lifecycle/state used by `currentState()` and
`observeState()` rather than maintain an independent response-completion detector.

Where practical this PI should be implemented as a convenience over canonical
state observation.

### `getTurns(query)`

Retrieves arbitrary canonical turns without requiring the caller to know the exact
turn ID beforehand.

Two cursor forms are supported conceptually:

```js
getTurns({
  cursor: turnId,
  get: -20
})
```

or:

```js
getTurns({
  cursor_index: -1,
  get: -20
})
```

Exactly one of `cursor` or `cursor_index` is supplied.

Semantics:

- `get > 0` walks forward;
- `get < 0` walks backward;
- `abs(get)` is the requested number of turns;
- the cursor turn is included;
- `cursor_index` uses Python-style indexing: `0` is the first turn, `-1` the
  last turn, `-2` the second-last, and so on.

Examples:

```js
getTurns({ cursor_index: 0, get: 20 })
```

returns the first 20 turns including turn 0.

```js
getTurns({ cursor_index: -1, get: -20 })
```

returns the last 20 turns including the last turn.

```js
getTurns({ cursor: turnId, get: -20 })
```

returns that turn plus the 19 preceding turns.

Provider plugins translate this canonical retrieval operation onto the provider's
native history model.  A provider such as a stateless API may satisfy it from
AICC/client-held canonical history rather than from a hosted server-side
conversation endpoint.

### `currentState()`

Returns the current authoritative canonical agent/exchange state immediately.
The exact lifecycle taxonomy is defined separately from this PI and must be based
on evidence rather than presentation heuristics.

### `observeState(callback)`

Event-driven view of the same authoritative state returned by `currentState()`.
It must not independently infer provider lifecycle state.

Conceptually:

```text
commTraffic(data)
      |
      v
provider-specific interpretation
      |
      v
canonical state
   |        |
   v        v
currentState()   observeState(callback)
```

### `commTraffic(data)`

Feeds provider communication observations into the provider plugin so that it can
interpret/update canonical state.

The input is provider-native evidence, not caller-normalized lifecycle meaning.
For example, a ChatGPT host may forward request/response/stream/WebSocket/control
observations while the ChatGPT plugin decides what those observations mean.

This keeps acquisition separate from interpretation and prevents host/consumer
code from duplicating provider semantics.

### `version()`

Returns side-effect-free plugin identity/version information for compatibility,
testing, diagnostics, and logs.

A representative result is:

```js
{
  plugin: "chatgpt-web",
  version: "0.4.0",
  ref: "test/current",
  apiVersion: 1
}
```

The exact field names may be refined with the plugin ABI, but the PI requirement is
that AICC/tests can query the implementation identity they are attached to.

The symbolic `ref` is intentionally human-readable and may be mutable.  The plugin
implementation version and API version tell the caller what was actually loaded
and whether the plugin is compatible with the current Core contract.

## Internal provider-plugin responsibilities

The public PI above is intentionally smaller than the provider plugin's internal
responsibilities.

Provider-owned responsibilities include, as applicable:

- source/provider recognition;
- persisted-record normalization;
- retained/incremental provider state;
- provider-native message/turn identity mapping;
- provider-specific submission/control operations;
- live lifecycle interpretation;
- recovery/reconciliation;
- duplicate, stale, reordered, and concurrent observation handling;
- provider-specific tool/reasoning/resource provenance;
- provider diagnostics.

These capabilities do not automatically become additional public AICC methods.
They exist so the provider plugin can correctly implement the small public PI and
produce canonical Core semantics.

For example, ChatGPT may expose provider-native observations such as conversation
requests, steer/follow-up requests, stream status, resume/polling behaviour,
transport-completion markers, explicit success/error/cancel results, stop/control
operations, or late/reordered observations.  Consumers must not interpret those
markers themselves.  The ChatGPT plugin interprets them and updates canonical
Core state.

## State and response authority

The following APIs must project one authoritative canonical state rather than
creating parallel detectors:

```text
commTraffic(data) -> internal provider reducer/state
                       |          |          |
                       v          v          v
                 currentState  observeState  getResponse
```

`getTurns()` reads canonical conversation/turn data derived from the same provider
interpretation path.

## Module instance lifetime

Authorization and verified artifact source may be shared across tabs/pages, but
each page imports its own module instance from a local Blob URL.

Within one page, repeated AICC instances should avoid redundant downloads/imports.
A page-level module Promise/cache may be shared.  Mutable provider/session state
should normally be created per Core/agent instance rather than stored in a single
module-global singleton.

A likely module shape is therefore a factory/descriptor rather than one mutable
provider session object, for example:

```js
export default {
  id: "chatgpt-web",
  create(context) {
    return new ChatGPTAgent(context);
  }
};
```

The exact module ABI remains part of the AICC plugin-contract work; this example
records the ownership/lifetime direction rather than freezing method names that
have not yet been implemented.

## Update/cache behaviour

The cache is keyed by plugin identity plus the selected symbolic ref and enough
resolved metadata to determine freshness.

Because refs may move, the loader revalidates a cached ref according to policy.
If the selected ref resolves to unchanged artifact metadata, the verified cache is
reused.  If it changed, the new artifact is fetched and verified before use.

Older cached revisions may coexist temporarily so different AICC versions/test
branches do not overwrite each other's selected plugin source.

Do not rely solely on ordinary browser HTTP caching for correctness.

## Required verification

The implementation is not complete until tests cover at least:

- first authorization and authorization cancellation/denial;
- public artifact loading without authorization;
- private repository access denied;
- first artifact download;
- simultaneous pages causing only one initial authorization/download;
- another tab/domain obtaining the shared verified artifact source;
- verified cache reuse;
- mutable symbolic-ref revalidation/update;
- invalid artifact/integrity rejection;
- wrong plugin identity rejection;
- incompatible plugin API version rejection;
- Blob ESM import in the target Tampermonkey/browser environment;
- multiple AICC instances in one page without redundant artifact downloads;
- separate per-instance mutable provider state;
- local loader use of the same plugin ABI;
- `sendMessage()` success/refusal semantics, including follow-up refusal;
- `getTurns()` positive/negative cursor and Python-style index semantics;
- `currentState()`/`observeState()` consistency;
- `getResponse()` using the canonical state authority;
- `commTraffic()` preserving provider-native evidence until plugin
  interpretation;
- `version()` reporting the actually loaded plugin implementation/ref/API;
- no provider-name conditionals leaking into generic AICC rendering/consumer
  paths.

## Design constraints

1. Provider plugins are genuine runtime plugins, not merely provider strategy
   classes compiled permanently into AICC.
2. A plugin may be public or private; AICC's ABI is the same either way.
3. Private source/artifacts are not embedded in public AICC artifacts.
4. Symbolic refs are authoritative selectors.  Do not require opaque SHAs merely
   for immutability.
5. Share verified artifact source/cache, not live plugin objects, between browser
   pages.
6. Canonical state is single-source-of-truth for `currentState()`,
   `observeState()`, and `getResponse()`.
7. Hosts forward provider-native communication evidence through `commTraffic()`;
   provider interpretation stays in the plugin.
8. No silent fallback from a failed/invalid plugin to a different implementation.
9. Authentication/downloading must not be repeated per AICC instance when a
   shared authorized/cache environment is available.
10. Provider implementation detail remains behind the plugin boundary even when
    the public AICC PI is deliberately small.
