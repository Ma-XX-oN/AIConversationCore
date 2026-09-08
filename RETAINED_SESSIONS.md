# Retained canonical sessions

`createCanonicalConversationSession()` is the interactive/long-lived Core API for consumers that need to change presentation policy or append new records without reparsing an unchanged provider prefix.

## Boundary

The session owns provider normalization and retained canonical semantic state:

```text
provider records
    |
    v
normalize once
    |
    v
retained canonical event inventory
    |-- project(options)
    |-- renderMarkdown(options)
    |-- renderHtml(options)
    `-- append(newRecords)
```

A consumer must not cache provider-specific rollback semantics or reconstruct them after normalization. Revision status, model transitions, abort state, source identity, and canonical ordering remain Core-owned semantics.

## API

```js
import { createCanonicalConversationSession } from './src/index.js';

const session = createCanonicalConversationSession({
  provider: 'codex',
  records
});

const normalView = session.project({ includeRolledBackTurns: false });
const historyView = session.project({ includeRolledBackTurns: true });
const html = session.renderHtml({ includeRolledBackTurns: false });

session.append(newRecords);
const updated = session.project({ includeRolledBackTurns: false });
```

`project()`, `renderMarkdown()`, and `renderHtml()` operate on the retained canonical inventory. Changing `includeRolledBackTurns` changes effective visibility only; it must not change canonical IDs, source indexes, revision classification, or the retained event inventory.

## Incremental append

Codex sessions support append-only growth. `append(newRecords)` assigns the new records their absolute source indexes, normalizes only those records, and updates retained revision state that can affect earlier canonical interactions. The unchanged provider prefix is not passed through the provider adapter again.

The retained revision tracker is an implementation detail. Downstream consumers see only canonical state and projection results and must not reproduce Codex rollback interpretation.

Other providers currently reject incremental append instead of silently falling back to full renormalization. A future provider append implementation must preserve the same no-hidden-full-reparse contract.

## Diagnostics

`session.diagnostics` exposes counters used by regression tests and interactive bridges:

- `initial_normalization_passes`: one for a successfully created session;
- `full_renormalization_passes`: zero for the retained-session lifetime;
- `appended_records_processed`: number of provider records handled through incremental append;
- `projection_count`: number of structured projections requested.

These counters are diagnostic evidence, not canonical transcript semantics.

## Rendering and visibility

Historical Codex revisions remain in the canonical structured/HTML inventory with revision metadata and stable presentation identity. The default projection marks historical revisions not visible; `includeRolledBackTurns:true` exposes those same retained units.

This separation is required for consumers that maintain stable speech, search, DOM, or virtualization indexes while a user changes visibility settings.

## Consumer lifecycle

A long-lived consumer should create one session for one selected source session, reuse it for all projections, append only newly observed records, and discard it only when the selected provider session changes or the consumer shuts down.

Re-reading the whole provider file merely because a display/speech setting changed defeats the purpose of this API and is considered an integration bug.
