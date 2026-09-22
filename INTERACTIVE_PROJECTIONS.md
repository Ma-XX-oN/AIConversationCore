# Interactive projections

This document owns the design for Core-generated HTML units, canonical word identity, provenance, navigation boundaries, and lookup. It is referenced from `DESIGN.md` so interactive detail can evolve without turning the architecture index into a monolith.

## Responsibility boundary

Core owns semantic structure and stable interactive identity. Consumers own viewport/materialization policy, scrolling, platform speech engines, CSS/theme choices, and host interaction.

Consumers must not:

- split Core-declared atomic HTML units;
- retokenize canonical HTML to recreate word identity;
- use visible text as an identity fallback;
- reconstruct word-to-unit or word-to-block associations by searching rendered output;
- repair Core HTML structure downstream.

## Complete canonical HTML units

`renderCanonicalHtmlUnits()` returns complete Core-rendered units using the same serializer as `renderCanonicalHtml()`.

The initial legal virtualization boundary is one complete presentation turn. Each unit carries stable presentation/source identity and is atomic to downstream virtualization. Concatenating unit HTML in canonical order must reproduce the complete canonical HTML.

Nested semantic structures such as User Context, reasoning groups, tool disclosures, and subagents stay inside the owning unit. A finer virtualization boundary is a future Core API change, not a consumer heuristic.

Primary implementation:

- `src/projections/html.js`
- `src/projections/html-visibility.js`
- `src/projections/presentation.js`
- `src/projections/presentation-revisions.js`

Primary verification:

- canonical HTML rendering/unit tests;
- browser/ESM parity tests;
- AgentPanelSpeaker virtualization integration tests.

## Canonical word identity

Core owns one transcript-global numeric word identity space. Word IDs:

- begin at 1;
- increase monotonically and contiguously in canonical visible order;
- do not restart at turn/block/unit boundaries;
- are shared by HTML, speech/highlight, navigation, and lookup projections.

One canonical word is one canonical DOM identity. Ordinary words serialize as one `word-N` element. If inline Markdown formatting divides the visible characters of one word, Core restructures its own generated HTML so the formatting is nested inside the single word identity rather than exposing fragments that consumers must reassemble.

Public canonical HTML does not expose a second fragment identity or text-alignment path.

Primary implementation:

- `src/projections/word-identity.js` — current word allocation/provenance engine;
- `src/projections/word-element.js` — canonical word-element construction/serialization;
- `src/projections/html.js` — integration with rendered units.

`src/projections/word-identity.js` is recorded legacy size debt in `.github/file-size-policy.json`; it may not grow. The next substantive change to that responsibility must split it first.

## Ordered-list ordinals

An ordered-list ordinal is itself a canonical interactive/spoken word. Because the browser renders the marker structurally, the corresponding `<li>` is the canonical DOM element for that ordinal and carries its `word-N` identity.

The item body receives subsequent IDs. Nested ordered lists allocate identities on their own nested `<li>` elements. Unordered lists do not manufacture ordinal identities.

This supersedes the earlier concept of speech-only prefix tokens for ordered-list markers.

## Word provenance

Each canonical word carries Core-owned provenance sufficient to associate it with:

- presentation node;
- canonical event;
- canonical content block;
- block-relative word index;
- retained source metadata.

Core derives provenance from the same canonical structures and token grammar used to allocate word IDs. A mismatch is an invariant failure, not a reason to fall back to fuzzy text alignment.

`renderCanonicalHtmlUnits()`, `projectCanonicalWords()`, and `locateCanonicalWord()` expose the same authoritative word/provenance record.

## Separators

Canonical words retain exact visible whitespace immediately before each word in `separator_before` within the owning block.

The first word of each canonical block has an empty separator. Subsequent separators preserve spaces/newlines exactly. This allows speech/display consumers to segment the canonical stream while carrying existing word IDs, without reconstructing spacing from source Markdown or DOM text.

Separators are transport metadata on the existing word identity, not another identity mechanism.

## Navigation boundaries

Canonical word records expose `navigation_boundary_before` when a word begins a Core-owned structural navigation unit such as a paragraph, heading, list item, block quote, preformatted block, or table row.

Soft source newlines inside one paragraph are not promoted to structural boundaries; their exact newline remains available through `separator_before`.

Consumers may use this flag for sentence/section navigation while preserving canonical word IDs. They must not parse HTML to rediscover the same structure.

## High-level word lookup

`locateCanonicalWord(events, wordId, options)` is the canonical lookup operation for consumers holding a word handle whose HTML unit may not currently be materialized.

The result contains:

- the authoritative canonical word record;
- the complete Core-rendered unit containing that word.

A valid positive word ID absent from the selected projection returns `null`. Invalid handles are rejected.

Lookup is numeric-identity-only. Duplicate visible text, DOM search, consumer tokenization, or fuzzy matching are never fallback paths.

Core intentionally does not expose a public word-to-unit bookkeeping map. Consumers ask the high-level semantic question and remain free to manage their own viewport/window policy.

## Raw Markdown HTML

Raw HTML originating inside textual Markdown content is transcript content, not Core structure. The canonical HTML renderer escapes such raw HTML before inserting it into Core-owned structural containers.

Only HTML emitted by Core itself may participate in the canonical structural DOM. Structural parsers remain strict; they do not silently repair mis-nested Core HTML.

## Presentation tree relationship

The presentation tree is the provider-independent semantic structure upstream of HTML/Markdown serialization. It owns turn/reasoning/tool grouping and stable structural identity.

Relevant files:

- `src/projections/presentation.js`
- `src/projections/presentation-revisions.js`
- `src/projections/revision-visibility.js`
- `src/projections/structured.js`
- `src/projections/structured-visibility.js`

Word identity is derived downstream from this Core-owned structure; it is not a substitute for the structure itself.

## Consumer integration

### AgentPanelSpeaker.NET

May retain canonical numeric word handles, request units, virtualize/mount returned HTML, and map those handles to WebView2 highlighting/speech progress. It must not create a second tokenization or text-alignment layer.

### DownloadConversation

May use the same turn/unit/word projections for browser-side reading/navigation. Browser acquisition and UI remain DownloadConversation-owned.

### Other consumers

Any future consumer requiring equivalent word/turn semantics should use these same Core identities/projections. Platform-specific segmentation may transform the stream only while retaining authoritative Core handles/provenance.

## Key decisions

See `decisions/PRESENTATION-DECISIONS.md`, especially D017-D025, for the durable decisions governing presentation grammar, HTML units, word identity, lookup, provenance, separators, ordinals, and raw HTML.
