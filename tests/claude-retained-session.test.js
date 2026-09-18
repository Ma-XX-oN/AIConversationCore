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


test('retained Claude session preserves state across repeated append batches', () => {
  const session = createCanonicalConversationSession({
    provider: 'claude',
    records: [
      record('user-1', 'user', 'user', text('Initial prompt.'))
    ]
  });
  const beforeIds = session.events.map(event => event.id);

  session.append([
    record('assistant-agent', 'assistant', 'assistant', [{
      type: 'tool_use',
      id: 'toolu_agent_repeated',
      name: 'Agent',
      input: { description: 'Inspect repeated append state' },
      caller: { type: 'direct' }
    }])
  ]);
  session.append([
    record('user-agent-result', 'user', 'user', [{
      type: 'tool_result',
      tool_use_id: 'toolu_agent_repeated',
      content: 'Repeated append complete.\nagentId: agent-456 (internal ID - do not mention to user.)'
    }])
  ]);
  session.append([
    record('assistant-final', 'assistant', 'assistant', text('Final appended answer.'))
  ]);

  const projection = session.project();
  assert.deepEqual(
    projection.events.slice(0, beforeIds.length).map(event => event.id),
    beforeIds);

  const subagent = projection.events.find(event =>
    event.source_record_id === 'user-agent-result');
  assert.ok(subagent, 'the later Agent result must retain prior appended invocation state');
  assert.equal(subagent.kind, 'subagent');
  assert.equal(subagent.source_index, 2);
  assert.equal(subagent.blocks[0].agent_id, 'agent-456');
  assert.equal(
    subagent.blocks[0].description,
    'Inspect repeated append state');
  assert.equal(
    subagent.relationships.invocation_source.record_index,
    1);

  const final = projection.events.find(event =>
    event.source_record_id === 'assistant-final');
  assert.ok(final, 'the third append batch must enter canonical state');
  assert.equal(final.source_index, 3);
  assert.equal(final.blocks[0].text, 'Final appended answer.');
  assert.equal(session.diagnostics.initial_normalization_passes, 1);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
  assert.equal(session.diagnostics.appended_records_processed, 3);
});


test('retained Claude session matches complete-session projection after repeated appends', () => {
  const initial = [
    record('user-equivalence', 'user', 'user', text('Equivalence prompt.'))
  ];
  const agentCall = record('assistant-equivalence-agent', 'assistant', 'assistant', [{
    type: 'tool_use',
    id: 'toolu_equivalence_agent',
    name: 'Agent',
    input: { description: 'Check equivalence' },
    caller: { type: 'direct' }
  }]);
  const agentResult = record('user-equivalence-result', 'user', 'user', [{
    type: 'tool_result',
    tool_use_id: 'toolu_equivalence_agent',
    content: 'Equivalent result.\nagentId: agent-equivalence (internal ID - do not mention to user.)'
  }]);
  const finalAnswer = record(
    'assistant-equivalence-final',
    'assistant',
    'assistant',
    text('Equivalent final answer.'));

  const incremental = createCanonicalConversationSession({
    provider: 'claude',
    records: initial
  });
  incremental.append([agentCall]);
  incremental.append([agentResult]);
  incremental.append([finalAnswer]);

  const complete = createCanonicalConversationSession({
    provider: 'claude',
    records: [...initial, agentCall, agentResult, finalAnswer]
  });

  assert.deepEqual(
    incremental.project(),
    complete.project(),
    'incremental Claude projection must equal complete-session projection');
  assert.equal(incremental.diagnostics.initial_normalization_passes, 1);
  assert.equal(incremental.diagnostics.full_renormalization_passes, 0);
  assert.equal(incremental.diagnostics.appended_records_processed, 3);
});
