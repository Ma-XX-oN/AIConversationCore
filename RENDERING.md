# Canonical rendering contract

AIConversationCore owns the provider-neutral conversation semantics **and** the
canonical presentation contract used to turn those semantics into user-visible
transcripts.  Hosts may override documented presentation settings, but they must
not independently reinterpret canonical events into competing transcript
structures.

## Ownership boundary

AIConversationCore owns:

- provider normalization into canonical events and blocks;
- structural presentation units and safe atomic boundaries;
- source-record aliases associated with each structural unit;
- canonical Markdown structure;
- canonical semantic HTML structure;
- default stylesheet/theme values and stable semantic style roles; and
- format-independent display settings supported by the high-level render API.

Hosts own:

- provider data acquisition and authentication;
- persistence and transport;
- application window/chrome and controls;
- interaction policy such as search, speech, scrolling, and virtualization;
- resource fetching that requires host credentials; and
- explicit theme overrides supplied through the core contract.

A host that virtualizes or paginates canonical output must use presentation-unit
boundaries supplied by the core.  Provider/source record identity is provenance;
it is not by itself a safe rendering boundary.

## High-level API

`renderConversation(input, options)` is the preferred consumer entry point.
Lower-level adapters and renderers remain public for consumers that already own a
canonical event stream or need an individual projection stage.

The default input kind is `canonical`.  Provider-native input can be selected with
`input_kind: 'provider_records'` and a provider name supported by the artifact in
use.  The ESM API supports the canonical provider adapters available in the
repository.  The classic ChatGPT browser artifact deliberately adapts ChatGPT
provider records only.

Supported output formats are currently:

- `markdown`
- `html`

The returned object includes the selected content, canonical events, and the
versioned structural `presentation` model.  HTML results also include the
canonical stylesheet.  This keeps structure available to consumers without
requiring them to parse the generated Markdown or HTML to rediscover grouping.

## Presentation model

`buildCanonicalPresentation(events, options)` returns a versioned model whose
units retain both semantic structure and all participating source identities.

A presentation unit has:

- stable unit identity;
- semantic `kind`;
- parent identity where applicable;
- `boundary`, including `atomic` for indivisible structures;
- human-readable label when the structure defines one;
- canonical source event IDs; and
- provider/source record aliases.

Grouped reasoning is an important example.  Several source reasoning records may
render as one `Having N thoughts` disclosure.  The group is therefore one atomic
presentation unit even though every original source identity remains separately
addressable for speech, search, provenance, or navigation.

## Display settings and themes

Semantic display options are format-independent and are supplied through
`options.display`.  The initial high-level contract includes existing projection
settings such as provenance visibility, turn-ID display, and separate-thought
presentation.

Visual settings are supplied through `options.theme`.  The theme contains:

- semantic ANSI roles;
- semantic HTML class names; and
- CSS values such as fonts, font size, line height, foreground/background,
  heading/reasoning/tool/citation colours, code styling, borders, spacing, and
  radius.

Per-call theme overrides are merged with configured defaults.  Visual overrides
must not change presentation-unit identity or canonical grouping semantics.

## Markdown and HTML parity

Markdown and HTML are not separate semantic implementations.  The HTML renderer
uses the canonical Markdown projection and the same presentation model so thought
grouping, tool structures, citations, resources, provenance, and other established
semantics cannot silently drift between formats.

Automated regression tests require browser/ESM parity and protect grouped
reasoning through both formats.  HTML conversion also treats canonical disclosure
openings and closings as block structures so a `<details>` element cannot be
accidentally wrapped inside a paragraph.

## Compatibility

Existing lower-level APIs remain available while consumers migrate to the
high-level contract.  Presentation schema versions are explicit.  A consumer must
not infer a new structural meaning from a schema version it does not understand.

Consumer repositories should pin AIConversationCore to an exact Git commit and
move that pin only together with their own integration tests and review.

## Regression rationale

AgentPanelSpeaker.NET issue #18 demonstrated why this boundary is necessary.  Its
virtualizer treated every source record anchor as an independent rendering
boundary, splitting one grouped thought disclosure across sibling virtual
sections.  The immediate application fix kept `<details>` ranges intact, but the
architectural correction is for the core to expose the grouped structure and safe
boundary directly so future consumers do not have to reverse-engineer it from
rendered markup.
