import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { adaptChatGPTRecords, renderCanonicalMarkdown } from '../src/index.js';
import { buildBrowserBundle } from '../scripts/build-browser-bundle.mjs';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const bundleUrl = new URL('../dist/aiconversationcore.chatgpt.browser.js', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('committed browser artifact exactly matches the deterministic generator', async () => {
  assert.equal(await readFile(bundleUrl, 'utf8'), await buildBrowserBundle());
});

test('generated classic browser bundle exposes the required DownloadConversation API', async () => {
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });

  assert.equal(typeof context.AIConversationCore, 'object');
  assert.equal(typeof context.AIConversationCore.adaptChatGPTRecords, 'function');
  assert.equal(typeof context.AIConversationCore.renderCanonicalMarkdown, 'function');
});

test('generated browser bundle matches ESM ChatGPT normalization and Markdown rendering', async () => {
  const records = await loadJsonl(fixtureUrl);
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });

  const esmEvents = adaptChatGPTRecords(records);
  const browserEvents = context.AIConversationCore.adaptChatGPTRecords(plain(records));
  assert.deepEqual(plain(browserEvents), plain(esmEvents));
  assert.equal(
    context.AIConversationCore.renderCanonicalMarkdown(browserEvents),
    renderCanonicalMarkdown(esmEvents)
  );
});
