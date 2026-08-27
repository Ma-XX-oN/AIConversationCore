import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('preserves ChatGPT alt_text as a non-citation display replacement', async () => {
  const records = await loadJsonl(fixtureUrl);
  const event = adaptChatGPTRecords(records).find(item => item.source_record_id === 'final-1');

  assert.ok(event);
  assert.deepEqual(event.display_replacements, [{
    id: 'final-1:display_replacement:0',
    type: 'display_replacement',
    replacement_kind: 'alt_text',
    matched_text: 'entity["people","Morris Plotkin","coding theorist"]',
    display_text: 'Morris Plotkin',
    prompt_text: 'Morris Plotkin',
    text_range: {
      part_index: 0,
      start: 0,
      end: 'entity["people","Morris Plotkin","coding theorist"]'.length
    },
    source: {
      provider: 'chatgpt',
      record_id: 'final-1',
      record_index: 9,
      reference_index: 0
    }
  }]);

  assert.equal(event.citations.some(item => item.matched_text?.includes('Morris Plotkin')), false);
});

test('display replacement range points into canonical text without renderer token parsing', async () => {
  const records = await loadJsonl(fixtureUrl);
  const event = adaptChatGPTRecords(records).find(item => item.source_record_id === 'final-1');
  const replacement = event.display_replacements[0];
  const block = event.blocks[replacement.text_range.part_index];

  assert.equal(
    block.text.slice(replacement.text_range.start, replacement.text_range.end),
    replacement.matched_text
  );
  assert.equal(replacement.display_text, 'Morris Plotkin');
});
