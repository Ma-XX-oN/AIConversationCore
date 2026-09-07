import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import {
  adaptChatGPTRecords,
  renderCanonicalHtml,
  renderCanonicalMarkdown,
  renderConversation
} from '../src/index.js';
import { buildBrowserBundle } from '../scripts/build-browser-bundle.mjs';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const bundleUrl = new URL('../dist/aiconversationcore.chatgpt.browser.js', import.meta.url);

/**
 * Loads newline-delimited JSON records from one fixture URL.
 *
 * @param {URL} url - Fixture URL to load.
 * @returns {Promise<Array<Object<string, *>>>} Promise resolving to parsed JSONL records.
 */
async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

/**
 * Converts a cross-realm value into a plain JSON-compatible object graph.
 *
 * @param {*} value - Value produced inside the browser-bundle VM context.
 * @returns {*} Plain JSON-compatible clone.
 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('committed browser artifact exactly matches the deterministic generator', async () => {
  assert.equal(await readFile(bundleUrl, 'utf8'), await buildBrowserBundle());
});

test('generated classic browser bundle exposes the complete ChatGPT render API', async () => {
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });

  const api = context.AIConversationCore;
  assert.equal(typeof api, 'object');
  for (const name of [
    'adaptChatGPTRecords',
    'renderCanonicalMarkdown',
    'buildCanonicalPresentation',
    'markdownToHtml',
    'renderCanonicalHtml',
    'renderCanonicalStylesheet',
    'renderConversation',
    'configureProjectionTheme',
    'getDefaultProjectionTheme',
    'resetProjectionTheme',
    'resolveProjectionTheme'
  ]) {
    assert.equal(typeof api[name], 'function', `${name} should be exposed`);
  }
  assert.equal(typeof api.STYLE_ROLES, 'object');
  assert.equal(typeof api.RENDER_FORMATS, 'object');
  assert.equal(typeof api.RENDER_INPUT_KINDS, 'object');
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

test('generated browser bundle matches ESM structural and HTML rendering', async () => {
  const records = await loadJsonl(fixtureUrl);
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });

  const events = adaptChatGPTRecords(records);
  const browserEvents = context.AIConversationCore.adaptChatGPTRecords(plain(records));
  const esmHtml = renderCanonicalHtml(events, { document: true });
  const browserHtml = context.AIConversationCore.renderCanonicalHtml(browserEvents, { document: true });
  assert.deepEqual(plain(browserHtml), plain(esmHtml));

  const options = {
    format: 'html',
    display: { debug_provenance: true, show_turn_id: true },
    theme: { css: { font_family: 'Browser Test Sans', font_size: '18px' } }
  };
  assert.deepEqual(
    plain(context.AIConversationCore.renderConversation(browserEvents, plain(options))),
    plain(renderConversation(events, options))
  );
});

test('ChatGPT browser artifact rejects unsupported provider-record adaptation explicitly', async () => {
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });

  assert.throws(
    () => context.AIConversationCore.renderConversation([], {
      input_kind: 'provider_records',
      provider: 'claude'
    }),
    /ChatGPT provider records only/
  );
});
