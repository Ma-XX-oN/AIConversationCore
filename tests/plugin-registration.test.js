import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { buildBrowserBundle } from '../scripts/build-browser-bundle-plugins.mjs';
import { PluginRegistration } from '../src/plugins/registration.js';

function fixture(id = 'alpha', overrides = {}) {
  return {
    id, name: id.toUpperCase(), iconUrl: 'https://example.org/icon.png', apiVersion: 1,
    recognize: input => input?.provider === id,
    create: context => ({
      sendMessage: async () => ({}), getResponse: async () => ({}),
      getTurns: () => context.core.deriveTurns([]), currentState: () => ({}),
      observeState: () => () => {}, commTraffic: data => context.core.publishEvents(data),
      version: () => ({ plugin: id, apiVersion: 1, version: '1.0.0' })
    }),
    ...overrides
  };
}

function harness() {
  let now = 0;
  const timers = [];
  const logs = [];
  const service = new PluginRegistration({
    schedule: (callback, delay) => { const timer = { callback, at: now + delay }; timers.push(timer); return timer; },
    cancel: timer => { timer.cancelled = true; },
    report: event => logs.push(event)
  });
  return { service, timers, logs, advance: ms => {
    now += ms;
    for (const timer of timers) if (!timer.cancelled && !timer.fired && timer.at <= now) {
      timer.fired = true; timer.callback();
    }
  } };
}

test('two independent providers register with frozen metadata and isolated canonical sessions', () => {
  const { service } = harness();
  const original = fixture();
  const captured = service.register(original);
  original.id = 'mutated'; original.create = () => null; original.name = 'mutated';
  service.register(fixture('beta'));
  assert.equal(service.get('alpha'), captured);
  assert.equal(captured.name, 'ALPHA');
  assert.ok(Object.isFrozen(captured));
  assert.ok(Object.isFrozen(service.list()));
  assert.deepEqual(service.list().map(x => x.id), ['alpha', 'beta']);
  assert.equal(service.recognize({ provider: 'beta' }).id, 'beta');
  assert.equal(service.recognize({ provider: 'unknown' }), null);
  const first = service.create('alpha'); const second = service.create('beta');
  first.agent.commTraffic([{ id: 'canonical:1' }]);
  assert.deepEqual(first.session.events, [{ id: 'canonical:1' }]);
  assert.deepEqual(second.session.events, []);
  assert.equal(first.descriptor, captured);
  assert.throws(() => service.create('absent'), /not registered/);
});

test('invalid, duplicate and accessor descriptors reject without partial registry mutation', () => {
  const { service, logs } = harness();
  const first = service.register(fixture());
  for (const overrides of [{ name: '' }, { iconUrl: '' }, { apiVersion: 2 }, { create: null }, { recognize: 1 }, { id: '' }]) {
    assert.throws(() => service.register(fixture('beta', overrides)));
    assert.deepEqual(service.list(), [first]);
  }
  let accesses = 0;
  const bad = fixture('beta');
  Object.defineProperty(bad, 'id', { get() { accesses++; return 'beta'; } });
  assert.throws(() => service.register(bad), /data property/);
  assert.equal(accesses, 0);
  assert.throws(() => service.register(fixture()), /already registered/);
  assert.equal(service.get('alpha'), first);
  assert.equal(logs.filter(x => x.code === 'registration-error').length, 8);
});

test('one-shot diagnostic fires exactly at 15 seconds and late registration recovers once', () => {
  const { service, advance, logs, timers } = harness();
  advance(14999); assert.equal(logs.length, 0);
  advance(1); assert.equal(logs.length, 1);
  assert.equal(logs[0].code, 'no-plugins');
  assert.equal(service.state().missingPluginError, true);
  advance(30000); assert.equal(logs.length, 1); assert.equal(timers.length, 1);
  service.register(fixture());
  assert.equal(service.state().missingPluginError, false);
  assert.deepEqual(logs.map(x => x.code), ['no-plugins', 'registration-recovered']);
  service.register(fixture('beta')); assert.equal(logs.length, 2);
});

