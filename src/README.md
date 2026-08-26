# AIConversationCore source layout

## Initial ChatGPT adapter slice

`src/adapters/chatgpt.js` begins Phase 3 with the smallest verified ChatGPT normalization slice.

For the ordinary `text` fixture used by `tests/chatgpt-adapter.test.js`, each source record becomes one canonical `message` event in the same source-array order. The adapter does not regroup, sort, or associate records by `turn_exchange_id` or `working_turn_id`; those values are preserved only as relationships/metadata in this slice.

Each event currently records:

- canonical `id` derived from the stable ChatGPT message ID;
- `provider`, `source_record_id`, and `source_index`;
- `kind`, `role`, `channel`, `visibility`, and source `content_type`;
- ordered structured text `blocks` with stable block IDs and source record/part provenance;
- observed `turn_exchange_id` and `working_turn_id` relationship values.

`src/derive/turns.js` provides the initial derived-turn projection for this slice. Each visible User or Assistant message event becomes one independently addressable turn in canonical event order. Duplicate exchange/working-turn metadata does not collapse, merge, pair, or reorder those turns.

The duplicate-identity fixture therefore protects two separate invariants:

1. provider relationship metadata does not change canonical event order; and
2. four distinct visible message events derive into four distinct turns.

It is not a User/Assistant-pair (UAP) association test. Any exchange or pairing relationship is a later derived relationship and is not used to establish canonical ordering or turn identity.

This is intentionally not the complete ChatGPT schema. Commentary, reasoning summaries, tools/results, citations, files, images, artifacts, hidden/system records, branches, and additional content types must be added incrementally against the Phase 2 fixtures and baselines. Unsupported semantics must not be invented merely to make the schema look complete.

The chronology invariant is explicit: source ordering is preserved unless real provider evidence establishes a different required rule and that change is separately tracked and tested.
