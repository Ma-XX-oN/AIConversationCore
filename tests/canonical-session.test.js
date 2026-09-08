import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalConversationSession } from '../src/index.js';

function turnContext(model, timestamp) {
  return {
    timestamp,
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

function abort(timestamp) {
  return {
    timestamp,
    type: 'event_msg',
    payload: { type: 'turn_aborted' }
  };
}

function initialRevisionRecords() {
  return [
    turnContext('gpt-5.4', '2026-09-08T00:00:00.000Z'),
    user('Original question', '2026-09-08T00:00:01.000Z'),
    assistant('Original answer', '2026-09-08T00:00:02.000Z'),
    rollback('2026-09-08T00:00:03.000Z'),
    turnContext('gpt-5.5', '2026-09-08T00:00:04.000Z'),
    user('Edited question', '2026-09-08T00:00:05.000Z')
  ];
}

function userEvents(projection) {
  return projection.events.filter(event =>
    event.role === 'user' && event.kind === 'message');
}

test('retained canonical session projects Codex rollback visibility repeatedly without renormalizing', () => {
  const session = createCanonicalConversationSession({
    provider: 'codex',
    records: initialRevisionRecords()
  });
  const canonicalIds = session.events.map(event => event.id);

  const hidden = session.project({ includeRolledBackTurns: false });
  const shown = session.project({ includeRolledBackTurns: true });
  const hiddenAgain = session.project({ includeRolledBackTurns: false });

  assert.deepEqual(hidden.events.map(event => event.id), canonicalIds);
  assert.deepEqual(shown.events.map(event => event.id), canonicalIds);
  assert.deepEqual(hiddenAgain.events.map(event => event.id), canonicalIds);
  assert.deepEqual(userEvents(hidden).map(event => event.projection?.visible), [false, true]);
  assert.deepEqual(userEvents(shown).map(event => event.projection?.visible), [true, true]);
  assert.equal(session.diagnostics.initial_normalization_passes, 1);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
  assert.equal(session.diagnostics.projection_count, 3);
});

test('retained canonical session HTML toggles hidden state over the same historical turn identity', () => {
  const session = createCanonicalConversationSession({
    provider: 'codex',
    records: initialRevisionRecords()
  });

  const hiddenHtml = session.renderHtml({ includeRolledBackTurns: false });
  const shownHtml = session.renderHtml({ includeRolledBackTurns: true });

  const hiddenMatch = hiddenHtml.match(
    /<section class="transcript-turn revision-original" data-presentation-id="([^"]+)"[^>]*hidden[^>]*>/);
  const shownMatch = shownHtml.match(
    /<section class="transcript-turn revision-original" data-presentation-id="([^"]+)"(?![^>]*\bhidden\b)[^>]*>/);
  assert.ok(hiddenMatch, 'hidden projection must retain the original turn in the DOM');
  assert.ok(shownMatch, 'shown projection must expose the retained original turn');
  assert.equal(hiddenMatch[1], shownMatch[1]);
  assert.equal(session.diagnostics.initial_normalization_passes, 1);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
});

test('retained canonical session Markdown changes visibility without changing canonical inventory', () => {
  const session = createCanonicalConversationSession({
    provider: 'codex',
    records: initialRevisionRecords()
  });
  const ids = session.events.map(event => event.id);

  const hidden = session.renderMarkdown({ includeRolledBackTurns: false });
  const shown = session.renderMarkdown({ includeRolledBackTurns: true });

  assert.doesNotMatch(hidden, /Original question/);
  assert.match(hidden, /Edited question/);
  assert.match(shown, /Original question/);
  assert.match(shown, /Edited question/);
  assert.deepEqual(session.events.map(event => event.id), ids);
});

test('retained Codex session appends only new source records and preserves existing canonical IDs', () => {
  const session = createCanonicalConversationSession({
    provider: 'codex',
    records: initialRevisionRecords()
  });
  const beforeIds = session.events.map(event => event.id);

  session.append([
    assistant('Edited answer', '2026-09-08T00:00:06.000Z')
  ]);
  const after = session.project({ includeRolledBackTurns: true });

  assert.deepEqual(after.events.slice(0, beforeIds.length).map(event => event.id), beforeIds);
  assert.match(after.markdown, /Edited answer/);
  assert.equal(session.diagnostics.initial_normalization_passes, 1);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
  assert.equal(session.diagnostics.appended_records_processed, 1);
});