test('early registration cancels diagnostic; invalid registration does not cancel it', () => {
  const early = harness(); early.advance(14999); early.service.register(fixture());
  early.advance(1); assert.equal(early.logs.length, 0); assert.ok(early.timers[0].cancelled);
  const invalid = harness(); assert.throws(() => invalid.service.register(fixture('alpha', { name: '' })));
  invalid.advance(15000); assert.equal(invalid.logs.at(-1).code, 'no-plugins');
});

test('diagnostic observers receive immutable events and listener failures do not corrupt registration', () => {
  const { service, advance, logs } = harness();
  const events = [];
  const stop = service.observeDiagnostics(event => events.push(event));
  service.observeDiagnostics(() => { throw new Error('listener failure'); });
  advance(15000);
  assert.ok(Object.isFrozen(events[0]));
  service.register(fixture());
  assert.equal(service.state().missingPluginError, false);
  stop(); stop();
  assert.throws(() => service.register(fixture()));
  assert.equal(events.length, 2);
  assert.ok(logs.some(event => event.code === 'diagnostic-listener-error'));
});

test('classic shared-world public API works in both startup orders without catalogue transport', async () => {
  const bundle = await buildBrowserBundle();
  for (const pluginFirst of [false, true]) {
    const timers = [];
    const context = vm.createContext({ URL, console, setTimeout: (cb, ms) => {
      const timer = { cb, ms }; timers.push(timer); return timer;
    }, clearTimeout: timer => { timer.cancelled = true; } });
    const bootstrap = `globalThis.tryRegister = () => {
      if (!globalThis.AIConversationCore) return false;
      globalThis.AIConversationCore.registerAgentPlugin(globalThis.descriptor);
      return true;
    }; tryRegister();`;
    context.descriptor = fixture();
    if (pluginFirst) vm.runInContext(bootstrap, context);
    vm.runInContext(bundle, context);
    if (pluginFirst) assert.equal(context.tryRegister(), true);
    else vm.runInContext(bootstrap, context);
    const core = context.AIConversationCore;
    assert.equal(core.getAgentPlugin('alpha').id, 'alpha');
    assert.equal(core.createAgent('alpha').agent.version().plugin, 'alpha');
    assert.equal(timers.length, 1); assert.equal(timers[0].ms, 15000);
    assert.ok(timers[0].cancelled);
    core.registerAgentPlugin(fixture('beta'));
    assert.equal(core.listAgentPlugins().length, 2);
  }
});

test('all descriptor fields are captured as own data and prior snapshots stay unchanged', () => {
  const { service } = harness();
  for (const invalid of [null, 42, {}, Object.create(fixture()), fixture('alpha', { apiVersion: 1.5 }),
    fixture('alpha', { iconUrl: null }), fixture('alpha', { name: undefined })]) {
    assert.throws(() => service.register(invalid));
    assert.equal(service.list().length, 0);
  }
  for (const key of ['name', 'iconUrl', 'apiVersion', 'create', 'recognize']) {
    const descriptor = fixture();
    Object.defineProperty(descriptor, key, { get() { assert.fail('accessor invoked'); } });
    assert.throws(() => service.register(descriptor), /data property/);
  }
  service.register(fixture());
  const previous = service.state();
  service.register(fixture('beta'));
  assert.equal(previous.plugins.length, 1);
  assert.ok(Object.isFrozen(previous));
  assert.throws(() => { previous.plugins.push(fixture()); }, TypeError);
  assert.throws(() => { previous.plugins[0].name = 'replacement'; }, TypeError);
});

