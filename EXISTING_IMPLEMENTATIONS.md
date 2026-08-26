# Existing Implementation Comparison

This document records the codebase comparison performed before implementation of
`AIConversationCore`. It is a required design input, not a historical note to be
ignored after initial development.

The purpose of this comparison is to identify:

- behaviour that is already correct and must be preserved;
- semantics currently implemented more than once;
- genuine provider/application differences that must not be flattened away;
- responsibilities that belong in `AIConversationCore`;
- responsibilities that must remain in consuming applications; and
- regression risks that must be protected by tests before extraction begins.

See also:

- `DESIGN.md` for the target architecture and invariants;
- `TESTING.md` for mandatory regression and parity requirements;
- `ROADMAP.md` for migration order;
- `DECISIONS.md` for durable architecture decisions; and
- `AI_AGENT_RULES.md` for mandatory change discipline.

## Baselines reviewed

The comparison is based on actual source code, not only project descriptions.

### DownloadConversation

Baseline reviewed:

- repository: `Ma-XX-oN/DownloadConversation`
- branch: `main`
- userscript: `chatgpt-conversation-markdown-export.user.js`
- userscript version observed during review: `0.6.132`

The current implementation is a Tampermonkey userscript that captures authenticated
ChatGPT Conversation API access, paginates API records, reconstructs a stable
chronological message spine, exports JSONL/Markdown, recovers some browser-only
image material, and provides browser navigation/testing/diagnostics.

### AI-transcript.py

Baseline reviewed:

- repository: `Ma-XX-oN/AI-General-Memory`
- branch: `master`
- script: `scripts/AI-transcript.py`

The current implementation is a Python CLI/session tool supporting Claude, Codex,
and direct-file ChatGPT JSONL. In addition to transcript rendering, it provides
session discovery, filtering, grep/search, record/time ranges, display policies,
and provider-specific interpretation.

The associated `AI-transcript-arch.md`, regression test script, and fixtures were
also reviewed.

### AgentPanelSpeaker

Baseline reviewed:

- user-supplied archive: `AgentPanelSpeaker-v212.zip`
- version: `v212`

The current implementation is a Windows C# application using WebView2 and SAPI.
It consumes Claude/Codex JSONL, renders a transcript, identifies speech fragments,
tracks stable node/word identities, supports searching/navigation, and maps visible
transcript words to speech positions.

The v212 archive also contains a bundled `tools/AI-transcript.py` used as a
reference formatter. That bundled copy is older than the current
`AI-General-Memory/scripts/AI-transcript.py` and therefore represents another
potential drift point.

## High-level comparison

| Area | DownloadConversation | AI-transcript.py | AgentPanelSpeaker v212 |
| --- | --- | --- | --- |
| Primary language | JavaScript | Python | C# |
| Primary environment | ChatGPT browser page/Tampermonkey | CLI/local files | Windows desktop/WebView2/SAPI |
| Providers currently handled | ChatGPT | Claude, Codex, ChatGPT | Claude, Codex |
| Raw-data acquisition | Live ChatGPT Conversation API + DOM fallback/recovery | Local JSONL/session stores | Watches/reads local JSONL |
| Provider interpretation | Embedded in userscript | Embedded provider-specific Python paths | Embedded independently in speech extractor and transcript formatter |
| Canonical shared model today | No | No | No |
| Turn/exchange model | Stable chronological records plus UAP-derived grouping | Provider-specific turn grouping; ChatGPT chronological record rendering | Extracted nodes plus source identity; speech/display paths independently infer structure |
| Markdown rendering | Yes, ChatGPT-specific | Yes, provider-specific | Yes, independent formatter for WebView transcript |
| Interactive turn navigation | Existing jump support; future reading planned | Not a primary runtime concern | Core application capability |
| Speech/highlight projection | Future requirement | No | Yes |
| Search | Minimal/current browser navigation | Rich grep/filter/session search | Rich rendered transcript search/navigation |
| Tests | Built-in production-path tests | Large regression shell suite + fixtures | Limited automated fixtures/tests relative to complexity |

## Shared semantic responsibilities already present

All three codebases contain logic that interprets AI conversation semantics rather
than merely performing platform-specific I/O. These overlapping responsibilities
are candidates for `AIConversationCore`.

### Provider record classification

Existing code distinguishes concepts such as:

- real User input;
- Assistant visible/final text;
- intermediate/commentary text;
- reasoning/thought summaries;
- tool calls;
- tool results;
- hidden/system/context records;
- attachments/images/files;
- citations;
- provider-specific interactive requests; and
- delegated/subagent activity.

