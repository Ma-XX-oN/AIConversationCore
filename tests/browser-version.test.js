import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { buildBrowserBundle } from '../scripts/build-browser-bundle.mjs';

const packageUrl = new URL('../package.json', import.meta.url);

test('browser version API matches the authoritative package version', async () => {
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });
  const packageMetadata = JSON.parse(await readFile(packageUrl, 'utf8'));

  assert.equal(typeof context.AIConversationCore?.getVersion, 'function');
  assert.equal(context.AIConversationCore.getVersion(), packageMetadata.version);
});
