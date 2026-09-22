import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptChatGPTRecords,
  renderCanonicalHtml,
  renderCanonicalMarkdown
} from '../src/index.js';

function record(id, role, createTime, text, endTurn = false) {
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

const OPTIONS = Object.freeze({
  heading: Object.freeze({
    timestamp: true,
    recordNumber: true,
    turnId: true,
    timeZone: 'UTC'
  })
});

test('visible Turn ID is rendered as the bare provider/source ID', () => {
  const events = adaptChatGPTRecords([
    record('user-id', 'user', 1789318790, 'Question'),
    record('assistant-id', 'assistant', 1789318805, 'Answer', true)
  ]);

  const markdown = renderCanonicalMarkdown(events, OPTIONS);
  assert.match(markdown, /^## User \[2026-09-13 16:59:50\]: 1: user-id$/m);
  assert.match(markdown, /^## ChatGPT \[2026-09-13 17:00:05\]: 2: assistant-id$/m);
  assert.doesNotMatch(markdown, /turn_id=/);

  const html = renderCanonicalHtml(events, OPTIONS);
  assert.match(html, /transcript-turn-id[^>]*>user-id<\/span>/);
  assert.match(html, /transcript-turn-id[^>]*>assistant-id<\/span>/);
  assert.doesNotMatch(html, />turn_id=/);
});
