import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptClaudeRecords } from '../src/index.js';

const fixtureUrl = new URL('./fixtures/claude/claude-rich-subagent.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('full Claude adapter preserves evidenced messages, reasoning, tools and subagents', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptClaudeRecords(records);

  assert.deepEqual(events.map(event => event.kind), [
    'message',
    'reasoning_summary',
    'subagent',
    'subagent',
    'subagent',
    'tool_call',
    'tool_result',
    'message'
  ]);
  assert.deepEqual(events.map(event => event.source_index), [0, 1, 3, 5, 6, 7, 8, 9]);

  const successful = events.find(event => event.kind === 'subagent' &&
    event.blocks[0]?.agent_id === 'agent-safe-1');
  assert.ok(successful);
  assert.equal(successful.blocks[0].description, 'Review selected files');
  assert.equal(successful.blocks[0].output,
    'Async agent launched successfully.\nThe agent is working in the background.\noutput_file: C:\\Temp\\agent-safe-1.output');
  assert.equal(successful.relationships.tool_call_id, 'toolu_agent_ok');

  const failed = events.find(event => event.kind === 'subagent' &&
    event.blocks[0]?.agent_id === 'toolu_agent_fail');
  assert.ok(failed);
  assert.equal(failed.blocks[0].description, 'Redirect review agent');
  assert.equal(failed.blocks[0].output,
    "Agent type 'fork' not found. Available agents: general-purpose");

  const queued = events.find(event => event.kind === 'subagent' &&
    event.blocks[0]?.agent_id === 'child-safe-2');
  assert.ok(queued);
  assert.equal(queued.blocks[0].description, 'Inspect child output');
  assert.equal(queued.blocks[0].output, 'Child review complete.');
  assert.equal(queued.relationships.tool_call_id, 'toolu_child_safe');
});

test('Claude Bash call/result keeps explicit source correlation without chronology inference', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptClaudeRecords(records);
  const call = events.find(event => event.kind === 'tool_call');
  const result = events.find(event => event.kind === 'tool_result');

  assert.equal(call.relationships.tool_call_id, 'toolu_bash');
  assert.equal(result.relationships.tool_call_id, 'toolu_bash');
  assert.equal(call.blocks[0].name, 'Bash');
  assert.deepEqual(call.blocks[0].input, {
    command: "printf 'verified\\n'",
    description: 'Verify result'
  });
  assert.equal(result.blocks[0].output, 'verified');
});
