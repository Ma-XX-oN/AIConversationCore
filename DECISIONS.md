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
roles and map them into WebView2/CSS itself.  Provider adapters must never know
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

**Status:** Accepted

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
