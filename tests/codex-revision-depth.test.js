import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptCodexRecords,
  createCanonicalConversationSession,
  projectCanonicalConversation
} from '../src/index.js';

function revisionRecords() {
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
      payload: { type: 'user_message', message: 'First edit' }
    },
    {
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'First edit response' }
    },
    {
      type: 'event_msg',
      payload: { type: 'thread_rolled_back', num_turns: 1 }
    },
    {
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Second edit' }
    },
    {
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'Second edit response' }
    },
    {
      type: 'event_msg',
      payload: { type: 'thread_rolled_back', num_turns: 1 }
    },
    {
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Current edit' }
    },
    {
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'Current response' }
    }
  ];
}

function conversationalEvents(events) {
  return events.filter(event =>
    event.kind === 'message' &&
    (event.role === 'user' || event.role === 'assistant'));
}

test('Codex normalization assigns stable zero-based revision depth to each lineage generation', () => {
  const events = conversationalEvents(adaptCodexRecords(revisionRecords()));

  assert.deepEqual(
    events.map(event => [event.role, event.revision_status, event.revision_depth]),
    [
      ['user', 'original', 0],
      ['assistant', 'original', 0],
      ['user', 'superseded', 1],
      ['assistant', 'superseded', 1],
      ['user', 'superseded', 2],
      ['assistant', 'superseded', 2],
      ['user', 'edited', 3],
      ['assistant', 'edited', 3]
    ]
  );
});

test('history projection changes visibility without renumbering revision depth or canonical IDs', () => {
  const normalized = adaptCodexRecords(revisionRecords());
  const hidden = projectCanonicalConversation(normalized);
  const shown = projectCanonicalConversation(normalized, {
    includeRolledBackTurns: true
  });
  const hiddenEvents = conversationalEvents(hidden.events);
  const shownEvents = conversationalEvents(shown.events);

  assert.deepEqual(hiddenEvents.map(event => event.id), shownEvents.map(event => event.id));
  assert.deepEqual(hiddenEvents.map(event => event.revision_depth), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual(shownEvents.map(event => event.revision_depth), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual(hiddenEvents.map(event => event.projection?.visible),
    [false, false, false, false, false, false, true, true]);
  assert.deepEqual(shownEvents.map(event => event.projection?.visible),
    [true, true, true, true, true, true, true, true]);
});

test('retained session append preserves prior revision depths and assigns the next generation', () => {
  const initial = revisionRecords().slice(0, 8);
  const session = createCanonicalConversationSession({
    provider: 'codex',
    records: initial
  });
  const before = conversationalEvents(session.project({
    includeRolledBackTurns: true
  }).events);
  const beforeIds = before.map(event => event.id);

  session.append(revisionRecords().slice(8));
  const after = conversationalEvents(session.project({
    includeRolledBackTurns: true
  }).events);

  assert.deepEqual(after.slice(0, beforeIds.length).map(event => event.id), beforeIds);
  assert.deepEqual(after.map(event => event.revision_depth), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
});

test('revision heading suffix is applied consistently to User and Assistant generations', () => {
  const events = conversationalEvents(adaptCodexRecords(revisionRecords()));

  assert.deepEqual(
    events.map(event => event.projection?.heading_suffix ?? ''),
    [
      ' (original 0)',
      ' (original 0)',
      ' (superseded 1)',
      ' (superseded 1)',
      ' (superseded 2)',
      ' (superseded 2)',
      ' (edited 3)',
      ' (edited 3)'
    ]
  );
});
