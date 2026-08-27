# AIConversationCore source layout

## Initial ChatGPT adapter slices

`src/adapters/chatgpt.js` begins Phase 3 with incremental, fixture-backed ChatGPT normalization.

For ordinary visible message records, each source record becomes one canonical `message` event in the same source-array order. The adapter does not regroup, sort, or associate records by `turn_exchange_id` or `working_turn_id`; those values are preserved only as relationships/metadata.

For an Assistant record whose provider channel is `commentary`, the adapter emits a canonical `commentary` event rather than flattening that record into a final/ordinary message event. Commentary preserves the same stable source identity, source index, channel, visibility, text blocks, and block provenance as other mapped records.

For an Assistant record whose source `content_type` is `thoughts`, the adapter emits a canonical `reasoning_summary` event. Each source thought is retained as a structured `reasoning_summary` block with its `summary`, `content`, `chunks`, `finished` state, stable block ID, source record index, and thought index. Normalizing a source reasoning record does not by itself assert that the material is eligible for public/export presentation; visibility/export policy remains a separate projection concern.

Each mapped event currently records:

- canonical `id` derived from the stable ChatGPT message ID;
- `provider`, `source_record_id`, and `source_index`;
- `kind`, `role`, `channel`, `visibility`, and source `content_type`;
- ordered structured content `blocks` with stable block IDs and source provenance;
- observed `turn_exchange_id` and `working_turn_id` relationship values.

`src/derive/turns.js` derives independently addressable turns from the ordered canonical event stream. Ordinary message events start turns. Assistant commentary joins the current Assistant turn when one already exists; if commentary appears before the final Assistant message, it starts the Assistant turn and the later Assistant message completes that same turn. A pre-final Assistant `reasoning_summary` likewise starts or joins the still-open Assistant turn, preserving source event order before commentary/final content. A reasoning event observed after a completed Assistant message is not collapsed backward into that completed turn. These are turn/event relationships, not User/Assistant pairing.

The duplicate-identity fixture protects two separate invariants:

1. provider relationship metadata does not change canonical event order; and
2. four distinct visible message events derive into four distinct turns.

It is not a User/Assistant-pair (UAP) association test. Any exchange or pairing relationship is a later derived relationship and is not used to establish canonical ordering or turn identity.

The rich ChatGPT fixture `tests/fixtures/chatgpt/chatgpt-direct.jsonl` is imported from `AI-General-Memory/scripts/fixtures/chatgpt-direct.jsonl` at upstream blob SHA `1631c0b4fe7b059759d3546f9c8ab54d6ae22c92`. The current slices use its real `thought-1` and `commentary-1` records. The canonical rich ChatGPT golden is recorded separately in `tests/canonical-golden-manifest.json` and protects the resolved rendering contract while semantic extraction proceeds incrementally.

This is intentionally not the complete ChatGPT schema. Tools/results, citations, files, images, artifacts, hidden/system records, branches, and additional content types must be added incrementally against fixture/baseline evidence. Unsupported semantics must not be invented merely to make the schema look complete.

The chronology invariant is explicit: source ordering is preserved unless real provider evidence establishes a different required rule and that change is separately tracked and tested.
