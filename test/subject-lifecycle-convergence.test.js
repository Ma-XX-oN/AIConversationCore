import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAgent } from '../src/plugins/loading.js';

const providerBytes = await readFile(new URL('./fixtures/provider-1.21.txt', import.meta.url));
const provider = await import('data:text/javascript;base64,' + providerBytes.toString('base64'));

async function harness(conversationId = 'A') {
  const loaded = await loadAgent('chatgpt-web', { loadModule: async () => provider });
  const updates = [];
  const legacy = [];
  const dispose = loaded.agent.observeState(value => updates.push(value), 'subject-identification');
  const disposeLegacy = loaded.agent.observeState(value => legacy.push(value));
  const host = provider.connectChatGPTSubjectHost({
    agent: loaded.agent, origin: 'https://chatgpt.com', conversationId
  });
  return { loaded, updates, legacy, dispose, disposeLegacy, host };
}

function conversation(host, sequence, id, title, gizmoId, extra = {}) {
  const request = host.request({
    network_sequence: sequence, method: 'GET',
    request_url: '/backend-api/conversations/' + id
  });
  if (!request) return false;
  return host.response({
    network_sequence: sequence, status: 200,
    body: { conversation_id: id, title, gizmo_id: gizmoId, ...extra }
  });
}

function project(host, sequence, id, title) {
  if (!host.request({ network_sequence: sequence, method: 'GET',
    request_url: '/backend-api/gizmos/' + id })) return false;
  return host.response({ network_sequence: sequence, status: 200,
    body: { gizmo: { id, display: { name: title } } } });
}

test('early backend project metadata, delayed membership, rename and dedup in actual Core', async () => {
  const { host, updates, legacy, dispose, disposeLegacy } = await harness();
  assert.equal(updates.length, 1);
  assert.equal(updates[0].readiness, 'unresolved');
  assert.equal(project(host, 1, 'g-p-X', 'Early name'), false);
  assert.equal(updates.length, 1);
  assert.equal(conversation(host, 2, 'A', 'First', 'g-p-X'), true);
  assert.equal(updates.at(-1).project.name, 'Early name');
  assert.equal(updates.at(-1).conversation.name, 'First');
  assert.equal(updates.at(-1).readiness, 'resolved');
  assert.equal(conversation(host, 3, 'A', 'First', 'g-p-X'), false);
  assert.equal(project(host, 4, 'g-p-X', 'Early name'), false);
  const count = updates.length;
  assert.equal(conversation(host, 5, 'A', 'Renamed', 'g-p-X'), true);
  assert.equal(updates.length, count + 1);
  assert.equal(updates.at(-1).conversation.name, 'Renamed');
  assert.equal(project(host, 6, 'g-p-X', 'Renamed project'), true);
  assert.equal(updates.at(-1).project.name, 'Renamed project');
  assert.equal(legacy.length, 1, 'legacy state observers are not notified');
  assert.equal(Object.isFrozen(updates.at(-1)), true);
  dispose(); disposeLegacy();
});

test('A→B→A navigation invalidates outstanding network tokens, no prior project leaks', async () => {
  const { host, updates, dispose, disposeLegacy } = await harness('A');
  assert.equal(conversation(host, 10, 'A', 'A', 'g-p-X'), true);
  assert.equal(project(host, 11, 'g-p-X', 'X'), true);
  assert.equal(host.request({ network_sequence: 12, method: 'GET',
    request_url: '/backend-api/conversations/A' }), true);
  host.begin('B');
  assert.equal(updates.at(-1).readiness, 'unresolved');
  assert.equal(host.response({ network_sequence: 12, status: 200,
    body: { conversation_id: 'A', title: 'Late A', gizmo_id: 'g-p-X' } }), false);
  assert.equal(conversation(host, 13, 'B', 'B', 'g-p-Y'), true);
  assert.equal(project(host, 14, 'g-p-Y', 'Y'), true);
  host.begin('A');
  assert.equal(updates.at(-1).project.status, 'unresolved');
  assert.equal(conversation(host, 15, 'A', 'Latest A', 'g-p-X'), true);
  assert.equal(updates.at(-1).project.id, 'g-p-X');
  assert.equal(updates.at(-1).project.name, null, 'previous X name is discarded');
  assert.equal(project(host, 16, 'g-p-X', 'Latest X'), true);
  assert.equal(updates.at(-1).project.name, 'Latest X');
  assert.ok(updates.every((entry, index) => index === 0 ||
    entry.revision > updates[index - 1].revision));
  dispose(); disposeLegacy();
});

test('X→Y→X stale project responses fail closed even with reused project id', async () => {
  const { host, updates, dispose, disposeLegacy } = await harness('A');
  assert.equal(conversation(host, 21, 'A', 'A', 'g-p-X'), true);
  assert.equal(host.request({ network_sequence: 22, method: 'GET',
    request_url: '/backend-api/gizmos/g-p-X' }), true);
  assert.equal(conversation(host, 23, 'A', 'A', 'g-p-Y'), true);
  assert.equal(conversation(host, 24, 'A', 'A', 'g-p-X'), true);
  const before = updates.length;
  assert.equal(host.response({ network_sequence: 22, status: 200,
    body: { gizmo: { id: 'g-p-X', display: { name: 'Stale X' } } } }), false);
  assert.equal(updates.length, before);
  assert.equal(updates.at(-1).project.name, null);
  assert.equal(project(host, 25, 'g-p-X', 'Current X'), true);
  assert.equal(updates.at(-1).project.name, 'Current X');
  dispose(); disposeLegacy();
});

test('explicit standalone null differs from missing membership and invalid project value', async () => {
  const { host, updates, dispose, disposeLegacy } = await harness('S');
  assert.equal(conversation(host, 31, 'S', 'Standalone', undefined), true);
  assert.equal(updates.at(-1).project.status, 'unresolved',
    'missing field is not standalone proof');
  assert.equal(conversation(host, 32, 'S', 'Standalone', null), true);
  assert.equal(updates.at(-1).project.status, 'none');
  assert.equal(updates.at(-1).project.id, null);
  assert.equal(conversation(host, 33, 'S', 'Standalone', 'invalid-gizmo'), true);
  assert.equal(updates.at(-1).project.status, 'unresolved');
  dispose(); disposeLegacy();
});

test('fresh agent after reload, multiple subscribers, unsubscribe and no duplicate delivery', async () => {
  const first = await harness('R');
  assert.equal(conversation(first.host, 41, 'R', 'Previous', 'g-p-Old'), true);
  assert.equal(project(first.host, 42, 'g-p-Old', 'Old project'), true);
  first.dispose(); first.disposeLegacy();
  const second = await harness('R');
  assert.equal(second.updates[0].project.status, 'unresolved');
  const extra = [];
  const unsubscribe = second.loaded.agent.observeState(s => extra.push(s),
    'subject-identification');
  assert.equal(extra.length, 1);
  assert.equal(conversation(second.host, 43, 'R', 'Fresh', null), true);
  assert.equal(second.updates.at(-1).project.status, 'none');
  assert.equal(extra.length, 2);
  const before = second.updates.length;
  second.dispose(); unsubscribe(); second.disposeLegacy();
  second.host.begin('A');
  assert.equal(second.updates.length, before);
  assert.equal(extra.length, 2);
});
