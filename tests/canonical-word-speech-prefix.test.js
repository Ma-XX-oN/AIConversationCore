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

function wordsFor(text) {
  const [unit] = core.renderCanonicalHtmlUnits([
    assistantEvent(textBlock('block:list', text))
  ]);
  return { unit, words: unit.speech_words };
}

test('ordered-list structural speech prefixes precede the first canonical word of each item', () => {
  const { unit, words } = wordsFor('3. First item\n4. Second item');
  const first = words.find(word => word.text === 'First');
  const second = words.find(word => word.text === 'Second');

  assert.ok(first && second, 'Expected canonical list-item words.');
  assert.equal(first.speech_prefix_before, '3. ');
  assert.equal(second.speech_prefix_before, '4. ');
  assert.match(unit.html, /data-list-ordinal="3"/u);
  assert.match(unit.html, /data-list-ordinal="4"/u);
  assert.equal(
    unit.html.includes('id="word-3">3</span>'),
    false,
    'A structural list ordinal must not impersonate a canonical transcript word.'
  );
});

test('nested ordered lists carry independent Core-owned structural speech prefixes', () => {
  const { words } = wordsFor('3. Outer\n   7. Nested\n4. Next');
  const outer = words.find(word => word.text === 'Outer');
  const nested = words.find(word => word.text === 'Nested');
  const next = words.find(word => word.text === 'Next');

  assert.ok(outer && nested && next, 'Expected nested canonical list words.');
  assert.equal(outer.speech_prefix_before, '3. ');
  assert.equal(nested.speech_prefix_before, '7. ');
  assert.equal(next.speech_prefix_before, '4. ');
});

test('unordered lists and ordinary words do not invent structural speech prefixes', () => {
  const { words } = wordsFor('- Alpha\n- Beta\n\nPlain text');
  assert.ok(words.length > 0);
  for (const word of words) {
    assert.equal(word.speech_prefix_before, '');
  }
});

test('word lookup preserves the structural speech prefix on the exact canonical handle', () => {
  const events = [assistantEvent(textBlock('block:list', '9. Exact handle'))];
  const [unit] = core.renderCanonicalHtmlUnits(events);
  const exact = unit.speech_words.find(word => word.text === 'Exact');
  assert.ok(exact);
  assert.equal(exact.speech_prefix_before, '9. ');

  const located = core.locateCanonicalWord(events, exact.id);
  assert.ok(located);
  assert.deepEqual(located.word, exact);
});

// Structural speech prefixes are Core semantics but are deliberately not
// transcript word identities; consumers may not manufacture word IDs for them.
