# AIConversationCore source layout

## Incremental provider-adapter slices

`src/adapters/chatgpt.js` began Phase 3 with incremental, fixture-backed ChatGPT
normalization.  Claude and Codex tool slices now exist alongside it so equivalent
call/result semantics can share one canonical shape without pretending that the
rest of those provider adapters is already complete.

For ordinary visible ChatGPT message records, each source record becomes one
canonical `message` event in the same source-array order. The adapter does not
regroup, sort, or associate records by `turn_exchange_id` or `working_turn_id`;
those values are preserved only as relationships/metadata.

For an Assistant record whose provider channel is `commentary`, the ChatGPT
adapter emits a canonical `commentary` event rather than flattening that record
into a final/ordinary message event. Commentary preserves the same stable source
identity, source index, channel, visibility, text blocks, and block provenance as
other mapped records.

For an Assistant record whose source `content_type` is `thoughts`, the ChatGPT
adapter emits a canonical `reasoning_summary` event. Each source thought is
retained as a structured `reasoning_summary` block with its `summary`, `content`,
`chunks`, `finished` state, stable block ID, source record index, and thought
index. Normalizing a source reasoning record does not by itself assert that the
material is eligible for public/export presentation; visibility/export policy
remains a separate projection concern.

## Tool calls and results

The canonical tool slice uses `tool_call` and `tool_result` events with structured
blocks.  The shared fields are:

- `call_id` when the provider supplies an explicit correlation identity;
- tool `name` when known;
- raw provider input or output payload without rendering it to Markdown first;
- provider-specific input/output format metadata where needed;
- source record/block provenance and source index; and
- `relationships.tool_call_id` when explicit source evidence supplies it.

Provider differences are preserved:

- ChatGPT code records addressed to a tool normalize as `tool_call`; tool-role
  execution-output and multimodal-result records normalize as `tool_result`.
  The established rich ChatGPT fixture does not expose an explicit call/result ID,
  so the adapter leaves `call_id` and `relationships.tool_call_id` null rather than
  inferring linkage from adjacency.
- `adaptClaudeToolEvents()` extracts `tool_use` and `tool_result` blocks. Claude's
  `tool_use.id` / `tool_result.tool_use_id` provide explicit correlation. Special
  tool names such as `Agent`, `AskUserQuestion`, and `ExitPlanMode` and their raw
  inputs remain intact so downstream projections can preserve their established
  special rendering.
- `adaptCodexToolEvents()` extracts `function_call`, `function_call_output`,
  `custom_tool_call`, and `custom_tool_call_output` response items. Codex
  `call_id` supplies explicit correlation. Tool-specific semantics such as
  `request_user_input` and `apply_patch` remain represented by their tool name and
  raw payload instead of being flattened into generic transcript text.

The Claude and Codex exports are deliberately named `adapt*ToolEvents`: these are
narrow migration slices, not claims that every provider record type has already
been normalized. Unknown/non-tool records must not be silently reclassified just
to make those adapters look complete.

Tool events do not create new derived User/Assistant turns merely because they are
present. Turn grouping remains a separately derived semantic and is changed only
when established provider behaviour requires it.

Each mapped ChatGPT event currently records:

- canonical `id` derived from the stable ChatGPT message ID;
- `provider`, `source_record_id`, and `source_index`;
- `kind`, `role`, `channel`, `visibility`, and source `content_type`;
- ordered structured content `blocks` with stable block IDs and source provenance;
- observed `turn_exchange_id` and `working_turn_id` relationship values; and
- an explicit tool-call relationship field that remains null when the source has
  no explicit correlation ID.

`src/derive/turns.js` derives independently addressable turns from the ordered
canonical event stream. Ordinary message events start turns. Assistant commentary
joins the current Assistant turn when one already exists; if commentary appears
before the final Assistant message, it starts the Assistant turn and the later
Assistant message completes that same turn. A pre-final Assistant
`reasoning_summary` likewise starts or joins the still-open Assistant turn,
preserving source event order before commentary/final content. A reasoning event
observed after a completed Assistant message is not collapsed backward into that
completed turn. These are turn/event relationships, not User/Assistant pairing.

The duplicate-identity fixture protects two separate invariants:

1. provider relationship metadata does not change canonical event order; and
2. four distinct visible message events derive into four distinct turns.

It is not a User/Assistant-pair (UAP) association test. Any exchange or pairing
relationship is a later derived relationship and is not used to establish
canonical ordering or turn identity.

The rich ChatGPT fixture `tests/fixtures/chatgpt/chatgpt-direct.jsonl` is imported
from `AI-General-Memory/scripts/fixtures/chatgpt-direct.jsonl` at upstream blob SHA
`1631c0b4fe7b059759d3546f9c8ab54d6ae22c92`. The canonical rich ChatGPT golden is
recorded separately in `tests/canonical-golden-manifest.json`. Claude and Codex
tool tests use the checked-in privacy-safe fixtures whose real-evidence provenance
is pinned in the provider canonical/regression manifests.

This is intentionally not the complete provider schema. Citations, files, images,
artifacts, additional hidden/system records, branches, and additional content
types must be added incrementally against fixture/baseline evidence. Unsupported
semantics must not be invented merely to make the schema look complete.

The chronology invariant is explicit: source ordering is preserved unless real
provider evidence establishes a different required rule and that change is
separately tracked and tested.
