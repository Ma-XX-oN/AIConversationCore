import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalHtmlUnits } from '../src/index.js';

function messageEvent(text) {
  return {
    id: 'event:user:raw-html-blockquote',
    provider: 'codex',
    kind: 'message',
    role: 'user',
    channel: 'final',
    content_type: 'text',
    visibility: 'visible',
    source_record_id: 'record:raw-html-blockquote',
    source_index: 0,
    blocks: [{
      id: 'event:user:raw-html-blockquote:block:0',
      type: 'text',
      text
    }],
    citations: [],
    resources: []
  };
}

test('raw unmatched blockquote HTML remains visible content and cannot break canonical structure', () => {
  const [unit] = renderCanonicalHtmlUnits([
    messageEvent('Before raw HTML.\n\n</blockquote>\n\nAfter raw HTML.')
  ]);

  assert.ok(unit, 'Expected one canonical HTML unit.');
  assert.match(
    unit.html,
    /<blockquote class="transcript-turn-body">[\s\S]*<\/blockquote><\/section>$/,
    'The Core-owned turn body must remain structurally intact.'
  );
  assert.match(
    unit.html,
    /&lt;\/blockquote&gt;/,
    'The source closing tag must remain visible escaped content.'
  );
  assert.equal(
    (unit.html.match(/<\/blockquote>/g) ?? []).length,
    1,
    'Source Markdown must not inject a second structural blockquote close.'
  );
  assert.deepEqual(
    unit.speech_words.map(word => word.text),
    ['Before', 'raw', 'HTML', '.', '<', '/', 'blockquote', '>', 'After', 'raw', 'HTML', '.'],
    'Escaped raw HTML must stay in the authoritative canonical word stream.'
  );
});
