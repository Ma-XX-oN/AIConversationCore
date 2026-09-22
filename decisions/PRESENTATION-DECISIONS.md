# Presentation decisions (D017-D027)

The decision text below is preserved from the former monolithic `DECISIONS.md`.

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

## D025 — Raw Markdown HTML is content, not Core structure

**Status:** Accepted

**Decision:** Raw HTML syntax that originates inside a canonical textual Markdown
leaf is transcript content. The canonical HTML renderer escapes Marked raw-HTML
tokens before inserting the rendered leaf into Core-owned presentation containers.
Only structural HTML emitted by Core itself may participate in the canonical DOM.
The escaped source characters remain visible content and retain ordinary canonical
word identity. Fenced code continues to use the existing code-block escaping rule.

Core's structural parsers remain strict. They must not recover from mis-nested or
unbalanced HTML by silently popping ancestors, and consumers must not add fallback
repair paths for malformed canonical HTML.

**Reason:** Real-machine AgentPanelSpeaker testing exposed a Codex transcript that
made raw Markdown HTML survive Marked and reach Core's word-element restructuring
pass, where it failed with `Canonical HTML closes unexpected <blockquote>.` Raw
transcript text must never be able to close or reparent Core's own turn, reasoning,
tool, or other semantic containers. Escaping at the Markdown-leaf boundary keeps
source text visible while preserving D017's rule that Core alone owns presentation
structure and D019's one canonical word-identity path.


## D026 — Heading semantics and debug provenance are Core-owned

**Status:** Accepted; supersedes D015 wherever D015 allows consumers to supply semantic heading/debug values.

**Decision:** AIConversationCore derives transcript-heading semantics from canonical source provenance and owns their serialization. Public consumers may select presentation policy only: whether timestamp, one-based source record number, source/provider turn ID, and debug provenance are shown, plus presentation settings such as timezone or styling. Consumers do not supply the semantic values themselves and do not construct `turn_id=...`, record-number, timestamp, or debug-comment text.

For composite Assistant turns, the enclosing Assistant heading is owned by the final Assistant message source when one exists. Commentary and other independently headed structures retain their own source provenance. Related-source structures, including Claude sub-agent invocation headings, receive the same Core-derived metadata treatment. Debug comments use Core's canonical `record_id` and zero-based `record_index` fields and are rendered by Core.

The structured presentation tree carries the same derived heading metadata used by Markdown and HTML so virtualization can mount Core-owned units without reconstructing presentation semantics. Classic-browser and ESM entry points use the same projection policy and rendering contract.

**Reason:** Presentation meaning must not diverge between DownloadConversation, AI-transcript, AgentPanelSpeaker, or future consumers. Keeping semantic values and formatting in Core prevents duplicate/mismatched metadata when one visible response spans multiple provider records and preserves one authoritative representation for virtualization.

## D027 — Visible Turn IDs are unlabeled values

**Status:** Accepted; refines D026 visible Turn-ID serialization.

**Decision:** When Turn ID visibility is enabled, Core serializes the native source/provider Turn ID as the bare visible value. The semantic metadata field remains `turn_id`, but the visible heading component does not include a `turn_id=` label. Metadata order remains speaker, timestamp, record number, then Turn ID.

Debug provenance is unaffected and remains explicitly labelled with `record_id=` and zero-based `record_index=` inside the Core-owned debug comment. Consumers must not add or remove the Turn-ID label themselves.

**Reason:** The Turn ID is already an independently selectable, semantically styled heading component. Repeating its field name in every visible heading adds noise without adding identity information. Keeping the formatting decision in Core preserves the shared presentation contract across Markdown, HTML, structured presentation, and all consumers.
