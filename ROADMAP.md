# AIConversationCore Roadmap

This file is the repository-backed source of truth for planned migration phases
and current project direction. GitHub Projects is not being used at this time, so
project-management state that would otherwise live there must be kept here and in
GitHub Issues.

## Working principles

- Work is staged; do not perform a wholesale rewrite.
- Preserve previously-correct behaviour unless there is concrete evidence that it
  is wrong.
- Unrelated defects or improvements are separate issues and separate commits.
- Testing is mandatory for each migration step. See `TESTING.md`.
- Architecture and invariants live in `DESIGN.md`.
- Durable decisions and reversals live in `DECISIONS.md`.
- AI-specific change discipline lives in `AI_AGENT_RULES.md`.

## Phase 1 — Canonical model

Define and test the canonical event/content model before migrating large bodies of
application code.

Required capabilities include:

- heterogeneous provider/model records
- commentary/intermediate assistant content
- reasoning/thought summaries when exposed
- tool calls and tool results
- subagents/delegated activity
- system/context records
- attachments, images, citations, and artifacts
- hidden/visible distinctions
- parent/child, call/result, branch, and exchange relationships
- incomplete conversations and half-turn situations
- derived turns that can be addressed independently
- provenance and stable source identity/ranges
- provider-specific information that does not yet have a canonical field

Interactive use is a design requirement, not a later add-on. The canonical model
must support turn reading/navigation, display, speech, and highlighting without
forcing consumers to parse Markdown.

## Phase 2 — Behaviour inventory and regression fixtures

Before extraction, inventory the current behaviour of:

- `DownloadConversation`
- `AI-transcript.py`
- relevant `AgentPanelSpeaker` transcript/display/speech logic

Create representative real-world fixtures and golden outputs that capture
previously-correct behaviour. Include known provider/model variations and problem
cases already encountered.

The migration must be able to prove both:

1. new shared behaviour is correct; and
2. behaviour that was already correct remains correct.

## Phase 3 — ChatGPT adapter

Mechanically extract proven ChatGPT record interpretation into the shared
JavaScript core where practical.

Do not combine extraction with speculative changes to ordering, grouping, or
association logic. In particular, do not replace working chronological behaviour
without real evidence that it fails.

## Phase 4 — Canonical Markdown renderer

Create one shared Markdown renderer covering at least:

- escaping
- code-fence language mapping
- tool-call/tool-result formatting
- commentary/reasoning formatting
- citations
- attachments/images/artifacts
- `sandbox:` conversion
- provider file-pointer handling such as `sediment://`
- canonical whitespace/newline rules

`DownloadConversation` and `AI-transcript.py` must converge on the same canonical
transcript body except for explicitly documented consumer-specific outer metadata.

## Phase 5 — DownloadConversation integration

Keep the current Tampermonkey implementation during the migration.

Move provider interpretation and shared rendering/projection semantics into
`AIConversationCore` while leaving browser acquisition, recovery, storage, UI,
and other platform concerns in `DownloadConversation`.

DownloadConversation is expected to gain individual-turn reading/navigation
functionality in the near future. Core design and APIs must therefore support
interactive turn access, speech/display projection, highlighting/source mapping,
and related semantics where these can be shared with `AgentPanelSpeaker`.

A browser extension may replace or supplement the Tampermonkey host later, but
that is intentionally not part of the initial core migration.

## Phase 6 — AI-transcript.py integration

Remove the independent ChatGPT rendering implementation once parity is proven.

Python should invoke the canonical JavaScript implementation, initially through a
persistent Node.js worker or another single-process bridge that does not spawn one
JavaScript process per record.

Keep Python-specific CLI, file discovery, JSONL I/O, search/filter commands, and
output routing in `AI-transcript.py`.

## Phase 7 — Cross-consumer parity gate

Use the same source fixtures through all relevant entry points and compare
canonical outputs/projections.

At minimum, protect against regressions involving:

- code-fence language selection
- HTML/Markdown escaping
- citation formatting
- favicon/decorative markup differences
- sandbox URL conversion
- provider file-pointer resolution
- trailing-newline and blank-line policy
- hidden/commentary/tool/subagent handling
- turn ordering/identity

No migration slice is complete until parity and regression tests pass.

## Phase 8 — AgentPanelSpeaker integration

Consume canonical events/turns or a shared speech/display projection rather than
parsing Markdown to rediscover transcript semantics.

Keep WebView2, SAPI, timing, audio playback, and application UI in
`AgentPanelSpeaker`.

Where `AgentPanelSpeaker` and `DownloadConversation` require the same turn-reading,
speech, display, source-range, or highlighting semantics, implement those semantics
once in `AIConversationCore` and test both consumers against them.

## Phase 9 — Additional providers/models

Add provider adapters independently after the ChatGPT path is stable and tested.

Normalize equivalent concepts while preserving real differences. Do not flatten
provider-specific semantics merely to make the schema appear uniform.

## Current project-management approach

GitHub Projects is deliberately not being used for now because the available
integration cannot manage it reliably. Use:

- this file for phases/current direction;
- GitHub Issues for concrete work, bugs, and tracked follow-ups;
- `DECISIONS.md` for architectural decisions/reversals;
- `TESTING.md` for mandatory verification requirements.

If GitHub Projects is adopted later, it may provide views/status fields, but it
must not replace the durable architectural and testing documentation kept in this
repository.
