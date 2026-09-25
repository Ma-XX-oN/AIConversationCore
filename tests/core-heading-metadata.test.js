import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptChatGPTRecords,
  buildCanonicalPresentation,
  renderCanonicalHtml,
  renderCanonicalMarkdown
} from '../src/index.js';

/**
 * Builds one minimal ChatGPT message record for heading-metadata projection tests.
 *
 * @param {string} id - Native ChatGPT source message ID.
 * @param {string} role - Source author role.
 * @param {number} createTime - Source Unix timestamp in seconds.
 * @param {string} text - Visible message text.
 * @param {string|null} channel - Optional ChatGPT channel.
 * @param {boolean} endTurn - Whether the source message completes the turn.
 * @returns {Object<string, *>} Minimal provider record accepted by the ChatGPT adapter.
 */
function record(id, role, createTime, text, channel = null, endTurn = false) {
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
    channel
  };
}

/** Core-owned visibility policy used by all heading renderers in these tests. */
const HEADING_OPTIONS = Object.freeze({
  heading: Object.freeze({
    timestamp: true,
    recordNumber: true,
    turnId: true,
    debugProvenance: true,
    timeZone: 'UTC'
  })
});

test('Core derives source heading metadata and ignores caller-supplied semantic values', () => {
  const events = adaptChatGPTRecords([
    record('user-1', 'user', 1789318790, 'Question'),
    record('commentary-1', 'assistant', 1789318800, 'Working.', 'commentary'),
    record('final-1', 'assistant', 1789318805, 'Answer', 'final', true)
  ]);

  events[0].projection = {
    heading_metadata: {
      timestamp: 'WRONG',
      record_number: 999,
      turn_id: 'caller-injected-id',
      show_turn_id: true
    },
    debug_provenance: true
  };

  const markdown = renderCanonicalMarkdown(events, HEADING_OPTIONS);

  assert.match(
    markdown,
    /^## User \[2026-09-13 16:59:50\]: 1: user-1 <!-- record_id=user-1 record_index=0 -->$/m
  );
  assert.match(
    markdown,
    /^## ChatGPT \[2026-09-13 17:00:05\]: 3: final-1 <!-- record_id=final-1 record_index=2 -->$/m
  );
  assert.match(
    markdown,
    /^### ChatGPT Commentary \[2026-09-13 17:00:00\]: 2: commentary-1 <!-- record_id=commentary-1 record_index=1 -->$/m
  );
  assert.doesNotMatch(markdown, /WRONG|999|caller-injected-id/);
  assert.doesNotMatch(markdown, /<!-- turn_id=/);
});

test('Core presentation tree exposes the same final-response heading metadata used for virtualization', () => {
  const events = adaptChatGPTRecords([
    record('user-1', 'user', 1789318790, 'Question'),
    record('commentary-1', 'assistant', 1789318800, 'Working.', 'commentary'),
    record('final-1', 'assistant', 1789318805, 'Answer', 'final', true)
  ]);
  const presentation = buildCanonicalPresentation(events, HEADING_OPTIONS);

  assert.deepEqual(presentation.turns[0].heading_metadata, {
    timestamp: '2026-09-13 16:59:50',
    record_number: 1,
    turn_id: 'user-1',
    debug: { record_id: 'user-1', record_index: 0 }
  });
  assert.deepEqual(presentation.turns[1].heading_metadata, {
    timestamp: '2026-09-13 17:00:05',
    record_number: 3,
    turn_id: 'final-1',
    debug: { record_id: 'final-1', record_index: 2 }
  });

  const commentary = presentation.turns[1].children.find(child => child.kind === 'commentary');
  assert.ok(commentary);
  assert.deepEqual(commentary.heading_metadata, {
    timestamp: '2026-09-13 17:00:00',
    record_number: 2,
    turn_id: 'commentary-1',
    debug: { record_id: 'commentary-1', record_index: 1 }
  });
});

test('canonical HTML renders Core-owned heading metadata with semantic classes', () => {
  const events = adaptChatGPTRecords([
    record('user-1', 'user', 1789318790, 'Question'),
    record('final-1', 'assistant', 1789318805, 'Answer', 'final', true)
  ]);
  const html = renderCanonicalHtml(events, HEADING_OPTIONS);

  assert.match(html, /<h2>.*transcript-user-heading.*User.*transcript-timestamp.*2026-09-13 16:59:50.*transcript-record-number.*1:.*transcript-turn-id.*user-1.*<\/h2>/s);
  assert.match(html, /<h2>.*transcript-assistant-heading.*ChatGPT.*transcript-timestamp.*2026-09-13 17:00:05.*transcript-record-number.*2:.*transcript-turn-id.*final-1.*<\/h2>/s);
  assert.match(html, /<!-- record_id=user-1 record_index=0 -->/);
  assert.match(html, /<!-- record_id=final-1 record_index=1 -->/);
});

test('record-number width is presentation policy while Core retains numeric source ownership', () => {
  const events = adaptChatGPTRecords([
    record('user-1', 'user', 1789318790, 'Question'),
    record('final-1', 'assistant', 1789318805, 'Answer', 'final', true)
  ]);
  const options = {
    heading: {
      recordNumber: true,
      recordNumberWidth: 2
    }
  };

  const markdown = renderCanonicalMarkdown(events, options);
  assert.match(markdown, /^## User  1:$/m);
  assert.match(markdown, /^## ChatGPT  2:$/m);

  const html = renderCanonicalHtml(events, options);
  assert.match(html, /transcript-record-number[^>]*> 1:<\/span>/);
  assert.match(html, /transcript-record-number[^>]*> 2:<\/span>/);

  const presentation = buildCanonicalPresentation(events, options);
  assert.equal(presentation.turns[0].heading_metadata.record_number, 1);
  assert.equal(presentation.turns[1].heading_metadata.record_number, 2);
  assert.equal(presentation.turns[0].heading_metadata.record_number_width, 2);
  assert.equal(presentation.turns[1].heading_metadata.record_number_width, 2);
});

test('record numbers remain unpadded when no width policy is supplied', () => {
  const events = adaptChatGPTRecords([
    record('user-1', 'user', 1789318790, 'Question'),
    record('final-1', 'assistant', 1789318805, 'Answer', 'final', true)
  ]);

  const markdown = renderCanonicalMarkdown(events, {
    heading: { recordNumber: true }
  });
  assert.match(markdown, /^## User 1:$/m);
  assert.match(markdown, /^## ChatGPT 2:$/m);
  assert.doesNotMatch(markdown, /^## User  1:$/m);
});
