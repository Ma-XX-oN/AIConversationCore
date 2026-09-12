# AIConversationCore Decisions

This file records durable architectural decisions, including later reversals or
superseding decisions. It exists so future work does not depend on chat history or
assistant memory to reconstruct why the project is shaped as it is.

When a decision changes, do not silently rewrite history. Add a new entry that
supersedes the old one and explain why.

## D001 — JavaScript is the canonical implementation language

**Status:** Accepted

**Decision:** Implement the shared core in JavaScript.

**Reason:** `DownloadConversation` must run in a browser/userscript environment,
which makes JavaScript the practical lowest common denominator. Python and C#
consumers should invoke or consume the shared implementation rather than maintain
independent normalization/rendering ports.

Performance is not currently expected to justify sacrificing a single canonical
implementation, because the dominant work is JSON traversal, string processing,
normalization, and serialization rather than numerically intensive computation.

## D002 — Canonical primitives are events; turns are derived

**Status:** Accepted

**Decision:** Model the canonical conversation as ordered/related events and derive
turns from those events.

**Reason:** A complete User/Assistant pair cannot be assumed. The project has
already encountered half-UAP situations, and the core must represent incomplete,
in-progress, commentary, tool, subagent, and branched activity without losing data
or forcing it into a pair.

User/Assistant pairs/UAPs may still be derived where useful, but they are not the
canonical storage primitive.

## D003 — Normalize model/provider differences without erasing them

**Status:** Accepted

**Decision:** Provider adapters map provider-specific records into common semantic
event/content categories while retaining provider-specific information and source
provenance.

**Reason:** Different systems expose commentary, reasoning summaries, tool
activity, subagents, hidden/system records, branches, citations, attachments, and
other concepts differently. Equivalent concepts should be normalized once, but
real semantic differences must remain representable.

Unknown or unsupported source data must not silently disappear.

## D004 — Rendering is downstream of normalization

**Status:** Accepted

**Decision:** Canonical events/content blocks are normalized before Markdown,
plain-text, speech, display, or other output projections are produced.

**Reason:** Markdown is only one consumer format. `AgentPanelSpeaker` and future
interactive `DownloadConversation` functionality need structured content and
stable identity/range information that would be lost or made ambiguous by using
Markdown as the interchange representation.

## D005 — One canonical Markdown renderer

**Status:** Accepted

**Decision:** Markdown serialization belongs in `AIConversationCore` and should be
shared by consumers.

**Reason:** `DownloadConversation` and `AI-transcript.py` already demonstrated
drift in code-fence language selection, sandbox/file handling, citation markup,
escaping, favicons/decorative markup, and whitespace. Those differences are parity
bugs unless explicitly documented as consumer-specific outer metadata.

## D006 — Preserve existing working behaviour during migration

**Status:** Accepted

**Decision:** Migrate incrementally, one vertical slice at a time, with regression
and parity tests before accepting each step.

**Reason:** The goal is consolidation without breaking behaviour that is already
correct. Extraction must not be used as an excuse to redesign unrelated working
logic. Unrelated defects or improvements require separate issues and commits.

Working chronological ordering/association must not be replaced based on
speculation; actual evidence of failure is required before changing it.

## D007 — Testing is part of the architecture

**Status:** Accepted

**Decision:** Previously-correct behaviour must be protected by automated tests,
real regression fixtures, golden outputs where appropriate, parity tests, and
consumer-level integration tests.

**Reason:** A new feature working is insufficient if extraction or refactoring
breaks existing correct behaviour. See `TESTING.md` for the mandatory completion
gate.

## D008 — Keep DownloadConversation as Tampermonkey during core migration

**Status:** Accepted

**Decision:** Do not convert `DownloadConversation` to a bookmarklet or browser
extension as part of the initial core migration.

**Reason:** Its recorder requires capabilities and lifecycle behaviour better
suited to a userscript/extension than a bookmarklet. Changing browser packaging at
the same time as the transcript architecture would introduce an unrelated major
variable. A browser extension remains a possible later upgrade.

## D009 — Interactive turn consumption is a core use case

