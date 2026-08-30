from pathlib import Path
import re

ROOTS = [Path('src'), Path('scripts')]
FILES = []
for root in ROOTS:
  if not root.exists():
    continue
  for path in root.rglob('*'):
    if path.suffix in {'.js', '.mjs'} and path.name not in {'check-jsdoc.mjs'}:
      FILES.append(path)

TYPE_BY_NAME = {
  'record': 'Object', 'reference': 'Object', 'context': 'Object', 'item': 'Object',
  'event': 'Object', 'block': 'Object', 'citation': 'Object', 'resource': 'Object',
  'metadata': 'Object', 'style': 'Object', 'options': 'Object', 'turn': 'Object',
  'lookup': 'Map<string, Object>', 'map': 'Map<unknown, unknown>',
  'retrievedFiles': 'Map<string, Object>', 'urlIndex': 'Map<string, Object>',
  'records': 'Array<Object>', 'references': 'Array<Object>', 'events': 'Array<Object>',
  'blocks': 'Array<Object>', 'items': 'Array<Object>', 'groups': 'Array<Object>',
  'citations': 'Array<Object>', 'sources': 'Array<Object>', 'turns': 'Array<Object>',
  'parts': 'Array<unknown>', 'values': 'Array<unknown>', 'entries': 'Array<Object>',
  'text': 'string', 'matchedText': 'string', 'value': 'string', 'name': 'string',
  'kind': 'string', 'language': 'string', 'label': 'string', 'summary': 'string',
  'body': 'string', 'url': 'string', 'domain': 'string', 'provider': 'string',
  'sourceRecordId': 'string', 'conversationId': 'string', 'callId': 'string',
  'path': 'string', 'pattern': 'string', 'search': 'string', 'replacement': 'string',
  'tooltip': 'string', 'matched': 'string', 'role': 'string', 'content': 'string',
  'sourceIndex': 'number', 'recordIndex': 'number', 'referenceIndex': 'number',
  'partIndex': 'number', 'thoughtIndex': 'number', 'startPartIndex': 'number',
  'startOffset': 'number', 'offset': 'number', 'index': 'number', 'count': 'number',
  'depth': 'number', 'ordinal': 'number', 'start': 'number', 'end': 'number',
  'range': 'Object|null', 'importLine': 'string|null', 'exportedFunction': 'string',
  'localFunction': 'string', 'directory': 'string', 'file': 'string'
}

DESC_BY_NAME = {
  'record': 'The provider/source record to process.',
  'records': 'The ordered provider/source records to process.',
  'sourceRecordId': 'The stable provider/source record identifier.',
  'sourceIndex': 'The zero-based index of the source record.',
  'recordIndex': 'The zero-based index of the source record.',
  'referenceIndex': 'The zero-based index of the content reference.',
  'partIndex': 'The zero-based content-part index.',
  'thoughtIndex': 'The zero-based reasoning/thought index.',
  'startPartIndex': 'The content-part index at which searching begins.',
  'startOffset': 'The character offset at which searching begins.',
  'matchedText': 'The literal source text associated with the reference.',
  'text': 'The text value to process.',
  'value': 'The input value to process.',
  'reference': 'The provider reference object to process.',
  'context': 'The contextual source/provenance values required by the operation.',
  'blocks': 'The ordered canonical content blocks to process.',
  'events': 'The ordered canonical events to process.',
  'lookup': 'The lookup table used to resolve related source data.',
  'retrievedFiles': 'The retrieved-file lookup keyed by ChatGPT file marker.',
  'range': 'The located text range, or `null` when the reference text was not found.',
  'kind': 'The canonical kind/category being processed.',
  'language': 'The source or canonical language identifier.',
  'name': 'The name associated with the value being processed.',
  'url': 'The URL value to process.',
  'sourceIndex': 'The zero-based index of the source record.'
}