test('retained Codex session handles an appended rollback and replacement without renormalizing the prefix', () => {
  const session = createCanonicalConversationSession({
    provider: 'codex',
    records: [
      turnContext('gpt-5.5', '2026-09-08T00:00:00.000Z'),
      user('First question', '2026-09-08T00:00:01.000Z'),
      assistant('First answer', '2026-09-08T00:00:02.000Z')
    ]
  });
  const firstUserId = userEvents(session.project({ includeRolledBackTurns: true }))[0].id;

  session.append([
    rollback('2026-09-08T00:00:03.000Z'),
    turnContext('gpt-5.5', '2026-09-08T00:00:04.000Z'),
    user('Replacement question', '2026-09-08T00:00:05.000Z'),
    assistant('Replacement answer', '2026-09-08T00:00:06.000Z')
  ]);

  const shown = session.project({ includeRolledBackTurns: true });
  const users = userEvents(shown);
  assert.deepEqual(users.map(event => event.revision_status), ['original', 'edited']);
  assert.equal(users[0].id, firstUserId);
  assert.deepEqual(users.map(event => event.projection?.visible), [true, true]);
  assert.match(shown.markdown, /First question/);
  assert.match(shown.markdown, /Replacement question/);
  assert.equal(session.diagnostics.initial_normalization_passes, 1);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
  assert.equal(session.diagnostics.appended_records_processed, 4);
});

test('retained Codex session applies an appended abort to the existing interaction without renormalizing it', () => {
  const session = createCanonicalConversationSession({
    provider: 'codex',
    records: [
      turnContext('gpt-5.5', '2026-09-08T00:00:00.000Z'),
      user('Abort me', '2026-09-08T00:00:01.000Z'),
      assistant('Partial answer', '2026-09-08T00:00:02.000Z')
    ]
  });
  const beforeIds = session.events.map(event => event.id);

  session.append([abort('2026-09-08T00:00:03.000Z')]);
  const projection = session.project({ includeRolledBackTurns: true });
  const affected = projection.events.filter(event =>
    event.revision_status === 'normal' && event.execution_status === 'aborted');

  assert.ok(affected.length >= 2, 'the retained User/Assistant interaction should become aborted');
  assert.deepEqual(projection.events.map(event => event.id), beforeIds);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
  assert.equal(session.diagnostics.appended_records_processed, 1);
});

test('retained Codex session emits model-change semantics for an appended edited replacement', () => {
  const session = createCanonicalConversationSession({
    provider: 'codex',
    records: [
      turnContext('gpt-5.5', '2026-09-08T00:00:00.000Z'),
      user('Original model question', '2026-09-08T00:00:01.000Z'),
      assistant('Original model answer', '2026-09-08T00:00:02.000Z')
    ]
  });
  const originalId = userEvents(session.project({ includeRolledBackTurns: true }))[0].id;

  session.append([
    rollback('2026-09-08T00:00:03.000Z'),
    turnContext('gpt-5.6', '2026-09-08T00:00:04.000Z'),
    user('New model question', '2026-09-08T00:00:05.000Z')
  ]);

  const projection = session.project({ includeRolledBackTurns: true });
  const users = userEvents(projection);
  const modelNotice = projection.events.find(event => event.content_type === 'model_change');

  assert.equal(users[0].id, originalId);
  assert.deepEqual(users.map(event => event.revision_status), ['original', 'edited']);
  assert.ok(modelNotice, 'replacement with a changed model must retain a model-change notice');
  assert.match(modelNotice.blocks[0].text, /GPT-5\.5/);
  assert.match(modelNotice.blocks[0].text, /GPT-5\.6/);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
  assert.equal(session.diagnostics.appended_records_processed, 3);
});
