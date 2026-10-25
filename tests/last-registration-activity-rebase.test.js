import assert from 'node:assert/strict';
import test from 'node:test';
import { registerAgentPlugin, createAgent, activityState, observeActivity,
  disposeActivity } from '../src/index.js';
test('registered agent retains activity and disposes without catalogue loader', () => {
  let publish;
  registerAgentPlugin({ id: 'last-rebase-fixture', name: 'Last',
    iconUrl: 'https://example.test/icon.png', apiVersion: 1,
    create(ctx) {
      publish = ctx.core.publishActivityTimestamp;
      return { sendMessage: async () => ({}), getResponse: async () => ({}),
        getTurns: () => [], currentState: () => ({}),
        observeState: () => () => {}, commTraffic: () => {},
        version: () => ({ plugin: 'last-rebase-fixture', apiVersion: 1 }) };
    } });
  const { agent, session } = createAgent('last-rebase-fixture');
  assert.ok(session);
  const seen = [];
  const unsubscribe = observeActivity(agent, s => seen.push(s.latestIncomingAtMs));
  const ts = Date.now() - 2000;
  assert.equal(publish(ts), true);
  assert.deepEqual(seen, [null, ts]);
  unsubscribe();
  assert.equal(disposeActivity(agent), true);
  assert.equal(activityState(agent), null);
  assert.equal(publish(ts + 1), false);
});

test('registration observation replays and reports success without polling', async () => {
  const { PluginRegistration } = await import('../src/plugins/registration.js');
  const registry = new PluginRegistration({
    schedule: () => 1, cancel: () => {}, report: () => {}
  });
  const seen = [];
  const off = registry.observeRegistrations(descriptor => seen.push(descriptor.id));
  registry.register({ id: 'first', name: 'First', iconUrl: 'https://example.test/a.png',
    apiVersion: 1, create: () => ({}) });
  assert.deepEqual(seen, ['first']);
  const replay = [];
  const stop = registry.observeRegistrations(descriptor => replay.push(descriptor.id));
  assert.deepEqual(replay, ['first']);
  off();
  registry.register({ id: 'second', name: 'Second', iconUrl: 'https://example.test/b.png',
    apiVersion: 1, create: () => ({}) });
  assert.deepEqual(seen, ['first']);
  assert.deepEqual(replay, ['first', 'second']);
  stop();
});
