import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-chronological-duplicate-identity.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('preserves source chronology despite duplicate exchange identities', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptChatGPTRecords(records);

  assert.deepEqual(events.map(event => event.source_record_id), ['u1', 'a1', 'u2', 'a2']);
  assert.deepEqual(events.map(event => event.source_index), [0, 1, 2, 3]);
  assert.deepEqual(events.map(event => event.blocks[0]?.text), [
    'First question',
    'First answer',
    'Second question',
    'Second answer'
  ]);

  assert.deepEqual(events.map(event => event.relationships.turn_exchange_id), [
    'same-exchange', 'same-exchange', 'same-exchange', 'same-exchange'
  ]);
  assert.deepEqual(events.map(event => event.relationships.working_turn_id), [
    'same-working', 'same-working', 'same-working', 'same-working'
  ]);
});

test('maps ordinary visible User and final Assistant records to canonical message events', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptChatGPTRecords(records);

  assert.deepEqual(events.map(({ kind, role, channel, visibility, content_type }) => ({
    kind, role, channel, visibility, content_type
  })), [
    { kind: 'message', role: 'user', channel: null, visibility: 'visible', content_type: 'text' },
    { kind: 'message', role: 'assistant', channel: 'final', visibility: 'visible', content_type: 'text' },
    { kind: 'message', role: 'user', channel: null, visibility: 'visible', content_type: 'text' },
    { kind: 'message', role: 'assistant', channel: 'final', visibility: 'visible', content_type: 'text' }
  ]);

  for (const [index, event] of events.entries()) {
    assert.equal(event.id, `chatgpt:${records[index].id}`);
    assert.equal(event.source.provider, 'chatgpt');
    assert.equal(event.source.record_id, records[index].id);
    assert.equal(event.source.record_index, index);
    assert.equal(event.blocks.length, 1);
    assert.equal(event.blocks[0].source.record_id, records[index].id);
    assert.equal(event.blocks[0].source.record_index, index);
    assert.equal(event.blocks[0].source.part_index, 0);
  }
});

test('rejects a source record without a stable id rather than inventing identity', () => {
  assert.throws(
    () => adaptChatGPTRecords([{ author: { role: 'user' }, content: { content_type: 'text', parts: ['x'] } }]),
    /missing id/
  );
});
