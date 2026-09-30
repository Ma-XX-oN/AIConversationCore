import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AgentPluginRegistry,
  validateAgentPluginDescriptor
} from '../src/plugins/registry.js';

function agent(version = '1.2.3') {
  return {
    sendMessage: async () => ({ ok: true, turnId: 't1' }),
    getResponse: async () => ({ ok: true }),
    getTurns: () => [],
    currentState: () => ({}),
    observeState: () => () => {},
    commTraffic: () => {},
    version: () => ({ plugin: 'fixture-agent', version, apiVersion: 1 })
  };
}

function descriptor(overrides = {}) {
  return {
    id: 'fixture-agent',
    apiVersion: 1,
    recognize: input => input?.provider === 'fixture',
    create: () => agent(),
    ...overrides
  };
}

function canonicalMessage(id, role, text) {
  return {
    id,
    provider: 'fixture',
    source_record_id: id,
    source_index: 0,
    kind: 'message',
    role,
    channel: role === 'assistant' ? 'final' : null,
    visibility: 'visible',
    content_type: 'text',
    blocks: [{
      id: `${id}:part:0`,
      type: 'text',
      text,
      source: { provider: 'fixture', record_id: id, record_index: 0, part_index: 0 }
    }],
    citations: [],
    resources: [],
    relationships: {},
    source: { provider: 'fixture', record_id: id, record_index: 0, turn_id: id }
  };
}

test('descriptor validation accepts the provider-neutral factory contract', () => {
  assert.equal(validateAgentPluginDescriptor(descriptor(), 1).id, 'fixture-agent');
});

test('registry registers a descriptor and creates a complete public agent PI', () => {
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  registry.register(descriptor());
  const instance = registry.create('fixture-agent', { conversationId: 'c1' });

  for (const name of [
    'sendMessage', 'getResponse', 'getTurns', 'currentState',
    'observeState', 'commTraffic', 'version'
  ]) {
    assert.equal(typeof instance[name], 'function', name);
  }
  assert.deepEqual(instance.version(), {
    plugin: 'fixture-agent',
    version: '1.2.3',
    apiVersion: 1
  });
});

test('Core canonical services are injected without allowing caller override', () => {
  let received = null;
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  registry.register(descriptor({
    create: context => {
      received = context;
      return agent();
    }
  }));
  registry.create('fixture-agent', {
    core: { deriveTurns: () => ['caller'] },
    nativeOperation: 'preserved'
  });

  assert.equal(received.nativeOperation, 'preserved');
  assert.equal(typeof received.core.deriveTurns, 'function');
  assert.notDeepEqual(received.core.deriveTurns([]), ['caller']);
  assert.deepEqual(received.core.deriveTurns([]), []);
});

test('registry can register an imported module default descriptor', () => {
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  registry.registerModule({ default: descriptor() });
  assert.equal(registry.get('fixture-agent').id, 'fixture-agent');
});

test('recognition identifies a plugin without constructing mutable provider state', () => {
  let creations = 0;
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  registry.register(descriptor({
    create: () => {
      creations += 1;
      return agent();
    }
  }));

  assert.equal(registry.recognize({ provider: 'fixture' }).id, 'fixture-agent');
  assert.equal(creations, 0);
});

test('registry refuses duplicate IDs rather than silently replacing a plugin', () => {
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  registry.register(descriptor());
  assert.throws(() => registry.register(descriptor()), /already registered/);
});

test('registry refuses incompatible plugin API versions before construction', () => {
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  assert.throws(
    () => registry.register(descriptor({ apiVersion: 2 })),
    /API version 2.*requires 1/
  );
});

test('registry refuses agents that do not implement the complete public PI', () => {
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  registry.register(descriptor({ create: () => ({ version: () => ({}) }) }));
  assert.throws(() => registry.create('fixture-agent'), /missing public PI/);
});

test('registry verifies created agent identity against its registered descriptor', () => {
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  registry.register(descriptor({
    create: () => ({
      ...agent(),
      version: () => ({ plugin: 'other-agent', version: '1.2.3', apiVersion: 1 })
    })
  }));
  assert.throws(() => registry.create('fixture-agent'), /identity mismatch/);
});

test('registry retains provider-published canonical events in a Core-owned session', () => {
  let receivedCore = null;
  const registry = new AgentPluginRegistry({ apiVersion: 1 });
  registry.register(descriptor({
    create: context => {
      receivedCore = context.core;
      return {
        ...agent(),
        commTraffic(data) {
          context.core.publishEvents(data.events);
        }
      };
    }
  }));

  const instance = registry.create('fixture-agent', {
    core: { publishEvents: () => { throw new Error('caller override'); } }
  });
  assert.equal(typeof receivedCore.publishEvents, 'function');

  const event = canonicalMessage('fixture:user:1', 'user', 'Hello');
  instance.commTraffic({ events: [event] });

  const session = registry.session(instance);
  assert.ok(session, 'Core must retain a canonical session for every created agent.');
  assert.deepEqual(session.events, [event]);
  assert.deepEqual(session.project().events, [event]);
});
