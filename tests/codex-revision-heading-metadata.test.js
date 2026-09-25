import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalMarkdown } from '../src/index.js';

function revisionEvent(role, sourceIndex) {
  return {
    id: `codex:${role}:${sourceIndex}`,
    provider: 'codex',
    kind: 'message',
    role,
    channel: 'final',
    content_type: 'text',
    visibility: 'visible',
    source_record_id: `record-${sourceIndex}`,
    source_index: sourceIndex,
    source: {
      provider: 'codex',
      record_id: `record-${sourceIndex}`,
      record_index: sourceIndex
    },
    blocks: [{ type: 'text', text: `${role} revision` }],
    citations: [],
    resources: [],
    revision_status: 'edited',
    revision_depth: 3,
    projection: { heading_suffix: ' (edited 3)' }
  };
}

test('revision suffix is rendered exactly once when Core heading metadata is enabled', () => {
  const markdown = renderCanonicalMarkdown(
    [revisionEvent('user', 2), revisionEvent('assistant', 3)],
    { heading: { recordNumber: true, recordNumberWidth: 2 } }
  );
  const headings = markdown.split('\n').filter(line => line.startsWith('## '));

  assert.deepEqual(headings, [
    '## User (edited 3)  3:',
    '## Codex (edited 3)  4:'
  ]);
  for (const heading of headings) {
    assert.equal((heading.match(/\(edited 3\)/g) ?? []).length, 1);
  }
});

test('revision suffix remains single and adjacent when heading metadata is disabled', () => {
  const markdown = renderCanonicalMarkdown([revisionEvent('user', 2)]);
  const heading = markdown.split('\n')[0];

  assert.equal(heading, '## User (edited 3)');
  assert.equal((heading.match(/\(edited 3\)/g) ?? []).length, 1);
});
