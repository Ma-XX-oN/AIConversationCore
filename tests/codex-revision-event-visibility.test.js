import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptCodexRecords,
  projectCanonicalConversation
} from '../src/index.js';

function records() {
  return [
    {
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Original request' }
    },
    {
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'Original response' }
    },
    {
      type: 'event_msg',
      payload: { type: 'thread_rolled_back', num_turns: 1 }
    },
    {
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Edited request' }
    },
    {
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'Edited response' }
    }
  ];
}

function messages(events) {
  return events.filter(event =>
    event?.kind === 'message' &&
    (event?.role === 'user' || event?.role === 'assistant'));
}

test('revision event projections expose stable Core-owned history eligibility facts', () => {
  const normalized = adaptCodexRecords(records());
  const hidden = messages(projectCanonicalConversation(normalized).events);
  const shown = messages(projectCanonicalConversation(normalized, {
    includeRolledBackTurns: true
  }).events);

  assert.deepEqual(
    hidden.map(event => [
      event.projection?.visible,
      event.projection?.revision_history_controlled,
      event.projection?.historical_revision
    ]),
    [
      [false, true, true],
      [false, true, true],
      [true, true, false],
      [true, true, false]
    ]
  );
  assert.deepEqual(
    shown.map(event => [
      event.projection?.visible,
      event.projection?.revision_history_controlled,
      event.projection?.historical_revision
    ]),
    [
      [true, true, true],
      [true, true, true],
      [true, true, false],
      [true, true, false]
    ]
  );
});
