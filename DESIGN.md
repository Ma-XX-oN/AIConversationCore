# AIConversationCore Design

## Purpose

`AIConversationCore` normalizes heterogeneous AI conversation/event records into a
single canonical representation, then provides shared renderers/projections over
that representation.

The design goal is semantic consistency across consumers. Provider differences
must be represented explicitly rather than flattened away, while equivalent
concepts must be normalized once rather than reimplemented independently by each
application.

The core is not only an export/rendering library. Canonical data must also support
interactive consumers that read, navigate, speak, highlight, or otherwise operate
on individual turns and content ranges.

## Migration behaviour authority

During migration, the current `AI-General-Memory/scripts/AI-transcript.py`
implementation is the canonical behavioural/rendering reference for every provider
it recognizes, currently ChatGPT, Claude, and Codex. This defines the behaviour to
extract and preserve; it does not make the Python implementation, CLI structure,
or provider-specific storage code the target architecture.

Provider behaviour must be decomposed into provider adapters, canonical events and
blocks, derived turns/relationships, and shared renderers/projections. Adding a new
provider should therefore require a new adapter plus any genuinely new canonical
semantics, not a new independent renderer.

A separately verified defect or capability gap may supersede the current Python
behaviour for a specific semantic. Such changes require their own evidence, issue,
tests, and migration decision rather than being folded into unrelated extraction.

ChatGPT image handling is currently the known area requiring that separate
verification. The Python renderer's source-position and missing/unavailable
semantics are useful behavioural evidence, but actual image-resource resolution
must be verified against `DownloadConversation`. `DownloadConversation` remains an
API-driven transcript renderer; its image capability must be treated as API/resource
resolution, not as DOM transcript rendering or a DOM content fallback.

## Architectural layers

### 1. Provider adapters

Each provider/model adapter translates raw provider records into canonical events.
ChatGPT is the first migration priority, but the architecture is explicitly
multi-provider because the canonical behavioural source already recognizes
ChatGPT, Claude, and Codex.

Expected adapter structure:

```text
src/
  adapters/
    chatgpt.js
    claude.js
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
for interactive consumers such as `AgentPanelSpeaker` and future
`DownloadConversation` turn-reading functionality, which need stable mappings
between source content, displayed content, spoken content, and highlighted
content.

Where practical, canonical blocks/projections should expose stable identifiers and
ranges so consumers do not have to parse rendered Markdown or rediscover semantic
boundaries independently.

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

Derived turns must be directly consumable by interactive applications. Consumers
must be able to navigate or request an individual turn without requiring a
complete UAP or reparsing Markdown.

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
- speech/highlight projection
- turn-navigation/read projection
- canonical JSON interchange

Speech/highlight and turn-reading projections may be shared by both
`AgentPanelSpeaker` and `DownloadConversation`. The design must not assume that
speech, highlighting, or interactive turn traversal belongs to only one consumer.

## Consumer boundaries

### DownloadConversation

Owns browser-specific acquisition and recorder behaviour:

- ChatGPT Conversation API capture
- authentication/request-context capture
- pagination/recovery
- API/resource resolution for ChatGPT attachments/images where browser credentials
  or browser-accessible resource context are required
- Tampermonkey UI
- File System Access API operations
- recorder state/resume
- browser-side playback/reading UI when implemented

It should delegate provider interpretation and shared rendering/projection logic
to `AIConversationCore`.

`DownloadConversation` is expected to gain the ability to read/navigate individual
turns in the near future, with functionality conceptually similar to parts of
`AgentPanelSpeaker`. Therefore the core must preserve enough structured content,
turn identity, ordering, provenance, and source/display ranges for both consumers
to share the same semantic interpretation rather than developing parallel
implementations.

The existing Tampermonkey form remains the target during this migration. A browser
extension can be built later without changing core semantics.

### AI-transcript.py

During migration, current `AI-transcript.py` behaviour is the canonical reference
for all providers it recognizes. After each behaviour slice has been extracted and
verified, Python should delegate that shared semantic/rendering behaviour to the
JavaScript core rather than maintain a second implementation.

Python continues to own:

- CLI
- file/source discovery
- JSONL I/O
- grep/filter/session commands
- output routing

The eventual bridge should use a persistent Node.js worker or equivalent
single-process mechanism rather than spawning one JavaScript process per record.

### AgentPanelSpeaker

Owns:

- C#/Windows application behaviour
- WebView2
- SAPI synthesis/playback
- timing/highlighting UI

It should consume canonical events/content or a core-generated speech/display
projection, not parse Markdown to rediscover transcript semantics.

Where `AgentPanelSpeaker` and `DownloadConversation` need equivalent turn-reading,
speech, display, or highlighting semantics, those semantics belong in a shared
core projection unless there is a demonstrated platform-specific reason to keep
them separate.

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
   storage, UI, playback, and credential-bound resource resolution stay in
   consumers.
7. **Unknown data is explicit.** Unsupported/unknown records remain representable
   and diagnosable rather than silently disappearing.
8. **Stable provenance.** Canonical events/blocks should retain enough source
   identity to trace rendered output back to originating provider records.
9. **Interactive turn access is a core use case.** Canonical and derived data must
   support individual-turn navigation/reading without requiring complete UAPs or
   reparsing rendered Markdown.
10. **Shared interactive semantics stay shared.** If multiple consumers need the
    same speech/display/highlight/turn-reading interpretation, implement that
    semantic projection once in the core and keep platform-specific playback/UI in
    the consumer.
11. **AI-transcript.py is the migration behaviour authority across supported
    providers.** Deviations require separately verified evidence; the final shared
    implementation remains JavaScript.

## Migration principle

Do not rewrite functioning systems around an unproven new abstraction in one
step. Extract one vertical slice at a time, verify it against the canonical
`AI-transcript.py` behaviour and relevant consumer evidence, then continue.

ChatGPT is the first provider being extracted, but its adapter must not define the
core in a way that prevents Claude, Codex, or future providers from using the same
canonical event/block/turn and renderer architecture.

Architectural cleanup must not be bundled with unrelated behaviour changes.