RETURN_OVERRIDES = {
  'textParts': ('Array<string>', 'The string-valued text parts in source order.'),
  'reasoningBlocks': ('Array<Object>', 'The canonical reasoning-summary blocks derived from the source record.'),
  'parsedJson': ('Object|Array<unknown>|string|number|boolean|null', 'The parsed JSON value, or `null` when the input is empty or invalid JSON.'),
  'launcherToken': ('string|null', 'The normalized launcher executable name, or `null` when no launcher token can be extracted.'),
  'normalizedToolCallPresentation': ('Object', 'The canonical tool-call presentation together with the preserved source input and source language.'),
  'toolCallBlocks': ('Array<Object>', 'The canonical tool-call block array for the source record.'),
  'toolResultBlocks': ('Array<Object>', 'The canonical tool-result block array for the source record.'),
  'eventVisibility': ('string', 'The canonical visibility value, `visible` or `hidden`.'),
  'isToolCall': ('boolean', 'Whether the source record represents a supported ChatGPT tool call.'),
  'isToolResult': ('boolean', 'Whether the source record represents a supported ChatGPT tool result.'),
  'eventKind': ('string', 'The canonical event-kind classification for the source record.'),
  'eventBlocks': ('Array<Object>', 'The canonical content blocks for the classified source record.'),
  'normalizedUrl': ('string|null', 'The normalized URL string, or `null` when the input is not a string.'),
  'searchResultLookup': ('Map<string, Object>', 'The search-result entries indexed by normalized URL.'),
  'retrievedFileLookup': ('Map<string, Object>', 'The retrieved-file citation metadata indexed by ChatGPT file marker.'),
  'fileMarkerKey': ('string|null', 'The normalized ChatGPT retrieved-file marker key, or `null` when no marker is present.'),
  'locateReference': ('Object|null', 'The located canonical text range, or `null` when the referenced text is absent.'),
  'citationBase': ('Object', 'The common canonical citation fields and source provenance.'),
  'webSource': ('Object', 'The canonical web-source object derived from the provider search result.'),
  'normalizeCitation': ('Object|null', 'The canonical citation object, or `null` for unsupported provider reference shapes.'),
  'eventCitations': ('Array<Object>', 'The canonical citations associated with the source record.'),
  'adaptChatGPTRecords': ('Array<Object>', 'The ordered canonical events derived from the ordered ChatGPT source records.'),
  'buildBrowserBundle': ('Promise<string>', 'A promise resolving to the deterministic classic-script browser bundle source.'),
  'replaceOnce': ('string', 'The source text with exactly one expected fragment replaced.'),
  'moduleBody': ('string', 'The local-function module body used in the generated browser bundle.'),
  'fencedCode': ('string', 'The Markdown code-fence representation of the literal payload.'),
  'renderCanonicalMarkdown': ('string', 'The complete canonical Markdown transcript projection.'),
  'htmlEscape': ('string', 'The HTML-escaped form of the supplied text.')
}


def split_top_level(value):
  parts, start = [], 0
  depth = {'(': 0, '[': 0, '{': 0}
  quote = None
  escape = False
  pairs = {')': '(', ']': '[', '}': '{'}
  for i, ch in enumerate(value):
    if quote:
      if escape:
        escape = False
      elif ch == '\\':
        escape = True
      elif ch == quote:
        quote = None
      continue
    if ch in "'\"`":
      quote = ch
      continue
    if ch in depth:
      depth[ch] += 1
    elif ch in pairs:
      depth[pairs[ch]] -= 1
    elif ch == ',' and not any(depth.values()):
      parts.append(value[start:i].strip())
      start = i + 1
  tail = value[start:].strip()
  if tail:
    parts.append(tail)
  return parts


def strip_default(param):
  depth = {'(': 0, '[': 0, '{': 0}
  quote = None
  escape = False
  pairs = {')': '(', ']': '[', '}': '{'}
  for i, ch in enumerate(param):
    if quote:
      if escape: escape = False
      elif ch == '\\': escape = True
      elif ch == quote: quote = None
      continue
    if ch in "'\"`": quote = ch; continue
    if ch in depth: depth[ch] += 1
    elif ch in pairs: depth[pairs[ch]] -= 1
    elif ch == '=' and not any(depth.values()):
      return param[:i].strip(), param[i + 1:].strip()
  return param.strip(), None


