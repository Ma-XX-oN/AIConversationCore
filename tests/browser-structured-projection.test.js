import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { buildBrowserBundle } from '../scripts/build-browser-bundle.mjs';

const bundleUrl = new URL('../dist/aiconversationcore.chatgpt.browser.js', import.meta.url);

function textRecord(id, role, text, extra = {}) {
  return {
    id,
    author: { role, name: null, metadata: {} },
    create_time: extra.create_time ?? null,
    update_time: null,
    content: { content_type: 'text', parts: [text] },
    metadata: {},
    recipient: 'all',
    channel: extra.channel ?? (role === 'assistant' ? 'final' : null),
    status: 'finished_successfully',
    end_turn: role === 'assistant'
  };
}

test('checked-in browser bundle is generated from current source modules', async () => {
  const checkedIn = await readFile(bundleUrl, 'utf8');
  assert.equal(checkedIn, await buildBrowserBundle());
});

test('browser bundle exposes the shared structural presentation contract', async () => {
  const bundle = await readFile(bundleUrl, 'utf8');
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(bundle, context, {
    filename: 'aiconversationcore.chatgpt.browser.js'
  });

  const core = context.AIConversationCore;
  assert.equal(typeof core?.adaptChatGPTRecords, 'function');
  assert.equal(typeof core?.renderCanonicalMarkdown, 'function');
  assert.equal(typeof core?.projectCanonicalConversation, 'function');

  const records = [
    {
      id: 'thought-1',
      author: { role: 'assistant', name: null, metadata: {} },
      create_time: 200,
      update_time: null,
      content: {
        content_type: 'thoughts',
        thoughts: [{ summary: 'Checking', content: 'Inspecting the request.' }]
      },
      metadata: {},
      recipient: 'all',
      channel: 'analysis',
      status: 'finished_successfully',
      end_turn: false
    },
    textRecord('assistant-final', 'assistant', 'Done.', { create_time: 201 })
  ];
  const events = core.adaptChatGPTRecords(records);
  const projection = core.projectCanonicalConversation(events);

  assert.equal(projection.schema_version, 2);
  assert.equal(projection.presentation.schema_version, 2);
  assert.equal(
    projection.presentation.split_policy,
    'presentation-tree'
  );
  assert.equal(projection.presentation.tree.schema_version, 2);
  assert.equal(projection.presentation.tree.kind, 'conversation');
  assert.ok(projection.presentation.structural_units.length > 0);
  assert.ok(projection.presentation.structural_units.some(unit =>
    unit.kind === 'reasoning_group' && unit.atomic === true));

  const assistantTurn = projection.presentation.tree.turns.find(turn =>
    turn.actor?.role === 'assistant');
  assert.ok(assistantTurn);
  assert.equal(assistantTurn.children[0].kind, 'reasoning_group');
  assert.equal(assistantTurn.children[0].thought_count, 1);
  assert.equal(assistantTurn.children[1].kind, 'markdown');
});
