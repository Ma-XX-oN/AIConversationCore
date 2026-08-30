#!/usr/bin/env python3

import json
from pathlib import Path

known_path = Path('tests/known-differences.json')
data = json.loads(known_path.read_text(encoding='utf-8'))
entries = data.setdefault('differences', [])
by_id = {entry.get('id') for entry in entries}

new_entries = [
  {
    'id': 'ai-transcript-debug-provenance',
    'area': 'transcript debug provenance',
    'ai_transcript_legacy': "-N emitted a 1-based '<!-- record: N -->' comment before visible record blocks",
    'canonical': 'the existing -N debug flag now emits renderer-owned source provenance using turn_id=<source_record_id> and zero-based record_index=<source_index> on every renderer-generated structural heading/grouping',
    'classification': 'user-decided-canonical-policy',
    'evidence': '2026-08-30 Phase 6 user decision plus production parity/regression gates',
    'migration_rule': 'the canonical provenance format replaces the old -N syntax; do not preserve a compatibility path for <!-- record: N -->'
  },
  {
    'id': 'chatgpt-response-heading-thought-commentary-grouping',
    'area': 'ChatGPT response structure',
    'ai_transcript_legacy': 'could place a Thoughts details block before a later ChatGPT heading and used a generic Thoughts summary',
    'canonical': 'each ChatGPT response starts with exactly one ## ChatGPT; commentary uses ### ChatGPT Commentary; consecutive reasoning is grouped as Having a thought / Having N thoughts; commentary breaks thought consecutiveness; tools do not increment N',
    'classification': 'user-decided-canonical-policy',
    'evidence': '2026-08-30 explicit user decision after strict pre-migration parity exposed the structural difference',
    'migration_rule': 'protect the decided response grammar with focused and production parity tests rather than preserving the legacy placement'
  }
]
for entry in new_entries:
  if entry['id'] not in by_id:
    entries.append(entry)
known_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

roadmap_path = Path('ROADMAP.md')
roadmap = roadmap_path.read_text(encoding='utf-8')
old_current = '''**Phase 6 is next.** Integrate `AI-General-Memory/scripts/AI-transcript.py` with the
canonical JavaScript core while retaining its Python-specific CLI, discovery,
JSONL I/O, filtering/search/session commands, and output routing.'''
new_current = '''**Phase 6 is complete.** `AI-General-Memory/scripts/AI-transcript.py` now routes
ChatGPT, Claude, and Codex transcript presentation through a persistent Node.js
worker pinned to AIConversationCore while retaining Python-specific CLI, discovery,
JSONL I/O, filtering/search/session commands, and output routing.  The existing
`-N` debug flag now uses canonical `turn_id`/`record_index` provenance rather than
the superseded `<!-- record: N -->` format.  Historical parity, canonical provider
parity, portable direct-file regressions, core tests, and diff hygiene gate the
integration.  The production migration was committed in AI-General-Memory as
`5c299cdbf0265024994cd3601eb73df14e5ad623`.'''
if old_current not in roadmap:
  if new_current not in roadmap:
    raise SystemExit('Phase 6 current-status anchor not found')
else:
  roadmap = roadmap.replace(old_current, new_current, 1)

phase_heading = '## Phase 6 — AI-transcript.py integration\n\n'
phase_status = '''## Phase 6 — AI-transcript.py integration

**Status: COMPLETE.**

`AI-transcript.py` preserves its Python-owned CLI, discovery, JSONL I/O,
record/time filtering, grep/search, session selection, and output routing while
all ChatGPT, Claude, and Codex transcript presentation now crosses one persistent
line-delimited JSON Node.js bridge into the pinned canonical JavaScript core.  It
does not spawn one JavaScript process per source record.

Consumer-specific date/record-number/ANSI/separate-thought presentation is passed
as projection metadata.  `-N` remains the existing transcript-debug switch, but
its old 1-based `<!-- record: N -->` comments are replaced by canonical source
provenance (`turn_id` and zero-based `record_index`) on every renderer-generated
heading/grouping, including grouped multi-source structures.

Migration gates compare the production Python entry point against the historical
pre-Phase-6 implementation except for explicitly recorded canonical decisions,
compare all three providers against canonical goldens, run the portable direct-file
regression corpus, run the core suite, and enforce diff hygiene.  Proven Claude
thinking HTML escaping and ExitPlanMode approval collapsing were preserved rather
than silently accepted as migration drift.

'''
if '**Status: COMPLETE.**' not in roadmap.split('## Phase 6 — AI-transcript.py integration', 1)[1].split('## Phase 7', 1)[0]:
  if phase_heading not in roadmap:
    raise SystemExit('Phase 6 section anchor not found')
  roadmap = roadmap.replace(phase_heading, phase_status, 1)
roadmap_path.write_text(roadmap, encoding='utf-8')
