import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptInteractiveSessionRecords } from '../src/index.js';

test('interactive Claude normalization removes injected user context and preserves queued-command split', () => {
  const records = [
    {
      type: 'user',
      uuid: 'user-1',
      timestamp: '2026-09-05T00:00:00Z',
      message: {
        role: 'user',
        content: [{
          type: 'text',
          text: '<system-reminder>generated</system-reminder>\nActual user text'
        }]
      }
    },
    {
      type: 'attachment',
      uuid: 'queue-1',
      timestamp: '2026-09-05T00:00:01Z',
      attachment: {
        type: 'queued_command',
        prompt: '> generated card\n> context\n\nQueued user text'
      }
    }
  ];

  const events = adaptInteractiveSessionRecords('claude', records);
  const user = events.find(event => event.source_index === 0 && event.kind === 'message');
  const queued = events.find(event => event.content_type === 'queued_command');

  assert.equal(user.blocks[0].text, 'Actual user text');
  assert.equal(user.source.timestamp, '2026-09-05T00:00:00Z');
  assert.equal(queued.blocks[0].queued_command.generated_context, '> generated card\n> context');
  assert.equal(queued.blocks[0].queued_command.user_text, 'Queued user text');
});

test('interactive Claude normalization exposes subagent lifecycle timing without timing footer speech', () => {
  const records = [
    {
      type: 'assistant',
      uuid: 'agent-call',
      timestamp: '2026-09-05T00:00:00Z',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'toolu-agent',
          name: 'Agent',
          input: { description: 'Inspect files' }
        }]
      }
    },
    {
      type: 'user',
      uuid: 'agent-result',
      timestamp: '2026-09-05T00:00:05Z',
      toolUseResult: { agentType: 'general-purpose', totalDurationMs: 5000 },
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'toolu-agent',
          content: 'agentId: child-1 (internal ID - do not mention to user.)\nDone.\n```text\nSTART=x END=y ELAPSED=5s\n```'
        }]
      }
    }
  ];

  const events = adaptInteractiveSessionRecords('claude', records);
  const started = events.find(event => event.content_type === 'subagent_start');
  const finished = events.find(event => event.kind === 'subagent');

  assert.equal(started.visibility, 'hidden');
  assert.equal(started.blocks[0].subagent_start.description, 'Inspect files');
  assert.equal(finished.blocks[0].duration_ms, 5000);
  assert.equal(finished.blocks[0].output, 'Done.');
});

test('interactive Codex normalization preserves speech-specific phase, secret input, preamble and completion facts', () => {
  const records = [
    {
      type: 'event_msg',
      timestamp: '2026-09-05T00:00:00Z',
      payload: {
        type: 'user_message',
        message: 'context\n## My request for Codex:\nActual request'
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

  assert.equal(user.blocks[0].text, 'Actual request');
  assert.equal(analysis.channel, 'analysis');
  assert.equal(input.blocks[0].request_user_input.questions[0].is_secret, true);
  assert.equal(completion.lifecycle.timestamp, '2026-09-05T00:00:03Z');
  assert.equal(plan.blocks[0].text, 'Do the thing.');
});
