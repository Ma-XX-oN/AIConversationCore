# Existing Implementation Comparison — Implications and Migration

This document preserves the second half of the original implementation comparison performed before implementation of `AIConversationCore`.

### It currently interprets provider semantics twice

AgentPanelSpeaker v212 has two substantial independent provider-processing paths:

1. `JsonlRecordExtractor` builds speech/navigation-oriented `ExtractedNode` data.
2. `TranscriptMarkdownFormatter` independently parses the same provider records to
   build the displayed transcript.

Project history records real bugs caused by these paths disagreeing. For example,
queued-command material could exist in speech history while being omitted from the
rendered transcript.

This is direct evidence for the central design rule:

> Provider records must be normalized once. Display, Markdown, speech, search, and
> navigation must be projections of the same normalized events/content.

`AIConversationCore` must not reproduce AgentPanelSpeaker's current dual-parser
architecture in a different form.

### Stable provenance is required below the turn level

AgentPanelSpeaker does not merely need a Turn ID. It maps:

- source JSONL records;
- normalized/extracted nodes;
- rendered transcript nodes;
- words/tokens; and
- speech/highlight positions.

Therefore canonical events/content blocks must retain stable source provenance.
Where meaningful and available, they should also retain source ranges or enough
identity to derive stable projection ranges later.

The exact SAPI token timing model remains AgentPanelSpeaker-specific, but the core
must not destroy the information required to build that mapping.

### Subagent activity is lifecycle data, not merely prose

AgentPanelSpeaker already represents background/subagent activity with identifiers,
descriptions, and start/end timestamps in addition to visible announcement/result
text.

The canonical model should therefore be capable of representing delegated-agent
relationships and lifecycle events explicitly rather than flattening all subagent
activity into ordinary Assistant text.

### Interactive reading is now a shared requirement

AgentPanelSpeaker already consumes individual transcript nodes/turns interactively.
DownloadConversation is expected to gain similar turn-reading/navigation behaviour.

Therefore interactive consumption is a core design constraint now. The canonical
model and projections must support:

- addressing individual turns/events;
- stable navigation identities;
- display text separate from archival Markdown;
- speakable text/projection;
- source-to-display mappings; and
- highlighting/search mappings where appropriate.

This does **not** mean SAPI/WebView2 mechanics belong in the core.

## Existing duplication and drift risks

### 1. DownloadConversation versus AI-transcript.py ChatGPT rendering

Both codebases independently implement ChatGPT semantics and Markdown rendering.
They already differ in observable output, including previously identified areas
such as:

- code-fence language inference;
- HTML attribute escaping;
- citation presentation;
- decorative favicon handling;
- generated `sandbox:` link conversion;
- provider file-pointer handling such as `sediment://`; and
- newline/whitespace serialization.

These are not reasons to change proven chronological association. They are evidence
that duplicated renderers drift.

The target is one ChatGPT normalizer and one canonical Markdown renderer.

### 2. AgentPanelSpeaker extractor versus formatter

As described above, AgentPanelSpeaker separately interprets provider records for
speech and display. This has already produced behaviour mismatches.

The target is one normalized event/content model feeding both projections.

### 3. AgentPanelSpeaker bundled AI-transcript.py

AgentPanelSpeaker v212 contains a bundled `tools/AI-transcript.py` reference copy.
The current `AI-General-Memory` implementation has moved substantially beyond that
copy, including newer ChatGPT support and fixes.

The bundled copy must not become another maintained implementation of provider or
rendering semantics. Migration should eliminate the need for semantic duplication,
or deliberately generate/vendor a known core version where a self-contained tool
is required.

## Current internal abstractions worth preserving or learning from

### DownloadConversation

Useful existing ideas:

- stable message IDs;
- explicit chronological record spine;
- exact identifier metadata when available;
- diagnostics that distinguish evidence from fallback;
- incomplete-half recovery rather than destructive pairing assumptions;
- production-path tests; and
- explicit browser-vs-API fallback boundaries.

The existing UAP grouping logic remains application/use-case knowledge during
migration, but UAPs must not become the canonical storage primitive.

### AI-transcript.py

Useful existing ideas:

- provider adapters/stores are already conceptually separated;
- extensive regression fixtures;
- adaptive Markdown code fencing;
- explicit provider-specific interpretation;
- searchable text extraction distinct from full transcript rendering; and
- support for provider structures not currently present in DownloadConversation.

The implementation language should not be ported wholesale to JavaScript without
first establishing behaviour tests. The goal is semantic preservation, not a
line-for-line translation.

### AgentPanelSpeaker

Useful existing ideas:

- source identity separated from local rendered-node identity;
- stable word/token identities;
- explicit content categories;
- display/speech separation as projections;
- source-to-rendered-word mapping;
- subagent/background lifecycle tracking; and
- virtual-document navigation.

The lesson from its duplicated parser paths is equally important: these projection
features must share one normalized semantic source.

## Proposed responsibility boundary

The comparison supports the following target boundary.

### `AIConversationCore` owns

- canonical conversation/event/content schemas;
- provider adapters for ChatGPT, Claude, Codex, and future providers;
- provider record classification;
- normalized role/channel/visibility semantics;
- stable provenance representation;
- canonical ordering information;
- tool call/result relationships;
- delegated/subagent relationships/lifecycle representation;
- derived turns;
- optional derived exchanges/pairings;
- structured content blocks;
- canonical Markdown serialization;
- canonical searchable/displayable text projections;
- common speech/display projection semantics where provider interpretation is
  involved; and
- deterministic transformation APIs suitable for browser, Node/Python, and C#
  consumers.

### Consumers own

- acquiring raw records;
- persistence and filesystem operations;
- application-specific UI;
- browser/desktop platform integration;
- networking/authentication;
- terminal CLI behaviour;
- SAPI/audio timing/playback; and
- application lifecycle/recovery mechanisms.

## Testing implications before extraction

No provider implementation should be moved into the core until its existing
behaviour has regression coverage sufficient to detect accidental changes.

At minimum, fixtures/tests must cover the following semantic categories before the
corresponding implementation is extracted:

- chronological ordering and stable identity;
- incomplete User/Assistant halves;
- commentary/intermediate output;
- reasoning/thought summaries;
- ordinary Assistant final output;
- tools and tool results;
- provider-specific user-input requests/answers;
- subagents/delegated/background work;
- hidden/system/context records;
- citations and memory citations;
- files, images, and artifacts;
- `sandbox:` and provider-internal file pointers;
- adaptive code fences/language classification;
- projection/search text;
- source provenance; and
- cross-consumer parity where equivalent output is expected.

Existing AI-transcript.py fixtures and tests should be reused as baseline evidence
where applicable rather than recreated from memory.

DownloadConversation's built-in production tests should likewise be preserved and
migrated so they test the shared production implementation rather than a parallel
test-only substitute.

AgentPanelSpeaker needs substantially stronger automated semantic regression
coverage before replacing its existing parsers because its current functionality
contains many source/display/speech mapping assumptions.

## Migration consequence

The comparison reinforces the staged roadmap:

1. define and test the canonical schema;
2. preserve existing behaviours as fixtures/golden outputs;
3. extract one provider/semantic slice at a time;
4. make all relevant projections use that shared slice;
5. compare old versus new behaviour;
6. accept only intended differences; and
7. remove duplicated implementation only after parity is proven.

Do not use the existence of a shared core as justification for broad rewrites of
working association, ordering, rendering, speech, or recovery algorithms.

The core exists to reduce semantic duplication and make future changes safer, not
to reset previously verified behaviour.
