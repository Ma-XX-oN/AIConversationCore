import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptInteractiveSessionRecords } from '../src/index.js';

test('Claude interactive session excludes sidechain and preserves queued-command structure', () => {
  const records = [
    {
      type: 'user',
      uuid: 'sidechain-user',
      isSidechain: true,
      timestamp: '2026-09-05T00:00:00Z',
      message: { role: 'user', content: [{ type: 'text', text: 'hidden sidechain' }] }
    },
    {
      type: 'attachment',
      uuid: 'queued-1',
      timestamp: '2026-09-05T00:00:01Z',
      attachment: {
        type: 'queued_command',
        prompt: '> generated context\n> still generated\n\nReal queued request'
      }
    }
  ];

  const events = adaptInteractiveSessionRecords('claude', records);

  assert.equal(events.length, 1);
  const queued = events[0];
  assert.equal(queued.source_index, 1);
  assert.equal(queued.source.timestamp, '2026-09-05T00:00:01Z');
  assert.equal(queued.kind, 'message');
  assert.equal(queued.role, 'user');
  assert.equal(queued.content_type, 'queued_command');
  assert.equal(queued.blocks[0].text, '> generated context\n> still generated\n\nReal queued request');
  assert.deepEqual(queued.blocks[0].queued_command, {
    generated_context: '> generated context\n> still generated',
    user_text: 'Real queued request'
  });
});

test('Claude interactive session exposes hidden Agent start and completion duration', () => {
  const records = [
    {
      type: 'assistant',
      uuid: 'assistant-1',
      timestamp: '2026-09-05T00:01:00Z',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'toolu-agent-1',
          name: 'Agent',
          input: { description: 'Review the integration' }
        }]
      }
    },
    {
      type: 'user',
      uuid: 'user-result-1',
      timestamp: '2026-09-05T00:01:05Z',
      toolUseResult: {
        agentType: 'general-purpose',
        totalDurationMs: 5000
      },
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'toolu-agent-1',
          content: 'agentId: agent-1 (internal ID - do not mention to user.)\nReview complete.'
        }]
      }
    }
  ];

  const events = adaptInteractiveSessionRecords('claude', records);
  const start = events.find(event => event.content_type === 'subagent_start');
  const completion = events.find(event => event.kind === 'subagent');

  assert.ok(start);
  assert.equal(start.visibility, 'hidden');
  assert.equal(start.source.timestamp, '2026-09-05T00:01:00Z');
  assert.equal(start.blocks[0].name, 'Agent');
  assert.equal(start.blocks[0].subagent_start.description, 'Review the integration');

  assert.ok(completion);
  assert.equal(completion.source.timestamp, '2026-09-05T00:01:05Z');
  assert.equal(completion.blocks[0].duration_ms, 5000);
  assert.equal(completion.blocks[0].output, 'Review complete.');
});

test('Claude queue completion retains duration metadata', () => {
  const records = [{
    type: 'queue-operation',
    uuid: 'queue-1',
    timestamp: '2026-09-05T00:02:00Z',
    operation: 'enqueue',
    content: '<task-notification><status>completed</status><task-id>task-1</task-id><summary>Agent "Check output" came to rest</summary><result>Done.</result><usage><duration_ms>12000</duration_ms></usage></task-notification>'
  }];

  const events = adaptInteractiveSessionRecords('claude', records);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'subagent');
  assert.equal(events[0].source.timestamp, '2026-09-05T00:02:00Z');
  assert.equal(events[0].blocks[0].duration_ms, 12000);
});

test('Codex interactive session preserves task completion and completed Plan as hidden lifecycle events', () => {
  const records = [
    {
      type: 'event_msg',
      timestamp: '2026-09-05T00:03:00Z',
      payload: { type: 'task_complete' }
    },
    {
      type: 'event_msg',
      timestamp: '2026-09-05T00:03:01Z',
      payload: {
        type: 'item_completed',
        item: { type: 'Plan', text: '1. Inspect\n2. Implement' }
      }
    }
  ];

  const events = adaptInteractiveSessionRecords('codex', records);
  const completion = events.find(event => event.content_type === 'task_complete');
  const plan = events.find(event => event.content_type === 'completed_plan');

  assert.ok(completion);
  assert.equal(completion.visibility, 'hidden');
  assert.equal(completion.lifecycle.timestamp, '2026-09-05T00:03:00Z');
  assert.equal(completion.source.timestamp, '2026-09-05T00:03:00Z');

  assert.ok(plan);
  assert.equal(plan.visibility, 'hidden');
  assert.equal(plan.role, 'assistant');
  assert.equal(plan.blocks[0].text, '1. Inspect\n2. Implement');
  assert.equal(plan.source.timestamp, '2026-09-05T00:03:01Z');
});

test('interactive session enriches ordinary canonical events with source timestamps', () => {
  const records = [{
    type: 'event_msg',
    timestamp: '2026-09-05T00:04:00Z',
    payload: { type: 'user_message', message: 'Hello' }
  }];

  const events = adaptInteractiveSessionRecords('codex', records);

  assert.equal(events.length, 1);
  assert.equal(events[0].source.timestamp, '2026-09-05T00:04:00Z');
  assert.equal(events[0].blocks[0].source.timestamp, '2026-09-05T00:04:00Z');
});
