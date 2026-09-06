import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptSpeechSessionRecords } from '../src/index.js';

function records() {
  return [
    {
      timestamp: '2026-09-06T19:17:01.000Z',
      type: 'session_meta',
      payload: { id: '01a07826-f445-7dd2-a370-3f3c7a3754a6' }
    },
    {
      timestamp: '2026-09-06T19:52:39.000Z',
      type: 'turn_context',
      payload: { model: 'gpt-5.5' }
    },
    {
      timestamp: '2026-09-06T19:52:40.000Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: '# Context from my IDE setup:\n\n## My request for Codex:\nOriginal'
      }
    },
    {
      timestamp: '2026-09-06T19:52:42.000Z',
      type: 'event_msg',
      payload: { type: 'turn_aborted' }
    },
    {
      timestamp: '2026-09-06T19:52:43.000Z',
      type: 'event_msg',
      payload: { type: 'thread_rolled_back', num_turns: 1 }
    },
    {
      timestamp: '2026-09-06T19:52:46.000Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: '# Context from my IDE setup:\n\n## My request for Codex:\nReplacement'
      }
    }
  ];
}

test('Codex speech seam hides rolled-back revisions by default without stripping IDE context', () => {
  const events = adaptSpeechSessionRecords('codex', records());
  const users = events.filter(event => event.role === 'user' && event.kind === 'message');

  assert.equal(users.length, 1);
  assert.equal(users[0].revision_status, 'edited');
  assert.match(users[0].blocks[0].text, /^# Context from my IDE setup:/);
  assert.match(users[0].blocks[0].text, /Replacement$/);
});

test('Codex speech seam exposes original and edited revisions only when requested', () => {
  const events = adaptSpeechSessionRecords(
    'codex',
    records(),
    { includeRolledBackTurns: true }
  );
  const users = events.filter(event => event.role === 'user' && event.kind === 'message');

  assert.deepEqual(users.map(event => event.revision_status), ['original', 'edited']);
  assert.deepEqual(users.map(event => event.execution_status), ['aborted', 'completed']);
  assert.match(users[0].blocks[0].text, /^# Context from my IDE setup:/);
});
