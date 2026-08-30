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