**Status:** Accepted

**Decision:** Design canonical turns/content and shared projections so they support
interactive turn reading/navigation in addition to export.

**Reason:** `AgentPanelSpeaker` already needs structured display/speech/highlight
semantics, and `DownloadConversation` is expected to gain similar turn-reading
functionality in the near future. This affects the model now: stable turn/block
identity, ordering, provenance, and source/display/spoken range mapping must not be
lost merely because the first shared output is Markdown.

Where both applications need equivalent semantic interpretation for turn reading,
speech, display, or highlighting, that interpretation should live in the core.
Platform-specific audio engines, WebView/browser UI, playback controls, and other
host behaviour remain in the consuming application.

## D010 — Repository documentation carries project-management context for now

**Status:** Accepted

**Decision:** Do not use GitHub Projects at this stage. Keep project phases and
current direction in `ROADMAP.md`, concrete work and defects in GitHub Issues,
architecture in `DESIGN.md`, testing requirements in `TESTING.md`, and durable
decisions/reversals in this file.

**Reason:** The currently available GitHub integration does not expose reliable
GitHub Projects management. Project state still needs to survive across
conversations, so it must be baked into repository documentation rather than left
in chat history.

## D011 — AI-transcript.py is the default multi-provider migration behaviour source

**Status:** Accepted, amended by D012

**Decision:** During migration, the current
`AI-General-Memory/scripts/AI-transcript.py` behaviour is the default canonical
behavioural/rendering reference for every provider it recognizes, currently
ChatGPT, Claude, and Codex.

This does not supersede D001. The final shared implementation remains JavaScript.
The Python script is the behavioural source to extract from, not the architecture
to copy wholesale.

**Reason:** `AI-transcript.py` already contains the broadest unified interpretation
and rendering behaviour across the recognized providers. Treating separate
consumer renderers as equal authorities would leave the migration without a stable
default target and would preserve existing drift instead of eliminating it.

Provider-specific interpretation must therefore be decomposed behind independent
adapters into one canonical event/block/turn model and shared renderers. Future
providers should enter through the same adapter boundary rather than gaining their
own renderer.

A specific `AI-transcript.py` behaviour may be superseded only when separately
tracked evidence proves a defect or a host has a verified capability the standalone
Python process cannot supply.

## D012 — ChatGPT citation and image exceptions require explicit provenance

**Status:** Accepted

**Decision:** Two ChatGPT semantics currently supersede or qualify the default
`AI-transcript.py` authority:

1. ChatGPT citation rendering uses verified `DownloadConversation` behaviour as
   canonical. Existing browser/screenshot evidence showed the Python citation
   presentation was not correct enough, while DownloadConversation matched the
   intended transcript presentation better.
2. ChatGPT image semantics preserve verified source-position and
   missing/unavailable behaviour while allowing DownloadConversation's
   authenticated API/resource-resolution evidence to supply capabilities the
   standalone Python process cannot.

These are narrow semantic exceptions. They do not make DownloadConversation the
canonical source for unrelated ChatGPT behaviour, and they do not move
browser/application APIs into the core.

For any additional difference between `AI-transcript.py`, DownloadConversation, or
another verified implementation, the implementation choice must not be inferred by
an AI agent. The alternatives and evidence must be presented to the user, and the
user's selected resolution must be recorded before it is incorporated into a
canonical golden or shared implementation.

**Reason:** The canonical transcript must be composed from verified behaviour, not
from whichever implementation an agent happens to prefer. Explicit provenance and
user resolution prevent the wrong pieces of competing implementations from being
silently combined.

## D013 — Tool call/result correlation requires explicit source identity

**Status:** Accepted

**Decision:** Normalize provider tool activity into canonical `tool_call` and
`tool_result` events/blocks, but populate call/result correlation only when the
source provider supplies an explicit correlation identifier.  Do not infer a
relationship merely because a result follows a call chronologically.

