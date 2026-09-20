import test from 'node:test';
import assert from 'node:assert/strict';

import {
  projectCanonicalWords,
  renderCanonicalHtmlUnits
} from '../src/index.js';

function source(index, id) {
  return {
    provider: 'codex',
    record_id: id,
    record_index: index
  };
}

function message({ id, sourceIndex, role, blocks }) {
  return {
    id,
    provider: 'codex',
    source_record_id: id,
    source_index: sourceIndex,
    kind: 'message',
    role,
    channel: null,
    visibility: 'visible',
    content_type: 'message',
    blocks,
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source: source(sourceIndex, id)
  };
}

const events = [
  message({
    id: 'user-1',
    sourceIndex: 0,
    role: 'user',
    blocks: [
      {
        id: 'user-1:context',
        type: 'user_context',
        summary: '# Context from my IDE setup:',
        text: 'Context 13.234 value.',
        source: source(0, 'user-1')
      },
      {
        id: 'user-1:text',
        type: 'text',
        text: 'Visible **turn_id**s remain one token.',
        source: source(0, 'user-1')
      }
    ]
  }),
  message({
    id: 'assistant-1',
    sourceIndex: 1,
    role: 'assistant',
    blocks: [
      {
        id: 'assistant-1:text',
        type: 'text',
        text: 'Next value is 35.4401545.',
        source: source(1, 'assistant-1')
      }
    ]
  })
];

test('canonical word ids are global monotonic numeric handles shared by HTML and speech', () => {
  const projection = projectCanonicalWords(events);
  const ids = projection.words.map(word => word.id);

  assert.ok(ids.length > 0);
  assert.deepEqual(ids, ids.map((_, index) => index + 1));
  assert.ok(ids.every(Number.isSafeInteger));

  const units = renderCanonicalHtmlUnits(events);
  const html = units.map(unit => unit.html).join('');
  for (const word of projection.words) {
    assert.match(html, new RegExp(`id="word-${word.id}"`));
  }
});

test('decimal and markup-spanning visible units have one canonical word identity', () => {
  const projection = projectCanonicalWords(events);

  const decimal = projection.words.filter(word => word.text === '13.234');
  assert.equal(decimal.length, 1);

  const longDecimal = projection.words.filter(word => word.text === '35.4401545');
  assert.equal(longDecimal.length, 1);

  const markupWord = projection.words.filter(word => word.text === 'turn_ids');
  assert.equal(markupWord.length, 1);
});

test('Core semantic containment owns User Context classification around canonical words', () => {
  const projection = projectCanonicalWords(events);
  const contextWord = projection.words.find(word => word.text === '13.234');
  assert.ok(contextWord);
  assert.ok(contextWord.groups.includes('user_context'));

  const units = renderCanonicalHtmlUnits(events);
  const html = units.map(unit => unit.html).join('');
  const contextStart = html.indexOf('class="user-context"');
  const wordStart = html.indexOf(`id="word-${contextWord.id}"`);
  assert.ok(contextStart >= 0);
  assert.ok(wordStart > contextStart);
});
