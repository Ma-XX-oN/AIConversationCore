# Canonical Presentation and Rendering Contract

This document is normative. It records the shared presentation rules used by
`AIConversationCore` and all consumers so rendering behaviour does not depend on
provider-specific implementations or chat history.

## Core rule

Provider-specific behaviour ends at normalization unless a provider exposes a
real semantic that cannot be represented by the canonical model. Equivalent
canonical semantics use the same presentation rule for ChatGPT, Claude, Codex,
subagents, and future providers.

The canonical flow is:

```text
provider records
  -> canonical events/content
  -> canonical presentation tree
  -> output-specific serialization/projection
```

Markdown is an output format, not an interchange format between canonical
semantics and HTML. HTML consumers must not parse a complete generated Markdown
transcript to rediscover headings, response containers, reasoning groups, tools,
or source-record boundaries.

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
independent canonical facts and are projected consistently into Markdown and the
structured presentation tree. Recorded Codex IDE context is transcript content and
must be preserved verbatim.

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

produces:

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

## Markdown content inside structural HTML

User/Agent text bodies are Markdown content. HTML output converts each Markdown
content node to an HTML fragment, but structural HTML is produced from the
presentation tree itself.

Correct:

```text
presentation tree
  -> emit structural <h2>/<blockquote>/<details>/tool containers directly
  -> convert each Markdown content node to an HTML fragment
```

Incorrect:

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

Presentation nodes retain stable source identity and ordered source aliases.
Interactive consumers use those declared identities for virtualization, search,
speech, and highlighting. They must not relocate provenance comments through
Markdown or infer semantic boundaries from rendered `<details>` tags.

The presentation model must support at least:

- turn identity and actor;
- ordered content nodes;
- reasoning groups and individual reasoning items;
- tool calls/results and their correlation;
- Markdown content nodes;
- attachments/resources;
- stable source record/block identities; and
- declared atomic presentation boundaries.

## Output projections

HTML and Markdown are independent serializers of the same presentation tree.
Neither serializer owns grouping semantics.

AgentPanelSpeaker should consume the presentation tree and render structural HTML
directly, converting only Markdown content nodes with its Markdown engine.
DownloadConversation may continue to use canonical Markdown for archival export.
Future browser/desktop readers should consume the same presentation structure for
interactive HTML rather than reparsing canonical Markdown.