Claude `tool_use.id` / `tool_result.tool_use_id` and Codex `call_id` are explicit
correlation evidence and therefore populate canonical `call_id` and
`relationships.tool_call_id`.  The established rich ChatGPT fixture has code-tool
calls and tool-role results but no explicit source correlation ID, so those fields
remain null for that evidence set.

Special tool behaviours remain provider semantics layered on the canonical tool
shape.  Names and raw payloads such as Claude `AskUserQuestion`, `ExitPlanMode`,
`Agent`, and Codex `request_user_input` / `apply_patch` must be preserved so later
renderers can reproduce their established presentation without flattening them
into generic text during normalization.

**Reason:** Call/result is a semantic relationship, not an ordering heuristic.
Inventing correlation from adjacency would violate the project's evidence and
chronology rules and could associate unrelated tool activity.  Preserving explicit
provider IDs gives the shared model a common relationship where it is proven while
retaining uncertainty where the provider evidence does not establish one.

## D014 — Projection styling uses semantic roles exposed through the core API

**Status:** Accepted

**Decision:** Shared display/header projections must represent style intent with
semantic roles rather than embedding ANSI colours, HTML/CSS classes, or other
format-specific styling directly in canonical conversation data or provider
adapters.

Initial turn-header style roles include at least:

- `user-heading`
- `assistant-heading`
- `timestamp`
- `record-number`
- `turn-id`

The core projection API must expose these roles and their default mappings through
a documented configuration surface.  The intended API shape is a shared/default
configuration or theme setup function, with per-render overrides where useful.
Consumers must not need to duplicate the semantic-role definitions themselves.

ANSI rendering maps the roles to terminal styles.  HTML rendering maps the same
roles to stable semantic classes or equivalent structured style metadata.
Plain-text rendering ignores presentation styling while retaining the same header
component structure.  Other consumers may map the roles to their own presentation
system.

The default ANSI grammar preserves established behaviour: User headings are
yellow, Assistant/provider headings green, timestamps cyan, and record numbers
dim.  `turn-id` receives its own default role/style, currently intended to be
magenta/purple.  Those colour choices are projection defaults, not canonical
conversation semantics.

`AgentPanelSpeaker` must therefore be able either to consume core-generated HTML
with stable semantic classes or to consume structured header components/style
roles and map the roles into WebView2/CSS itself.  Provider adapters must never know
about these colours or CSS classes.

**Reason:** ANSI is only one presentation target.  The same semantic header data
will be useful in terminal output, HTML/WebView2, browser UI, and future display
projections.  Separating semantic style roles from format-specific presentation
prevents styling knowledge from being duplicated across consumers and keeps the
core API suitable for both `AI-transcript.py` and `AgentPanelSpeaker`.

## D015 — Renderer debug provenance uses source record identity

**Status:** Accepted

**Decision:** Renderer debugging metadata uses the DownloadConversation-compatible
HTML comment fields `turn_id` and `record_index`.  For canonical provider events,
`turn_id` is the preserved provider/source record identity (`source_record_id`),
not the separately derived canonical turn ID.  `record_index` is the zero-based
source record index (`source_index`).

When debugging is enabled, every renderer-generated heading or grouping structure
is annotated with this source provenance, including User/Assistant headings,
commentary headings, sub-agent headings, Question headings, Plan headings, thought
or tool details groups, and equivalent future renderer-generated structures.
When one generated group represents multiple source records, the first source
comment is attached to the opening/summary line and subsequent source comments are
emitted on immediately following lines.

**Reason:** This is debugging instrumentation.  It must expose every generated
structural boundary back to the source records that caused it, and it must use the
same identity vocabulary already consumed by DownloadConversation rather than
introducing a competing `record_id` output field.

## D016 — ChatGPT response and thought/commentary grammar

**Status:** Accepted, generalized by D017

**Decision:** Each rendered ChatGPT response begins with exactly one `## ChatGPT`
heading.  Commentary inside that response is headed `### ChatGPT Commentary`.
Consecutive thought/reasoning activity is grouped under
`<details><summary>Having a thought</summary>...</details>` for one item or
`<details><summary>Having N thoughts</summary>...</details>` for multiple
consecutive items.  Commentary ends the current consecutive thought run; later
thought activity begins a new group.

