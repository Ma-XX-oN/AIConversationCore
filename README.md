# AIConversationCore

Takes JSONL DBs from different AI systems and turns them into a single cohesive
conversation specification.

`AIConversationCore` is a shared JavaScript normalization core. Its purpose is to
prevent multiple applications from independently interpreting and rendering the
same provider data in subtly different ways.

Initial consumers:

- `DownloadConversation`
- `AI-transcript.py` in `AI-General-Memory`
- `AgentPanelSpeaker`

## What belongs here

The core owns provider-record interpretation, canonical conversation/event
normalization, derived turn relationships, and shared rendering/projection logic.
It must be able to represent provider differences including:

- user and assistant messages
- commentary/intermediate assistant messages
- reasoning/thought summaries when exposed
- tool calls and tool results
- subagents/delegated agents and nested activity
- system/context/model-editable records
- citations and source links
- attachments, images, and generated artifacts
- hidden versus visible records
- parent/child, call/result, branch, and exchange relationships
- provider/model-specific channels and record types

Provider-specific information must not be discarded merely because the canonical
model does not yet use it directly.

## Fundamental model

The primitive model is an ordered stream/graph of canonical **events**.

**Turns are derived structure.** User/assistant pairs (historically called UAPs in
`DownloadConversation`) are also derived relationships, not storage primitives.
This allows incomplete/half conversations, in-progress responses, commentary,
tools, subagents, branches, and other non-paired activity to be represented
without forcing data into a complete UAP.

## Shared Markdown

Markdown serialization belongs in this repository. Given the same canonical
conversation data, consumers should produce equivalent transcript bodies unless a
difference is explicitly documented as consumer-specific outer metadata.

Differences such as HTML escaping, code-fence language selection, citation HTML,
whitespace policy, attachment URLs, `sandbox:` handling, or provider file-pointer
handling are parity bugs unless documented otherwise.

## Testing

Testing is part of the project contract, not a later cleanup phase.  A behavioural
change is not complete merely because the new behaviour works; previously-correct
behaviour must also remain correct.

See [`TESTING.md`](TESTING.md) for the mandatory unit, fixture, golden-output,
cross-consumer parity, integration, regression, and migration verification rules.

## Language

The canonical implementation is JavaScript because it must run directly in
`DownloadConversation` and is the practical lowest common denominator for the
initial consumers. Other languages should invoke or consume this implementation
rather than maintain independent ports of normalization/rendering logic.

A persistent Node.js worker is the initial preferred bridge for Python and is also
an option for C#.

## What does not belong here

Application/platform concerns stay in the consuming applications, including:

- Tampermonkey/browser-extension APIs
- browser request interception/authentication capture
- browser UI and recorder recovery/storage workflows
- Python CLI/file discovery
- WebView2
- SAPI/audio playback/highlighting

## Project documentation

The repository is the source of truth for project intent and state. Do not rely on
chat history or assistant memory to reconstruct decisions.

- [`DESIGN.md`](DESIGN.md) — architecture, canonical model, invariants, boundaries
- [`EXISTING_IMPLEMENTATIONS.md`](EXISTING_IMPLEMENTATIONS.md) — reviewed codebase baselines, commonalities, differences, ownership boundaries, and migration risks
- [`TESTING.md`](TESTING.md) — mandatory regression/parity/integration test contract
- [`ROADMAP.md`](ROADMAP.md) — migration phases and current work state
- [`DECISIONS.md`](DECISIONS.md) — durable architectural decisions and reversals
- [`AI_AGENT_RULES.md`](AI_AGENT_RULES.md) — mandatory change/verification discipline

This project is a staged migration, not a wholesale rewrite. Existing proven
behaviour must be preserved while common functionality is moved here
incrementally.
