import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalHtmlUnits } from '../src/index.js';

test('historical turn HTML declares historical state for interactive consumers', () => {
  const event = {
    id: 'event:historical:1',
    provider: 'codex',
    kind: 'message',
    role: 'user',
    channel: 'final',
    content_type: 'text',
    visibility: 'visible',
    source_record_id: 'record:historical:1',
    source_index: 0,
    revision_status: 'original',
    revision_depth: 0,
    rolled_back: true,
    blocks: [{ type: 'text', text: 'Historical prompt.' }],
    citations: [],
    resources: []
  };

  const [unit] = renderCanonicalHtmlUnits([event], {
    includeRolledBackTurns: false
  });

  assert.ok(unit, 'Expected one retained historical HTML unit.');
  assert.match(unit.html, /data-revision-historical="true"/,
    'Core HTML must identify historical turns so a UI can toggle visibility without adding semantic markup itself.');
  assert.match(unit.html, /\shidden(?:\s|>)/,
    'Historical turn should start hidden when history is excluded from the active projection.');
});
