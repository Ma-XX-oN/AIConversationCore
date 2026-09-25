import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';

import {
  adaptChatGPTRecords,
  renderCanonicalMarkdown,
  renderTurnHeader
} from '../src/index.js';
import { buildBrowserBundle } from '../scripts/build-browser-bundle.mjs';

function canonicalEvent(kind, sourceId, sourceIndex, text) {
  return {
    id: `chatgpt:${sourceId}`,
    provider: 'chatgpt',
    source_record_id: sourceId,
    source_index: sourceIndex,
    kind,
    role: 'assistant',
    channel: kind === 'message' ? 'final' : null,
    visibility: 'visible',
    content_type: 'text',
    blocks: [{ type: 'text', text }],
    citations: [],
    resources: [],
    relationships: {},
    source: {
      provider: 'chatgpt',
      record_id: sourceId,
      record_index: sourceIndex,
      turn_id: sourceId
    },
    projection: {}
  };
}

function chatgptRecord(id, role, createTime, text, endTurn = false) {
  return {
    id,
    author: { role, name: null, metadata: {} },
    create_time: createTime,
    update_time: null,
    content: { content_type: 'text', parts: [text] },
    status: 'finished_successfully',
    end_turn: endTurn,
    weight: 1,
    metadata: { is_visually_hidden_from_conversation: false },
    recipient: 'all',
    channel: role === 'assistant' ? 'final' : null
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('composite ChatGPT response heading belongs to final Assistant source', () => {
  const commentary = canonicalEvent('commentary', 'commentary-id', 0, 'Working');
  const answer = canonicalEvent('message', 'answer-id', 1, 'Answer');
  const markdown = renderCanonicalMarkdown([commentary, answer], {
    heading: {
      recordNumber: true,
      turnId: true,
      debugProvenance: true
    }
  });

  assert.match(
    markdown,
    /^## ChatGPT 2: answer-id <!-- record_id=answer-id record_index=1 -->$/m
  );
  assert.match(
    markdown,
    /^### ChatGPT Commentary 1: commentary-id <!-- record_id=commentary-id record_index=0 -->$/m
  );
  assert.doesNotMatch(markdown, /^## ChatGPT 1: commentary-id/m);
});

test('turn-header projection renders the provider Turn ID without a field label', () => {
  const header = renderTurnHeader({
    id: 'turn:user-id',
    role: 'user',
    source: {
      provider: 'chatgpt',
      records: [{ turn_id: 'user-id' }]
    }
  }, {
    showTurnId: true
  });

  assert.equal(header, '## User user-id');
  assert.doesNotMatch(header, /turn_id=/);
});

test('classic browser Markdown matches ESM Core-owned heading metadata', async () => {
  const records = [
    chatgptRecord('user-id', 'user', 1789318790, 'Question'),
    chatgptRecord('assistant-id', 'assistant', 1789318805, 'Answer', true)
  ];
  const options = {
    heading: {
      timestamp: true,
      recordNumber: true,
      turnId: true,
      debugProvenance: true,
      timeZone: 'UTC'
    }
  };

  const expected = renderCanonicalMarkdown(adaptChatGPTRecords(records), options);
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });
  const browserEvents = context.AIConversationCore.adaptChatGPTRecords(plain(records));
  const actual = context.AIConversationCore.renderCanonicalMarkdown(
    browserEvents,
    plain(options)
  );

  assert.equal(actual, expected);
  assert.match(expected, /^## User \[2026-09-13 16:59:50\]: 1: user-id/m);
  assert.match(expected, /^## ChatGPT \[2026-09-13 17:00:05\]: 2: assistant-id/m);
  assert.doesNotMatch(expected, /turn_id=/);
  assert.match(expected, /record_id=user-id record_index=0/);
  assert.match(expected, /record_id=assistant-id record_index=1/);
});
