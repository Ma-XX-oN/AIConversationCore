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

function assistantEvent(blocks) {
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
    blocks,
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

function wordsForBlock(unit, blockId) {
  return unit.speech_words.filter(
    word => word.provenance?.block_id === blockId
  );
}

test('canonical words preserve exact spaces and newlines before each word', () => {
  const [unit] = core.renderCanonicalHtmlUnits([
    assistantEvent([textBlock('block:spacing', 'alpha  beta\ngamma')])
  ]);
  const words = wordsForBlock(unit, 'block:spacing');
  assert.deepEqual(
    words.map(word => [word.text, word.separator_before]),
    [
      ['alpha', ''],
      ['beta', '  '],
      ['gamma', '\n']
    ]
  );
});

test('canonical word separators reset at each canonical block', () => {
  const [unit] = core.renderCanonicalHtmlUnits([
    assistantEvent([
      textBlock('block:first', 'first'),
      textBlock('block:second', 'second')
    ])
  ]);
  const first = wordsForBlock(unit, 'block:first');
  const second = wordsForBlock(unit, 'block:second');
  assert.equal(first[0]?.separator_before, '');
  assert.equal(second[0]?.separator_before, '');
});

test('inline formatting keeps one word identity and its exact separator', () => {
  const [unit] = core.renderCanonicalHtmlUnits([
    assistantEvent([textBlock('block:inline', 'prefix  turn_id**s** suffix')])
  ]);
  const words = wordsForBlock(unit, 'block:inline');
  const splitMarkup = words.find(word => word.text === 'turn_ids');
  assert.ok(splitMarkup, 'Expected one canonical word across inline markup.');
  assert.equal(splitMarkup.separator_before, '  ');
  assert.equal(
    unit.html.includes(`data-word-id="${splitMarkup.id}"`),
    false,
    'Separator metadata must not change the one-element word DOM contract.'
  );
});

test('fenced code preserves line separators between canonical word IDs', () => {
  const [unit] = core.renderCanonicalHtmlUnits([
    assistantEvent([
      textBlock('block:fence', '```python\nalpha beta\ngamma delta\n```')
    ])
  ]);
  const words = wordsForBlock(unit, 'block:fence');
  const gamma = words.find(word => word.text === 'gamma');
  assert.ok(gamma, 'Expected canonical fenced-code word gamma.');
  assert.equal(gamma.separator_before, '\n');
  assert.ok(
    gamma.groups.includes('fenced_code') &&
      gamma.groups.includes('fence:python'),
    'Existing fenced-code semantic groups must remain intact.'
  );
});

test('word lookup returns the same separator-enriched canonical word', () => {
  const events = [
    assistantEvent([textBlock('block:lookup', 'alpha beta')])
  ];
  const [unit] = core.renderCanonicalHtmlUnits(events);
  const beta = unit.speech_words.find(word => word.text === 'beta');
  assert.ok(beta);
  const located = core.locateCanonicalWord(events, beta.id);
  assert.ok(located);
  assert.deepEqual(located.word, beta);
});
