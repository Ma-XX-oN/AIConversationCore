#!/usr/bin/env python3

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def append_once(path, marker, text):
  content = path.read_text(encoding='utf-8')
  if marker not in content:
    path.write_text(content.rstrip() + '\n\n' + text.strip() + '\n', encoding='utf-8')

append_once(
  ROOT / 'DECISIONS.md',
  '## D015 — Renderer debug provenance uses source record identity',
  '''
## D015 — Renderer debug provenance uses source record identity

**Status:** Accepted

**Decision:** Renderer debugging metadata uses the DownloadConversation-compatible
HTML comment fields `turn_id` and `record_index`.  For canonical provider events,
`turn_id` is the preserved provider/source record identity (`source_record_id`),
not the separately derived canonical turn ID.  `record_index` is the zero-based
source record index (`source_index`).

When debugging is enabled, every renderer-generated heading or grouping structure
is annotated with this source provenance, including User/Assistant headings,
commentary headings, sub-agent headings, Question headings, Plan headings, thought
or tool details groups, and equivalent future renderer-generated structures.
When one generated group represents multiple source records, the first source
comment is attached to the opening/summary line and subsequent source comments are
emitted on immediately following lines.

**Reason:** This is debugging instrumentation.  It must expose every generated
structural boundary back to the source records that caused it, and it must use the
same identity vocabulary already consumed by DownloadConversation rather than
introducing a competing `record_id` output field.

## D016 — ChatGPT response and thought/commentary grammar

**Status:** Accepted

**Decision:** Each rendered ChatGPT response begins with exactly one `## ChatGPT`
heading.  Commentary inside that response is headed `### ChatGPT Commentary`.
Consecutive thought/reasoning activity is grouped under
`<details><summary>Having a thought</summary>...</details>` for one item or
`<details><summary>Having N thoughts</summary>...</details>` for multiple
consecutive items.  Commentary ends the current consecutive thought run; later
thought activity begins a new group.

**Reason:** This is the user-selected canonical ChatGPT transcript grammar for the
Phase 6 migration and resolves the previously undecided difference surfaced by the
strict historical AI-transcript.py parity gate on 2026-08-30.
''')

append_once(
  ROOT / 'NORMALIZATION_RULES.md',
  '## Renderer debug provenance',
  '''
## Renderer debug provenance

Debug provenance is a renderer-wide diagnostic contract.  When enabled, every
renderer-generated heading or grouping element carries the source identity that
caused it, using HTML comments with DownloadConversation-compatible names:

```text
<!-- turn_id=<source_record_id> record_index=<source_index> -->
```

This includes top-level User/provider headings and nested structures such as
commentary, sub-agent, Question, Plan, thought, tool, and file-change groups.  A
provider-specific semantic identifier that belongs in visible text (for example a
Claude sub-agent ID) remains visible and is distinct from the source `turn_id` in
the diagnostic comment.

When one generated group aggregates multiple source events, attach the first
source comment to the generated opening/summary line and emit each later source
comment on its own immediately following line.  Do not silently drop provenance
merely because multiple records were collapsed into one rendered group.

## ChatGPT response grouping

A rendered ChatGPT response begins with exactly one `## ChatGPT` heading.
Commentary within the response is rendered as `### ChatGPT Commentary`.
Consecutive thought/reasoning activity is grouped using `Having a thought` or
`Having N thoughts` summary text.  Commentary breaks consecutiveness, so thought
activity after commentary begins a new details group rather than being counted in
the preceding group.
''')

manifest_path = ROOT / 'tests' / 'canonical-golden-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
entry = next(item for item in manifest['goldens'] if item['provider'] == 'chatgpt')
semantics = {item.get('semantic') for item in entry['decisions']}
if 'chatgpt_response_grouping' not in semantics:
  entry['decisions'].append({
    'semantic': 'chatgpt_response_grouping',
    'choice': 'Every ChatGPT response begins with one ## ChatGPT heading; commentary uses ### ChatGPT Commentary; consecutive thoughts use Having a thought/Having N thoughts groups and commentary breaks thought consecutiveness.',
    'authority': 'user decision 2026-08-30'
  })
entry['golden_sha256'] = hashlib.sha256((ROOT / entry['golden']).read_bytes()).hexdigest()
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