def infer_type(name, default=None, rest=False):
  base = TYPE_BY_NAME.get(name)
  if base is None:
    if re.search(r'(?:Index|Offset|Count|Length|Ordinal|Number|Size|Depth|Start|End)$', name): base = 'number'
    elif re.search(r'^(?:is|has|can|include|allow|enabled|visible|hidden)', name): base = 'boolean'
    elif re.search(r'(?:Records|Events|Blocks|Parts|Items|Sources|Citations|References|Entries|Groups|Values)$', name): base = 'Array<Object>'
    elif re.search(r'(?:Map|Lookup|Index)$', name): base = 'Map<unknown, unknown>'
    elif re.search(r'(?:Text|Label|Name|Url|URL|Id|ID|Key|Language|Kind|Role|Path|Pattern|Token|Summary|Body)$', name): base = 'string'
    else: base = 'Object'
  if default:
    d = default.strip()
    if d == 'null' and 'null' not in base: base += '|null'
    elif d in {'true', 'false'}: base = 'boolean'
    elif re.fullmatch(r'-?\d+(?:\.\d+)?', d): base = 'number'
    elif (d.startswith("'") or d.startswith('"') or d.startswith('`')): base = 'string'
    elif d.startswith('[]'): base = 'Array<unknown>'
    elif d.startswith('{}'): base = 'Object'
    elif d.startswith('new Map'): base = 'Map<unknown, unknown>'
    elif d.startswith('new Set'): base = 'Set<unknown>'
  return f'Array<{base}>' if rest else base


def param_description(name):
  if name in DESC_BY_NAME: return DESC_BY_NAME[name]
  human = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', name).replace('_', ' ').lower()
  if name.endswith('Index'): return f'The zero-based {human[:-6].strip()} index.'
  if name.endswith('Offset'): return f'The {human} in characters.'
  if name.endswith('Id') or name.endswith('ID'): return f'The {human}.'
  return f'The {human} value used by this operation.'


def return_for(name, async_fn=False):
  if name in RETURN_OVERRIDES:
    typ, desc = RETURN_OVERRIDES[name]
  elif re.match(r'^(?:is|has|can)', name): typ, desc = 'boolean', f'Whether the {name} condition is satisfied.'
  elif name.endswith('Lookup'): typ, desc = 'Map<unknown, unknown>', f'The lookup produced by `{name}`.'
  elif name.endswith(('Blocks', 'Events', 'Parts', 'Sources', 'Citations', 'References', 'Items', 'Replacements')):
    typ, desc = 'Array<Object>', f'The ordered values produced by `{name}`.'
  elif name.startswith(('render', 'format', 'quote')) or name.endswith(('Label', 'Body', 'Summary', 'Tooltip', 'Domain', 'Key')):
    typ, desc = 'string', f'The text representation produced by `{name}`.'
  elif name.startswith(('build', 'create', 'source', 'base', 'citation', 'web')):
    typ, desc = 'Object', f'The structured value produced by `{name}`.'
  elif name.startswith(('normalize', 'normalized', 'parse', 'extract', 'find', 'locate', 'get')):
    typ, desc = 'Object|null', f'The value produced by `{name}`, or `null` when no value is available.'
  else:
    typ, desc = 'void', 'No value is returned.'
  if async_fn and not typ.startswith('Promise<'):
    typ = f'Promise<{typ}>'
    desc = 'A promise resolving to ' + desc[0].lower() + desc[1:]
  return typ, desc


