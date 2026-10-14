import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AgentPluginRegistry, loadAgent } from '../src/index.js';

test('actual older .1.9 plugin is PI-valid, but cannot impersonate pinned .1.21', async () => {
  const bytes = await readFile(new URL('./fixtures/provider-1.9.txt', import.meta.url));
  assert.equal(bytes.length, 50204);
  const sha = createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + String.fromCharCode(0)))
    .update(bytes).digest('hex');
  assert.equal(sha, 'f29805c7f8d0393f588aacf22661f667b11f8cfa');
  const old = await import('data:text/javascript;base64,' + bytes.toString('base64'));
  const registry = new AgentPluginRegistry();
  registry.registerModule(old);
  const oldInstance = registry.create('chatgpt-web', {
    ref: '6805ea7240c38160386a591cf3a72439226ab675'
  });
  assert.equal(oldInstance.version().version, '0.1.0-issue.1.9');
  assert.equal(typeof oldInstance.observeState, 'function');
  assert.equal(typeof oldInstance.currentState, 'function');
  await assert.rejects(
    loadAgent('chatgpt-web', { loadModule: async () => old }),
    /artifact identity mismatch/,
    'real Core must not accept old binary under .1.21 catalogue pin'
  );
});

test('Core package and lockfile root version are aligned with the compiled browser build', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)));
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
});
