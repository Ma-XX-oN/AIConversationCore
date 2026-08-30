from pathlib import Path
import re

ROOTS = [Path('src'), Path('scripts')]
FILES = sorted(
  p for root in ROOTS if root.exists()
  for p in root.rglob('*')
  if p.suffix in {'.js', '.mjs'} and p.name not in {'check-jsdoc.mjs'}
)

GLOBAL_DOCS = {
  ('scripts/build-browser-bundle.mjs', 'ROOT'):
    'Repository root used to resolve source modules and the generated browser bundle.',
  ('scripts/build-browser-bundle.mjs', 'OUTPUT'):
    'Generated browser-bundle path consumed by browser integrations.',
  ('src/projections/style.js', 'STYLE_ROLES'):
    'Stable semantic style-role names exposed to projection consumers.',
  ('src/projections/style.js', 'DEFAULT_THEME'):
    'Immutable default projection theme used as the reset and merge baseline.',
  ('src/projections/style.js', 'configuredTheme'):
    'Mutable process-wide projection theme produced by applying consumer overrides to the default.',
  ('src/projections/turn-header.js', 'PROVIDER_LABELS'):
    'Human-readable provider labels used when rendering turn-header provenance.',
}

LOCAL_COMMENTS = {
  'src/adapters/chatgpt-base.js': {
    '  let input = sourceInput;':
      'Canonical tool input starts as the exact provider payload and is replaced only by an evidenced normalization.',
    '  let inputFormat = null;':
      'Canonical input format remains unspecified unless the provider payload can be classified safely.',
    '  let language = sourceLanguage;':
      'Canonical display language starts from provider metadata and may be corrected from stronger tool semantics.',
    '  const lookup = new Map();':
      'Lookup maps preserve source reference identity while citations/resources are normalized.',
    '  const citations = [];':
      'Canonical citations are accumulated in source-reference order.',
    '  let partIndex = 0;':
      'Source text-part cursor used to continue citation matching after the previous reference.',
    '  let offset = 0;':
      'Character offset within the current source text part for the next citation search.',
    '  let cursor = 0;':
      'Offset of the next source character not yet copied while rewriting generated sandbox links.',
    '  const resources = [];':
      'Canonical resources are accumulated without changing source encounter order.',
    '  let resourceIndex = 0;':
      'Stable per-event resource ordinal used to construct canonical resource identifiers.',
    '  const sourceRecords = records':
      'Metadata records are excluded here so source_index continues to refer only to provider conversation records.',
  },
  'src/adapters/chatgpt.js': {
    '  const textOrdinalToPartIndex = new Map();':
      'Maps text-only ordinals used by ChatGPT references back to original multimodal part indexes.',
    '  let textOrdinal = 0;':
      'Counts only textual parts while walking multimodal source content.',
    '  let partIndex = 0;':
      'Canonical text-block cursor used to place display replacements in source order.',
    '  let offset = 0;':
      'Character offset within the current canonical text block for the next reference match.',
    '  const knownRecordIds = new Set(records':
      'Set of stable provider record IDs used to validate parent relationships without inventing links.',
  },
  'src/adapters/claude.js': {
    '  const events = [];':
      'Canonical events are appended in the same order as their source records/blocks.',
    '  const agentCalls = new Map();':
      'Maps Claude subagent call IDs to their source call metadata so later results can be correlated.',
    '  const toolNames = new Map();':
      'Maps tool-use IDs to tool names so result events retain the originating tool identity.',
  },
  'src/adapters/codex.js': {
    '  const events = [];':
      'Canonical events are appended in source order while Codex records are normalized.',
  },
  'src/derive/turns.js': {
    '  const turns = [];':
      'Derived turns are accumulated in canonical event order; no provider event reordering occurs here.',
    '  const turnsWithMessage = new Set();':
      'Tracks turn indexes that already contain a visible message so later assistant activity is attached correctly.',
  },
  'src/projections/markdown.js': {
    '  const results = new Map();':
      'Maps tool-call IDs to their canonical result events for paired rendering.',
    '  const consumedResults = new Set();':
      'Tracks tool-result event IDs already rendered with a call so they are not emitted twice.',
    '  const requestIds = new Set();':
      'Tracks Codex request/result event IDs rendered in request sections and excluded from the main response.',
    '  const state = { codexQuestionNumber: 0 };':
      'Per-render mutable numbering state for Codex question sections; it is not shared across render calls.',
  },
}

DECLARATION_RX = re.compile(
  r'^(?P<indent>[ \t]*)(?:export\s+)?(?:(?:async\s+)?function\*?\s+[A-Za-z_$][\w$]*\s*\(|const\s+[A-Za-z_$][\w$]*\s*=.*=>)'
)
TOP_LEVEL_RX = re.compile(r'^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b')


def normalize_immediate_jsdoc(lines, declaration_index):
  end = declaration_index - 1
  while end >= 0 and not lines[end].strip():
    end -= 1
  if end < 0 or lines[end].strip() != '*/':
    return
  start = end
  while start >= 0 and lines[start].strip() != '/**':
    start -= 1
  if start < 0:
    return
  indent = re.match(r'^[ \t]*', lines[declaration_index]).group(0)
  normalized = [indent + '/**']
  for line in lines[start + 1:end]:
    content = line.strip()
    if content.startswith('*'):
      content = content[1:].lstrip()
    normalized.append(indent + ' *' + ((' ' + content) if content else ''))
  normalized.append(indent + ' */')
  lines[start:end + 1] = normalized


def preceding_comment(lines, index):
  pos = index - 1
  while pos >= 0 and not lines[pos].strip():
    pos -= 1
  if pos < 0:
    return False
  stripped = lines[pos].strip()
  return stripped.startswith('//') or stripped.endswith('*/') or stripped.startswith('/*')


def add_global_docs(path, lines):
  result = []
  for line in lines:
    match = TOP_LEVEL_RX.match(line)
    if match:
      name = match.group(1)
      # Function-valued top-level const declarations already have full JSDoc.
      is_function_value = '=>' in line or re.search(r'=\s*(?:async\s+)?function\b', line)
      if not is_function_value and not preceding_comment(result, len(result)):
        doc = GLOBAL_DOCS.get((path.as_posix(), name))
        if not doc:
          raise SystemExit(f'Missing semantic global documentation for {path}:{name}')
        result.append(f'/** {doc} */')
    result.append(line)
  return result


def add_local_comments(path, lines):
  configured = LOCAL_COMMENTS.get(path.as_posix(), {})
  counts = {needle: 0 for needle in configured}
  result = []
  for line in lines:
    if line in configured:
      counts[line] += 1
      if not preceding_comment(result, len(result)):
        indent = re.match(r'^[ \t]*', line).group(0)
        result.append(f'{indent}// {configured[line]}')
    result.append(line)
  missing = [needle for needle, count in counts.items() if count == 0]
  if missing:
    raise SystemExit(f'Configured local declarations not found in {path}:\n' + '\n'.join(missing))
  return result


for path in FILES:
  original = path.read_text(encoding='utf-8')
  lines = original.splitlines()

  # Work from bottom to top so line replacement cannot invalidate later declaration indexes.
  declaration_indexes = [i for i, line in enumerate(lines) if DECLARATION_RX.match(line)]
  for index in reversed(declaration_indexes):
    normalize_immediate_jsdoc(lines, index)

  lines = add_global_docs(path, lines)
  lines = add_local_comments(path, lines)
  updated = '\n'.join(lines) + ('\n' if original.endswith('\n') else '')
  path.write_text(updated, encoding='utf-8')
  if updated != original:
    print(f'updated {path}')
