import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAgent } from '../src/plugins/loading.js';

const bytes = await readFile(new URL('./fixtures/provider-1.21.txt', import.meta.url));
const provider = await import('data:text/javascript;base64,' + bytes.toString('base64'));

test('rapid 400-step navigation retains only current Core identity and no legacy emissions', async () => {
  const loaded = await loadAgent('chatgpt-web', { loadModule: async () => provider });
  const identity = [];
  const legacy = [];
  const unobserveIdentity = loaded.agent.observeState(
    snapshot => identity.push(snapshot), 'subject-identification');
  const unobserveLegacy = loaded.agent.observeState(snapshot => legacy.push(snapshot));
  const host = provider.connectChatGPTSubjectHost({
    agent: loaded.agent, origin: 'https://chatgpt.com',
    conversationId: 'A'
  });
  for (let i = 0; i < 200; i++) {
    const oldId = i % 2 === 0 ? 'A' : 'B';
    const nextId = i % 2 === 0 ? 'B' : 'A';
    host.begin(oldId);
    const oldSequence = i * 3 + 1;
    assert.equal(host.request({ network_sequence: oldSequence, method: 'GET',
      request_url: '/backend-api/conversations/' + oldId }), true);
    host.begin(nextId);
    assert.equal(host.response({ network_sequence: oldSequence, status: 200,
      body: { conversation_id: oldId, title: 'STALE', gizmo_id: 'g-p-Old' } }),
    false, 'stale request must be rejected after navigation');
    const nextSequence = oldSequence + 1;
    assert.equal(host.request({ network_sequence: nextSequence, method: 'GET',
      request_url: '/backend-api/conversations/' + nextId }), true);
    assert.equal(host.response({ network_sequence: nextSequence, status: 200,
      body: { conversation_id: nextId, title: 'Name-' + i, gizmo_id: null } }),
    true);
    assert.equal(identity.at(-1).conversation.id, nextId);
    assert.equal(identity.at(-1).conversation.name, 'Name-' + i);
    assert.equal(identity.at(-1).project.status, 'none');
  }
  assert.ok(identity.length > 200);
  assert.ok(identity.length <= 801, 'no duplicate identity publications');
  assert.equal(legacy.length, 1, 'legacy state observers remain isolated');
  assert.ok(identity.every((entry, i) => i === 0 ||
    entry.revision === identity[i - 1].revision + 1));
  unobserveIdentity(); unobserveLegacy();
});

test('many independent observers unsubscribe without duplicated or retained callbacks', async () => {
  const loaded = await loadAgent('chatgpt-web', { loadModule: async () => provider });
  const callbacks = [];
  const subscriptions = [];
  for (let index = 0; index < 100; index++) {
    const seen = [];
    callbacks.push(seen);
    subscriptions.push(loaded.agent.observeState(snapshot => seen.push(snapshot),
      'subject-identification'));
  }
  assert.ok(callbacks.every(events => events.length === 1));
  const host = provider.connectChatGPTSubjectHost({
    agent: loaded.agent, origin: 'https://chatgpt.com', conversationId: 'C'
  });
  const first = host.request({ network_sequence: 10, method: 'GET',
    request_url: '/backend-api/conversations/C' });
  assert.equal(first, true);
  assert.equal(host.response({ network_sequence: 10, status: 200,
    body: { conversation_id: 'C', title: 'C', gizmo_id: null } }), true);
  assert.ok(callbacks.every(events => events.length === 2));
  subscriptions.forEach(unsubscribe => unsubscribe());
  host.begin('D');
  assert.ok(callbacks.every(events => events.length === 2));
});
