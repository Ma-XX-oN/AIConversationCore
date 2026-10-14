import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAgent } from '../src/plugins/loading.js';

/**
 * Reconstructed from #126's October 12 authenticated reduced evidence:
 * - 21:38:09.846Z project-details 200 arrives early
 * - 21:38:24.412Z conversation 200 establishes membership
 * - 21:38:28.494Z repeated conversation response
 * Names and identifiers are substituted consistently; this is a
 * SOURCE-DERIVED REPLAY, not a live #127 authenticated browser witness.
 */
test('recorded Oct12 backend ordering publishes project and conversation names once', async () => {
  const bytes = await readFile(new URL('./fixtures/provider-1.21.txt', import.meta.url));
  const provider = await import('data:text/javascript;base64,' + bytes.toString('base64'));
  const { agent } = await loadAgent('chatgpt-web', { loadModule: async () => provider });
  const updates = [];
  const unsubscribe = agent.observeState(s => updates.push(s), 'subject-identification');
  const host = provider.connectChatGPTSubjectHost({
    agent, origin: 'https://chatgpt.com', conversationId: 'C-Redacted'
  });
  assert.equal(host.request({ network_sequence: 1, method: 'GET',
    request_url: '/backend-api/gizmos/g-p-Redacted' }), true);
  assert.equal(host.response({ network_sequence: 1, status: 200,
    body: { gizmo: { id: 'g-p-Redacted',
      display: { name: 'Project-Redacted' } } } }), false);
  assert.equal(updates.length, 1, 'early project detail must not publish before membership');
  assert.equal(host.request({ network_sequence: 2, method: 'GET',
    request_url: '/backend-api/conversations/C-Redacted' }), true);
  assert.equal(host.response({ network_sequence: 2, status: 200,
    body: { conversation_id: 'C-Redacted', title: 'Conversation-Redacted',
      gizmo_id: 'g-p-Redacted' } }), true);
  assert.equal(updates.at(-1).readiness, 'resolved');
  assert.equal(updates.at(-1).project.name, 'Project-Redacted');
  assert.equal(updates.at(-1).conversation.name, 'Conversation-Redacted');
  const count = updates.length;
  assert.equal(host.request({ network_sequence: 3, method: 'GET',
    request_url: '/backend-api/conversations/C-Redacted' }), true);
  assert.equal(host.response({ network_sequence: 3, status: 200,
    body: { conversation_id: 'C-Redacted', title: 'Conversation-Redacted',
      gizmo_id: 'g-p-Redacted' } }), false);
  assert.equal(updates.length, count, 'same resolved names do not republish');
  unsubscribe();
});
