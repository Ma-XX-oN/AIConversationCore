import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAgent } from '../src/plugins/loading.js';

const bytes = await readFile(new URL('./fixtures/provider-1.21.txt', import.meta.url));
const provider = await import('data:text/javascript;base64,' + bytes.toString('base64'));

async function createIsolatedHost(id) {
  const { agent, session } = await loadAgent('chatgpt-web', {
    loadModule: async () => provider
  });
  const updates = [];
  const stop = agent.observeState(s => updates.push(s), 'subject-identification');
  const host = provider.connectChatGPTSubjectHost({
    agent, origin: 'https://chatgpt.com', conversationId: id
  });
  return { agent, session, updates, stop, host };
}

function respond(host, seq, id, title, membership) {
  assert.equal(host.request({ network_sequence: seq, method: 'GET',
    request_url: '/backend-api/conversations/' + id }), true);
  return host.response({ network_sequence: seq, status: 200,
    body: { conversation_id: id, title, gizmo_id: membership } });
}

test('duplicated tabs with same conversation do not share subject observer state', async () => {
  const first = await createIsolatedHost('S');
  const second = await createIsolatedHost('S');
  assert.notEqual(first.agent, second.agent);
  assert.notEqual(first.session, second.session);
  assert.equal(first.updates.length, 1);
  assert.equal(second.updates.length, 1);

  assert.equal(respond(first.host, 1, 'S', 'Tab one', 'g-p-One'), true);
  assert.equal(first.updates.at(-1).project.id, 'g-p-One');
  assert.equal(second.updates.at(-1).readiness, 'unresolved',
    'duplicate tab must not inherit first tab state');

  assert.equal(respond(second.host, 1, 'S', 'Tab two', null), true);
  assert.equal(second.updates.at(-1).project.status, 'none');
  assert.equal(first.updates.at(-1).project.id, 'g-p-One',
    'second tab must not revoke first tab project');
  assert.equal(first.updates.at(-1).conversation.name, 'Tab one');
  assert.equal(second.updates.at(-1).conversation.name, 'Tab two');

  first.host.begin('A');
  assert.equal(first.updates.at(-1).readiness, 'unresolved');
  assert.equal(second.updates.at(-1).conversation.id, 'S');
  const firstCount = first.updates.length;
  first.stop();
  assert.equal(respond(first.host, 2, 'A', 'After stop', null), true);
  assert.equal(first.updates.length, firstCount);
  assert.equal(respond(second.host, 2, 'S', 'Second renamed', null), true);
  assert.equal(second.updates.at(-1).conversation.name, 'Second renamed');
  second.stop();
});
