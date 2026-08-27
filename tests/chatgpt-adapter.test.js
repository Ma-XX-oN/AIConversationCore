import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';
import { deriveTurns } from '../src/derive/turns.js';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-chronological-duplicate-identity.jsonl', import.meta.url);
const directFixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const baselineUrl = new URL('./baseline/ai-transcript-current/chatgpt-chronological-duplicate-identity.md', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('preserves canonical event order despite duplicate exchange identities', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptChatGPTRecords(records);

  assert.deepEqual(events.map(event => event.source_record_id), ['u1', 'a1', 'u2', 'a2']);
  assert.deepEqual(events.map(event => event.source_index), [0, 1, 2, 3]);

  assert.deepEqual(events.map(event => event.relationships.turn_exchange_id), [
    'same-exchange', 'same-exchange', 'same-exchange', 'same-exchange'
  ]);
  assert.deepEqual(events.map(event => event.relationships.working_turn_id), [
    'same-working', 'same-working', 'same-working', 'same-working'
  ]);
});

test('derives four distinct turns without collapsing duplicate exchange identities', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptChatGPTRecords(records);
  const turns = deriveTurns(events);

  assert.deepEqual(turns.map(turn => turn.source.record_ids[0]), ['u1', 'a1', 'u2', 'a2']);
  assert.deepEqual(turns.map(turn => turn.role), ['user', 'assistant', 'user', 'assistant']);
  assert.deepEqual(turns.map(turn => turn.index), [0, 1, 2, 3]);
  assert.equal(new Set(turns.map(turn => turn.id)).size, 4);
});

test('Phase 2 golden output preserves the same source-record chronology', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptChatGPTRecords(records);
  const baseline = await readFile(baselineUrl, 'utf8');

  let previousIndex = -1;
  for (const event of events) {
    const text = event.blocks[0]?.text;
    const index = baseline.indexOf(text);
    assert.notEqual(index, -1, `Phase 2 baseline is missing ${JSON.stringify(text)}.`);
    assert.ok(index > previousIndex, `Phase 2 baseline order differs at source record ${event.source_record_id}.`);
    previousIndex = index;
  }
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

test('maps Assistant commentary as commentary without flattening it into a message', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const commentary = events.find(event => event.source_record_id === 'commentary-1');

  assert.ok(commentary);
  assert.equal(commentary.kind, 'commentary');
  assert.equal(commentary.role, 'assistant');
  assert.equal(commentary.channel, 'commentary');
  assert.equal(commentary.visibility, 'visible');
  assert.equal(commentary.content_type, 'text');
  assert.equal(commentary.source_index, 3);
  assert.deepEqual(commentary.blocks.map(block => block.text), [
    'I am checking a tiny python snippet before the final answer.'
  ]);
  assert.equal(commentary.blocks[0].source.record_id, 'commentary-1');
  assert.equal(commentary.blocks[0].source.record_index, 3);
  assert.equal(commentary.blocks[0].source.part_index, 0);
});

test('maps ChatGPT thoughts to canonical reasoning summaries with structured provenance', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const reasoning = events.find(event => event.source_record_id === 'thought-1');

  assert.ok(reasoning);
  assert.equal(reasoning.kind, 'reasoning_summary');
  assert.equal(reasoning.role, 'assistant');
  assert.equal(reasoning.channel, null);
  assert.equal(reasoning.visibility, 'visible');
  assert.equal(reasoning.content_type, 'thoughts');
  assert.equal(reasoning.source_index, 2);
  assert.deepEqual(reasoning.blocks, [{
    id: 'thought-1:thought:0',
    type: 'reasoning_summary',
    summary: 'Planning the reply',
    content: 'I will run a tiny python snippet before answering.',
    chunks: ['I will run a tiny python snippet before answering.'],
    finished: true,
    source: {
      provider: 'chatgpt',
      record_id: 'thought-1',
      record_index: 2,
      thought_index: 0
    }
  }]);
});

test('commentary starts an Assistant turn that the later final message completes', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const selected = events.filter(event =>
    event.source_record_id === 'user-1' ||
    event.source_record_id === 'commentary-1' ||
    event.source_record_id === 'final-1'
  );
  const turns = deriveTurns(selected);

  assert.equal(turns.length, 2);
  assert.deepEqual(turns.map(turn => turn.role), ['user', 'assistant']);
  assert.deepEqual(turns[0].event_ids, ['chatgpt:user-1']);
  assert.deepEqual(turns[1].event_ids, ['chatgpt:commentary-1', 'chatgpt:final-1']);
  assert.deepEqual(turns[1].source.record_ids, ['commentary-1', 'final-1']);
});

test('reasoning, commentary, and final message retain source order in one Assistant turn', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const selected = events.filter(event =>
    event.source_record_id === 'user-1' ||
    event.source_record_id === 'thought-1' ||
    event.source_record_id === 'commentary-1' ||
    event.source_record_id === 'final-1'
  );
  const turns = deriveTurns(selected);

  assert.equal(turns.length, 2);
  assert.deepEqual(turns.map(turn => turn.role), ['user', 'assistant']);
  assert.deepEqual(turns[0].event_ids, ['chatgpt:user-1']);
  assert.deepEqual(turns[1].event_ids, [
    'chatgpt:thought-1',
    'chatgpt:commentary-1',
    'chatgpt:final-1'
  ]);
  assert.deepEqual(turns[1].source.record_ids, ['thought-1', 'commentary-1', 'final-1']);
});

test('reasoning after a completed Assistant message does not collapse into that completed turn', () => {
  const events = [
    {
      id: 'chatgpt:a1', provider: 'chatgpt', source_record_id: 'a1', role: 'assistant',
      visibility: 'visible', kind: 'message', source: { provider: 'chatgpt' }
    },
    {
      id: 'chatgpt:r1', provider: 'chatgpt', source_record_id: 'r1', role: 'assistant',
      visibility: 'visible', kind: 'reasoning_summary', source: { provider: 'chatgpt' }
    }
  ];
  const turns = deriveTurns(events);

  assert.equal(turns.length, 2);
  assert.deepEqual(turns.map(turn => turn.event_ids), [['chatgpt:a1'], ['chatgpt:r1']]);
});

test('rejects a source record without a stable id rather than inventing identity', () => {
  assert.throws(
    () => adaptChatGPTRecords([{ author: { role: 'user' }, content: { content_type: 'text', parts: ['x'] } }]),
    /missing id/
  );
});