**Reason:** This is the user-selected canonical ChatGPT transcript grammar for the
Phase 6 migration and resolves the previously undecided difference surfaced by the
strict historical AI-transcript.py parity gate on 2026-08-30.

## D017 — Provider-independent presentation tree and rendering grammar

**Status:** Accepted

**Decision:** Provider-specific rendering differences end at canonical normalization
unless a provider exposes a semantic that cannot be represented by the shared model.
ChatGPT, Claude, Codex, subagents, and future agents use one presentation grammar
after normalization.

Each rendered User/Agent/Subagent turn has one heading and one outer response
container. User attachments are presented before the User Markdown body unless
actual provider evidence establishes inline-media semantics. Agent content remains
in source order inside the same outer response container.

Consecutive reasoning activity forms one `reasoning_group`. Ordinary tool calls and
results occurring during that reasoning run are children of the reasoning group and
are therefore hidden when the group is collapsed; a tool may itself use a nested
disclosure for its payload. A visible response/commentary item ends the current
reasoning run but does not end the surrounding Agent turn. Later reasoning starts
another reasoning group in that same turn.

A reasoning group serializes to one `<details>` disclosure whose summary is
`Having a thought` for one reasoning item or `Having N thoughts` for multiple
reasoning items. Paragraphs within one reasoning record are paragraphs, not
separate thoughts. Renderers must not insert synthetic separators such as `***` or
horizontal rules between reasoning records unless that separator exists in source
content or a separately accepted presentation decision explicitly requires it.

Textual User/Agent content is Markdown content. HTML consumers render structural
HTML directly from the canonical presentation tree and run only textual content
nodes through a Markdown-to-HTML parser. Fenced code is recognized as a code block;
its payload is escaped/prettified rather than recursively interpreted as Markdown
or HTML. Canonical Markdown is an independent serialization/output target and must
never be used as the semantic interchange representation from which an HTML
consumer reconstructs turn, reasoning, tool, or source-identity structure.

Source identity and structural identity remain explicit on presentation-tree nodes
so interactive consumers can map search, speech, highlighting, virtualization, and
navigation without relocating Markdown comments or inferring `<details>` ownership
from rendered text.

D016's thought-run rule is generalized by this decision; its ChatGPT-specific
wording describes the historical case that established the grammar, not a
provider-specific exception.

**Reason:** Equivalent canonical semantics must render equivalently across
providers. Provider-specific Markdown assembly caused structural divergence,
synthetic separators, invalid disclosure boundaries, and consumer-side
reparsing/repair. A shared presentation tree makes the semantic grouping
authoritative once and allows HTML, Markdown, speech, and other projections to
serialize the same structure without rediscovering it.


## D018 — Canonical HTML exposes Core-owned complete virtualization units

**Status:** Accepted

**Decision:** Interactive consumers that virtualize canonical HTML use
Core-rendered complete HTML units. The initial legal cut is one complete
presentation turn per unit. Each unit carries its stable presentation ID,
source-record identities, an explicit atomic contract, and already-rendered
canonical HTML.

`renderCanonicalHtmlUnits()` and `renderCanonicalHtml()` use the same Core HTML
serializer. Concatenating unit HTML in canonical order must reproduce the
complete canonical HTML exactly. User Context, reasoning groups, tools, and
other nested semantic containers remain entirely inside a returned unit; a
consumer must not split a unit or infer a finer boundary from `<details>`, CSS
classes, record-anchor counts, or provider markers.

The presentation tree continues to expose nested atomic semantics. The
complete-turn unit boundary is deliberately conservative and does not claim
that turns are inherently indivisible at every future projection level. A
future finer-grained virtualization API must be defined and rendered by Core
with an explicit versioned contract before consumers may cut more finely.

**Reason:** AgentPanelSpeaker demonstrated that slicing completed HTML around
source anchors can bisect a semantically atomic disclosure even when all source
identities are retained. Moving `<details>` inference into the consumer would
recreate Core presentation semantics downstream and violate D017. Core-owned
rendered units preserve one HTML renderer while giving interactive consumers a
safe virtualization boundary.

