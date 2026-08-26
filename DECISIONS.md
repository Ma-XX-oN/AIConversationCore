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
