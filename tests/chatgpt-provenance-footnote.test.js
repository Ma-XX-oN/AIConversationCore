import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';
import { deriveTurns } from '../src/derive/turns.js';
import { renderCanonicalMarkdown } from '../src/projections/markdown.js';

const fixtureUrl = new URL('./fixtures/chatgpt/H1 Heading.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('preserves original JSONL provenance through ChatGPT normalization and turn derivation', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptChatGPTRecords(records);
  const recordId = '76eb9f6a-e7a6-470f-9205-7f09d7dbbd60';
  const event = events.find(item => item.source_record_id === recordId);

  assert.ok(event);
  assert.equal(event.source_index, 8);
  assert.deepEqual(event.source, {
    provider: 'chatgpt',
    record_id: recordId,
    record_index: 8,
    turn_id: recordId,
    create_time: 1772317719.480372,
    update_time: null,
    turn_exchange_id: '7a7d9077-dafb-4b5c-a567-afb382039884',
    working_turn_id: null
  });
  assert.equal(event.source.record_index + 1, 9);
  assert.equal(Object.hasOwn(event.source, 'record_number'), false);

  const turn = deriveTurns(events).find(item => item.event_ids.includes(event.id));
  assert.ok(turn);
  const sourceRecord = turn.source.records.find(record => record.record_id === recordId);
  assert.deepEqual(sourceRecord, {
    record_id: recordId,
    record_index: 8,
    turn_id: recordId,
    create_time: 1772317719.480372,
    update_time: null,
    turn_exchange_id: '7a7d9077-dafb-4b5c-a567-afb382039884',
    working_turn_id: null
  });
  assert.equal(sourceRecord.record_index + 1, 9);
  assert.equal(Object.hasOwn(sourceRecord, 'record_number'), false);
});

test('round-trips ordinary Markdown footnote syntax without provider-specific conversion', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptChatGPTRecords(records);
  const recordId = '76eb9f6a-e7a6-470f-9205-7f09d7dbbd60';
  const event = events.find(item => item.source_record_id === recordId);

  assert.ok(event);
  const text = event.blocks.filter(block => block.type === 'text').map(block => block.text).join('');
  assert.ok(text.includes('A sentence with a footnote.[^1]'));
  assert.ok(text.includes('[^1]: The footnote text.'));
  assert.equal(event.citations.length, 0);

  const rendered = renderCanonicalMarkdown(events);
  assert.ok(rendered.includes('A sentence with a footnote.[^1]'));
  assert.ok(rendered.includes('[^1]: The footnote text.'));
});