## D019 — Canonical word identity is one Core-owned DOM element

**Status:** Accepted

**Decision:** AIConversationCore owns canonical interactive-word tokenization and
the HTML restructuring required to serialize that identity. Each canonical word
has one global numeric word ID and exactly one canonical DOM word element,
serialized as `<span id="word-N">...</span>`. If Markdown or another inline
presentation construct divides the visible characters of one word across nested
HTML elements, Core restructures its own generated HTML so the relevant formatting
is nested inside that one word element.

Core may use piece-level markers internally while producing the final projection,
but those markers are not part of the public HTML contract and must be collapsed
before HTML leaves Core. Public canonical HTML does not expose secondary
`data-word-id` fragments for one word.

Consumers must not retokenize canonical HTML, repair Markdown boundaries, reassemble
word fragments, search duplicate text to rediscover identity, or introduce a
fallback word-identity path. The ESM and browser-bundle projections must implement
the same Core-owned result.

This decision supersedes the piece-fragment serialization wording originally added
to `DESIGN.md` during issue #80. It does not change the global numeric word-ID
coordinate space or the requirement that HTML and speech/highlight projections use
the same authoritative IDs.

**Reason:** One canonical word is one interactive object. Exposing one logical word
as several DOM objects pushes Core semantics into every consumer and creates the
exact divergence the shared core exists to prevent. The corrected #80 regressions
cover both `turn_id**s**`, where formatting begins inside the word, and `` `turn_`id
``, where inline code ends before the word ends. Both must leave Core as one word
element without consumer-side reconstruction.

## D020 — Word-handle lookup is a high-level Core operation

**Status:** Accepted

**Decision:** A consumer that holds a canonical numeric word ID asks
AIConversationCore to locate that word rather than maintaining a parallel
word-to-unit index. The public lookup operation returns the authoritative canonical
word record together with the complete Core-rendered unit containing it. A valid
word ID that is absent from the selected projection returns `null`; invalid handles
are rejected.

Lookup uses canonical numeric identity only. Visible text, duplicate text, DOM
search, consumer tokenization, and fallback alignment are not valid lookup paths.
Core retains freedom to change its internal lookup strategy without exposing its
bookkeeping as a public mapping table.

The consumer continues to own viewport selection, window size, scrolling, and when
to materialize the returned unit. Core owns the semantic question of which
canonical unit contains a canonical word. The ESM and browser-bundle APIs expose
the same operation.

**Reason:** Virtualized consumers such as AgentPanelSpeaker can hold a valid word
identity whose containing HTML unit is not currently materialized. Requiring the
consumer to reconstruct a word-to-unit map would duplicate Core semantics and make
identical visible text ambiguous. A high-level Core lookup preserves one identity
model while keeping UI/window policy outside Core.

## D021 — Canonical words carry Core-owned source provenance

**Status:** Accepted

**Decision:** Every canonical interactive word exposed by Core carries the stable
canonical provenance needed to associate that word with its presentation node,
event, content block, block-relative word position, and source metadata.  The
word's global numeric `id` remains its authoritative cross-boundary identity.

`renderCanonicalHtmlUnits()` exposes this provenance on each `speech_words`
record.  `locateCanonicalWord()` returns the same word record, including the same
provenance.  Consumers must not reconstruct this relationship by matching visible
text, counting independently tokenized words, correlating DOM fragments, or
maintaining a second word-to-content identity model.

Core verifies provenance against the same canonical word grammar and rendered
content used to allocate word IDs.  If block-level provenance cannot be reconciled
exactly with the rendered canonical word sequence, Core treats that as an invariant
failure rather than selecting a best-effort or fallback association.

**Reason:** A complete rendered turn can contain multiple canonical events and
blocks, including reasoning, commentary, final response text, User Context, and
ordinary User content.  A unit-level lookup alone cannot tell a speech/display
consumer which event/block owns a word when several sources share one turn or even
identical visible text.  Keeping that relationship in Core prevents the same
consumer-side alignment machinery that D019 and D020 were introduced to remove.


