import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalMarkdown } from '../src/index.js';

function event({ id, index, kind, role = 'assistant', blocks = [], projection = {} }) {
  return {
    id: `chatgpt:${id}`,
    provider: 'chatgpt',
    kind,
    role,
    visibility: 'visible',
    source_record_id: id,
    source_index: index,
    source: { provider: 'chatgpt', record_id: id, record_index: index },
    relationships: {},
    blocks,
    resources: [],
    citations: [],
    projection
  };
}

test('ChatGPT response and commentary headings both honour consumer heading suffix projections', () => {
  const events = [
    event({
      id: 'tool-call',
      index: 0,
      kind: 'tool_call',
      blocks: [{ type: 'tool_call', name: 'api_tool', input: 'inspect()', language: 'javascript' }],
      projection: { heading_suffix: ' <!-- record_id=response-source -->' }
    }),
    event({
      id: 'commentary-source',
      index: 1,
      kind: 'commentary',
      blocks: [{ type: 'text', text: 'Continuing.' }],
      projection: { heading_suffix: ' <!-- record_id=commentary-source -->' }
    })
  ];

  const rendered = renderCanonicalMarkdown(events);
  assert.match(rendered, /^## ChatGPT <!-- record_id=response-source -->/);
  assert.match(rendered, /^### ChatGPT Commentary <!-- record_id=commentary-source -->$/m);
});
