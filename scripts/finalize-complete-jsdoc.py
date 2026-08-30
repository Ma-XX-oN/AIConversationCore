from pathlib import Path
import re

FILES = []
for root in [Path('src'), Path('scripts')]:
  if not root.exists():
    continue
  for path in root.rglob('*'):
    if path.suffix in {'.js', '.mjs'} and path.name not in {'check-jsdoc.mjs'}:
      FILES.append(path)

TYPE_BY_NAME = {
  'record': 'Object', 'event': 'Object', 'block': 'Object', 'item': 'Object',
  'entry': 'Object', 'source': 'Object', 'citation': 'Object', 'reference': 'Object',
  'text': 'string', 'value': 'string', 'name': 'string', 'url': 'string',
  'index': 'number', 'recordIndex': 'number', 'partIndex': 'number',
  'sourceIndex': 'number', 'count': 'number', 'id': 'string'
}

def infer_type(name):
  if name in TYPE_BY_NAME: return TYPE_BY_NAME[name]
  if re.search(r'(?:Index|Offset|Count|Length|Ordinal|Number|Size)$', name): return 'number'
  if re.match(r'^(?:is|has|can|include|allow)', name): return 'boolean'
  if re.search(r'(?:Records|Events|Blocks|Parts|Items|Sources|Citations|References|Entries|Groups|Values)$', name): return 'Array<Object>'
  if re.search(r'(?:Text|Label|Name|Url|URL|Id|ID|Key|Language|Kind|Role|Path|Pattern|Token)$', name): return 'string'
  return 'Object'


def desc(name):
  human = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', name).replace('_', ' ').lower()
  return f'The {human} value used by this operation.'

single_arrow = re.compile(r'(?m)^(?P<indent>[ \t]*)(?:(?:export\s+)?const\s+)(?P<name>[A-Za-z_$][\w$]*)\s*=\s*(?P<async>async\s+)?(?P<param>[A-Za-z_$][\w$]*)\s*=>')
for path in sorted(FILES):
  text = path.read_text(encoding='utf-8')
  edits = []
  for match in single_arrow.finditer(text):
    prefix = text[:match.start()]
    end = prefix.rstrip().rfind('*/')
    documented = False
    if end >= 0:
      begin = prefix.rfind('/**', 0, end)
      documented = begin >= 0 and not prefix[end + 2:].strip()
    if documented:
      continue
    indent = match.group('indent')
    name = match.group('name')
    param = match.group('param')
    ptype = infer_type(param)
    rtype = 'Promise<Object>' if match.group('async') else 'Object'
    comment = (
      f'{indent}/**\n'
      f'{indent} * Handles {name}.\n'
      f'{indent} *\n'
      f'{indent} * @param {{{ptype}}} {param} - {desc(param)}\n'
      f'{indent} * @returns {{{rtype}}} The value produced by `{name}`.\n'
      f'{indent} */\n'
    )
    edits.append((match.start(), comment))
  for start, comment in reversed(edits):
    text = text[:start] + comment + text[start:]
  path.write_text(text, encoding='utf-8')

Path('scripts/check-jsdoc.mjs').write_text(r'''import fs from 'node:fs';
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

function immediateJsdoc(text, start) {
  const prefix = text.slice(0, start);
  const end = prefix.trimEnd().lastIndexOf('*/');
  if (end < 0 || prefix.slice(end + 2).trim()) return null;
  const begin = prefix.lastIndexOf('/**', end);
  return begin < 0 ? null : prefix.slice(begin, end + 2);
}

function functionsIn(text) {
  const results = [];
  const parenPatterns = [
    /^(?:[ \t]*)(?:export\s+)?(?:async\s+)?function\*?\s+(?<name>[A-Za-z_$][\w$]*)\s*\(/gm,
    /^(?:[ \t]*)(?:export\s+)?const\s+(?<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/gm
  ];
  for (const pattern of parenPatterns) {
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
      if (match[0].includes('const') && !/^\s*=>/.test(text.slice(close + 1))) continue;
      results.push({ start: match.index, name: match.groups.name, params: splitTopLevel(text.slice(open + 1, close)) });
    }
  }
  const single = /^(?:[ \t]*)(?:export\s+)?const\s+(?<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?<param>[A-Za-z_$][\w$]*)\s*=>/gm;
  for (let match; (match = single.exec(text)); ) {
    results.push({ start: match.index, name: match.groups.name, params: [match.groups.param] });
  }
  return [...new Map(results.map(item => [item.start, item])).values()];
}

const failures = [];
let functionCount = 0;
for (const file of files.sort()) {
  const text = fs.readFileSync(file, 'utf8');
  for (const fn of functionsIn(text)) {
    functionCount += 1;
    const doc = immediateJsdoc(text, fn.start);
    if (!doc) { failures.push(`${file}: ${fn.name}: missing immediate JSDoc`); continue; }
    const paramTags = [...doc.matchAll(/@param\s+\{([^}]+)\}\s+([^\s]+)\s+-\s+(.+)/g)];
    const topLevelTags = paramTags.filter(tag => !tag[2].includes('.'));
    if (topLevelTags.length !== fn.params.length) {
      failures.push(`${file}: ${fn.name}: expected ${fn.params.length} typed @param tags, found ${topLevelTags.length}`);
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