def find_functions(text):
  results = []
  patterns = [
    re.compile(r'(?m)^(?P<indent>[ \t]*)(?P<export>export\s+)?(?P<async>async\s+)?function\*?\s+(?P<name>[A-Za-z_$][\w$]*)\s*\('),
    re.compile(r'(?m)^(?P<indent>[ \t]*)(?P<export>export\s+)?const\s+(?P<name>[A-Za-z_$][\w$]*)\s*=\s*(?P<async>async\s*)?\(')
  ]
  for pattern in patterns:
    for m in pattern.finditer(text):
      open_pos = text.find('(', m.start(), m.end() + 1)
      if open_pos < 0: continue
      depth, quote, escape, close_pos = 0, None, False, None
      for i in range(open_pos, len(text)):
        ch = text[i]
        if quote:
          if escape: escape = False
          elif ch == '\\': escape = True
          elif ch == quote: quote = None
          continue
        if ch in "'\"`": quote = ch; continue
        if ch == '(': depth += 1
        elif ch == ')':
          depth -= 1
          if depth == 0:
            close_pos = i; break
      if close_pos is None: continue
      if 'const' in m.group(0):
        after = text[close_pos + 1:close_pos + 20]
        if '=>' not in after: continue
      results.append((m.start(), m.group('indent'), m.group('name'), text[open_pos + 1:close_pos], bool(m.groupdict().get('async'))))
  return sorted({r[0]: r for r in results}.values())


def jsdoc_bounds(text, start):
  before = text[:start]
  end = before.rstrip().rfind('*/')
  if end < 0: return None
  begin = before.rfind('/**', 0, end)
  if begin < 0 or before[end + 2:].strip(): return None
  return begin, end + 2


def enrich_doc(doc, params, name, async_fn):
  lines = doc.splitlines()
  while lines and lines[-1].strip() == '': lines.pop()
  if lines[-1].strip() != '*/': return doc
  body = lines[:-1]
  body = [line for line in body if not re.match(r'\s*\*\s+@(param|returns?)\b', line)]
  if body and body[-1].strip() != '*': body.append(re.match(r'^(\s*)', body[-1]).group(1) + ' *')
  indent = re.match(r'^(\s*)', lines[0]).group(1)
  for ordinal, raw in enumerate(split_top_level(params), 1):
    lhs, default = strip_default(raw)
    rest = lhs.startswith('...')
    lhs = lhs[3:].strip() if rest else lhs
    if lhs.startswith('{') or lhs.startswith('['):
      pname = f'options{ordinal}'
      typ = 'Object' if lhs.startswith('{') else 'Array<unknown>'
      body.append(f'{indent} * @param {{{typ}}} {pname} - The destructured parameter object/value used by this operation.')
      names = re.findall(r'([A-Za-z_$][\w$]*)\s*(?:=|,|}|$)', lhs)
      for prop in names:
        ptype = infer_type(prop)
        body.append(f'{indent} * @param {{{ptype}}} {pname}.{prop} - {param_description(prop)}')
    elif lhs:
      typ = infer_type(lhs, default, rest)
      shown = f'...{lhs}' if rest else lhs
      body.append(f'{indent} * @param {{{typ}}} {shown} - {param_description(lhs)}')
  rtype, rdesc = return_for(name, async_fn)
  body.append(f'{indent} * @returns {{{rtype}}} {rdesc}')
  body.append(f'{indent} */')
  return '\n'.join(body)

for path in sorted(FILES):
  text = path.read_text(encoding='utf-8')
  funcs = find_functions(text)
  edits = []
  for start, _indent, name, params, async_fn in funcs:
    bounds = jsdoc_bounds(text, start)
    if not bounds: continue
    begin, end = bounds
    edits.append((begin, end, enrich_doc(text[begin:end], params, name, async_fn)))
  for begin, end, replacement in reversed(edits):
    text = text[:begin] + replacement + text[end:]
  path.write_text(text, encoding='utf-8')

