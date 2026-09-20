import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderCanonicalHtml,
  renderCanonicalMarkdown
} from '../src/index.js';

const NORMALIZED_ORDERED_LIST_EVENT = Object.freeze({
  id: 'event:ordered-list:1',
  provider: 'codex',
  kind: 'message',
  role: 'assistant',
  channel: 'final',
  content_type: 'text',
  visibility: 'visible',
  source_record_id: 'record:ordered-list:1',
  source_index: 0,
  blocks: Object.freeze([
    Object.freeze({
      type: 'text',
      text: '3. First\n' +
        '4. Second\n' +
        '   7. Nested seven\n' +
        '   8. Nested eight\n' +
        '5. Third\n\n' +
        '- Bullet one\n' +
        '- Bullet two'
    })
  ]),
  citations: Object.freeze([]),
  resources: Object.freeze([])
});

function normalizedFixture() {
  return [NORMALIZED_ORDERED_LIST_EVENT];
}

test('the same normalized ordered-list fixture preserves ordinals in Markdown and HTML', () => {
  const events = normalizedFixture();

  const markdown = renderCanonicalMarkdown(events);
  assert.ok(markdown.includes('3. First'));
  assert.ok(markdown.includes('4. Second'));
  assert.ok(markdown.includes('7. Nested seven'));
  assert.ok(markdown.includes('8. Nested eight'));
  assert.ok(markdown.includes('5. Third'));
  assert.ok(markdown.includes('- Bullet one'));

  const html = renderCanonicalHtml(events);
  assert.match(html, /<ol start="3">/);
  assert.match(html, /<li data-list-ordinal="3" id="word-\d+">\s*<span id="word-\d+">First<\/span>/);
  assert.match(html, /<li data-list-ordinal="4" id="word-\d+">\s*<span id="word-\d+">Second<\/span>/);
  assert.match(html, /<ol start="7">/);
  assert.match(html, /<li data-list-ordinal="7" id="word-\d+">\s*<span id="word-\d+">Nested<\/span> <span id="word-\d+">seven<\/span>/);
  assert.match(html, /<li data-list-ordinal="8" id="word-\d+">\s*<span id="word-\d+">Nested<\/span> <span id="word-\d+">eight<\/span>/);
  assert.match(html, /<li data-list-ordinal="5" id="word-\d+">\s*<span id="word-\d+">Third<\/span>/);
  assert.equal((html.match(/data-list-ordinal=/g) ?? []).length, 5);
  assert.match(html, /<ul>\s*<li><span id="word-\d+">Bullet<\/span> <span id="word-\d+">one<\/span>/);
  assert.match(html, /<li><span id="word-\d+">Bullet<\/span> <span id="word-\d+">two<\/span><\/li>/);
});

test('a normalized single-item ordered list exposes ordinal 1 without affecting unordered lists', () => {
  const event = {
    ...NORMALIZED_ORDERED_LIST_EVENT,
    id: 'event:ordered-list:single',
    source_record_id: 'record:ordered-list:single',
    blocks: [{ type: 'text', text: '1. Item\n\n- Bullet' }]
  };
  const events = [event];

  const markdown = renderCanonicalMarkdown(events);
  assert.ok(markdown.includes('1. Item'));
  assert.ok(markdown.includes('- Bullet'));

  const html = renderCanonicalHtml(events);
  assert.match(html, /<ol>\s*<li data-list-ordinal="1" id="word-1">\s*<span id="word-2">Item<\/span>/);
  assert.equal((html.match(/data-list-ordinal=/g) ?? []).length, 1);
  assert.match(html, /<ul>\s*<li><span id="word-3">Bullet<\/span><\/li>/);
});
