import fs from 'node:fs';
import path from 'node:path';

import { countLogicalLines, evaluateFileSizePolicy } from './file-size-policy-lib.mjs';

// Repository root used for maintained-file discovery and policy configuration.
const root = process.cwd();
// Parsed repository-maintained file-size policy.
const policy = JSON.parse(fs.readFileSync(
  path.join(root, '.github', 'file-size-policy.json'),
  'utf8'));

/**
 * Recursively collects UTF-8 source/document files from one repository directory.
 *
 * @param {string} directory - Repository-relative directory to scan.
 * @param {Set<string>} extensions - File extensions that belong to the maintained policy.
 * @returns {string[]} Repository-relative maintained file paths.
 */
function collectFiles(directory, extensions) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  const collected = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.posix.join(directory.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectFiles(relative, extensions));
      continue;
    }
    if (extensions.has(path.extname(entry.name))) collected.push(relative);
  }
  return collected;
}

/**
 * Returns root-level maintained Markdown documents.
 *
 * @returns {string[]} Root-level Markdown paths.
 */
function rootDocuments() {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name);
}

const sourceFiles = [
  ...collectFiles('src', new Set(['.js', '.mjs'])),
  ...collectFiles('scripts', new Set(['.js', '.mjs']))
];
const documentFiles = [
  ...rootDocuments(),
  ...collectFiles('docs', new Set(['.md'])),
  ...collectFiles('decisions', new Set(['.md']))
];
const files = [...new Set([...sourceFiles, ...documentFiles])].sort();
const violations = [];

for (const relative of files) {
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  violations.push(...evaluateFileSizePolicy({
    path: relative,
    lineCount: countLogicalLines(text),
    maxLines: policy.max_lines,
    legacyMaxLines: policy.legacy_max_lines ?? {}
  }));
}

if (violations.length) {
  process.stderr.write('Maintained-file size policy failures:\n');
  for (const violation of violations) process.stderr.write(`- ${violation}\n`);
  process.exit(1);
}

process.stdout.write(
  `Maintained-file size policy passed for ${files.length} source/document files.\n`);
