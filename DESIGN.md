# AIConversationCore Design

This document is the architecture index. Detailed subsystem contracts live in focused documents so no maintained design document becomes a monolith.

## Purpose

AIConversationCore converts provider-specific conversation/event records into one canonical semantic model and then projects that model into Markdown, HTML, structured, speech/navigation, and other consumer-facing forms.

Provider differences are resolved once in Core. Consumers must not reinterpret provider semantics, reconstruct canonical structure from rendered text, or maintain parallel semantic models.

## Behaviour authority during migration

`AI-General-Memory/scripts/AI-transcript.py` remains the default behavioural source for ChatGPT, Claude, and Codex during migration, subject to explicitly documented evidence-backed exceptions.

Current ChatGPT exceptions are citation presentation and authenticated image/resource resolution, where verified DownloadConversation evidence is authoritative for those narrow capabilities.

Any new conflict between established implementations requires evidence, user review, a tracked issue, and a recorded decision before canonical behaviour changes.

## Architecture map

| Responsibility | Owns | Does not own | Primary files | Detailed docs/tests |
| --- | --- | --- | --- | --- |
| Provider normalization | Provider-record interpretation, source identity, canonical event construction | Rendering/UI | `src/adapters/chatgpt.js`, `src/adapters/claude.js`, `src/adapters/claude-events.js`, `src/adapters/codex.js` | `NORMALIZATION_RULES.md`, provider adapter tests |
| Claude visible normalization | Injected-system-text suppression and retained Claude correlation wrapper | Session lifecycle/UI | `src/adapters/claude-normalized.js` | `RETAINED_SESSIONS.md`, `tests/claude-retained-session.test.js` |
| Interactive/session normalization | Provider session records, phase/lifecycle metadata | Long-lived retained-session orchestration | `src/adapters/session.js`, `src/adapters/speech-session*.js` | interactive/speech session tests |
| Retained canonical sessions | Long-lived canonical inventory, append dispatch, projection counters | Provider-specific Codex revision rules | `src/session/canonical-session.js` | `RETAINED_SESSIONS.md`, retained-session tests |
| Codex retained state | Rollback/revision tracking, model-change notices, append-only Codex updates, User Context speech selection | Generic session API | `src/session/codex-retained.js` | `RETAINED_SESSIONS.md`, Codex retained/revision tests |
| Presentation tree | Provider-independent turn/reasoning/tool structure | Host DOM/window policy | `src/projections/presentation*.js` | `RENDERING.md`, `INTERACTIVE_PROJECTIONS.md` |
| Markdown | Canonical Markdown serialization | Consumer-specific formatting repair | `src/projections/markdown*.js` | `RENDERING.md`, renderer/golden tests |
| HTML | Canonical HTML serialization and complete rendered units | Viewport/materialization policy | `src/projections/html*.js` | `INTERACTIVE_PROJECTIONS.md`, HTML tests |
| Word identity/navigation | Core-owned numeric word IDs, provenance, separators, navigation boundaries, lookup | Consumer retokenization/alignment | `src/projections/word-identity.js`, `src/projections/word-element.js` | `INTERACTIVE_PROJECTIONS.md`, word tests |
| Heading metadata/style roles | Core-derived heading semantics and semantic presentation roles | Provider adapters/UI theme mechanics | `src/projections/heading-metadata.js`, `src/projections/turn-header.js` | heading tests, decisions D014/D026/D027 |
| Browser artifact | Deterministic classic-browser bundle generated from authoritative modules | Hand-maintained browser logic | `scripts/build-browser-bundle.mjs`, `dist/aiconversationcore.chatgpt.browser.js` | `BROWSER_BUNDLE.md`, bundle parity tests |
| Branch/workflow invariants | Parent ownership, declared dependency imports, maintained-file size | Feature semantics | `scripts/check-branch-policy.mjs`, `scripts/check-maintained-file-size.mjs`, `.github/*.json` | `BRANCHING.md`, `AI_AGENT_RULES.md` |

When a responsibility moves or a module splits, update this table and the relevant focused document in the same logical change.

## Canonical model

The canonical primitive is an ordered event stream/graph. Turns and other higher-level structures are derived from events rather than assumed User/Assistant pairs.

Canonical events preserve at least:

- stable canonical identity;
- provider/source identity and source index;
- event kind, role/actor, channel, and visibility;
- explicit relationships such as call/result and parent/source links when evidenced;
- ordered canonical content blocks;
- provider metadata required for later interpretation.

