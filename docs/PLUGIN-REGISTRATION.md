# Public provider registration API — revision 1

AICC #134 supplies a provider-neutral boundary in `src/index.js` and the
classic script's `globalThis.AIConversationCore`.  Load exactly one Core instance
in the shared MAIN_WORLD.  Its registration subsystem starts immediately on
module/script evaluation, independently of consumers and agent creation.

## Descriptor contract

`registerAgentPlugin(descriptor)` synchronously returns a frozen captured
provider descriptor.  Required own data properties are `id` (nonempty string),
`name` (nonempty string), `iconUrl` (nonempty string), `apiVersion` (integer 1),
and `create` (function).  Optional `recognize` is a function when supplied;
`null`/`undefined` mean no recognizer.  Icon URLs are metadata; Core does not
fetch them.  These six public fields are captured once, validated before any
inventory mutation, and frozen.  Accessor properties are rejected without
invocation.  Inherited fields and implementation-specific extras are not copied.
Invalid descriptors and duplicate exact IDs throw and produce a visible error
and diagnostic event.  Existing registrations survive unchanged.

A provider factory receives `create(context)` and returns a fresh agent object
with the existing Agent PI methods: `sendMessage`, `getResponse`, `getTurns`,
`currentState`, `observeState`, `commTraffic`, and `version`.  Its `version()`
identity must report `plugin` equal to the descriptor ID and `apiVersion: 1`.
Provider implementation version identity remains provider-owned.  Core supplies
`context.core.deriveTurns` and `context.core.publishEvents(events)` and prevents
caller overrides of those canonical services.  Reusing an already associated
agent object is rejected so the existing agent/session association is preserved.

## Public signatures

| Signature | Result |
| --- | --- |
| `registerAgentPlugin(descriptor)` | Frozen captured descriptor; throws on error |
| `getAgentPlugin(id)` | Frozen descriptor or `null` |
| `listAgentPlugins()` | Frozen array snapshot in registration order |
| `recognizeAgentPlugin(input)` | First recognizing descriptor or `null` |
| `createAgent(id, context = {})` | Frozen `{agent, session, descriptor}` association |
| `getPluginRegistrationState()` | Frozen `{apiVersion: 1, plugins, missingPluginError}` |
| `observePluginRegistrationDiagnostics(listener)` | Idempotent unsubscribe function |

The `session` is the existing Core-owned canonical session: `events`,
`project(options)`, `renderMarkdown(options)`, and `renderHtml(options)`.
The agent's own `currentState`/`observeState` PI is preserved.  Registration does
not install or change provider observers, navigation, identity, or canonical
normalization/rendering.  It does not invent a new provider state protocol.
No public registry mutation or provider-specific catalogue is required to create
an agent.  An unavailable ID throws immediately; Core does not poll or import.

## Startup diagnostic and recovery

Exactly one timer is scheduled for 15,000 ms at subsystem construction.  At the
boundary, an empty inventory sets `missingPluginError: true`, calls
`console.error`, and emits `{code: 'no-plugins', level: 'error', message}`.
A successful earlier registration cancels the timer.  Invalid registrations do
not cancel it.  The timer does not repeat.  Browser timer execution is subject
to the browser event loop; the configured delay remains exactly 15,000 ms.

A valid late registration remains accepted.  It clears the missing-plugin state,
logs through `console.info`, and emits `registration-recovered` once.  Other
registration errors emit `registration-error`; subscriber exceptions are
isolated and reported as `diagnostic-listener-error`.  Events are immutable.
Subscriptions observe future diagnostics; query state for the current inventory
and missing-plugin status.  No shared DC logger or selector UI is introduced.
Node timer handles are unreferenced so importing Core alone does not keep Node
alive.  Test/embedded realms must supply actual or controlled host timer services.

## Startup order and successor handoff

CGP2 #38 loads its classic bootstrap independently.  When Core exists it calls
`AIConversationCore.registerAgentPlugin(descriptor)` once.  When Core is absent,
the provider owns polling for that API, ending after success or a definitive
registration error.  Core owns no provider bootstrap queue or heartbeat.

DC #366 uses `createAgent(id, context)` and the returned agent/session.  It must
not call the old catalogue loader or inspect a provider-specific global.
Provider selection can use `getAgentPlugin`, `listAgentPlugins`, or recognition.
A second independent provider requires no Core source or catalogue change.

The legacy `getAgentPluginArtifact`/`loadAgent` exports remain isolated solely
for existing consumers while DC #366 replaces its boundary.  They are not used
by the new registration subsystem.  Final integrated catalogue retirement belongs
to DC #367 after upstream consumer migration; no obsolete fallback is authorised.
Unrelated AICC #125/#127/#132 branches remain unmodified and unmerged.

## Independent test method

Run `node --test tests/plugin-registration.test.js` for two independent fixtures,
both startup orders against the generated classic bundle, immutable capture,
validation/duplicates, isolated canonical sessions, exact simulated timer
boundary, early cancellation, late recovery, and diagnostic subscriber isolation.
Run `python scripts/repoworkflow-validate.py` for the complete maintained Core
suite and provider golden gates.  The VM startup-order test simulates a provider
bootstrap; it is not live signed-in ChatGPT evidence.  DC #367 owns real installed
script/realm and cross-repository certification with exact upstream SHAs.
