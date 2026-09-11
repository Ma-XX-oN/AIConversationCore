import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptCodexRecords,
  projectCanonicalConversation,
  renderCanonicalHtml
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

function userEvents(projection) {
  return projection.events.filter(event =>
    event.role === 'user' && event.kind === 'message');
}

function wrappedPair(first, second) {
  return `<span id="word-\\d+">${first}<\\/span> ` +
    `<span id="word-\\d+">${second}<\\/span>`;
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

test('Codex projection changes effective visibility without removing or renumbering canonical events', () => {
  const canonicalEvents = adaptCodexRecords(retainedHistoryFixture(), {
    includeRolledBackTurns: true
  });

  const hiddenProjection = projectCanonicalConversation(canonicalEvents, {
    includeRolledBackTurns: false
  });
  const historicalProjection = projectCanonicalConversation(canonicalEvents, {
    includeRolledBackTurns: true
  });

  assert.deepEqual(
    hiddenProjection.events.map(event => event.id),
    historicalProjection.events.map(event => event.id));

  const hiddenUsers = userEvents(hiddenProjection);
  const historicalUsers = userEvents(historicalProjection);
  assert.deepEqual(hiddenUsers.map(event => event.blocks[0]?.text), [
    'Original question',
    'Edited question'
  ]);
  assert.deepEqual(historicalUsers.map(event => event.blocks[0]?.text), [
    'Original question',
    'Edited question'
  ]);
  assert.deepEqual(hiddenUsers.map(event => event.projection?.visible), [false, true]);
  assert.deepEqual(historicalUsers.map(event => event.projection?.visible), [true, true]);
  assert.equal(hiddenUsers[0].id, historicalUsers[0].id);
  assert.equal(hiddenUsers[1].id, historicalUsers[1].id);
});

test('canonical HTML retains historical turns with semantic revision classes and toggles only hidden state', () => {
  const canonicalEvents = adaptCodexRecords(retainedHistoryFixture(), {
    includeRolledBackTurns: true
  });
  const hiddenHtml = renderCanonicalHtml(canonicalEvents, {
    includeRolledBackTurns: false
  });
  const historicalHtml = renderCanonicalHtml(canonicalEvents, {
    includeRolledBackTurns: true
  });

  const originalQuestion = wrappedPair('Original', 'question');
  const originalAnswer = wrappedPair('Original', 'answer');
  const editedQuestion = wrappedPair('Edited', 'question');

  assert.match(hiddenHtml, new RegExp(originalQuestion));
  assert.match(hiddenHtml, new RegExp(originalAnswer));
  assert.match(hiddenHtml, new RegExp(
    '<section class="transcript-turn revision-original"' +
    '[^>]*data-revision-status="original"[^>]*hidden[^>]*>' +
    `[\\s\\S]*?${originalQuestion}`
  ));
  assert.match(hiddenHtml, new RegExp(
    '<section class="transcript-turn revision-edited"' +
    '[^>]*data-revision-status="edited"[^>]*>' +
    `[\\s\\S]*?${editedQuestion}`
  ));

  assert.match(historicalHtml, new RegExp(
    '<section class="transcript-turn revision-original"' +
    '[^>]*data-revision-status="original"(?![^>]*\\bhidden\\b)[^>]*>' +
    `[\\s\\S]*?${originalQuestion}`
  ));
  assert.match(historicalHtml, new RegExp(editedQuestion));
});
