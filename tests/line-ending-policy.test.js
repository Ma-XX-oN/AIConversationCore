import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const REQUIRED = [
  '*.js text eol=lf',
  '*.mjs text eol=lf',
  '*.json text eol=lf',
  '*.jsonl text eol=lf',
  '*.md text eol=lf',
  '*.py text eol=lf',
];

test('repository enforces LF checkouts for Core text inputs', async () => {
  const text = await readFile(new URL('../.gitattributes', import.meta.url), 'utf8');
  const rules = new Set(text.trim().split(/\r?\n/));
  for (const rule of REQUIRED) {
    assert.ok(rules.has(rule), `missing required .gitattributes rule: ${rule}`);
  }
});