## D022 — Canonical word streams retain Core-owned separators

**Status:** Accepted

**Decision:** Every canonical interactive word record retains the exact visible
whitespace that precedes that word inside its owning canonical content block as
`separator_before`.  Core derives this value from the same rendered visible stream
and token grammar that allocate the global numeric word ID.  The first word in each
block starts with an empty separator; spaces and newlines between later words are
preserved exactly.

The separator is part of the canonical word projection, not a second identity or a
consumer hint to re-tokenize text.  `renderCanonicalHtmlUnits()`,
`projectCanonicalWords()`, and `locateCanonicalWord()` return the same enriched word
record, and the browser bundle remains equivalent to the ESM API.  The public HTML
contract remains one `<span id="word-N">...</span>` per canonical word.

Consumers may use these separators to divide the canonical word stream into
platform-specific speech/display segments while carrying the existing word IDs
through the transformation.  They must not recover identity by text search,
subsequence matching, independent tokenization, or reconstructed ordinals.

**Reason:** AgentPanelSpeaker needs to preserve Core word IDs while its speech layer
applies sentence, fence-line, and other platform-specific segmentation.  Word text
and provenance alone omit the spaces/newlines that define those boundaries.  If the
consumer reconstructed them from rendered/source text, it would recreate the
alignment machinery D019–D021 were intended to remove.  Core already has the exact
visible stream at word-allocation time, so retaining its separators keeps one
identity path and makes the transformation lossless without a fallback.

## D023 — Structural speech prefixes are Core-owned but are not word identities

**Status:** Accepted

**Decision:** Canonical words may carry `speech_prefix_before`, a Core-owned
structural string that a speech consumer emits immediately before that word.  The
initial use is the resolved marker of an ordered-list item, such as `3. ` before
the first canonical word in that item.  Words without such structure carry an
empty prefix.

A structural prefix is not a canonical transcript word.  Its characters do not
receive numeric `word_id` values and do not create additional `word-N` DOM
elements.  Consumers may tokenize the prefix for their platform speech engine,
but those structural speech tokens have no word handle.  Consumers must not
fabricate IDs for them, borrow an adjacent word ID, or parse source Markdown to
reconstruct list ordinals.

`renderCanonicalHtmlUnits()`, `projectCanonicalWords()`, and
`locateCanonicalWord()` expose the same prefix-enriched canonical word records.
The prefix is derived from Core-owned rendered structure, including
`data-list-ordinal`, in the same projection pass that allocates word IDs.

**Reason:** Issue #72 established that ordered-list ordinals are Core semantics and
must be available to speech consumers, while issue #75 exposed that the previous
HTML-only ordinal metadata was insufficient to carry word identity through a real
speech pipeline.  Treating an implicit list marker as a fake word would violate
D019's one-word/one-DOM-element contract; parsing the list again in a consumer
would duplicate Core semantics.  An explicit structural speech prefix preserves
both invariants.


## D024 — Ordered-list ordinals are canonical word identities

**Status:** Accepted; supersedes D023 for ordered-list ordinals and narrows the span-only wording of D019.

**Decision:** An ordered-list ordinal is a canonical interactive/spoken word with its own transcript-global numeric `word_id`. Because the browser renders the list marker structurally, the corresponding `<li>` is the one canonical DOM word element for that ordinal and carries `id="word-N"`. The item body receives subsequent canonical word IDs normally. Nested ordinals identify their own nested list items.

There is no separate prefix-token identity, null-handle structural token, hidden ordinal mapping element, or consumer-side structural-highlight association. `speech_words`, `projectCanonicalWords()`, and `locateCanonicalWord()` expose the same ordinal identity as the HTML.

**Reason:** AgentPanelSpeaker's established interaction contract highlights the entire list item while its number is spoken, then returns to ordinary word highlighting for the body. Putting the canonical ordinal ID directly on the `<li>` expresses that behaviour with the existing one-ID/one-DOM-element model and eliminates the synthetic ordinal mapping and the incorrect no-ID prefix design.
