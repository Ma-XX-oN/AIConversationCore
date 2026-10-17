import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAgentPluginArtifact,
  loadAgent
} from '../src/plugins/loading.js';

function chatGPTModule(artifact) {
  return {
    default: {
      id: 'chatgpt-web',
      apiVersion: 1,
      create: context => ({
        sendMessage: async () => ({ ok: true }),
        getResponse: async () => ({ ok: true }),
        getTurns: () => [],
        currentState: () => ({}),
        observeState: () => () => {},
        commTraffic(data) {
          if (Array.isArray(data?.events)) context.core.publishEvents(data.events);
        },
        version: () => ({
          plugin: 'chatgpt-web',
          version: artifact.version,
          ref: artifact.ref,
          apiVersion: artifact.apiVersion
        })
      })
    }
  };
}

test('Core owns the immutable #127 provider artifact identity', () => {
  const artifact = getAgentPluginArtifact('chatgpt-web');

  assert.equal(artifact.id, 'chatgpt-web');
  assert.equal(artifact.repository, 'Ma-XX-oN/Chat-Gpt-Plugin-2');
  assert.equal(artifact.ref, 'db7e3450aac94eb2990fba0de54d090e377dafa3');
  assert.equal(artifact.commit, 'db7e3450aac94eb2990fba0de54d090e377dafa3');
  assert.equal(artifact.version, '0.1.0-issue.1.29');
  assert.equal(artifact.apiVersion, 1);
  assert.equal(artifact.path, 'dist/chatgpt-plugin.mjs');
  assert.equal(artifact.gitBlobSha1, 'c731721005aefbc14a61bfc97270d7270aa80ea0');
  assert.equal(artifact.byteLength, 73131);
});

test('Core loads, registers and creates an agent while the host only transports an artifact', async () => {
  let transported = null;
  const result = await loadAgent('chatgpt-web', {
    async loadModule(artifact) {
      transported = artifact;
      return chatGPTModule(artifact);
    },
    context: { conversationId: 'conversation-1' }
  });

  assert.equal(transported, getAgentPluginArtifact('chatgpt-web'));
  assert.equal(result.artifact, transported);
  assert.equal(result.agent.version().plugin, 'chatgpt-web');
  assert.equal(result.agent.version().ref, 'db7e3450aac94eb2990fba0de54d090e377dafa3');
  assert.ok(result.session, 'Core must return its canonical session with the agent.');

  const event = {
    id: 'fixture:1',
    provider: 'fixture',
    source_record_id: 'fixture:1',
    source_index: 0,
    kind: 'message',
    role: 'assistant',
    channel: 'final',
    visibility: 'visible',
    content_type: 'text',
    blocks: [],
    citations: [],
    resources: [],
    relationships: {},
    source: { provider: 'fixture', record_id: 'fixture:1', record_index: 0, turn_id: 'fixture:1' }
  };
  result.agent.commTraffic({ events: [event] });
  assert.deepEqual(result.session.events, [event]);
});

test('Core refuses unknown agents and missing host transport explicitly', async () => {
  assert.throws(() => getAgentPluginArtifact('missing-agent'), /not configured/);
  await assert.rejects(() => loadAgent('chatgpt-web'), /loadModule/);
});
