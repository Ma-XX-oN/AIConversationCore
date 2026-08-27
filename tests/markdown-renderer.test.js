import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords, renderCanonicalMarkdown } from '../src/index.js';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const goldenUrl = new URL('./golden/chatgpt/chatgpt-direct.canonical.md', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('canonical Markdown renderer reproduces the established rich ChatGPT golden exactly', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptChatGPTRecords(records);
  const expected = await readFile(goldenUrl, 'utf8');

  assert.equal(renderCanonicalMarkdown(events), expected);
});

test('canonical Markdown renderer consumes normalized events, not provider-native records', () => {
  const events = [{
    id: 'chatgpt:u1',
    provider: 'chatgpt',
    source_record_id: 'u1',
    source_index: 0,
    kind: 'message',
    role: 'user',
    channel: null,
    visibility: 'visible',
    content_type: 'text',
    blocks: [{
      id: 'u1:part:0',
      type: 'text',
      text: 'Hello',
      source: { provider: 'chatgpt', record_id: 'u1', record_index: 0, part_index: 0 }
    }],
    citations: [],
    display_replacements: [],
    resources: [],
    relationships: {},
    source: { provider: 'chatgpt', record_id: 'u1', record_index: 0 }
  }];

  assert.equal(renderCanonicalMarkdown(events), '## User\n\n> Hello\n\n');
});
