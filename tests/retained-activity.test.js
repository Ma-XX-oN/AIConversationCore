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
