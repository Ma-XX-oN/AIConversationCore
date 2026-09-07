# Canonical Presentation and Rendering Contract

This document is normative. It records the shared presentation rules used by
`AIConversationCore` and all consumers so rendering behaviour does not depend on
provider-specific implementations or chat history.

## Core rule

Provider-specific behaviour ends at normalization unless a provider exposes a
real semantic that cannot be represented by the canonical model. Equivalent
canonical semantics use the same presentation rule for ChatGPT, Claude, Codex,
subagents, and future providers.

Once provider input has been normalized, there are exactly two canonical semantic
rendering paths:

1. canonical Markdown via `renderCanonicalMarkdown()`; and
2. canonical HTML via `renderCanonicalHtml()`.

The canonical flow is:

```text
provider records
  -> canonical events/content
  -> canonical presentation semantics
  -> canonical Markdown
  -> canonical HTML
```

The final two arrows above are independent output paths from the same normalized
semantics; HTML is not produced by reparsing the complete canonical Markdown
transcript. Core owns the semantic rendering decisions for both outputs.

Downstream consumers must not reinterpret provider-specific markers, duplicate
presentation grouping rules, or implement a parallel semantic renderer. They
integrate one of the completed canonical outputs. UI-specific styling, navigation,
virtualization, search, speech mapping, and similar application concerns remain
consumer responsibilities, but they must not change transcript semantics.

For every Core rendering change, the same normalized fixture must be exercised
through both canonical renderers. Both outputs must be verified before the Core
change is considered complete.

## Source ownership and loading

Callers own **source discovery and origin**. The core owns **reading, parsing, and
interpretation of sources that the caller supplies**. Provider-specific filesystem
locations are therefore outside the core contract: the core does not search
`~/.codex`, `CODEX_HOME`, Claude project directories, upload folders, or backups.

Node consumers may use `loadConversationSources()` with a primary source and
optional supplementary sources. A source may be supplied as `{ path }`, `{ text }`,
or `{ records }`; a bare string is treated as a path. This preserves a lower-level
records API for tests and embedded callers while allowing ordinary consumers to
hand file paths to the core rather than implementing JSONL parsing themselves.

For Codex, `supplementarySources.codexSessionIndex` is optional. When supplied,
the core reads and parses the session index and resolves the last valid matching
`thread_name` for the rollout/session UUID. Consumers discover the index path but
do not duplicate its interpretation.

Codex rollback history is hidden by default. Passing
`options.includeRolledBackTurns = true` exposes historical revisions. Revision
state (`original`, `superseded`, `edited`) and execution state (`aborted`) are
independent canonical facts and are projected consistently into Markdown and HTML.
Recorded Codex IDE context is transcript content and must be preserved verbatim.

## Turn structure

A visible User, Agent, or Subagent turn has one heading and one outer response
container. Source/presentation order inside the turn is authoritative.

Conceptually:

```html
<h2>AgentName ...</h2>
<blockquote>
  ...ordered presentation children...
</blockquote>
```

The underline commonly shown below a heading is presentation styling (for example
a CSS `border-bottom` on `h2`), not transcript content and not an inserted
horizontal rule.

## Reasoning groups

A consecutive run of reasoning activity forms one collapsible reasoning group.
The group ends when visible response/commentary content is emitted. Ending a
reasoning group does not end the outer Agent turn. Later reasoning begins another
reasoning group inside that same turn.

Ordinary tool calls/results that occur during reasoning are children of the active
reasoning group. They may themselves use nested collapsible presentation for tool
payloads. Collapsing the reasoning group therefore hides ordinary reasoning tool
activity as well as reasoning text.

Equivalent canonical input:

```text
reasoning A
reasoning B
tool call
tool result
reasoning C
visible response
reasoning D
visible response
```

produces canonical HTML equivalent to:

```html
<h2>AgentName ...</h2>
<blockquote>
  <details class="reasoning">
    <summary>Having 3 thoughts</summary>
    <div class="thought">A...</div>
    <div class="thought">B...</div>
    <details class="tool">...</details>
    <div class="thought">C...</div>
  </details>

  <div class="response">...</div>

  <details class="reasoning">
    <summary>Having a thought</summary>
    <div class="thought">D...</div>
  </details>

  <div class="response">...</div>
</blockquote>
```

No synthetic `***`, `<hr>`, or equivalent separator is inserted between thoughts.
A separator is rendered only when it exists in source Markdown or an explicit,
documented presentation policy requires one.

Paragraph boundaries inside one reasoning record remain paragraphs inside that
one thought. They do not create additional thoughts or response containers.

## Markdown content inside canonical HTML

User/Agent text bodies may contain Markdown semantics. The canonical HTML renderer
converts those Markdown leaves to HTML inside Core while also emitting the
canonical structural containers.

Correct:

```text
normalized canonical events
  -> Core presentation semantics
  -> Core emits structural <h2>/<blockquote>/<details>/tool containers
  -> Core converts Markdown leaves to HTML
  -> completed canonical HTML
```

Incorrect:

```text
normalized canonical events
  -> downstream consumer rebuilds presentation structure
  -> downstream consumer converts Markdown leaves with its own semantic renderer
```

Also incorrect:

```text
canonical events
  -> generate a whole Markdown transcript
  -> inject/rewrite structural Markdown and provenance markers
  -> parse the whole generated document as HTML
  -> infer semantic structure again
```

Fenced Markdown code becomes a code block. Fence contents are not recursively
interpreted as Markdown/HTML; they are escaped and may be syntax-highlighted or
otherwise prettified by the output renderer.

## User attachments

Verified current presentation places User attachments/images in an attachment area
before the User textual body. Do not invent arbitrary image/text interleaving from
the mere fact that the canonical model can preserve source block order. If a
provider later supplies evidenced inline-media semantics, add that capability as a
separate documented semantic.

Conceptually:

```html
<h2>User ...</h2>
<blockquote>
  <div class="attachments">...</div>
  <div class="message">...Markdown body rendered to HTML...</div>
</blockquote>
```

## Provider normalization examples

Provider adapters normalize equivalent records into common semantics:

```text
Claude thinking    -> reasoning
ChatGPT thought    -> reasoning
Codex reasoning    -> reasoning

provider tool call -> tool_call
provider tool result -> tool_result
```

Once normalized, those semantics use one rendering grammar. A provider-specific
renderer exception requires demonstrated semantic evidence, not historical
implementation differences.

## Source identity and interactive consumers

Canonical HTML retains stable source identity required by interactive consumers.
Consumers may use those declared identities for virtualization, search, speech,
highlighting, and navigation. They must not derive transcript semantics from
provider records or recreate canonical presentation grouping.

The internal presentation model supports at least:

- turn identity and actor;
- ordered content nodes;
- reasoning groups and individual reasoning items;
- tool calls/results and their correlation;
- Markdown content nodes;
- attachments/resources;
- stable source record/block identities; and
- declared atomic presentation boundaries.

That internal representation exists so the two Core serializers share semantics;
it is not permission for downstream consumers to implement a third semantic
rendering path.

## Output projections

Canonical Markdown and canonical HTML are the two Core-owned semantic serializers
of the same normalized semantics. Neither downstream caller owns grouping or
provider interpretation.

`DownloadConversation` may consume canonical Markdown for archival export.
`AgentPanelSpeaker` and browser/desktop readers should consume completed canonical
HTML and add only application integration such as styling, DOM lifecycle,
virtualization, navigation, search, speech, and highlighting. They must not render
presentation-node semantics themselves or reparse canonical Markdown to recover
those semantics.
