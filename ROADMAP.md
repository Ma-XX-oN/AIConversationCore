# AIConversationCore Roadmap

This file is the repository-backed source of truth for planned migration phases
and current project direction. GitHub Projects is not being used at this time, so
project-management state that would otherwise live there must be kept here and in
GitHub Issues.

## Current status

The source-level comparison of the three existing implementations is recorded in
`EXISTING_IMPLEMENTATIONS.md` using these baselines:

- `DownloadConversation` `main`, userscript version `0.6.132`;
- current `AI-General-Memory/master/scripts/AI-transcript.py`; and
- user-supplied `AgentPanelSpeaker-v212.zip`.

**Migration authority:** current `AI-General-Memory/scripts/AI-transcript.py` is
the default canonical behavioural/rendering reference for every provider it
recognizes, currently ChatGPT, Claude, and Codex. `AIConversationCore` is not
intended to copy the Python architecture; it is intended to decompose that proven
behaviour into provider adapters, one canonical event/block/turn model, and shared
renderers and projections.

ChatGPT has two established exceptions:

- **Citations:** verified `DownloadConversation` behaviour is canonical for ChatGPT
  citation rendering because existing browser/screenshot evidence showed the
  Python citation presentation was not correct enough.
- **Images/resource resolution:** preserve the verified source-position and
  missing/unavailable semantics while using `DownloadConversation` API/resource
  evidence where its authenticated browser context provides capabilities the
  standalone Python process cannot.

For any other difference between implementations, do not choose automatically.
Present the exact alternatives and evidence to the user and record the user's
choice before incorporating the behaviour into a canonical golden or migration
slice.

ChatGPT is only the first extraction target. The core must remain provider-agnostic
so Claude, Codex, and future providers can plug into the same canonical model and
renderers rather than acquiring parallel output implementations.

**Phase 2 is complete.** The repository now contains a shared fixture corpus for
ChatGPT, Claude, and Codex; machine-readable known differences; production
baselines for all three consumers; source provenance for those baselines; and
`tests/validate-phase2-baseline.py` as the completion gate.

The three executable production gates are satisfied:

- issue #2 — AgentPanelSpeaker v212 C# production display/extraction/speech paths;
- issue #3 — current `AI-General-Memory/scripts/AI-transcript.py`; and
- issue #4 — DownloadConversation's browser production renderer.

The DownloadConversation browser baseline is pinned to userscript version
`0.6.132`, commit `1b6ff84474cbf120e1b6dd9e1b396c22a63641d0`, blob
`ac14c3cc3ea6b30e6563609a7bf2641a193a7d6f`. The current AI-transcript baseline
is pinned to source commit `abcc2f33783e3690b9e1335161c73e7dabaed757` and
script blob `69115508946fad15e03fa3f9074645ec0e9131db`. AgentPanelSpeaker's
baseline metadata records the actual C# production paths exercised on Windows/.NET.

Phase 2 also reproduced a real DownloadConversation sandbox Markdown-link defect
for filenames containing parentheses. That defect is tracked separately as issue
#8 and is not an ordering/grouping change or a Phase 2 blocker.

The comparison and production baselines confirm existing semantic duplication and
drift risks, especially:

- independent ChatGPT rendering/interpretation in `DownloadConversation` and
  `AI-transcript.py`;
- independent provider interpretation in AgentPanelSpeaker's
  `JsonlRecordExtractor` and `TranscriptMarkdownFormatter`; and
- AgentPanelSpeaker's bundled older `tools/AI-transcript.py` reference copy.

The AgentPanelSpeaker production baseline makes the dual-parser problem concrete:
for the Claude adaptive-fence fixture, display includes the Bash tool call/result
while extraction/speech omit it. The Codex orphan-patch fixture likewise differs
from the current AI-transcript rendering. These are baseline facts to preserve and
classify during migration, not reasons to rewrite unrelated association logic.

**Phase 3 is complete.** The ChatGPT adapter now covers the concrete semantics
established by the Phase 2 corpus and subsequent verified evidence: ordinary
messages, commentary, exposed reasoning summaries, tool calls/results, evidenced
non-`parts` content, citations including `sources_footnote`, uploaded/retrieved
files, generated artifacts, ordered images, hidden/system/model-editable records,
explicit parent relationships, source provenance/ranges, and the established turn
and chronology invariants. The post-blocker completeness review found no remaining
concrete Phase 3 semantic blocker. Issue #34 (streamed response events for live
reading) is a future incremental-input capability, not a requirement for the
persisted-record ChatGPT adapter completed in Phase 3.

