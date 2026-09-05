import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRESENTATION_SCHEMA_VERSION,
  RENDER_FORMATS,
  buildCanonicalPresentation,
  renderConversation
} from '../src/index.js';

/**
 * Creates one synthetic ChatGPT reasoning event for renderer-contract tests.
 *
 * @param {number} index - One-based synthetic reasoning-record number.
 * @returns {Object<string, *>} Canonical reasoning-summary event with stable source provenance.
 */
function reasoningEvent(index) {
  return {
    id: `event-r${index}`,
    provider: 'chatgpt',
    source_record_id: `record-r${index}`,
    source_index: index - 1,
    kind: 'reasoning_summary',
    role: 'assistant',
    visibility: 'visible',
    blocks: [{
      id: `block-r${index}`,
      type: 'reasoning_summary',
      summary: `Thought ${index}`,
      content: `Reasoning body ${index}`
    }]
  };
}

/**
 * Creates one synthetic final ChatGPT Assistant message for renderer-contract tests.
 *
 * @returns {Object<string, *>} Canonical final message event terminating the synthetic Assistant response.
 */
function finalMessage() {
  return {
    id: 'event-final',
    provider: 'chatgpt',
    source_record_id: 'record-final',
    source_index: 3,
    kind: 'message',
    role: 'assistant',
    visibility: 'visible',
    blocks: [{ id: 'block-final', type: 'text', text: 'Final answer.' }]
  };
}

/**
 * Creates the canonical grouped-reasoning fixture used by high-level render tests.
 *
 * @returns {Array<Object<string, *>>} Three reasoning events followed by one final Assistant message.
 */
function groupedReasoningEvents() {
  return [reasoningEvent(1), reasoningEvent(2), reasoningEvent(3), finalMessage()];
}

test('presentation model exposes grouped reasoning as one atomic structural unit', () => {
  const presentation = buildCanonicalPresentation(groupedReasoningEvents());
  assert.equal(presentation.schema_version, PRESENTATION_SCHEMA_VERSION);
  assert.equal(presentation.units.length, 1);
  const response = presentation.units[0];
  assert.equal(response.kind, 'assistant_response');
  assert.equal(response.children.length, 2);
  const reasoning = response.children[0];
  assert.equal(reasoning.kind, 'reasoning_group');
  assert.equal(reasoning.boundary, 'atomic');
  assert.equal(reasoning.label, 'Having 3 thoughts');
  assert.deepEqual(
    reasoning.sources.map(source => source.record_id),
    ['record-r1', 'record-r2', 'record-r3']
  );
  assert.equal(response.children[1].kind, 'message');
});

test('Markdown and HTML high-level rendering share grouped-reasoning semantics', () => {
  const events = groupedReasoningEvents();
  const markdown = renderConversation(events, { format: RENDER_FORMATS.MARKDOWN });
  const html = renderConversation(events, { format: RENDER_FORMATS.HTML });

  assert.match(markdown.content, /<details><summary>Having 3 thoughts<\/summary>/);
  assert.match(html.markdown, /<details><summary>Having 3 thoughts<\/summary>/);
  assert.match(html.content, /<details><summary>Having 3 thoughts<\/summary>/);
  assert.match(html.content, /Reasoning body 1/);
  assert.match(html.content, /Reasoning body 2/);
  assert.match(html.content, /Reasoning body 3/);
  assert.deepEqual(html.presentation, markdown.presentation);
});

test('HTML rendering applies per-call visual theme overrides without changing structural semantics', () => {
  const rendered = renderConversation(groupedReasoningEvents(), {
    format: RENDER_FORMATS.HTML,
    theme: {
      css: {
        font_family: 'Example Sans',
        font_size: '19px',
        background: '#101010',
        foreground: '#eeeeee',
        reasoning: '#cccccc'
      }
    }
  });

  assert.match(rendered.stylesheet, /font-family:Example Sans/);
  assert.match(rendered.stylesheet, /font-size:19px/);
  assert.match(rendered.stylesheet, /background:#101010/);
  assert.match(rendered.stylesheet, /color:#eeeeee/);
  assert.match(rendered.stylesheet, /color:#cccccc/);
  assert.equal(rendered.presentation.units[0].children[0].boundary, 'atomic');
});

test('high-level display options are format-independent', () => {
  const events = groupedReasoningEvents();
  const markdown = renderConversation(events, {
    format: RENDER_FORMATS.MARKDOWN,
    display: { debug_provenance: true, show_turn_id: true }
  });
  const html = renderConversation(events, {
    format: RENDER_FORMATS.HTML,
    display: { debug_provenance: true, show_turn_id: true }
  });

  assert.match(markdown.content, /record_id=record-r1/);
  assert.match(html.markdown, /record_id=record-r1/);
  assert.deepEqual(html.presentation, markdown.presentation);
});
