import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptCodexRecords } from '../src/index.js';

const fixtureUrl = new URL('./fixtures/codex/codex-rich.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('full Codex adapter preserves evidenced messages, reasoning, commentary and tools', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptCodexRecords(records);

  assert.deepEqual(events.map(event => event.kind), [
    'message',
    'reasoning_summary',
    'commentary',
    'tool_call',
    'tool_result',
    'message',
    'message',
    'tool_call',
    'tool_result',
    'reasoning_summary',
    'message'
  ]);
  assert.deepEqual(events.map(event => event.source_index), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const commentary = events[2];
  assert.equal(commentary.role, 'assistant');
  assert.equal(commentary.channel, 'commentary');
  assert.equal(commentary.blocks[0].text,
    'I found the relevant section and I am applying a small patch.');
});

test('Codex apply_patch keeps explicit file-change semantics and call correlation', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptCodexRecords(records);
  const call = events.find(event => event.kind === 'tool_call' &&
    event.blocks[0]?.name === 'apply_patch');
  const result = events.find(event => event.kind === 'tool_result' &&
    event.relationships.tool_call_id === 'call-patch-1');

  assert.equal(call.relationships.tool_call_id, 'call-patch-1');
  assert.equal(result.relationships.tool_call_id, 'call-patch-1');
  assert.equal(call.blocks[0].file_change.patch,
    '*** Begin Patch\n*** Update File: example.txt\n@@\n-old value\n+new value\n*** End Patch');
  assert.equal(result.blocks[0].output, 'Done!');
});

test('Codex request_user_input normalizes questions and answers before rendering', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptCodexRecords(records);
  const call = events.find(event => event.kind === 'tool_call' &&
    event.blocks[0]?.name === 'request_user_input');
  const result = events.find(event => event.kind === 'tool_result' &&
    event.relationships.tool_call_id === 'call-question-1');

  assert.equal(call.relationships.tool_call_id, 'call-question-1');
  assert.deepEqual(call.blocks[0].request_user_input, {
    questions: [{
      id: 'mode',
      question: 'Choose verification mode',
      options: [
        { label: 'Focused', description: 'Run the narrow regression' },
        { label: 'Full', description: 'Run the complete suite' }
      ]
    }]
  });
  assert.deepEqual(result.blocks[0].request_user_input_response, {
    answers: { mode: ['Focused'] }
  });
});
