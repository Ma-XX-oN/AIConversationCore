import assert from 'node:assert/strict';
import test from 'node:test';

import { RetainedActivityObserver, RETAINED_ACTIVITY_API_VERSION } from '../src/plugins/activity.js';
import { AgentPluginRegistry } from '../src/plugins/registry.js';

test('retained observer replays null and never re-stamps delayed publication', () => {
  let now = 1000;
  const observer = new RetainedActivityObserver({ now: () => now });
  const history = [];
  observer.subscribe(state => history.push(state.latestIncomingAtMs));
  now = 9000;
  assert.equal(observer.publish(450), true); // Provider timestamp.
  assert.equal(observer.publish(1000), true); // Producer receipt-time fallback.
  assert.deepEqual(history, [null, 450, 1000]);
  assert.deepEqual(observer.snapshot(), {
    apiVersion: RETAINED_ACTIVITY_API_VERSION,
    clockDomain: 'unix-epoch-ms',
    latestIncomingAtMs: 1000
  });
});

test('duplicate, stale, invalid and future stamps do not change retained activity', () => {
  const observer = new RetainedActivityObserver({ now: () => 9000 });
  const seen = [];
  observer.subscribe(value => seen.push(value));
  assert.equal(observer.publish(2000), true);
  for (const value of [2000, 1999, -1, null, undefined, NaN, Infinity, 9001,
    '2001', new Date(2001), 0.25, Number.MAX_SAFE_INTEGER]) {
    assert.equal(observer.publish(value), false);
  }
  assert.equal(seen.length, 2);
  assert.equal(observer.snapshot().latestIncomingAtMs, 2000);
});

test('subscription isolation and disposal/rebind are safe', () => {
  const observer = new RetainedActivityObserver({ now: () => 9000 });
  observer.subscribe(() => { throw new Error('listener'); });
  const seen = [];
  const unsubscribe = observer.subscribe(state => seen.push(state.latestIncomingAtMs));
  observer.publish(200);
  unsubscribe();
  unsubscribe();
  observer.publish(300);
  observer.dispose();
  assert.equal(observer.publish(400), false);
  assert.deepEqual(seen, [null, 200]);
  assert.throws(() => observer.subscribe(() => {}), /disposed/);
});

test('Core registry exposes separate activity without breaking a legacy agent PI', () => {
  let firstProducer;
  const registry = new AgentPluginRegistry();
  registry.register({
    id: 'legacy', apiVersion: 1,
    create(context) {
      firstProducer = context.core;
      return {
        sendMessage: async () => ({}), getResponse: async () => ({}),
        getTurns: () => [], currentState: () => ({ status: 'legacy' }),
        observeState: () => () => {}, commTraffic: () => {},
        version: () => ({ plugin: 'legacy', apiVersion: 1 })
      };
    }
  });
  const agent = registry.create('legacy');
  const producer = firstProducer;
  const observed = [];
  const stop = registry.observeActivity(agent, s => observed.push(s.latestIncomingAtMs));
  assert.deepEqual(observed, [null]);
  assert.equal(producer.publishActivityTimestamp(100), true);
  assert.deepEqual(observed, [null, 100]);
  assert.deepEqual(agent.currentState(), { status: 'legacy' });
  stop();
  registry.disposeActivity(agent);
  assert.equal(producer.publishActivityTimestamp(200), false);
  assert.equal(registry.activityState(agent), null);
});

test('duplicate callback registrations have independent cancellation', () => {
  const observer = new RetainedActivityObserver({ now: () => 10000 });
  const stamps = [];
  const listener = state => stamps.push(state.latestIncomingAtMs);
  const first = observer.subscribe(listener);
  const second = observer.subscribe(listener);
  assert.deepEqual(stamps, [null, null]);
  first();
  observer.publish(1234);
  assert.deepEqual(stamps, [null, null, 1234]);
  second();
  observer.publish(1235);
  assert.deepEqual(stamps, [null, null, 1234]);
});

test('reentrant notifications are serialized and never delivered in reverse order', () => {
  const observer = new RetainedActivityObserver({ now: () => 10000 });
  const seen = [];
  observer.subscribe(state => {
    if (state.latestIncomingAtMs === 100) observer.publish(200);
  });
  observer.subscribe(state => seen.push(state.latestIncomingAtMs));
  observer.publish(100);
  assert.deepEqual(seen, [null, 100, 200]);
  assert.equal(observer.snapshot().latestIncomingAtMs, 200);
});

test('concurrent subscribers, listener failures and unsubscribe during delivery', () => {
  const observer = new RetainedActivityObserver({ now: () => 10000 });
  const seen = [];
  let stop = () => {};
  observer.subscribe(state => {
    if (state.latestIncomingAtMs !== null) stop();
  });
  stop = observer.subscribe(state => seen.push(['retired', state.latestIncomingAtMs]));
  observer.subscribe(state => seen.push(['active', state.latestIncomingAtMs]));
  observer.publish(100);
  assert.deepEqual(seen, [
    ['retired', null], ['active', null], ['active', 100]
  ]);
});

test('high-rate incoming stream updates only retained state, with no provider-state reads', () => {
  const observer = new RetainedActivityObserver({ now: () => 30000 });
  let notifications = 0;
  observer.subscribe(() => { notifications += 1; });
  const inaccessibleLegacyState = new Proxy({}, {
    get() { throw new Error('Core must not read unrelated provider state'); }
  });
  assert.ok(inaccessibleLegacyState);
  for (let timestampMs = 1; timestampMs <= 20000; timestampMs += 1) {
    assert.equal(observer.publish(timestampMs), true);
  }
  assert.equal(notifications, 20001);
  assert.equal(observer.snapshot().latestIncomingAtMs, 20000);
});

test('two agents have isolated activity state and replacement is a clean null replay', () => {
  const registry = new AgentPluginRegistry();
  const producers = [];
  registry.register({
    id: 'fixture', apiVersion: 1,
    create(context) {
      producers.push(context.core);
      return {
        sendMessage: async () => ({}), getResponse: async () => ({}),
        getTurns: () => [], currentState: () => ({}),
        observeState: () => () => {}, commTraffic: () => {},
        version: () => ({ plugin: 'fixture', apiVersion: 1 })
      };
    }
  });
  const oldAgent = registry.create('fixture');
  const oldProducer = producers[0];
  const oldStates = [];
  const unsubscribe = registry.observeActivity(oldAgent, s => {
    oldStates.push(s.latestIncomingAtMs);
  });
  oldProducer.publishActivityTimestamp(100);
  unsubscribe();
  registry.disposeActivity(oldAgent);
  const newAgent = registry.create('fixture');
  const newStates = [];
  registry.observeActivity(newAgent, s => newStates.push(s.latestIncomingAtMs));
  assert.deepEqual(newStates, [null]);
  assert.equal(oldProducer.publishActivityTimestamp(200), false);
  assert.deepEqual(oldStates, [null, 100]);
  producers[1].publishActivityTimestamp(300);
  assert.deepEqual(newStates, [null, 300]);
  assert.equal(registry.activityState(oldAgent), null);
});

test('unknown registry agent and invalid observer registration fail visibly', () => {
  const registry = new AgentPluginRegistry();
  assert.equal(registry.activityState({}), null);
  assert.throws(() => registry.observeActivity({}, () => {}), /unknown agent/);
  const observer = new RetainedActivityObserver();
  assert.throws(() => observer.subscribe(123), /listener must be a function/);
});
