# Retained canonical sessions

`createCanonicalConversationSession()` is the long-lived Core API for consumers that need repeated projections or append-only source growth without reparsing an unchanged provider prefix.

## Responsibility map

| Responsibility | File | Owns | Does not own |
| --- | --- | --- | --- |
| Session coordination | `src/session/canonical-session.js` | Provider selection, retained canonical inventory, append dispatch, diagnostics | Claude/Codex provider semantics |
| Claude retained correlation | `src/adapters/claude.js` | Tool-name and Agent-call state across record slices | Visible-text suppression/session UI |
| Claude event construction | `src/adapters/claude-events.js` | Canonical Claude events/provenance | Retained traversal state |
| Claude visible normalization | `src/adapters/claude-normalized.js` | Injected-system-text suppression and incremental wrapper | Generic session orchestration |
| Codex retained semantics | `src/session/codex-retained.js` | Revision/rollback state, model-change notices, append updates, User Context speech selection | Generic session API |

This separation is intentional. `canonical-session.js` stays provider-neutral and small; provider-specific retained state lives with the provider responsibility that understands it.

## Data flow

```text
provider records
    |
    v
provider retained adapter
    |
    v
retained canonical event inventory
    |-- project(options)
    |-- renderMarkdown(options)
    |-- renderHtml(options)
    `-- append(newRecords)
```

The unchanged provider prefix is normalized exactly once per session.

## Construction

```js
import { createCanonicalConversationSession } from './src/index.js';

const session = createCanonicalConversationSession({
  provider: 'claude',
  records
});
```

Supported providers remain ChatGPT, Claude, and Codex for initial normalization. Incremental append is currently implemented for Claude and Codex.

ChatGPT append rejects explicitly until a dedicated incremental adapter exists. The session must never hide a whole-session reparse behind `append()`.

## Claude incremental append

Claude append retains cross-record correlation state across batches:

- tool-use ID -> tool name;
- Agent tool-use ID -> invocation description/provenance.

This allows a tool result or Agent completion arriving in a later append batch to retain the same canonical identity/correlation that a complete one-shot normalization would produce.

`src/adapters/claude.js` exposes the slice/state primitives. `src/adapters/claude-normalized.js` owns the incremental visible-text wrapper used by the retained session.

The required invariant is:

```text
incremental projection after N append batches
==
one-shot projection of the same complete provider record inventory
```

for equivalent source order and projection options.

Regression coverage: `tests/claude-retained-session.test.js`.

## Codex incremental append

Codex append has additional semantics because later records can revise earlier canonical state.

`src/session/codex-retained.js` owns:

- rollback/revision lineage;
- revision status/depth;
- appended abort state;
- model-change notices;
- speech eligibility for User Context;
- stable absolute source indexes for appended records.

It may update metadata on existing canonical events when later provider records establish new revision state. It does not reread/re-normalize the unchanged provider prefix.

Regression coverage includes retained canonical session, revision-depth, rollback, model-change, and speech-selection tests.

## Projections

`project(options)` increments the session projection counter and returns a structured projection of retained canonical events.

Codex projection may clone event/block metadata to apply presentation-time options such as `includeUserContext`; retained canonical identity remains unchanged.

`renderMarkdown(options)` and `renderHtml(options)` render the retained canonical inventory through the normal Core renderer paths.

Changing visibility/presentation options must not change canonical IDs, source indexes, provider correlation, or retained revision classification.

## Diagnostics

`session.diagnostics` exposes verification counters:

- `initial_normalization_passes` — always one after successful construction;
- `full_renormalization_passes` — remains zero for the session lifetime;
- `appended_records_processed` — total records handled through incremental append;
- `projection_count` — structured projection calls.

These counters are diagnostic evidence, not canonical transcript semantics.

## Consumer lifecycle

A consumer should:

1. create one retained session for one selected provider session;
2. keep it while that provider session remains selected;
3. call projections/renderers repeatedly as UI/speech options change;
4. append only newly observed provider records;
5. discard the retained session only when the selected provider session changes or the consumer shuts down.

Re-reading the complete provider file merely because a presentation setting changed is an integration bug.

## Consumer boundaries

Consumers must not cache or reproduce Claude tool correlation or Codex rollback semantics. They receive canonical state/projections only.

Platform-specific playback, viewport selection, speech engine behavior, storage, file watching, and browser acquisition remain downstream responsibilities.

## Tests

Primary retained-session coverage:

- `tests/claude-retained-session.test.js`;
- retained Codex session tests;
- revision depth/history tests;
- speech User Context tests;
- structured/Markdown/HTML identity regressions.

Dependent repositories must also be tested after Core reconciliation because retained-session behavior is consumed by AgentPanelSpeaker.NET and other Core clients.
