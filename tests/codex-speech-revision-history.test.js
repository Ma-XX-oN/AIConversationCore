import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptSpeechSessionRecords,
  projectCanonicalConversation
} from '../src/index.js';

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

test('Codex speech normalization retains rolled-back revisions regardless of visibility preference', () => {
  const defaultEvents = adaptSpeechSessionRecords('codex', records());
  const requestedEvents = adaptSpeechSessionRecords(
    'codex',
    records(),
    { includeRolledBackTurns: true }
  );
  const defaultUsers = defaultEvents.filter(event =>
    event.role === 'user' && event.kind === 'message');
  const requestedUsers = requestedEvents.filter(event =>
    event.role === 'user' && event.kind === 'message');

  assert.deepEqual(defaultUsers.map(event => event.id), requestedUsers.map(event => event.id));
  assert.deepEqual(defaultUsers.map(event => event.revision_status), ['original', 'edited']);
  assert.deepEqual(defaultUsers.map(event => event.execution_status), ['aborted', 'completed']);
  assert.deepEqual(defaultUsers[0].blocks.map(block => block.type), ['user_context', 'text']);
  assert.equal(defaultUsers[0].blocks[0].summary, '# Context from my IDE setup:');
  assert.equal(defaultUsers[0].blocks[1].text, 'Original');
});

test('Codex speech projection hides historical revisions by default without deleting them', () => {
  const events = adaptSpeechSessionRecords('codex', records());
  const hidden = projectCanonicalConversation(events);
  const shown = projectCanonicalConversation(events, { includeRolledBackTurns: true });
  const hiddenUsers = hidden.events.filter(event =>
    event.role === 'user' && event.kind === 'message');
  const shownUsers = shown.events.filter(event =>
    event.role === 'user' && event.kind === 'message');

  assert.deepEqual(hiddenUsers.map(event => event.id), shownUsers.map(event => event.id));
  assert.deepEqual(hiddenUsers.map(event => event.projection?.visible), [false, true]);
  assert.deepEqual(shownUsers.map(event => event.projection?.visible), [true, true]);
});
