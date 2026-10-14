import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function browserExecutable() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser']
    .filter(Boolean)) {
    const probe = spawnSync(name, ['--version'], { encoding: 'utf8', timeout: 3000 });
    if (!probe.error && probe.status === 0) return name;
  }
  throw new Error('Chrome/Chromium executable required for #127 real-browser gate');
}

test('actual Chrome executes immutable Core and plugin browser host observer flow', () => {
  const root = mkdtempSync(join(tmpdir(), 'aicc127-browser-'));
  try {
    const core = resolve('dist/aiconversationcore.chatgpt.browser.js');
    const provider = readFileSync(resolve('test/fixtures/provider-1.21.txt'));
    copyFileSync(core, join(root, 'core.js'));
    const moduleURI = 'data:text/javascript;base64,' + provider.toString('base64');
    const source = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<div id="status">PENDING</div>
<script src="core.js"></script>
<script type="module">
(async () => {
  try {
    const provider = await import('${moduleURI}');
    const core = window.AIConversationCore;
    const descriptor = core.getAgentPluginArtifact('chatgpt-web');
    if (descriptor.gitBlobSha1 !== '32182498480ba061367ce60dbb4104c0c0d55fe7') {
      throw new Error('wrong pinned browser artifact');
    }
    const loaded = await core.loadAgent('chatgpt-web', {
      loadModule: async () => provider
    });
    const observed = [];
    const legacy = [];
    const unobserve = loaded.agent.observeState(s => observed.push(s),
      'subject-identification');
    const unobserveLegacy = loaded.agent.observeState(s => legacy.push(s));
    if (observed[0].readiness !== 'unresolved') throw new Error('missing initial state');
    const host = provider.connectChatGPTSubjectHost({
      agent: loaded.agent, origin: 'https://chatgpt.com', conversationId: 'A'
    });
    if (!host.request({network_sequence: 1, method: 'GET',
      request_url: '/backend-api/gizmos/g-p-One'})) throw new Error('early request');
    host.response({network_sequence: 1, status: 200,
      body: {gizmo: {id: 'g-p-One', display: {name: 'One'}}}});
    if (!host.request({network_sequence: 2, method: 'GET',
      request_url: '/backend-api/conversations/A'})) throw new Error('conversation request');
    host.response({network_sequence: 2, status: 200,
      body: {conversation_id: 'A', title: 'Alpha', gizmo_id: 'g-p-One'}});
    if (observed.at(-1).project.name !== 'One' ||
        observed.at(-1).conversation.name !== 'Alpha') throw new Error('project discovery');
    host.begin('B');
    if (!host.request({network_sequence: 3, method: 'GET',
      request_url: '/backend-api/conversations/B'})) throw new Error('B request');
    host.response({network_sequence: 3, status: 200,
      body: {conversation_id: 'B', title: 'Bravo', gizmo_id: null}});
    if (observed.at(-1).project.status !== 'none') throw new Error('standalone state');
    if (legacy.length !== 1) throw new Error('legacy observer changed');
    const before = observed.length;
    unobserve(); unobserveLegacy();
    host.begin('C');
    if (observed.length !== before) throw new Error('listener retained');
    document.getElementById('status').textContent = 'AICC127_BROWSER_PASS';
  } catch (error) {
    document.getElementById('status').textContent =
      'AICC127_BROWSER_FAIL: ' + String(error);
  }
})();
</script></body></html>`;
    writeFileSync(join(root, 'index.html'), source);
    const bin = browserExecutable();
    const result = spawnSync(bin, [
      '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--disable-background-networking', '--no-first-run',
      '--user-data-dir=' + join(root, 'profile'),
      '--virtual-time-budget=12000', '--dump-dom',
      pathToFileURL(join(root, 'index.html')).href
    ], { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, (result.stderr || '').slice(-1800) ||
      result.error?.message);
    assert.match(result.stdout, /AICC127_BROWSER_PASS/);
    assert.doesNotMatch(result.stdout, /AICC127_BROWSER_FAIL/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
