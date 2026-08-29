from pathlib import Path

path = Path('ROADMAP.md')
text = path.read_text(encoding='utf-8')

old_status = '''**Phase 4 is complete.** The canonical Markdown renderer now renders the established
ChatGPT, Claude, and Codex transcript bodies from canonical data only. Exact
regressions cover the rich provider goldens plus provider-specific behaviours such
as Claude AskUserQuestion, ExitPlanMode, synthetic notices, adaptive code fences,
and Codex orphan apply_patch output. The Phase 4 follow-up for generated-file
artifact links (#42) is also resolved. Phase 5 DownloadConversation integration is
now the active migration phase.
'''
new_status = '''**Phase 4 is complete.** The canonical Markdown renderer now renders the established
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
'''
assert old_status in text
text = text.replace(old_status, new_status, 1)

old_phase5 = '''## Phase 5 — DownloadConversation integration

Keep the current Tampermonkey implementation during the migration.

Move provider interpretation and shared rendering/projection semantics into
`AIConversationCore` while leaving browser acquisition, authenticated API/resource
resolution, storage, UI, and other platform concerns in `DownloadConversation`.

DownloadConversation is expected to gain individual-turn reading/navigation
functionality. Core design and APIs must therefore support interactive turn access,
speech/display projection, highlighting/source mapping, and related semantics where
these can be shared with `AgentPanelSpeaker`.

A browser extension may replace or supplement the Tampermonkey host later, but
that is intentionally not part of the initial core migration.
'''
new_phase5 = '''## Phase 5 — DownloadConversation integration

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
'''
assert old_phase5 in text
text = text.replace(old_phase5, new_phase5, 1)

path.write_text(text, encoding='utf-8')
print('ROADMAP.md updated for Phase 5 completion.')
