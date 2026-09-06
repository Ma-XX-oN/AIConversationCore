import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptInteractiveSessionRecords } from '../src/index.js';

function claudeRecord(type, timestamp, extra = {}) {
  return {
    type,
    timestamp,
    uuid: `${type}-${timestamp}`,
    isSidechain: false,
    ...extra
  };
}

test('Claude interactive session excludes sidechain and preserves queued-command structure', () => {
  const records = [
    claudeRecord('user', '2026-09-05T00:00:00Z', {
      message: { role: 'user', content: [{ type: 'text', text: 'Visible request' }] }
    }),
    claudeRecord('assistant', '2026-09-05T00:00:01Z', {
      isSidechain: true,
      message: { role: 'assistant', content: [{ type: 'text', text: 'Sidechain' }] }
    }),
    claudeRecord('queue-operation', '2026-09-05T00:00:02Z', {
      operation: 'enqueue',
      content: 'Queued follow-up'
    })
  ];

  const events = adaptInteractiveSessionRecords('claude', records);
  assert.equal(events.some(event => event.blocks?.some(block => block.text === 'Sidechain')), false);
  const queued = events.find(event => event.content_type === 'queued_command');
  assert.equal(queued.blocks[0].text, 'Queued follow-up');
});

test('Claude interactive session exposes hidden Agent start and completion duration', () => {
  const records = [
    claudeRecord('assistant', '2026-09-05T00:00:00Z', {
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tool-1', name: 'Task', input: { prompt: 'Work' } }]
      }
    }),
    claudeRecord('user', '2026-09-05T00:00:03Z', {
      toolUseResult: {
        agentId: 'agent-1',
        agentType: 'general-purpose',
        totalDurationMs: 3000,
        content: 'Done.'
      }
    })
  ];

  const events = adaptInteractiveSessionRecords('claude', records);
  const started = events.find(event => event.content_type === 'agent_start');
  const finished = events.find(event => event.content_type === 'agent_completion');
  assert.equal(started.visibility, 'hidden');
  assert.equal(finished.lifecycle.duration_ms, 3000);
  assert.equal(finished.blocks[0].output, 'Done.');
});

test('Claude queue completion retains duration metadata', () => {
  const records = [
    claudeRecord('queue-operation', '2026-09-05T00:00:00Z', {
      operation: 'enqueue',
      taskId: 'agent-1',
      content: 'Background task'
    }),
    claudeRecord('queue-operation', '2026-09-05T00:00:02Z', {
      operation: 'dequeue',
      taskId: 'agent-1',
      content: 'Done.',
      totalDurationMs: 2000
    })
  ];

  const events = adaptInteractiveSessionRecords('claude', records);
  const finished = events.find(event => event.content_type === 'agent_completion');
  assert.equal(finished.lifecycle.duration_ms, 2000);
  assert.equal(finished.blocks[0].output, 'Done.');
});

test('interactive Codex normalization preserves speech-specific phase, IDE context, secret input, preamble and completion facts', () => {
  const userText = 'context\n## My request for Codex:\nActual request';
  const records = [
    {
      type: 'event_msg',
      timestamp: '2026-09-05T00:00:00Z',
      payload: {
        type: 'user_message',
        message: userText
      }
    },
    {
      type: 'event_msg',
      timestamp: '2026-09-05T00:00:01Z',
      payload: { type: 'agent_message', phase: 'analysis', message: 'Thinking aloud' }
    },
    {
      type: 'response_item',
      timestamp: '2026-09-05T00:00:02Z',
      payload: {
        type: 'function_call',
        name: 'request_user_input',
        call_id: 'call-1',
        arguments: JSON.stringify({
          questions: [{
            id: 'q1',
            question: 'Choose one',
            isSecret: true,
            options: [{ label: 'A', description: 'First' }]
          }]
        })
      }
    },
    {
      type: 'event_msg',
      timestamp: '2026-09-05T00:00:03Z',
      payload: { type: 'task_complete' }
    },
    {
      type: 'event_msg',
      timestamp: '2026-09-05T00:00:04Z',
      payload: { type: 'item_completed', item: { type: 'Plan', text: 'Do the thing.' } }
    }
  ];

  const events = adaptInteractiveSessionRecords('codex', records);
  const user = events.find(event => event.content_type === 'user_message');
  const analysis = events.find(event => event.content_type === 'agent_message');
  const input = events.find(event => event.kind === 'tool_call');
  const completion = events.find(event => event.content_type === 'task_complete');
  const plan = events.find(event => event.content_type === 'completed_plan');

  assert.equal(user.blocks[0].text, userText);
  assert.equal(analysis.channel, 'analysis');
  assert.equal(input.blocks[0].request_user_input.questions[0].is_secret, true);
  assert.equal(completion.lifecycle.timestamp, '2026-09-05T00:00:03Z');
  assert.equal(plan.blocks[0].text, 'Do the thing.');
});
