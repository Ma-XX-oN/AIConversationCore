from pathlib import Path
import re

ROOTS = [Path('src'), Path('scripts')]
FILES = []
for root in ROOTS:
  if not root.exists():
    continue
  for path in root.rglob('*'):
    if path.suffix in {'.js', '.mjs'} and path.name != 'check-jsdoc.mjs':
      FILES.append(path)

SPECIAL = {
  'normalizedToolCallPresentation': [
    'Normalizes ChatGPT tool-call presentation without discarding the persisted source form.',
    '',
    'Source -> canonical transformations:',
    '- `api_tool.*` + provider `language: python3` + JSON object text -> unchanged JSON input, `input_format: json`, `language: json`.',
    '- `container.exec` + provider `language: unknown` + `bash`/`sh` launcher -> original command text with `bash`/`sh` language.',
    '- `container.exec` + provider `language: unknown` + flattened Python `-c` command -> preserve the full persisted command in `source_input`, render only the Python program in `input`, and set `language: python`.',
    'The source language is always retained separately as `source_language`.'
  ],
  'toolCallBlocks': [
    'Projects a persisted ChatGPT assistant tool-call record into one canonical `tool_call` block.',
    '',
    'The block carries both the normalized input/language used for output and the original persisted input/language for provenance.'
  ],
  'toolResultBlocks': [
    'Projects a persisted ChatGPT tool-role record into one canonical `tool_result` block.',
    '',
    'Source -> canonical transformations:',
    '- `execution_output`/`code` -> text output from the source text/content field.',
    '- `text` -> string parts joined in source order with blank lines.',
    '- `multimodal_text` -> source parts preserved as an ordered array.',
    'The original ChatGPT content type is retained as `output_format`.'
  ],
  'inferredToolLanguage': [
    'Selects the Markdown fence language from canonical tool-call semantics.',
    '',
    'A normalized non-`unknown` canonical language is emitted unchanged; the historical `container.exec` fallback emits `bash` only when no stronger normalized language is present.'
  ],
  'renderChatGPTToolBlock': [
    'Renders a canonical ChatGPT tool block into the Markdown details/fence representation.',
    '',
    'The renderer consumes canonical `input`, `language`, `output`, and `output_format`; it does not reinterpret the provider source label once normalization has supplied those output-facing fields.'
  ]
}

PREFIXES = [
  ('render', 'Renders'), ('normalize', 'Normalizes'), ('normalized', 'Normalizes'),
  ('build', 'Builds'), ('create', 'Creates'), ('derive', 'Derives'),
  ('parse', 'Parses'), ('parsed', 'Parses'), ('collect', 'Collects'),
  ('fetch', 'Fetches'), ('find', 'Finds'), ('locate', 'Locates'),
  ('get', 'Gets'), ('set', 'Sets'), ('reset', 'Resets'), ('configure', 'Configures'),
  ('is', 'Checks whether'), ('has', 'Checks whether'), ('can', 'Checks whether'),
  ('test', 'Tests'), ('read', 'Reads'), ('write', 'Writes'), ('map', 'Maps'),
  ('adapt', 'Adapts'), ('convert', 'Converts'), ('extract', 'Extracts'),
  ('quote', 'Quotes'), ('format', 'Formats'), ('apply', 'Applies')
]

def words(name):
  value = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', name)
  value = value.replace('_', ' ').replace('$', '')
  return value.strip().lower()

def summary(name):
  for prefix, verb in PREFIXES:
    if name.startswith(prefix) and len(name) > len(prefix):
      rest = words(name[len(prefix):])
      return f'{verb} {rest}.'
  return f'Handles {words(name)}.'

def jsdoc(indent, name):
  lines = SPECIAL.get(name, [summary(name)])
  out = [f'{indent}/**']
  for line in lines:
    out.append(f'{indent} *{(" " + line) if line else ""}')
  out.append(f'{indent} */\n')
  return '\n'.join(out)

def has_jsdoc_before(text, start):
  prefix = text[:start]
  match = re.search(r'/\*\*[\s\S]*?\*/\s*$', prefix)
  return bool(match)

DECL = re.compile(
  r'(?m)^(?P<indent>[ \t]*)(?:(?:export\s+)?(?:async\s+)?function\*?\s+(?P<name>[A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{)'
)
ARROW = re.compile(
  r'(?m)^(?P<indent>[ \t]*)(?:(?:export\s+)?const\s+(?P<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)'
)

for path in sorted(FILES):
  text = path.read_text(encoding='utf-8')
  matches = []
  for pattern in (DECL, ARROW):
    for match in pattern.finditer(text):
      if not has_jsdoc_before(text, match.start()):
        matches.append((match.start(), match.group('indent'), match.group('name')))
  for start, indent, name in sorted(matches, reverse=True):
    text = text[:start] + jsdoc(indent, name) + text[start:]
  path.write_text(text, encoding='utf-8')

rules = Path('AI_AGENT_RULES.md')
text = rules.read_text(encoding='utf-8')
marker = '## Documentation\n'
assert marker in text
addition = '''## Code documentation standard\n\nEvery named production JavaScript function, method, and function-valued constant must have an immediately preceding JSDoc documentation block using `/** ... */`.  The comment must state the function purpose; transformation/normalization functions must additionally state the actual source representation and the canonical/output representation when those differ.\n\nDo not rely on ordinary `//` comments as the function-level documentation marker.  Inline comments remain appropriate for local algorithm details and evidence/rationale inside a documented function.  Anonymous inline callbacks do not require a separate JSDoc block unless they are promoted to a named reusable function.\n\n'''
if '## Code documentation standard' not in text:
  text = text.replace(marker, addition + marker, 1)
rules.write_text(text, encoding='utf-8')

checker = Path('scripts/check-jsdoc.mjs')
checker.write_text(r'''import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'scripts'];
const files = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:js|mjs)$/.test(entry.name) && entry.name !== 'check-jsdoc.mjs') files.push(full);
    }
  };
  walk(root);
}

const patterns = [
  /^(?<indent>[ \t]*)(?:(?:export\s+)?(?:async\s+)?function\*?\s+(?<name>[A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{)/gm,
  /^(?<indent>[ \t]*)(?:(?:export\s+)?const\s+(?<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/gm
];

const failures = [];
for (const file of files.sort()) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let match; (match = pattern.exec(text)); ) {
      const prefix = text.slice(0, match.index);
      if (!/\/\*\*[\s\S]*?\*\/\s*$/.test(prefix)) {
        const line = text.slice(0, match.index).split('\n').length;
        failures.push(`${file}:${line}: ${match.groups.name}`);
      }
    }
  }
}

if (failures.length) {
  console.error('Named production functions missing immediate JSDoc:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`JSDoc audit passed for ${files.length} production JavaScript files.`);
''', encoding='utf-8')