Unknown source data must remain explicit/diagnosable rather than silently disappearing.

## Provider adapters

Adapters answer one question: **what does this provider-specific record mean?**

They may construct canonical events and preserve provider metadata, but they do not own Markdown/HTML styling, host UI, playback, storage, browser acquisition, or consumer-specific rendering repair.

Claude event construction is deliberately separated from traversal/correlation:

```text
Claude provider records
    |
    v
src/adapters/claude.js
  record traversal + retained call correlation
    |
    v
src/adapters/claude-events.js
  canonical event/provenance construction
    |
    v
src/adapters/claude-normalized.js
  visible-text filtering + retained incremental wrapper
```

## Canonical projections

Normalization and rendering are separate. Markdown, HTML, structured, speech, and navigation projections consume canonical semantics; they do not rediscover provider semantics.

Equivalent canonical semantics must render equivalently regardless of provider. Core owns structural presentation grouping; consumers own platform presentation, viewport policy, playback engines, and host UI.

See `RENDERING.md` for renderer contracts and `INTERACTIVE_PROJECTIONS.md` for HTML units, word identity, provenance, navigation boundaries, and lookup.

## Retained sessions

Long-lived consumers use `createCanonicalConversationSession()` rather than repeatedly normalizing an unchanged provider prefix.

The provider-neutral session coordinator lives in `src/session/canonical-session.js`. Provider-specific state lives behind retained adapters:

- Claude correlation state: `src/adapters/claude.js` / `claude-normalized.js`;
- Codex revision/rollback state: `src/session/codex-retained.js`.

See `RETAINED_SESSIONS.md` for lifecycle, append, diagnostics, and file ownership.

## Consumer boundaries

### DownloadConversation

Owns browser acquisition/authentication, ChatGPT API capture, recovery/pagination, File System Access operations, userscript UI, and browser-specific playback/UI. It delegates provider semantics and canonical rendering/projection to Core.

### AI-transcript.py

Owns CLI, source/file discovery, JSONL I/O, filtering/session commands, and output routing. During migration it remains behavioural evidence, but shared semantics move into JavaScript Core.

### AgentPanelSpeaker.NET

Owns WinForms/WebView2, Windows speech synthesis, playback/timing/highlighting UI, viewport/materialization policy, and platform integration. It consumes Core identities/projections rather than reparsing Markdown/HTML.

### Multi-AI

Owns orchestration/process/browser-worker concerns. Where it consumes conversation semantics, it must use the same Core contract rather than create another provider interpretation.

## Critical invariants

1. Provider-specific information needed for current/future interpretation is preserved.
2. Arbitrary turn sequences are valid; User/Assistant alternation is not required.
3. Source/observed ordering is preserved unless provider evidence proves another rule.
4. Provider semantics are resolved before rendering.
5. Each output format has one canonical Core renderer/projection path.
6. Browser/application APIs remain outside Core.
7. Unknown data remains explicit and diagnosable.
8. Canonical events/blocks retain stable source provenance.
9. Interactive turn access is a first-class Core use case.
10. Semantics shared by multiple consumers belong in Core; platform mechanics remain downstream.
11. Word identity is Core-owned and never reconstructed by consumer text matching.
12. Generated browser output is derived deterministically from modular authoritative source.
13. Substantive source modules and maintained docs stay below the repository size limit; legacy exceptions may not grow.
14. Architecture/docs identify responsibility, boundaries, data flow, files, and tests so future changes can navigate by design rather than rereading the repository.

## Documentation map

- `NORMALIZATION_RULES.md` — canonical normalization rules.
- `RENDERING.md` — presentation tree and rendering contracts.
- `INTERACTIVE_PROJECTIONS.md` — HTML units, words, navigation, lookup.
- `RETAINED_SESSIONS.md` — long-lived session/append architecture.
- `BROWSER_BUNDLE.md` — deterministic browser artifact.
- `TESTING.md` — verification requirements.
- `BRANCHING.md` — branch ownership/integration rules.
- `DECISIONS.md` — decision index with focused decision files.
- `AI_AGENT_RULES.md` — mandatory repository workflow/invariants.

## Migration principle

Extract one coherent vertical slice at a time, establish regression evidence, preserve verified behaviour, verify all affected Core and dependent-consumer paths, and then integrate the issue back into its declared parent. Architectural cleanup must not be hidden inside unrelated behavioural changes.
