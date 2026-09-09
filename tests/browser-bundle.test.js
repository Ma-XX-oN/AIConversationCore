import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import {
  adaptChatGPTRecords,
  renderCanonicalHtml,
  renderCanonicalHtmlUnits,
  renderCanonicalMarkdown
} from '../src/index.js';
import { buildBrowserBundle } from '../scripts/build-browser-bundle.mjs';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const bundleUrl = new URL('../dist/aiconversationcore.chatgpt.browser.js', import.meta.url);

const NORMALIZED_USER_CONTEXT_EVENT = Object.freeze({
  id: 'event:user-context:browser',
  provider: 'codex',
  kind: 'message',
  role: 'user',
  channel: 'final',
  content_type: 'text',
  visibility: 'visible',
  source_record_id: 'record:user-context:browser',
  source_index: 0,
  blocks: Object.freeze([
    Object.freeze({
      type: 'user_context',
      summary: '# Context from my IDE setup:',
      text: '## Active file: sessions/example.jsonl\n\n' +
        '## Open tabs:\n- example.jsonl: sessions/example.jsonl'
    }),
    Object.freeze({
      type: 'text',
      text: "I'm doing some testing. What time is it in Paris?"
    })
  ]),
  citations: Object.freeze([]),
  resources: Object.freeze([])
});

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
  assert.equal(typeof context.AIConversationCore.renderCanonicalHtml, 'function');
  assert.equal(typeof context.AIConversationCore.renderCanonicalHtmlUnits, 'function');
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

test('generated browser bundle matches ESM canonical HTML for the same normalized User-context fixture', async () => {
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });

  const events = [NORMALIZED_USER_CONTEXT_EVENT];
  const expected = renderCanonicalHtml(events);
  const actual = context.AIConversationCore.renderCanonicalHtml(plain(events));
  const units = context.AIConversationCore.renderCanonicalHtmlUnits(plain(events));
  assert.equal(actual, expected);
  assert.equal(units.map(unit => unit.html).join(''), expected);
  assert.equal(units.length, 1);
  assert.equal(units[0].atomic, true);
  assert.equal(units[0].source[0].record_id, 'record:user-context:browser');
  assert.match(actual, /<blockquote class="user-context">/);
  assert.match(actual, /<summary># Context from my IDE setup:<\/summary>/);
  assert.equal(actual.includes('## My request for Codex:'), false);
});
