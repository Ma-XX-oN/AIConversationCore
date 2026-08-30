import fs from 'node:fs';
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
