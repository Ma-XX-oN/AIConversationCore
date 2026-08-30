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
  'textParts': ['Returns the string-valued text parts from a ChatGPT source record in source order.'],
  'reasoningBlocks': ['Builds canonical reasoning-summary blocks from a ChatGPT `thoughts` record.'],
  'parsedJson': ['Parses a JSON string when valid, otherwise returns no parsed value.'],
  'launcherToken': ['Extracts the normalized executable/launcher token from the start of a persisted command string.'],
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
  'eventVisibility': ['Returns whether a ChatGPT source record is canonically visible or hidden.'],
  'eventKind': ['Classifies a ChatGPT source record into its canonical event kind.'],
  'eventBlocks': ['Builds the canonical content blocks for one classified ChatGPT source record.'],
  'adaptChatGPTRecords': ['Adapts ordered ChatGPT provider records into ordered canonical events while preserving source identity and provenance.'],
  'imagePointerSource': ['Returns the first usable image asset pointer exposed by a ChatGPT multimodal part.'],
  'sedimentDownloadUrl': ['Converts a ChatGPT `sediment://file_*` pointer into its authenticated download URL.'],
  'imageResource': ['Builds the canonical conversation-image resource for one ChatGPT image pointer part.'],
  'sourceFor': ['Builds canonical ChatGPT source provenance for a derived event/block object.'],
  'normalizedUrl': ['Normalizes a URL for stable citation/search-result lookup.'],
  'sourceRecordIdentity': ['Returns the stable source-record identity used to derive Claude canonical IDs.'],
  'baseSource': ['Builds canonical source provenance for a Claude record or content block.'],
  'textBlock': ['Builds a canonical text block from one Claude text content block.'],
  'reasoningBlock': ['Builds a canonical reasoning-summary block from one Claude thinking block.'],
  'toolCallEvent': ['Builds a canonical tool-call event from the provider-specific tool-call source record/block.'],
  'toolResultEvent': ['Builds a canonical tool-result event from the provider-specific tool-result source record/block.'],
  'messageEvent': ['Builds a canonical message/commentary event from provider-specific message content.'],
  'reasoningEvent': ['Builds a canonical reasoning-summary event from provider-specific reasoning content.'],
  'noticeEvent': ['Builds a canonical notice event from provider-specific synthetic notice content.'],
  'textFromToolResult': ['Extracts displayable text from a Claude tool-result string or text-block array.'],
  'agentIdFromResult': ['Extracts the internal Claude subagent ID embedded in an Agent tool result.'],
  'cleanAgentResult': ['Removes the internal Agent-ID control line from Claude subagent output.'],
  'subagentEvent': ['Builds a canonical subagent event from Claude Agent completion data.'],
  'xmlTag': ['Returns the trimmed contents of one named XML-like tag from Claude queue-operation text.'],
  'queueSubagentEvent': ['Converts a completed Claude queue-operation task notification into a canonical subagent event.'],
  'sourceIdentity': ['Returns the stable source identity used to derive Codex canonical IDs.'],
  'source': ['Builds canonical source provenance for a Codex source record.'],
  'htmlEscape': ['Escapes text for safe insertion into generated HTML fragments.'],
  'providerLabel': ['Returns the human-readable transcript speaker label for a canonical provider.'],
  'resourceById': ['Finds one canonical event resource by resource ID.'],
  'faviconDomain': ['Returns the origin used for a citation source favicon lookup.'],
  'sourceTooltip': ['Builds citation-source tooltip text from the source title and snippet.'],
  'sourceLabel': ['Returns the preferred visible label for a citation source.'],
  'retrievedLineLabel': ['Extracts and normalizes a retrieved-file line-range label from citation marker text.'],
  'textReplacements': ['Collects display replacements, citations, and generated-file links that apply to one text part.'],
  'reasoningBody': ['Builds the Markdown body for canonical reasoning-summary blocks in one event.'],
  'details': ['Wraps a summary and body in the HTML `details` structure used by Markdown output.'],
  'thoughtSummary': ['Returns the singular/plural human-readable summary for a count of Claude thoughts.'],
  'fencedCode': ['Wraps literal content in an adaptive Markdown code fence that cannot collide with backtick runs in the payload.'],
  'inferredToolLanguage': [
    'Selects the Markdown fence language from canonical tool-call semantics.',
    '',
    'A normalized non-`unknown` canonical language is emitted unchanged; the historical `container.exec` fallback emits `bash` only when no stronger normalized language is present.'
  ],
  'renderChatGPTToolBlock': [
    'Renders a canonical ChatGPT tool block into the Markdown details/fence representation.',
    '',
    'The renderer consumes canonical `input`, `language`, `output`, and `output_format`; it does not reinterpret the provider source label once normalization has supplied those output-facing fields.'
  ],
  'renderChatGPTToolEvent': ['Renders all canonical tool blocks belonging to one ChatGPT tool event.'],
  'renderChatGPTCommentarySegment': ['Renders one canonical ChatGPT commentary segment while keeping its reasoning and tool activity together.'],
  'renderChatGPTAssistantSegment': ['Renders one canonical ChatGPT Assistant segment into the required Markdown section or sections.']
}