**Phase 4 is complete.** The canonical Markdown renderer now renders the established
ChatGPT, Claude, and Codex transcript bodies from canonical data only. Exact
regressions cover the rich provider goldens plus provider-specific behaviours such
as Claude AskUserQuestion, ExitPlanMode, synthetic notices, adaptive code fences,
and Codex orphan apply_patch output. The Phase 4 follow-up for generated-file
artifact links (#42) is also resolved.

**Phase 5 is complete.** DownloadConversation v0.6.141 pins the Phase-4-complete
browser bundle and routes supported rich ChatGPT messages, citations, generated
file resources, recovered image resources, public Thoughts, and tool/result
segments through AIConversationCore canonical normalization/rendering. Browser-only
authenticated acquisition, resource recovery/enrichment, storage, UI, lifecycle,
and export orchestration remain in DownloadConversation. Source/provider turn IDs
remain the exported heading identity. A narrow defensive host fallback remains only
for unsupported or unrecognized source shapes rather than as a second general
provider renderer. DownloadConversation #98 and permanent CI run `33237356306`
record the completion evidence.

**Phase 6 is next.** Integrate `AI-General-Memory/scripts/AI-transcript.py` with the
canonical JavaScript core while retaining its Python-specific CLI, discovery,
JSONL I/O, filtering/search/session commands, and output routing.

## Working principles

- Work is staged; do not perform a wholesale rewrite.
- Preserve previously-correct behaviour unless there is concrete evidence that it
  is wrong.
- Treat current `AI-transcript.py` behaviour as the default migration authority for
  every provider it recognizes, subject to explicit evidence-backed exceptions.
- ChatGPT citations use verified DownloadConversation behaviour as canonical.
- New cross-implementation differences require explicit user choice before they
  alter canonical behaviour.
- Unrelated defects or improvements are separate issues and separate commits.
- Testing is mandatory for each migration step. See `TESTING.md`.
- Architecture and invariants live in `DESIGN.md`.
- Existing implementation baselines and ownership findings live in
  `EXISTING_IMPLEMENTATIONS.md`.
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
- arbitrary turn sequences without requiring User/Assistant alternation
- derived turns that can be addressed independently
- provenance and stable source identity/ranges
- provider-specific information that does not yet have a canonical field

Interactive use is a design requirement, not a later add-on. The canonical model
must support turn reading/navigation, display, speech, and highlighting without
forcing consumers to parse Markdown.

## Phase 2 — Behaviour inventory and regression fixtures

**Status: COMPLETE.**

The current behaviour of `DownloadConversation`, `AI-transcript.py`, and relevant
AgentPanelSpeaker transcript/display/speech logic has been inventoried and captured
in representative raw fixtures and executable production baselines.

Phase 2 artifacts:

- `tests/phase2-baseline-manifest.json` — fixture/baseline inventory and completed
  runner gate;
- `tests/known-differences.json` — explicit cross-implementation differences and
  migration rules;
- `tests/fixtures/` — raw provider fixtures with provenance;
- `tests/baseline/agentpanelspeaker-v212/` — C# display/extraction/speech baselines;
- `tests/baseline/ai-transcript-current/` — current Python formatter baselines and
  exact source provenance;
- `tests/baseline/downloadconversation/` — browser renderer baseline plus exact
  source provenance; and
- `tests/validate-phase2-baseline.py` — integrity/completion validator.

The migration must continue to prove both:

1. new shared behaviour is correct; and
2. behaviour that was already correct remains correct.

Golden outputs are evidence. They must not be silently refreshed merely to make a
test pass.

## Phase 3 — ChatGPT adapter

**Status: COMPLETE.**

The proven persisted-record ChatGPT semantics required for the initial shared
adapter have been extracted into the shared JavaScript core. The completion review
was rerun after resolving the concrete gaps found by issue #29, including
non-`parts` content (#30), explicit parent relationships (#31), and the separately
discovered `sources_footnote` citation form (#35). The obsolete UAP/half-turn
coverage premise from #32 was removed through the documentation correction tracked
by #33 rather than being encoded as a canonical requirement.

The completed adapter preserves source order and does not infer chronology,
grouping, parentage, or User/Assistant association beyond the explicit evidenced
rules. Subagent/delegated-agent handling remains evidence-driven (`when available`)
rather than speculative. Future streamed/provisional response capture is tracked
separately in #34 and does not reopen this persisted-record adapter phase.

ChatGPT citations use verified `DownloadConversation` behaviour. ChatGPT image
semantics preserve source position and missing/unavailable state while allowing a
credentialed browser host to supply resource-resolution enrichment outside the
core.

## Phase 4 — Canonical Markdown renderer

**Status: COMPLETE.**

The shared Markdown renderer consumes canonical events/turns/blocks rather than
provider-native records and reproduces the decided canonical transcript behaviour
for ChatGPT, Claude, and Codex.

Verified Phase 4 coverage includes:

- escaping and HTML-safe citation/link presentation;
- code-fence language mapping and adaptive fence sizing;
- tool-call/tool-result formatting;
- commentary and exposed reasoning formatting;
- citations and citation tooltip/favicon presentation;
- attachments, images, and generated artifacts;
- generated `sandbox:` file-link conversion through canonical resource metadata;
- provider file-pointer handling such as `sediment://` unavailable-image links;
- canonical whitespace/newline behaviour through exact golden comparisons.

The primary completion work is tracked by #37. The later generated-file renderer
gap discovered during Phase 5 was resolved separately by #42 without reopening
provider normalization, chronology, grouping, or turn derivation.

`DownloadConversation`, `AI-transcript.py`, and later consumers must converge on
that shared canonical transcript body except for explicitly documented
consumer-specific outer metadata or host-only resource-resolution inputs.

## Phase 5 — DownloadConversation integration

**Status: COMPLETE.**

DownloadConversation v0.6.141 consumes the pinned AIConversationCore browser bundle
for the supported canonical ChatGPT transcript path. The integration covers rich
visible messages and multimodal content, web/memory/retrieved-file citations,
generated Assistant sandbox artifacts, browser-recovered image enrichment while
preserving source image position and missing/unavailable states, public Thoughts,
and supported tool-call/tool-result segments.

The host/core boundary is now explicit:

- AIConversationCore owns provider interpretation and canonical transcript
  rendering for supported shapes;
- DownloadConversation owns browser acquisition/authentication, authenticated
  resource recovery/enrichment, storage/file output, UI, lifecycle, and export
  orchestration;
- DownloadConversation preserves the provider/source record ID in its existing
  `turn_id` heading comment rather than substituting a derived canonical ID; and
- a narrow defensive host fallback remains for unsupported/unrecognized source
  shapes, not as a parallel general provider renderer.

Completion is tracked by DownloadConversation #98. Its final clean head
`37ef4377c750cc76676cd10312b55331cd0d55b9` passed permanent CI run
`33237356306`, including the original Phase 5 regressions plus rich canonical
integration coverage for citations, generated files, recovered image states/order,
and Thoughts/tool/result segments. No chronology, grouping, UAP association, API
pagination, Jump, recorder UI, storage, or lifecycle semantics were changed by the
completion slice.

A browser extension may replace or supplement the Tampermonkey host later, but
that is intentionally not part of the initial core migration.

## Phase 6 — AI-transcript.py integration

As each canonical behaviour slice is proven in JavaScript, remove the corresponding
independent Python normalization/rendering implementation. This applies across all
providers recognized by `AI-transcript.py`, not only ChatGPT.

Python should invoke the canonical JavaScript implementation, initially through a
persistent Node.js worker or another single-process bridge that does not spawn one
JavaScript process per record.

Keep Python-specific CLI, file discovery, JSONL I/O, search/filter/session commands,
and output routing in `AI-transcript.py`.

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

AgentPanelSpeaker currently has independent provider interpretation in its speech
extractor and Markdown formatter. Migration must converge those projections on one
canonical normalization path rather than retaining both parsers behind the new
core.

## Phase 9 — Additional providers/models

After the existing `AI-transcript.py` providers have been migrated and stabilized,
add new providers by implementing independent adapters into the same canonical
model and renderers.

Normalize equivalent concepts while preserving real differences. Do not flatten
provider-specific semantics merely to make the schema appear uniform, and do not
create a provider-specific renderer when a canonical rendering semantic already
exists.

## Current project-management approach

GitHub Projects is deliberately not being used for now because the available
integration cannot manage it reliably. Use:

- this file for phases/current direction;
- GitHub Issues for concrete work, bugs, and tracked follow-ups;
- `EXISTING_IMPLEMENTATIONS.md` for reviewed baseline behaviour and migration
  boundaries;
- `DECISIONS.md` for architectural decisions/reversals;
- `TESTING.md` for mandatory verification requirements.

If GitHub Projects is adopted later, it may provide views/status fields, but it
must not replace the durable architectural and testing documentation kept in this
repository.
