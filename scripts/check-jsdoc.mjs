import fs from 'node:fs';
import path from 'node:path';

// Production source roots covered by the documentation contract.
const roots = ['src', 'scripts'];
// JavaScript modules whose named production functions and globals are audited.
const files = [];
// Generated filler phrases that do not explain a parameter or return value.
const placeholderDescriptions = [
  'value used by this operation',
  'value required by this function',
  'text representation produced by',
  'structured value produced by',
  'the value produced by'
];
// Exact documentation failures already present on main before the canonical render API work began.
const legacyFailures = new Set([
  'src/projections/markdown.js: projectedHeadingMetadataSuffix: expected 1 typed @param tags, found 2',
  'src/projections/markdown.js: projectedHeading: missing immediate JSDoc',
  'src/projections/markdown.js: styled: missing immediate JSDoc'
]);

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
  const stripped = prefix.trimEnd();
  if (!stripped.endsWith('*/')) return null;
  const marker = stripped.lastIndexOf('/**');
  if (marker < 0) return null;
  const lineStart = stripped.lastIndexOf('\n', marker - 1) + 1;
  return stripped.slice(lineStart);
}

function functionsIn(text) {
  const results = [];
  const parenPatterns = [
    /^(?<indent>[ \t]*)(?:export\s+)?(?:async\s+)?function\*?\s+(?<name>[A-Za-z_$][\w$]*)\s*\(/gm,
    /^(?<indent>[ \t]*)(?:export\s+)?const\s+(?<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/gm
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
      results.push({
        start: match.index,
        indent: match.groups.indent,
        name: match.groups.name,
        params: splitTopLevel(text.slice(open + 1, close))
      });
    }
  }
  const single = /^(?<indent>[ \t]*)(?:export\s+)?const\s+(?<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?<param>[A-Za-z_$][\w$]*)\s*=>/gm;
  for (let match; (match = single.exec(text)); ) {
    results.push({
      start: match.index,
      indent: match.groups.indent,
      name: match.groups.name,
      params: [match.groups.param]
    });
  }
  return [...new Map(results.map(item => [item.start, item])).values()];
}

function alignedJsdoc(doc, indent) {
  const lines = doc.split('\n');
  if (lines[0] !== `${indent}/**`) return false;
  if (lines.at(-1) !== `${indent} */`) return false;
  return lines.slice(1, -1).every(line => line === `${indent} *` || line.startsWith(`${indent} * `));
}

function previousNonblankLine(text, start) {
  const prefix = text.slice(0, start).replace(/[ \t]+$/gm, '');
  const lines = prefix.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim()) return lines[i];
  }
  return '';
}

function topLevelVariablesIn(text, functionStarts) {
  const results = [];
  const pattern = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/gm;
  for (let match; (match = pattern.exec(text)); ) {
    if (functionStarts.has(match.index)) continue;
    results.push({ start: match.index, name: match[1] });
  }
  return results;
}

function hasPlaceholderDescription(description) {
  const normalized = description.toLowerCase();
  return placeholderDescriptions.some(phrase => normalized.includes(phrase));
}

const failures = [];
let functionCount = 0;
let variableCount = 0;
for (const file of files.sort()) {
  const text = fs.readFileSync(file, 'utf8');
  const functions = functionsIn(text);
  const functionStarts = new Set(functions.map(fn => fn.start));
  for (const fn of functions) {
    functionCount += 1;
    const doc = immediateJsdoc(text, fn.start);
    if (!doc) { failures.push(`${file}: ${fn.name}: missing immediate JSDoc`); continue; }
    if (!alignedJsdoc(doc, fn.indent)) {
      failures.push(`${file}: ${fn.name}: JSDoc indentation does not match declaration`);
    }
    const paramTags = [...doc.matchAll(/@param\s+\{([^}]+)\}\s+([^\s]+)\s+-\s+(.+)/g)];
    const topLevelTags = paramTags.filter(tag => !tag[2].includes('.'));
    if (topLevelTags.length !== fn.params.length) {
      failures.push(`${file}: ${fn.name}: expected ${fn.params.length} typed @param tags, found ${topLevelTags.length}`);
    }
    for (const tag of paramTags) {
      const type = tag[1].trim();
      const description = tag[3].trim();
      if (!type || !description) failures.push(`${file}: ${fn.name}: incomplete @param ${tag[2]}`);
      if (type === 'Object') failures.push(`${file}: ${fn.name}: @param ${tag[2]} uses bare Object instead of the expected object shape`);
      if (hasPlaceholderDescription(description)) failures.push(`${file}: ${fn.name}: @param ${tag[2]} uses a placeholder description`);
    }
    const returns = doc.match(/@returns?\s+\{([^}]+)\}\s+(.+)/);
    if (!returns) {
      failures.push(`${file}: ${fn.name}: missing typed/described @returns`);
    } else {
      const type = returns[1].trim();
      const description = returns[2].trim();
      if (!type || !description) failures.push(`${file}: ${fn.name}: incomplete @returns`);
      if (type === 'Object') failures.push(`${file}: ${fn.name}: @returns uses bare Object instead of the expected object shape`);
      if (hasPlaceholderDescription(description)) failures.push(`${file}: ${fn.name}: @returns uses a placeholder description`);
    }
  }

  for (const variable of topLevelVariablesIn(text, functionStarts)) {
    variableCount += 1;
    const prior = previousNonblankLine(text, variable.start).trim();
    if (!(prior.startsWith('//') || prior.startsWith('/*') || prior.endsWith('*/'))) {
      failures.push(`${file}: ${variable.name}: missing immediately associated explanatory comment`);
    }
  }
}

const actionableFailures = failures.filter(failure => !legacyFailures.has(failure));
if (actionableFailures.length) {
  console.error('Documentation contract failures:\n' + actionableFailures.join('\n'));
  process.exit(1);
}
if (failures.length) {
  console.warn('Known pre-existing documentation debt:\n' + failures.join('\n'));
}
console.log(`Documentation audit passed for ${functionCount} named production functions and ${variableCount} top-level variables.`);
