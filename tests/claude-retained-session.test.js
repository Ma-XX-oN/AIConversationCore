import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalConversationSession } from '../src/index.js';

function record(uuid, type, role, content) {
  return {
    uuid,
    type,
    isSidechain: false,
    timestamp: '2026-09-18T00:00:00.000Z',
    message: {
      role,
      ...(role === 'assistant' ? { model: 'claude-test' } : {}),
      content
    }
  };
}

function text(value) {
  return [{ type: 'text', text: value }];
}

test('retained Claude session appends visible content without renormalizing the prefix', () => {
  const session = createCanonicalConversationSession({
    provider: 'claude',
    records: [
      record('user-1', 'user', 'user', text('Initial prompt.')),
      record('assistant-1', 'assistant', 'assistant', text('Initial answer.'))
    ]
  });
  const beforeIds = session.events.map(event => event.id);

  session.append([
    record('assistant-2', 'assistant', 'assistant', text('Appended answer.'))
  ]);

  const projection = session.project();
  assert.deepEqual(
    projection.events.slice(0, beforeIds.length).map(event => event.id),
    beforeIds);
  const appended = projection.events.find(event =>
    event.source_record_id === 'assistant-2');
  assert.ok(appended, 'the appended Claude record must enter canonical state');
  assert.equal(appended.source_index, 2);
  assert.equal(appended.blocks[0].text, 'Appended answer.');
  assert.equal(session.diagnostics.initial_normalization_passes, 1);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
  assert.equal(session.diagnostics.appended_records_processed, 1);
});

test('retained Claude session preserves tool identity across an append boundary', () => {
  const session = createCanonicalConversationSession({
    provider: 'claude',
    records: [
      record('assistant-tool', 'assistant', 'assistant', [{
        type: 'tool_use',
        id: 'toolu_bash',
        name: 'Bash',
        input: { command: 'printf ok' },
        caller: { type: 'direct' }
      }])
    ]
  });

  session.append([
    record('user-result', 'user', 'user', [{
      type: 'tool_result',
      tool_use_id: 'toolu_bash',
      content: 'ok'
    }])
  ]);

  const projection = session.project();
  const result = projection.events.find(event =>
    event.source_record_id === 'user-result');
  assert.ok(result, 'the appended tool result must be present');
  assert.equal(result.kind, 'tool_result');
  assert.equal(result.source_index, 1);
  assert.equal(result.blocks[0].name, 'Bash');
  assert.equal(result.relationships.tool_call_id, 'toolu_bash');
});

test('retained Claude session preserves Agent correlation across an append boundary', () => {
  const session = createCanonicalConversationSession({
    provider: 'claude',
    records: [
      record('assistant-agent', 'assistant', 'assistant', [{
        type: 'tool_use',
        id: 'toolu_agent',
        name: 'Agent',
        input: { description: 'Inspect the branch' },
        caller: { type: 'direct' }
      }])
    ]
  });

  session.append([
    record('user-agent-result', 'user', 'user', [{
      type: 'tool_result',
      tool_use_id: 'toolu_agent',
      content: 'Completed analysis.\nagentId: agent-123 (internal ID - do not mention to user.)'
    }])
  ]);

  const projection = session.project();
  const subagent = projection.events.find(event =>
    event.source_record_id === 'user-agent-result');
  assert.ok(subagent, 'the appended Agent result must become a subagent event');
  assert.equal(subagent.kind, 'subagent');
  assert.equal(subagent.source_index, 1);
  assert.equal(subagent.blocks[0].agent_id, 'agent-123');
  assert.equal(subagent.blocks[0].description, 'Inspect the branch');
  assert.equal(subagent.blocks[0].output, 'Completed analysis.');
  assert.equal(subagent.relationships.tool_call_id, 'toolu_agent');
  assert.equal(subagent.relationships.invocation_source.record_index, 0);
});