The syntax differs by provider, but the applications repeatedly have to answer the
same semantic question: **what does this raw record mean?**

That question belongs in provider adapters in `AIConversationCore`.

### Ordering and identity

All three systems require stable source identity and ordering.

DownloadConversation currently deduplicates ChatGPT Conversation API messages by
stable message ID and constructs an oldest-to-newest record spine. It also derives
UAP associations from exact identifiers, safe linkage evidence, and chronological
containment.

AI-transcript.py retains JSONL record identity/order and has provider-specific turn
grouping for Claude/Codex. Its ChatGPT renderer operates chronologically and does
not require complete User/Assistant pairing.

AgentPanelSpeaker retains JSONL record/source identities and then builds local
node identities for display/speech/search mappings.

The common core therefore needs stable provenance and ordering, but **must not use
a complete User/Assistant pair as its primitive representation**.

### Structured visible content

Each application must distinguish text from non-textual or differently rendered
content. Common content concepts include:

- prose;
- code;
- citations and links;
- file references;
- images;
- artifacts;
- structured tool input/output; and
- reasoning/commentary.

These should become canonical content blocks. They should not be collapsed to
Markdown during normalization because both AgentPanelSpeaker and the planned
DownloadConversation turn reader need structured content for interactive use.

### Rendering/projection

The same semantic content currently feeds different projections:

- archival Markdown;
- searchable text;
- visible HTML/WebView transcript;
- speakable text; and
- stable source/word mappings.

The core should normalize once and then support multiple projections. A projection
may deliberately omit or transform content, but it must do so from canonical
semantics rather than by reparsing Markdown or reinterpreting raw provider records.

## Important application-specific differences

Not everything common-looking belongs in the core. The following differences are
real platform/application responsibilities.

### DownloadConversation-specific responsibilities

Keep these outside `AIConversationCore`:

- browser/Tampermonkey startup;
- authenticated Conversation API request capture;
- API pagination transport;
- DOM materialization/virtualization recovery;
- ChatGPT page navigation and mounting;
- browser wake lock;
- File System Access/download behaviour;
- recorder lifecycle/resume/recovery UI; and
- browser diagnostics/UI.

The core may interpret the records obtained by these mechanisms, but it must not
depend on browser/Tampermonkey APIs.

### AI-transcript.py-specific responsibilities

Keep these outside the core:

- CLI argument parsing;
- session discovery;
- local path/project discovery;
- record/time filtering syntax;
- output routing;
- ANSI/terminal display policy; and
- command-line grep orchestration.

Searchable canonical text may be supplied by the core, but CLI behaviour remains
Python application logic.

### AgentPanelSpeaker-specific responsibilities

Keep these outside the core:

- WinForms application behaviour;
- WebView2 hosting/windowing;
- SAPI synthesis;
- audio playback;
- actual speech timing callbacks;
- UI queues/mailboxes;
- Windows hotkeys; and
- application-specific playback state.

The core should provide semantic/display/speech source material and provenance;
it should not become a Windows speech engine.

## Provider differences that must remain explicit

Normalization must not mean pretending all providers emit identical conversations.
The core needs canonical categories plus extension/provider metadata.

### ChatGPT

Current observed concepts include:

- `channel: commentary` versus final Assistant content;
- thoughts/reasoning recap records;
- tool records and tool-specific content types;
- hidden system/model-editable context;
- grouped web citations and memory citations;
- hidden file citation markers;
- generated `sandbox:` artifacts;
- `sediment://` and other internal file/image pointers;
- multimodal user content; and
- exchange/working-turn identifiers.

### Claude

Current AI-transcript.py and AgentPanelSpeaker logic includes concepts such as:

- thinking blocks;
- assistant `tool_use` followed by user-role `tool_result` records;
- AskUserQuestion-style interactions;
- plan-mode interactions;
- synthetic notices;
- injected/sidechain/system context that should not be treated as ordinary User
  input; and
- delegated/subagent activity.

A provider adapter must preserve these distinctions even where another provider has
no exact equivalent.

### Codex

Current code includes concepts such as:

- `event_msg` and `response_item` envelopes;
- user messages;
- agent messages with phase/commentary distinctions;
- reasoning events;
- tool/function calls and outputs;
- user-input requests and responses;
- plan/task completion events;
- file-change/apply-patch activity; and
- task completion.

Again, equivalent concepts should normalize, while genuinely different semantics
remain explicit.

## AgentPanelSpeaker-specific findings that affect core design

AgentPanelSpeaker is especially important because it demonstrates requirements
that are easy to miss if the core is designed only as a Markdown exporter.

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