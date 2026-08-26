# AIConversationCore Design

## Purpose

`AIConversationCore` normalizes heterogeneous AI conversation/event records into a
single canonical representation, then provides shared renderers/projections over
that representation.

The design goal is semantic consistency across consumers. Provider differences
must be represented explicitly rather than flattened away, while equivalent
concepts must be normalized once rather than reimplemented independently by each
application.

## Architectural layers

### 1. Provider adapters

Each provider/model adapter translates raw provider records into canonical events.
Initial priority is ChatGPT because both `DownloadConversation` and
`AI-transcript.py` already process ChatGPT conversation records.

Expected adapter structure:

```text
src/
  adapters/
    chatgpt.js
    codex.js
    ...
```

Adapters answer: **what does this provider-specific record mean?**

They must preserve source identity and provider-specific metadata needed for
future interpretation.

### 2. Canonical model

The canonical primitive is an ordered event stream/graph, not a User/Assistant
pair.

A canonical event needs enough information to express at least:

- stable canonical ID
- source/provider
- source record ID
- event kind
- role/actor
- channel
- visibility
- ordering information
- parent/child relationships
- call/result relationships
- branch/exchange relationships where available
- normalized content blocks
- provider-specific metadata/raw-source reference

Expected event kinds include, but are not limited to:

- message
- commentary
- reasoning_summary
- tool_call
- tool_result
- subagent
- system_context
- attachment
- image
- artifact
- citation

The schema must remain extensible. Encountering an unknown provider record type
must not require silently discarding it.

### 3. Content blocks

Events should carry structured content blocks rather than a pre-rendered Markdown
blob. Expected block types include:

- text
- code
- citation
- link
- file
- image
- artifact
- structured/tool data

Blocks should retain source provenance/ranges where available. This is important
for consumers such as `AgentPanelSpeaker`, which needs stable mappings between
source content, displayed content, and spoken/highlighted content.

### 4. Derived structure

Turns are derived from events.

A turn must be representable even when its counterpart does not exist. Therefore
complete User/Assistant pairing is never required to preserve a valid event or
turn.

User/assistant pairs (historically called UAPs in `DownloadConversation`) are a
further derived relationship. They may still be useful for recorder/export logic,
but they are not the canonical storage model.

Other derived relationships may include:

- exchanges
- branches
- delegated/subagent trees
- visible transcript projection
- speakable/displayable projections

### 5. Shared renderers/projections

Shared renderers consume canonical data. The first shared renderer is Markdown.

The Markdown renderer owns all canonical serialization choices including:

- Markdown escaping
- HTML escaping
- code-fence language selection
- tool-call/tool-result formatting
- commentary/reasoning presentation
- citation HTML/links
- attachment/image/artifact rendering
- provider pointer/link resolution such as `sandbox:` and `sediment://`
- whitespace normalization

The same input must produce the same canonical Markdown output regardless of which
consumer invokes the renderer.

Additional projections may include:

- plain/display text
- speech/highlight projection for `AgentPanelSpeaker`
- canonical JSON interchange

## Consumer boundaries

### DownloadConversation

Owns browser-specific acquisition and recorder behaviour:

- ChatGPT page/API capture
- authentication/request-context capture
- pagination/recovery
- Tampermonkey UI
- File System Access API operations
- recorder state/resume

It should delegate provider interpretation and shared rendering to
`AIConversationCore`.

The existing Tampermonkey form remains the target during this migration. A browser
extension can be built later without changing core semantics.

### AI-transcript.py

Owns:

- CLI
- file/source discovery
- JSONL I/O
- grep/filter/session commands
- output routing

It should not maintain an independent ChatGPT renderer once migration is complete.
Python should invoke the shared JavaScript implementation, initially through a
persistent Node.js worker or equivalent single-process bridge.

### AgentPanelSpeaker

Owns:

- C#/Windows application behaviour
- WebView2
- SAPI synthesis/playback
- timing/highlighting UI

It should consume canonical events/content or a core-generated speech/display
projection, not parse Markdown to rediscover transcript semantics.

## Critical invariants

1. **Lossless-enough normalization.** Provider-specific information needed for
   current or future interpretation must not be discarded solely because it has
   no current canonical field.
2. **Incomplete conversations are valid.** A missing User or Assistant half must
   not invalidate the other half.
3. **Ordering must preserve observed/source ordering unless actual evidence shows
   that a provider requires a different rule.** Do not replace working
   chronological association/grouping based on speculation.
4. **Normalization and rendering are separate.** Provider semantics are resolved
   before Markdown/speech/display serialization.
5. **One canonical renderer per output format.** Consumers must not maintain
   subtly different Markdown implementations.
6. **No browser/application APIs in the core.** Platform-specific acquisition,
   storage, UI, and playback stay in consumers.
7. **Unknown data is explicit.** Unsupported/unknown records remain representable
   and diagnosable rather than silently disappearing.
8. **Stable provenance.** Canonical events/blocks should retain enough source
   identity to trace rendered output back to originating provider records.

## Migration principle

Do not rewrite functioning systems around an unproven new abstraction in one
step. Extract one vertical slice at a time, make both old consumers use it, verify
parity, then continue.

The initial ChatGPT implementation should be mechanically extracted from proven
behaviour wherever possible. Architectural cleanup must not be bundled with
unrelated behaviour changes.