PREFIXES = [
  ('normalized', 'Normalizes'), ('normalize', 'Normalizes'),
  ('parsed', 'Parses'), ('parse', 'Parses'),
  ('render', 'Renders'), ('build', 'Builds'), ('create', 'Creates'),
  ('derive', 'Derives'), ('collect', 'Collects'), ('fetch', 'Fetches'),
  ('find', 'Finds'), ('locate', 'Locates'), ('get', 'Gets'), ('set', 'Sets'),
  ('reset', 'Resets'), ('configure', 'Configures'), ('is', 'Checks whether'),
  ('has', 'Checks whether'), ('can', 'Checks whether'), ('test', 'Tests'),
  ('read', 'Reads'), ('write', 'Writes'), ('map', 'Maps'), ('adapt', 'Adapts'),
  ('convert', 'Converts'), ('extract', 'Extracts'), ('quote', 'Quotes'),
  ('format', 'Formats'), ('apply', 'Applies'), ('remap', 'Remaps')
]

def words(name):
  value = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', name)
  value = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', value)
  value = value.replace('_', ' ').replace('$', '').strip().lower()
  replacements = {
    'chat gpt': 'ChatGPT', 'json': 'JSON', 'url': 'URL', 'id': 'ID',
    'html': 'HTML', 'ansi': 'ANSI', 'markdown': 'Markdown',
    'codex': 'Codex', 'claude': 'Claude'
  }
  for old, new in replacements.items():
    value = re.sub(rf'\b{re.escape(old)}\b', new, value)
  return value

def summary(name):
  for prefix, verb in PREFIXES:
    if name.startswith(prefix) and len(name) > len(prefix):
      return f'{verb} {words(name[len(prefix):])}.'
  suffixes = [
    ('Blocks', 'Builds {subject} blocks.'), ('Event', 'Builds a canonical {subject} event.'),
    ('Identity', 'Returns the {subject} identity.'), ('Label', 'Returns the {subject} label.'),
    ('Summary', 'Returns {subject} summary text.'), ('Body', 'Builds {subject} body text.'),
    ('Resource', 'Builds the {subject} resource.'), ('Range', 'Returns the {subject} range.'),
    ('Parts', 'Returns the {subject} parts.'), ('Url', 'Returns the {subject} URL.'),
    ('Domain', 'Returns the {subject} domain.'), ('Tooltip', 'Builds {subject} tooltip text.')
  ]
  for suffix, template in suffixes:
    if name.endswith(suffix) and len(name) > len(suffix):
      return template.format(subject=words(name[:-len(suffix)]))
  return f'Handles {words(name)}.'

def jsdoc(indent, name):
  lines = SPECIAL.get(name, [summary(name)])
  out = [f'{indent}/**']
  for line in lines:
    out.append(f'{indent} *{(" " + line) if line else ""}')
  out.append(f'{indent} */\n')
  return '\n'.join(out)

def has_jsdoc_before(text, start):
  return bool(re.search(r'/\*\*[\s\S]*?\*/\s*$', text[:start]))

DECL = re.compile(r'(?m)^(?P<indent>[ \t]*)(?:(?:export\s+)?(?:async\s+)?function\*?\s+(?P<name>[A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{)')
ARROW = re.compile(r'(?m)^(?P<indent>[ \t]*)(?:(?:export\s+)?const\s+(?P<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)')

for path in sorted(FILES):
  text = path.read_text(encoding='utf-8')
  matches = []
  for pattern in (DECL, ARROW):
    for match in pattern.finditer(text):
      name = match.group('name')
      if not has_jsdoc_before(text, match.start()):
        matches.append((match.start(), match.group('indent'), name))
      else:
        generic = f'/**\n * Implements `{name}`.\n */'
        if generic in text:
          text = text.replace(generic, jsdoc('', name).rstrip('\n'), 1)
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
