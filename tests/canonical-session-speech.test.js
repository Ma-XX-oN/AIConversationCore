import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalConversationSession } from '../src/index.js';

const contextMessage = [
  '# Context from my IDE setup:',
  '',
  '## Active file: sessions/example.jsonl',
  '',
  '## My request for Codex:',
  'Explain this change.'
].join('\n');

function records() {
  return [
    {
      type: 'event_msg',
      timestamp: '2026-09-08T00:00:00Z',
      payload: { type: 'user_message', message: contextMessage }
    },
    {
      type: 'event_msg',
      timestamp: '2026-09-08T00:00:01Z',
      payload: {
        type: 'agent_message',
        phase: 'commentary',
        message: 'I will inspect the implementation.'
      }
    },
    {
      type: 'event_msg',
      timestamp: '2026-09-08T00:00:02Z',
      payload: { type: 'task_complete' }
    }
  ];
}

function userMessage(projection) {
  return projection.events.find(event =>
    event.provider === 'codex' && event.kind === 'message' && event.role === 'user');
}

test('retained Codex session preserves interactive phase and lifecycle semantics from its one normalization pass', () => {
  const session = createCanonicalConversationSession({ provider: 'codex', records: records() });
  const projection = session.project({ includeUserContext: true });

  const commentary = projection.events.find(event =>
    event.role === 'assistant' && event.kind === 'commentary');
  const completion = projection.events.find(event => event.content_type === 'task_complete');

  assert.ok(commentary, 'retained session lost the Assistant commentary event');
  assert.equal(commentary.channel, 'commentary');
  assert.equal(commentary.source?.timestamp, '2026-09-08T00:00:01Z');
  assert.ok(completion, 'retained session lost the interactive task-complete lifecycle event');
  assert.equal(completion.lifecycle?.type, 'task_complete');
  assert.equal(session.diagnostics.initial_normalization_passes, 1);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
});

test('retained Codex session changes User Context speech eligibility at projection time without changing identity', () => {
  const session = createCanonicalConversationSession({ provider: 'codex', records: records() });

  const off = session.project({ includeUserContext: false });
  const on = session.project({ includeUserContext: true });
  const offAgain = session.project({ includeUserContext: false });

  const offUser = userMessage(off);
  const onUser = userMessage(on);
  const offAgainUser = userMessage(offAgain);
  assert.ok(offUser && onUser && offAgainUser, 'retained session lost the User event');
  assert.equal(offUser.id, onUser.id);
  assert.equal(onUser.id, offAgainUser.id);

  const offContext = offUser.blocks.find(block => block.type === 'user_context');
  const onContext = onUser.blocks.find(block => block.type === 'user_context');
  const offPrompt = offUser.blocks.find(block => block.type === 'text');
  const onPrompt = onUser.blocks.find(block => block.type === 'text');

  assert.ok(offContext && onContext, 'retained session lost semantic User Context');
  assert.equal(offContext.speech?.voice_role, 'user_context');
  assert.equal(onContext.speech?.voice_role, 'user_context');
  assert.equal(offContext.speech?.eligible, false);
  assert.equal(onContext.speech?.eligible, true);
  assert.equal(offPrompt?.speech?.eligible, true);
  assert.equal(onPrompt?.speech?.eligible, true);
  assert.equal(offPrompt?.speech?.voice_role, 'user');
  assert.equal(onPrompt?.speech?.voice_role, 'user');

  assert.equal(session.diagnostics.initial_normalization_passes, 1);
  assert.equal(session.diagnostics.full_renormalization_passes, 0);
  assert.equal(session.diagnostics.projection_count, 3);
});