test('agent identity and factory failures preserve inventory and existing session associations', () => {
  const { service } = harness();
  service.register(fixture('missing-pi', { create: () => ({}) }));
  service.register(fixture('wrong-identity', { create: fixture('different').create }));
  service.register(fixture('throwing', { create: () => { throw new Error('factory failed'); } }));
  assert.throws(() => service.create('missing-pi'), /missing public PI/);
  assert.throws(() => service.create('wrong-identity'), /identity mismatch/);
  assert.throws(() => service.create('throwing'), /factory failed/);
  let shared;
  let canonical;
  service.register(fixture('reused', { create: context => {
    if (!shared) { canonical = context.core; shared = fixture('reused').create(context); }
    return shared;
  } }));
  const first = service.create('reused', {
    core: { deriveTurns: () => ['invalid'], publishEvents: () => assert.fail('override used') }
  });
  assert.deepEqual(first.agent.getTurns(), []);
  assert.throws(() => service.create('reused'), /reused an existing agent/);
  canonical.publishEvents([{ id: 'retained' }]);
  assert.deepEqual(first.session.events, [{ id: 'retained' }]);
  assert.equal(service.list().length, 4);
});

test('shared public startup diagnostic logs visibly, recovers and never reschedules', async () => {
  const callbacks = [];
  const errors = []; const infos = []; const events = [];
  const context = vm.createContext({
    console: { error: (...args) => errors.push(args), info: (...args) => infos.push(args) },
    setTimeout: (cb, ms) => { callbacks.push({ cb, ms }); return 1; }, clearTimeout: () => {}
  });
  vm.runInContext(await buildBrowserBundle(), context);
  const core = context.AIConversationCore;
  core.observePluginRegistrationDiagnostics(event => events.push(event));
  assert.equal(callbacks.length, 1); assert.equal(callbacks[0].ms, 15000);
  assert.equal(core.getPluginRegistrationState().missingPluginError, false);
  callbacks[0].cb();
  assert.equal(errors.length, 1);
  assert.equal(core.getPluginRegistrationState().missingPluginError, true);
  core.registerAgentPlugin(fixture());
  assert.equal(infos.length, 1);
  assert.equal(core.getPluginRegistrationState().missingPluginError, false);
  assert.deepEqual(events.map(x => x.code), ['no-plugins', 'registration-recovered']);
  assert.equal(callbacks.length, 1);
});

test('provider-neutral registration observer replays and delivers late providers', () => {
  const { service, timers, logs } = harness();
  const snapshots = [];
  const duplicate = list => snapshots.push(list.map(x => x.id));
  const first = service.observeRegistrations(duplicate);
  const second = service.observeRegistrations(duplicate);
  assert.deepEqual(snapshots, [[], []]);
  service.register(fixture('alpha'));
  assert.deepEqual(snapshots, [[], [], ['alpha'], ['alpha']]);
  assert.equal(timers.length, 1, 'observations must not add polling');
  assert.throws(() => service.register(fixture('alpha')), /already registered/);
  assert.equal(snapshots.length, 4, 'rejected registration must not notify');
  first(); first();
  service.register(fixture('beta'));
  assert.deepEqual(snapshots.at(-1), ['alpha', 'beta']);
  second();
  service.register(fixture('gamma'));
  assert.equal(snapshots.length, 5, 'disposed observers must not notify');
  assert.equal(logs.filter(x => x.code === 'registration-observer-error').length, 0);
});

test('late registration subscriber failure does not affect other consumers', () => {
  const { service, logs } = harness();
  service.observeRegistrations(() => { throw new Error('observer fault'); });
  const seen = [];
  service.observeRegistrations(inventory => seen.push(inventory.map(x => x.id)));
  assert.equal(service.register(fixture('alpha')).id, 'alpha');
  assert.deepEqual(seen, [[], ['alpha']]);
  assert.ok(logs.some(x => x.code === 'registration-observer-error'));
});

test('classic browser exposes provider-neutral inventory subscription', async () => {
  const coreContext = vm.createContext({URL, setTimeout, clearTimeout});
  vm.runInContext(await buildBrowserBundle(), coreContext);
  const core = coreContext.AIConversationCore;
  const seen = [];
  const unsubscribe = core.observeAgentPluginRegistrations(
    inventory => seen.push(inventory.map(x => x.id))
  );
  core.registerAgentPlugin(fixture('alpha'));
  unsubscribe();
  core.registerAgentPlugin(fixture('beta'));
  assert.deepEqual(seen.map(items => Array.from(items)), [[], ['alpha']]);
});
