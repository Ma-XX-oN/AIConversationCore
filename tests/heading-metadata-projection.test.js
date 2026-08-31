import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalMarkdown } from '../src/index.js';

function messageEvent(provider, sourceRecordId, projection = {}) {
  return {
    id: `${provider}:fixture`,
    provider,
    source_record_id: sourceRecordId,
    source_index: 1,
    kind: 'message',
    role: provider === 'chatgpt' ? 'user' : 'assistant',
    channel: null,
    visibility: 'visible',
    content_type: 'text',
    blocks: [{ type: 'text', text: 'Body' }],
    citations: [],
    resources: [],
    relationships: {},
    source: { provider, record_id: sourceRecordId, record_index: 1 },
    projection
  };
}

test('structured heading metadata composes timestamp, record number, and source turn id', () => {
  const event = messageEvent('chatgpt', 'chatgpt-message-id', {
    heading_metadata: {
      timestamp: '2026-08-31 15:00:00',
      record_number: 2,
      show_turn_id: true
    }
  });
  assert.match(
    renderCanonicalMarkdown([event]),
    /^## User \[2026-08-31 15:00:00\]: 2: <!-- turn_id=chatgpt-message-id -->$/m
  );
});

test('source turn id is omitted when the provider event has no source record id', () => {
  const event = messageEvent('codex', null, {
    heading_metadata: { show_turn_id: true }
  });
  const markdown = renderCanonicalMarkdown([event]);
  assert.match(markdown, /^## Codex$/m);
  assert.doesNotMatch(markdown, /turn_id=/);
});

test('legacy heading_suffix remains supported after structured metadata', () => {
  const event = messageEvent('claude', 'claude-uuid', {
    heading_metadata: { record_number: 7 },
    heading_suffix: ' LEGACY'
  });
  assert.match(renderCanonicalMarkdown([event]), /^## Claude 7: LEGACY$/m);
});
