import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptCodexRecords,
  projectCanonicalConversation
} from '../src/index.js';

function turnContext(model) {
  return {
    timestamp: '2026-09-08T00:00:00.000Z',
    type: 'turn_context',
    payload: { model }
  };
}

function user(message, timestamp) {
  return {
    timestamp,
    type: 'event_msg',
    payload: { type: 'user_message', message }
  };
}

function assistant(message, timestamp) {
  return {
    timestamp,
    type: 'event_msg',
    payload: { type: 'agent_message', phase: 'final', message }
  };
}

function rollback(timestamp, numTurns = 1) {
  return {
    timestamp,
    type: 'event_msg',
    payload: { type: 'thread_rolled_back', num_turns: numTurns }
  };
}

function retainedHistoryFixture() {
  return [
    turnContext('gpt-5.5'),
    user('Original question', '2026-09-08T00:00:01.000Z'),
    assistant('Original answer', '2026-09-08T00:00:02.000Z'),
    rollback('2026-09-08T00:00:03.000Z'),
    turnContext('gpt-5.5'),
    user('Edited question', '2026-09-08T00:00:04.000Z'),
    assistant('Edited answer', '2026-09-08T00:00:05.000Z')
  ];
}

function eventIdentity(event) {
  return {
    id: event.id,
    source_index: event.source_index,
    revision_status: event.revision_status ?? null,
    execution_status: event.execution_status ?? null,
    model: event.model ?? null
  };
}

test('Codex canonical normalization retains the same revision inventory regardless of visibility preference', () => {
  const records = retainedHistoryFixture();
  const defaultEvents = adaptCodexRecords(records);
  const hiddenPreferenceEvents = adaptCodexRecords(records, {
    includeRolledBackTurns: false
  });
  const historicalPreferenceEvents = adaptCodexRecords(records, {
    includeRolledBackTurns: true
  });

  assert.deepEqual(
    defaultEvents.map(eventIdentity),
    historicalPreferenceEvents.map(eventIdentity));
  assert.deepEqual(
    hiddenPreferenceEvents.map(eventIdentity),
    historicalPreferenceEvents.map(eventIdentity));
});

test('Codex visibility is selected at projection time from one retained canonical inventory', () => {
  const canonicalEvents = adaptCodexRecords(retainedHistoryFixture(), {
    includeRolledBackTurns: true
  });

  const hiddenProjection = projectCanonicalConversation(canonicalEvents, {
    includeRolledBackTurns: false
  });
  const historicalProjection = projectCanonicalConversation(canonicalEvents, {
    includeRolledBackTurns: true
  });

  const hiddenUsers = hiddenProjection.events.filter(event =>
    event.role === 'user' && event.kind === 'message');
  const historicalUsers = historicalProjection.events.filter(event =>
    event.role === 'user' && event.kind === 'message');

  assert.deepEqual(hiddenUsers.map(event => event.blocks[0]?.text), [
    'Edited question'
  ]);
  assert.deepEqual(historicalUsers.map(event => event.blocks[0]?.text), [
    'Original question',
    'Edited question'
  ]);
  assert.equal(hiddenUsers[0].id, historicalUsers[1].id);
});
