import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalMarkdown } from '../src/index.js';

function messageEvent(provider, sourceRecordId, projection = {}, source = {}) {
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
    source: {
      provider,
      record_id: sourceRecordId,
      record_index: 1,
      ...source
    },
    projection
  };
}

test('Core-derived heading metadata composes timestamp, record number, and source turn id', () => {
  const event = messageEvent('chatgpt', 'chatgpt-message-id', {}, {
    timestamp: '2026-08-31T15:00:00Z',
    turn_id: 'chatgpt-message-id'
  });
  assert.match(
    renderCanonicalMarkdown([event], {
      heading: {
        timestamp: true,
        recordNumber: true,
        turnId: true,
        timeZone: 'UTC'
      }
    }),
    /^## User \[2026-08-31 15:00:00\]: 2: chatgpt-message-id$/m
  );
});

test('Core-derived timestamp supports fixed-offset presentation timezones', () => {
  const event = messageEvent('chatgpt', 'fixed-offset-message', {}, {
    timestamp: '2026-08-31T15:00:00Z'
  });
  assert.match(
    renderCanonicalMarkdown([event], {
      heading: { timestamp: true, timeZone: '-04:00' }
    }),
    /^## User \[2026-08-31 11:00:00\]:$/m
  );
  assert.match(
    renderCanonicalMarkdown([event], {
      heading: { timestamp: true, timeZone: '+05:30' }
    }),
    /^## User \[2026-08-31 20:30:00\]:$/m
  );
});

test('caller semantic heading metadata cannot override Core source provenance', () => {
  const event = messageEvent('chatgpt', 'activity-record-id', {
    heading_metadata: {
      timestamp: 'WRONG',
      record_number: 999,
      turn_id: 'caller-turn-id',
      debug: { record_id: 'caller-record', record_index: 999 }
    }
  }, {
    turn_id: 'source-turn-id'
  });
  const markdown = renderCanonicalMarkdown([event], {
    heading: { recordNumber: true, turnId: true, debugProvenance: true }
  });
  assert.match(
    markdown,
    /^## User 2: source-turn-id <!-- record_id=activity-record-id record_index=1 -->$/m
  );
  assert.doesNotMatch(markdown, /caller-turn-id|caller-record|999/);
});

test('Core-derived timestamp and record number preserve consumer ANSI colours', () => {
  const event = messageEvent('chatgpt', 'chatgpt-message-id', {
    colors: {
      user: '\u001b[33m',
      timestamp: '\u001b[36m',
      record_number: '\u001b[2m',
      reset: '\u001b[0m'
    }
  }, {
    timestamp: '2026-08-31T15:00:00Z'
  });
  const markdown = renderCanonicalMarkdown([event], {
    heading: { timestamp: true, recordNumber: true, timeZone: 'UTC' }
  });
  assert.match(
    markdown,
    /^\u001b\[33m## User\u001b\[0m \u001b\[36m\[2026-08-31 15:00:00\]:\u001b\[0m \u001b\[2m2:\u001b\[0m$/m
  );
});

test('turn id is omitted when Core source provenance has no suitable turn id', () => {
  const event = messageEvent('codex', null, {}, { turn_id: null });
  const markdown = renderCanonicalMarkdown([event], { heading: { turnId: true } });
  assert.match(markdown, /^## Codex$/m);
  assert.doesNotMatch(markdown, /turn_id=/);
});

test('generic heading_suffix remains supported after Core-derived metadata', () => {
  const event = messageEvent('claude', 'claude-uuid', {
    heading_suffix: ' LEGACY'
  }, {
    turn_id: 'claude-uuid'
  });
  assert.match(
    renderCanonicalMarkdown([event], { heading: { recordNumber: true } }),
    /^## Claude 2: LEGACY$/m
  );
});
