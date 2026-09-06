import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptCodexRecords,
  adaptInteractiveSessionRecords,
  renderCanonicalMarkdown,
  resolveCodexSessionMetadata
} from '../src/index.js';

const sessionId = '01a07826-f445-7dd2-a370-3f3c7a3754a6';

function sessionMeta() {
  return {
    timestamp: '2026-09-06T19:17:01.000Z',
    type: 'session_meta',
    payload: { id: sessionId }
  };
}

function turnContext(model) {
  return {
    timestamp: '2026-09-06T19:17:02.000Z',
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

function aborted(timestamp) {
  return {
    timestamp,
    type: 'event_msg',
    payload: { type: 'turn_aborted' }
  };
}

function revisionFixture() {
  return [
    sessionMeta(),
    turnContext('gpt-5.4'),
    user('What is an apple', '2026-09-06T19:52:40.000Z'),
    aborted('2026-09-06T19:52:42.000Z'),
    rollback('2026-09-06T19:52:43.000Z'),
    turnContext('gpt-5.5'),
    user('What is an tree?', '2026-09-06T19:52:46.000Z'),
    assistant('A tree answer.', '2026-09-06T19:52:54.000Z'),
    rollback('2026-09-06T19:53:00.000Z'),
    turnContext('gpt-5.5'),
    user('What is an pool?', '2026-09-06T19:53:50.000Z'),
    assistant('A pool answer.', '2026-09-06T19:53:58.000Z'),
    rollback('2026-09-06T20:00:00.000Z'),
    turnContext('gpt-5.5'),
    user('What is a puck?', '2026-09-06T20:00:10.000Z'),
    assistant('A puck answer.', '2026-09-06T20:00:20.000Z')
  ];
}

test('Codex hides rolled-back revisions by default and labels the active replacement edited', () => {
  const markdown = renderCanonicalMarkdown(adaptCodexRecords(revisionFixture()));

  assert.doesNotMatch(markdown, /What is an apple/);
  assert.doesNotMatch(markdown, /What is an tree/);
  assert.doesNotMatch(markdown, /What is an pool/);
  assert.match(markdown, /## User \(edited\)[\s\S]*What is a puck\?/);
  assert.match(markdown, /A puck answer\./);
  assert.match(markdown, /Model changed from GPT-5\.4 to GPT-5\.5/);
});

test('Codex includeRolledBackTurns exposes original, superseded and edited revisions', () => {
  const events = adaptCodexRecords(revisionFixture(), { includeRolledBackTurns: true });
  const users = events.filter(event => event.role === 'user' && event.kind === 'message');

  assert.deepEqual(users.map(event => event.revision_status), [
    'original',
    'superseded',
    'superseded',
    'edited'
  ]);
  assert.deepEqual(users.map(event => event.execution_status), [
    'aborted',
    'completed',
    'completed',
    'completed'
  ]);

  const markdown = renderCanonicalMarkdown(events);
  assert.match(markdown, /## User \(original, aborted\)[\s\S]*What is an apple/);
  assert.match(markdown, /## User \(superseded\)[\s\S]*What is an tree\?/);
  assert.match(markdown, /## User \(superseded\)[\s\S]*What is an pool\?/);
  assert.match(markdown, /## User \(edited\)[\s\S]*What is a puck\?/);
});

test('Codex rollback count is respected as a count rather than hard-coded to one', () => {
  const records = [
    sessionMeta(),
    turnContext('gpt-5.5'),
    user('First active turn', '2026-09-06T20:01:00.000Z'),
    assistant('First answer', '2026-09-06T20:01:01.000Z'),
    turnContext('gpt-5.5'),
    user('Second active turn', '2026-09-06T20:02:00.000Z'),
    assistant('Second answer', '2026-09-06T20:02:01.000Z'),
    rollback('2026-09-06T20:03:00.000Z', 2),
    turnContext('gpt-5.5'),
    user('Replacement turn', '2026-09-06T20:03:01.000Z')
  ];
  const events = adaptCodexRecords(records, { includeRolledBackTurns: true });
  const users = events.filter(event => event.role === 'user' && event.kind === 'message');

  assert.deepEqual(users.map(event => event.revision_status), ['original', 'superseded', 'edited']);
});

test('Codex session-index metadata uses the last valid matching title', () => {
  const indexRecords = [
    { id: sessionId, thread_name: 'Check Paris time' },
    { id: 'other-session', thread_name: 'Unrelated' },
    { id: sessionId, thread_name: 'Check Paris time (modified)' },
    { id: sessionId, thread_name: 'Check Paris time (MODIFIED)' }
  ];

  assert.deepEqual(resolveCodexSessionMetadata(revisionFixture(), indexRecords), {
    session_id: sessionId,
    title: 'Check Paris time (MODIFIED)',
    title_source: 'codex-session-index'
  });
});

test('Codex session-index metadata falls back cleanly when no matching index title exists', () => {
  assert.deepEqual(resolveCodexSessionMetadata(revisionFixture(), []), {
    session_id: sessionId,
    title: null,
    title_source: 'none'
  });
});

test('interactive Codex normalization never strips IDE context from recorded User content', () => {
  const message = '# Context from my IDE setup:\n\n## Active file: example.txt\n\n## My request for Codex:\nKeep all of this.';
  const events = adaptInteractiveSessionRecords('codex', [
    sessionMeta(),
    turnContext('gpt-5.5'),
    user(message, '2026-09-06T20:04:00.000Z')
  ]);
  const userEvent = events.find(event => event.role === 'user' && event.kind === 'message');

  assert.equal(userEvent.blocks[0].text, message);
});
