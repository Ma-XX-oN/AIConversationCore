import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { loadAgent, getAgentPluginArtifact } from '../src/plugins/loading.js';

test('pinned #127 provider blob loads through real Core and emits backend identity', async () => {
  const artifact = getAgentPluginArtifact('chatgpt-web');
  assert.equal(artifact.version, '0.1.0-issue.1.21');
  assert.equal(artifact.commit,
    'cf521202e78dede9152840193dc5ca140703b240');
  assert.equal(artifact.gitBlobSha1, '32182498480ba061367ce60dbb4104c0c0d55fe7');
  assert.equal(artifact.byteLength, 69824);
  const bytes = await readFile(new URL('./fixtures/provider-1.21.txt', import.meta.url));
  assert.equal(bytes.length, artifact.byteLength, 'exact artifact byte count');
  const gitBlob = createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + String.fromCharCode(0)))
    .update(bytes).digest('hex');
  assert.equal(gitBlob, artifact.gitBlobSha1, 'exact Git blob identity');
  const provider = await import('data:text/javascript;base64,' +
    bytes.toString('base64'));
  const loaded = await loadAgent('chatgpt-web', {
    loadModule: async descriptor => {
      assert.equal(descriptor.commit, artifact.commit);
      return provider;
    }
  });
  assert.ok(loaded.session);
  assert.equal(loaded.agent.version().version, artifact.version);
  const subject = [];
  const legacy = [];
  const stopSubject = loaded.agent.observeState(s => subject.push(s),
    'subject-identification');
  const stopLegacy = loaded.agent.observeState(s => legacy.push(s));
  assert.equal(subject.at(-1).readiness, 'unresolved');
  const host = provider.connectChatGPTSubjectHost({
    agent: loaded.agent,
    origin: 'https://chatgpt.com',
    conversationId: 'A'
  });
  assert.equal(host.request({ network_sequence: 1, method: 'GET',
    request_url: '/backend-api/conversations/A' }), true);
  assert.equal(host.response({ network_sequence: 1, status: 200,
    body: { conversation_id: 'A', title: 'Server title',
      gizmo_id: null } }), true);
  assert.equal(subject.at(-1).conversation.name, 'Server title');
  assert.equal(subject.at(-1).project.status, 'none');
  assert.equal(legacy.length, 1, 'legacy state observer remains separate');
  const count = subject.length;
  stopSubject();
  stopLegacy();
  host.begin('B');
  assert.equal(subject.length, count, 'listener is detached');
});

test('actual compiled Core classic browser bundle loads pinned provider with host updates', async () => {
  const coreSource = await readFile(
    new URL('../dist/aiconversationcore.chatgpt.browser.js', import.meta.url), 'utf8');
  const providerBytes = await readFile(new URL('./fixtures/provider-1.21.txt', import.meta.url));
  const provider = await import('data:text/javascript;base64,' +
    providerBytes.toString('base64'));
  const context = vm.createContext({ URL });
  vm.runInContext(coreSource, context);
  const core = context.AIConversationCore;
  assert.equal(typeof core.loadAgent, 'function');
  const loaded = await core.loadAgent('chatgpt-web', {
    loadModule: async descriptor => {
      assert.equal(descriptor.gitBlobSha1, '32182498480ba061367ce60dbb4104c0c0d55fe7');
      return provider;
    }
  });
  assert.ok(loaded.session);
  const observed = [];
  const unsubscribe = loaded.agent.observeState(s => observed.push(s),
    'subject-identification');
  assert.equal(observed[0].readiness, 'unresolved');
  const host = provider.connectChatGPTSubjectHost({
    agent: loaded.agent, origin: 'https://chatgpt.com', conversationId: 'C'
  });
  assert.equal(host.request({
    network_sequence: 11, method: 'GET',
    request_url: '/backend-api/conversations/C'
  }), true);
  assert.equal(host.response({
    network_sequence: 11, status: 200,
    body: { conversation_id: 'C', title: 'Compiled Core result', gizmo_id: null }
  }), true);
  assert.equal(observed.at(-1).conversation.name, 'Compiled Core result');
  assert.equal(observed.at(-1).project.status, 'none');
  const count = observed.length;
  unsubscribe();
  host.begin('D');
  assert.equal(observed.length, count);
});
