import assert from 'node:assert/strict';
import test from 'node:test';

import * as core from '../src/index.js';

function textBlock(id, text) {
  return {
    id,
    type: 'text',
    text,
    source: {
      provider: 'codex',
      record_id: 'record:0',
      record_index: 0
    }
  };
}

function assistantEvent(block) {
  return {
    id: 'event:assistant',
    provider: 'codex',
    kind: 'message',
    role: 'assistant',
    channel: 'final',
    content_type: 'text',
    visibility: 'visible',
    source_record_id: 'record:0',
    source_index: 0,
    blocks: [block],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source: {
      provider: 'codex',
      record_id: 'record:0',
      record_index: 0
    }
  };
}

function project(text) {
  const events = [assistantEvent(textBlock('block:list', text))];
  const [unit] = core.renderCanonicalHtmlUnits(events);
  return { events, unit, words: unit.speech_words };
}

function listItemWordId(html, ordinal) {
  const pattern = new RegExp(
    `<li(?=[^>]*\\bdata-list-ordinal="${ordinal}")(?=[^>]*\\bid="word-([0-9]+)")[^>]*>`,
    'u'
  );
  const match = html.match(pattern);
  return match ? Number.parseInt(match[1], 10) : null;
}

test('ordered-list ordinals are canonical words whose DOM element is the list item', () => {
  const { unit, words } = project('3. First item\n4. Second item');

  assert.deepEqual(
    words.map(word => word.text),
    ['3.', 'First', 'item', '4.', 'Second', 'item']
  );
  assert.deepEqual(words.map(word => word.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(listItemWordId(unit.html, 3), 1);
  assert.equal(listItemWordId(unit.html, 4), 4);
  assert.match(unit.html, /<span id="word-2">First<\/span>/u);
  assert.match(unit.html, /<span id="word-5">Second<\/span>/u);
});

test('non-one and nested ordered-list ordinals own their exact nested list-item IDs', () => {
  const { unit, words } = project('3. Outer\n   7. Nested\n4. Next');
  const byText = new Map(words.map(word => [word.text, word]));

  const outer = byText.get('3.');
  const nested = byText.get('7.');
  const next = byText.get('4.');
  assert.ok(outer && nested && next, 'Expected canonical ordinal words.');
  assert.equal(listItemWordId(unit.html, 3), outer.id);
  assert.equal(listItemWordId(unit.html, 7), nested.id);
  assert.equal(listItemWordId(unit.html, 4), next.id);

  const nestedLi = unit.html.match(
    new RegExp(`<li(?=[^>]*data-list-ordinal="7")(?=[^>]*id="word-${nested.id}")[^>]*>`, 'u')
  );
  assert.ok(nestedLi, 'Nested ordinal ID was not placed on its own nested <li>.');
});

test('ordinal lookup returns the same canonical word and list-item DOM identity', () => {
  const { events, unit, words } = project('9. Exact handle');
  const ordinal = words.find(word => word.text === '9.');
  assert.ok(ordinal, 'Expected canonical ordinal word.');
  assert.equal(listItemWordId(unit.html, 9), ordinal.id);

  const located = core.locateCanonicalWord(events, ordinal.id);
  assert.ok(located, 'Core lookup did not resolve the ordinal word ID.');
  assert.deepEqual(located.word, ordinal);
  assert.equal(listItemWordId(located.unit.html, 9), ordinal.id);
});

test('unordered lists do not manufacture structural ordinal word identities', () => {
  const { unit, words } = project('- Alpha\n- Beta');
  assert.deepEqual(words.map(word => word.text), ['Alpha', 'Beta']);
  assert.doesNotMatch(unit.html, /<li[^>]*\bid="word-[0-9]+"/u);
});
