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

function assistantEvent(text) {
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
    blocks: [textBlock('block:body', text)],
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

test('canonical words expose structural navigation starts without promoting soft line breaks', () => {
  const [unit] = core.renderCanonicalHtmlUnits([
    assistantEvent(
      'In practice:\n\n' +
      '- For web research, use sources.\n' +
      '- For local code/files, inspect files.\n\n' +
      'Soft line\nwrap continues.'
    )
  ]);
  const words = unit.speech_words;
  const structuralStarts = words
    .filter(word => word.navigation_boundary_before === true)
    .map(word => word.text);

  assert.deepEqual(
    structuralStarts,
    ['In', 'For', 'For', 'Soft'],
    'Paragraph and list-item starts must be explicit canonical navigation boundaries.'
  );

  const wrap = words.find(word => word.text === 'wrap');
  assert.ok(wrap, 'Expected the soft-line word wrap.');
  assert.equal(wrap.separator_before, '\n');
  assert.equal(
    wrap.navigation_boundary_before,
    false,
    'A soft newline inside one paragraph must not become a navigation boundary.'
  );
});
