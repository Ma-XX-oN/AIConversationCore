import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalMarkdown } from '../src/projections/markdown.js';

function event(index, kind, role, text = '') {
  const id = `turn-${index}`;
  const blocks = [];
  if (kind === 'reasoning_summary') {
    blocks.push({ type: 'reasoning_summary', summary: null, content: text });
  } else if (text) {
    blocks.push({ type: 'text', text });
  }
  return {
    id: `chatgpt:${id}`,
    provider: 'chatgpt',
    source_record_id: id,
    source_index: index,
    kind,
    role,
    visibility: 'visible',
    blocks,
    projection: { debug_provenance: true }
  };
}

test('ChatGPT response starts once and commentary breaks thought consecutiveness', () => {
  const events = [
    event(17, 'reasoning_summary', 'assistant', 'first thought'),
    event(18, 'reasoning_summary', 'assistant', 'second thought'),
    event(19, 'commentary', 'assistant', 'commentary text'),
    event(20, 'reasoning_summary', 'assistant', 'third thought'),
    event(21, 'message', 'assistant', 'final answer')
  ];
  const markdown = renderCanonicalMarkdown(events);

  assert.equal((markdown.match(/^## ChatGPT(?: |$)/gm) ?? []).length, 1);
  assert.match(markdown, /^## ChatGPT <!-- record_id=turn-17 record_index=17 -->/m);
  assert.match(markdown, /<summary>Having 2 thoughts<\/summary>|<summary>Having 2 thoughts<\/summary>/);
  assert.match(markdown, /<summary>Having 2 thoughts<\/summary> <!-- record_id=turn-17 record_index=17 -->\n<!-- record_id=turn-18 record_index=18 -->/);
  assert.match(markdown, /### ChatGPT Commentary <!-- record_id=turn-19 record_index=19 -->/);
  assert.match(markdown, /<summary>Having a thought<\/summary> <!-- record_id=turn-20 record_index=20 -->/);
  assert.ok(markdown.indexOf('Having 2 thoughts') < markdown.indexOf('ChatGPT Commentary'));
  assert.ok(markdown.indexOf('ChatGPT Commentary') < markdown.indexOf('Having a thought'));
});

test('debug provenance is absent when the flag is disabled', () => {
  const item = event(4, 'message', 'user', 'hello');
  item.projection = {};
  const markdown = renderCanonicalMarkdown([item]);
  assert.equal(markdown.includes('turn_id='), false);
  assert.equal(markdown.includes('record_index='), false);
});

test('ChatGPT response heading projection can differ from first commentary heading projection', () => {
  const commentary = event(30, 'commentary', 'assistant', 'interim');
  commentary.projection = {
    heading_suffix: ' <!-- record_id=commentary-30 -->',
    response_heading_suffix: ' <!-- record_id=final-31 -->'
  };
  const final = event(31, 'message', 'assistant', 'final');
  final.projection = {};
  const markdown = renderCanonicalMarkdown([commentary, final]);

  assert.match(markdown, /^## ChatGPT <!-- record_id=final-31 -->/m);
  assert.match(markdown, /^### ChatGPT Commentary <!-- record_id=commentary-30 -->/m);
  assert.equal((markdown.match(/^## ChatGPT(?: |$)/gm) ?? []).length, 1);
});
