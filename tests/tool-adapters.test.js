import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';
import { adaptClaudeToolEvents } from '../src/adapters/claude.js';
import { adaptCodexToolEvents } from '../src/adapters/codex.js';
import { deriveTurns } from '../src/derive/turns.js';

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

const chatgptFixture = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const claudeQuestionFixture = new URL('./fixtures/claude/claude-questions.jsonl', import.meta.url);
const claudeRichFixture = new URL('./fixtures/claude/claude-rich-subagent.jsonl', import.meta.url);
const codexFixture = new URL('./fixtures/codex/codex-rich.jsonl', import.meta.url);

test('ChatGPT code/tool records normalize without inventing call correlation', async () => {
  const records = await loadJsonl(chatgptFixture);
  const events = adaptChatGPTRecords(records);
  const selected = events.filter(event => ['code-1', 'code-2', 'tool-1', 'tool-2'].includes(event.source_record_id));

  assert.deepEqual(selected.map(event => event.kind), [
    'tool_call', 'tool_call', 'tool_result', 'tool_result'
  ]);
  assert.deepEqual(selected.map(event => event.source_index), [4, 5, 6, 7]);

  const pythonCall = selected[0].blocks[0];
  assert.equal(pythonCall.type, 'tool_call');
  assert.equal(pythonCall.name, 'python');
  assert.equal(pythonCall.input, "print('hello from python')");
  assert.equal(pythonCall.language, 'python');
  assert.equal(pythonCall.call_id, null);

  const executionResult = selected[2].blocks[0];
  assert.equal(executionResult.type, 'tool_result');
  assert.equal(executionResult.name, 'python');
  assert.equal(executionResult.output, 'hello from python');
  assert.equal(executionResult.call_id, null);

  for (const event of selected) {
    assert.equal(event.relationships.tool_call_id, null);
  }

  const browsingStatus = events.find(event => event.source_record_id === 'tool-3');
  assert.equal(browsingStatus.kind, 'message');
});

test('tool events do not create or re-associate derived turns without explicit turn semantics', async () => {
  const records = await loadJsonl(chatgptFixture);
  const events = adaptChatGPTRecords(records);
  const turns = deriveTurns(events);

  assert.deepEqual(turns.map(turn => turn.role), ['user', 'assistant']);
  assert.deepEqual(turns[0].event_ids, ['chatgpt:user-1']);
  assert.deepEqual(turns[1].event_ids, [
    'chatgpt:thought-1',
    'chatgpt:commentary-1',
    'chatgpt:final-1'
  ]);
  assert.equal(turns.some(turn => turn.event_ids.some(id => id.includes('code-') || id.includes('tool-'))), false);
});

test('Claude tool_use and tool_result preserve explicit correlation and special tool identity', async () => {
  const records = await loadJsonl(claudeQuestionFixture);
  const events = adaptClaudeToolEvents(records);

  assert.deepEqual(events.map(event => event.kind), [
    'tool_call', 'tool_result', 'tool_call', 'tool_result'
  ]);
  assert.deepEqual(events.map(event => event.source_index), [1, 2, 3, 4]);

  const firstCall = events[0].blocks[0];
  const firstResult = events[1].blocks[0];
  assert.equal(firstCall.name, 'AskUserQuestion');
  assert.equal(firstCall.call_id, 'toolu_question_one');
  assert.equal(firstResult.call_id, 'toolu_question_one');
  assert.equal(events[0].relationships.tool_call_id, 'toolu_question_one');
  assert.equal(events[1].relationships.tool_call_id, 'toolu_question_one');
  assert.equal(firstCall.input.questions.length, 1);
  assert.match(firstResult.output, /Both/);

  const secondCall = events[2].blocks[0];
  assert.equal(secondCall.name, 'AskUserQuestion');
  assert.equal(secondCall.input.questions.length, 2);
});

test('Claude generic Bash call/result uses the same canonical relationship shape', async () => {
  const records = await loadJsonl(claudeRichFixture);
  const events = adaptClaudeToolEvents(records);
  const bashCall = events.find(event => event.blocks[0]?.name === 'Bash');
  assert.ok(bashCall);

  const callId = bashCall.blocks[0].call_id;
  const result = events.find(event => event.kind === 'tool_result' && event.blocks[0]?.call_id === callId);
  assert.ok(result);
  assert.equal(callId, 'toolu_bash');
  assert.equal(bashCall.blocks[0].input.command, "printf 'verified\\n'");
  assert.equal(result.blocks[0].output, 'verified');
});

test('Codex custom tools and function tools preserve explicit call/result IDs and raw inputs', async () => {
  const records = await loadJsonl(codexFixture);
  const events = adaptCodexToolEvents(records);

  assert.deepEqual(events.map(event => event.source_index), [3, 4, 7, 8]);
  assert.deepEqual(events.map(event => event.kind), [
    'tool_call', 'tool_result', 'tool_call', 'tool_result'
  ]);

  const patchCall = events[0].blocks[0];
  const patchResult = events[1].blocks[0];
  assert.equal(patchCall.name, 'apply_patch');
  assert.equal(patchCall.call_id, 'call-patch-1');
  assert.match(patchCall.input, /\*\*\* Update File: example\.txt/);
  assert.equal(patchResult.call_id, 'call-patch-1');
  assert.equal(patchResult.output, 'Done!');

  const questionCall = events[2].blocks[0];
  const questionResult = events[3].blocks[0];
  assert.equal(questionCall.name, 'request_user_input');
  assert.equal(questionCall.input_format, 'json_string');
  assert.match(questionCall.input, /Choose verification mode/);
  assert.equal(questionResult.call_id, 'call-question-1');
  assert.match(questionResult.output, /Focused/);
});

test('tool adapters preserve source order and never correlate unrelated IDs', async () => {
  const claude = adaptClaudeToolEvents(await loadJsonl(claudeQuestionFixture));
  const codex = adaptCodexToolEvents(await loadJsonl(codexFixture));

  assert.deepEqual([...claude].map(event => event.source_index), [...claude].map(event => event.source_index).sort((a, b) => a - b));
  assert.deepEqual([...codex].map(event => event.source_index), [...codex].map(event => event.source_index).sort((a, b) => a - b));

  const claudeIds = claude.map(event => event.relationships.tool_call_id);
  assert.deepEqual(claudeIds, [
    'toolu_question_one', 'toolu_question_one', 'toolu_question_two', 'toolu_question_two'
  ]);
  const codexIds = codex.map(event => event.relationships.tool_call_id);
  assert.deepEqual(codexIds, [
    'call-patch-1', 'call-patch-1', 'call-question-1', 'call-question-1'
  ]);
});