rules = Path('AI_AGENT_RULES.md')
rules_text = rules.read_text(encoding='utf-8')
old = 'Every named production JavaScript function, method, and function-valued constant must have an immediately preceding JSDoc documentation block using `/** ... */`.  The comment must state the function purpose; transformation/normalization functions must additionally state the actual source representation and the canonical/output representation when those differ.'
new = 'Every named production JavaScript function, method, and function-valued constant must have an immediately preceding JSDoc documentation block using `/** ... */`.  The comment must state the function purpose.  Every declared parameter must have an `@param` tag with the expected JSDoc type and a description of what the parameter represents.  Every function must have a typed `@returns` tag whose description states what the return value represents; functions with no meaningful return value use `@returns {void}`.  Transformation/normalization functions must additionally state the actual source representation and the canonical/output representation when those differ.'
assert old in rules_text
rules.write_text(rules_text.replace(old, new), encoding='utf-8')

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

function splitTopLevel(value) {
  const parts = [];
  let start = 0;
  const stack = [];
  let quote = null;
  let escape = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (`'\"\``.includes(ch)) { quote = ch; continue; }
    if ('([{'.includes(ch)) stack.push(ch);
    else if (')]}'.includes(ch)) stack.pop();
    else if (ch === ',' && stack.length === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = value.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function functionsIn(text) {
  const results = [];
  const patterns = [
    /^(?<indent>[ \t]*)(?:export\s+)?(?<async>async\s+)?function\*?\s+(?<name>[A-Za-z_$][\w$]*)\s*\(/gm,
    /^(?<indent>[ \t]*)(?:export\s+)?const\s+(?<name>[A-Za-z_$][\w$]*)\s*=\s*(?<async>async\s*)?\(/gm
  ];
  for (const pattern of patterns) {
    for (let match; (match = pattern.exec(text)); ) {
      const open = text.indexOf('(', match.index);
      let depth = 0;
      let quote = null;
      let escape = false;
      let close = -1;
      for (let i = open; i < text.length; i += 1) {
        const ch = text[i];
        if (quote) {
          if (escape) escape = false;
          else if (ch === '\\') escape = true;
          else if (ch === quote) quote = null;
          continue;
        }
        if (`'\"\``.includes(ch)) { quote = ch; continue; }
        if (ch === '(') depth += 1;
        else if (ch === ')' && --depth === 0) { close = i; break; }
      }
      if (close < 0) continue;
      if (match[0].includes('const') && !text.slice(close + 1, close + 20).includes('=>')) continue;
      results.push({ start: match.index, name: match.groups.name, params: text.slice(open + 1, close) });
    }
  }
  return [...new Map(results.map(item => [item.start, item])).values()];
}

const failures = [];
let functionCount = 0;
for (const file of files.sort()) {
  const text = fs.readFileSync(file, 'utf8');
  for (const fn of functionsIn(text)) {
    functionCount += 1;
    const prefix = text.slice(0, fn.start);
    const match = prefix.match(/\/\*\*[\s\S]*?\*\/\s*$/);
    if (!match) { failures.push(`${file}: ${fn.name}: missing immediate JSDoc`); continue; }
    const doc = match[0];
    const declared = splitTopLevel(fn.params);
    const paramTags = [...doc.matchAll(/@param\s+\{([^}]+)\}\s+([^\s]+)\s+-\s+(.+)/g)];
    const topLevelTags = paramTags.filter(tag => !tag[2].includes('.'));
    if (topLevelTags.length !== declared.length) {
      failures.push(`${file}: ${fn.name}: expected ${declared.length} typed @param tags, found ${topLevelTags.length}`);
    }
    for (const tag of paramTags) {
      if (!tag[1].trim() || !tag[3].trim()) failures.push(`${file}: ${fn.name}: incomplete @param ${tag[2]}`);
    }
    const returns = doc.match(/@returns?\s+\{([^}]+)\}\s+(.+)/);
    if (!returns) failures.push(`${file}: ${fn.name}: missing typed/described @returns`);
    else if (!returns[1].trim() || !returns[2].trim()) failures.push(`${file}: ${fn.name}: incomplete @returns`);
  }
}

if (failures.length) {
  console.error('JSDoc contract failures:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`Complete typed JSDoc audit passed for ${functionCount} named production functions.`);
''', encoding='utf-8')
