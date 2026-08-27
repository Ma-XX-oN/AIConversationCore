import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';
import { deriveTurns } from '../src/derive/turns.js';

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

const fixture = new URL('./fixtures/chatgpt/chatgpt-parent-links.jsonl', import.meta.url);

test('ChatGPT metadata.parent_id is preserved as an explicit canonical relationship', async () => {
  const records = await loadJsonl(fixture);
  const events = adaptChatGPTRecords(records);
  const call = events.find(event => event.source_record_id === 'call-parent-fixture');

  assert.ok(call);
  assert.equal(call.relationships.parent_record_id, 'tool-parent-fixture');
  assert.equal(call.relationships.parent_event_id, 'chatgpt:tool-parent-fixture');
});

test('records without metadata.parent_id do not gain inferred parent relationships', async () => {
  const records = await loadJsonl(fixture);
  const events = adaptChatGPTRecords(records);

  for (const event of events.filter(event => event.source_record_id !== 'call-parent-fixture')) {
    assert.equal(event.relationships.parent_record_id, null);
    assert.equal(event.relationships.parent_event_id, null);
  }
});

test('missing parent targets preserve source identity without inventing a canonical target', () => {
  const records = [{
    id: 'child-only',
    author: { role: 'assistant', name: null, metadata: {} },
    content: { content_type: 'text', parts: ['Child only.'] },
    metadata: { parent_id: 'not-in-dataset' },
    recipient: 'all'
  }];

  const [event] = adaptChatGPTRecords(records);
  assert.equal(event.relationships.parent_record_id, 'not-in-dataset');
  assert.equal(event.relationships.parent_event_id, null);
});

test('parent normalization preserves source order and does not alter turn derivation', async () => {
  const records = await loadJsonl(fixture);
  const events = adaptChatGPTRecords(records);

  assert.deepEqual(events.map(event => event.source_record_id), [
    'user-parent-fixture',
    'call-parent-fixture',
    'tool-parent-fixture',
    'assistant-parent-fixture'
  ]);

  const turns = deriveTurns(events);
  assert.deepEqual(turns.map(turn => turn.role), ['user', 'assistant']);
  assert.deepEqual(turns[0].event_ids, ['chatgpt:user-parent-fixture']);
  assert.deepEqual(turns[1].event_ids, ['chatgpt:assistant-parent-fixture']);
});
