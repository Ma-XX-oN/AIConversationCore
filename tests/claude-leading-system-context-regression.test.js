import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptClaudeRecords, renderCanonicalMarkdown } from '../src/index.js';

const fixtureUrl = new URL('./fixtures/claude/claude-leading-system-context.jsonl', import.meta.url);

/**
 * Loads one JSONL fixture into provider records.
 *
 * @param {URL} url - Fixture URL to read.
 * @returns {Promise<Array<Object<string, *>>>} Parsed provider records in source order.
 */
async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('Claude injected leading IDE context does not create an extra visible User item', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptClaudeRecords(records);

  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'message');
  assert.equal(events[0].role, 'user');
  assert.equal(events[0].source_index, 2);
  assert.equal(events[0].blocks.length, 1);
  assert.equal(events[0].blocks[0].text, 'Can you provide me with simulations of these:');

  const markdown = renderCanonicalMarkdown(events);
  const userHeadings = markdown.match(/^## User$/gm) ?? [];
  assert.equal(userHeadings.length, 1);
  assert.equal(markdown.includes('ide_selection'), false);
  assert.equal(markdown.includes('repo is clean after the push'), false);
  assert.equal(markdown.startsWith('## User\n\n> Can you provide me with simulations of these:'), true);
});
