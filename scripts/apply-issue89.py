from pathlib import Path


def replace_once(path, old, new, label):
  text = path.read_text(encoding='utf-8')
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{label}: expected one match, found {count}')
  path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
  Path('src/projections/markdown.js'),
  '    fields.push(`turn_id=${metadata.turn_id}`);',
  '    fields.push(String(metadata.turn_id));',
  'canonical Markdown Turn ID label')

replace_once(
  Path('src/projections/heading-metadata.js'),
  '      text: `turn_id=${metadata.turn_id}`',
  '      text: String(metadata.turn_id)',
  'heading metadata component Turn ID label')

replace_once(
  Path('src/projections/turn-header.js'),
  '        text: `turn_id=${turnId}`',
  '        text: String(turnId)',
  'turn-header Turn ID label')

path = Path('tests/core-heading-metadata.test.js')
text = path.read_text(encoding='utf-8')
for old, new in [
  ('1: turn_id=user-1', '1: user-1'),
  ('3: turn_id=final-1', '3: final-1'),
  ('2: turn_id=commentary-1', '2: commentary-1'),
  ('.*turn_id=user-1.*', '.*user-1.*'),
  ('.*turn_id=final-1.*', '.*final-1.*')
]:
  if old not in text:
    raise RuntimeError(f'core-heading-metadata expected fragment not found: {old}')
  text = text.replace(old, new)
path.write_text(text, encoding='utf-8')

path = Path('tests/heading-metadata-projection.test.js')
text = path.read_text(encoding='utf-8')
for old, new in [
  ('2: turn_id=chatgpt-message-id', '2: chatgpt-message-id'),
  ('2: turn_id=source-turn-id <!--', '2: source-turn-id <!--')
]:
  if old not in text:
    raise RuntimeError(f'heading-metadata-projection expected fragment not found: {old}')
  text = text.replace(old, new)
path.write_text(text, encoding='utf-8')

path = Path('tests/turn-header.test.js')
text = path.read_text(encoding='utf-8')
for old, new in [
  ('## ChatGPT turn_id=chatgpt-assistant-source-id', '## ChatGPT chatgpt-assistant-source-id'),
  ('## Claude [2026-01-02 12:00:02]: 2: turn_id=claude-record-uuid',
   '## Claude [2026-01-02 12:00:02]: 2: claude-record-uuid'),
  ('## Codex turn_id=explicit-source-id', '## Codex explicit-source-id'),
  ('\\u001b[35mturn_id=chatgpt-assistant-source-id\\u001b[0m',
   '\\u001b[35mchatgpt-assistant-source-id\\u001b[0m'),
  ('<span class="transcript-turn-id">turn_id=claude-record-uuid</span>',
   '<span class="transcript-turn-id">claude-record-uuid</span>')
]:
  if old not in text:
    raise RuntimeError(f'turn-header expected fragment not found: {old}')
  text = text.replace(old, new)
path.write_text(text, encoding='utf-8')

rendering = Path('RENDERING.md')
text = rendering.read_text(encoding='utf-8')
old = ('Visible metadata order is timestamp, record number, then turn ID. Debug provenance is a separate Core-owned comment. '
       'When a provider has no suitable native turn ID (for example Codex records), requesting Turn ID emits no invented value.')
new = ('Visible metadata order is timestamp, record number, then Turn ID. The visible Turn ID is the bare native source/provider value; '
       'it is not prefixed with `turn_id=`. Debug provenance is a separate Core-owned comment. When a provider has no suitable native '
       'Turn ID (for example Codex records), requesting Turn ID emits no invented value.')
if old not in text:
  raise RuntimeError('RENDERING heading-metadata paragraph not found')
rendering.write_text(text.replace(old, new, 1), encoding='utf-8')

decisions = Path('DECISIONS.md')
text = decisions.read_text(encoding='utf-8')
if '## D027 — Visible Turn IDs are unlabeled values' not in text:
  text = text.rstrip() + '''\n\n## D027 — Visible Turn IDs are unlabeled values\n\n**Status:** Accepted; refines D026 visible Turn-ID serialization.\n\n**Decision:** When Turn ID visibility is enabled, Core serializes the native source/provider Turn ID as the bare visible value. The semantic metadata field remains `turn_id`, but the visible heading component does not include a `turn_id=` label. Metadata order remains speaker, timestamp, record number, then Turn ID.\n\nDebug provenance is unaffected and remains explicitly labelled with `record_id=` and zero-based `record_index=` inside the Core-owned debug comment. Consumers must not add or remove the Turn-ID label themselves.\n\n**Reason:** The Turn ID is already an independently selectable, semantically styled heading component. Repeating its field name in every visible heading adds noise without adding identity information. Keeping the formatting decision in Core preserves the shared presentation contract across Markdown, HTML, structured presentation, and all consumers.\n'''
  decisions.write_text(text, encoding='utf-8')
