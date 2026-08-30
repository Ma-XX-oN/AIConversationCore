import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptClaudeRecords, renderCanonicalMarkdown } from '../src/index.js';

const records = [
  {
    type: 'assistant',
    timestamp: '2026-01-02T12:00:03.000Z',
    message: {
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: 'toolu_agent_ok',
        name: 'Agent',
        input: { description: 'Review selected files' }
      }]
    }
  },
  {
    type: 'user',
    timestamp: '2026-01-02T12:00:04.000Z',
    message: {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: 'toolu_agent_ok',
        content: 'agentId: agent-safe-1 (internal ID - do not mention to user.)\nComplete.'
      }]
    }
  }
];

test('Claude subagent keeps completion as primary source and invocation as related source', () => {
  const [event] = adaptClaudeRecords(records);
  assert.equal(event.kind, 'subagent');
  assert.equal(event.source_index, 1);
  assert.equal(event.relationships.invocation_source.record_index, 0);
  assert.equal(event.blocks[0].source.record_index, 1);
});

test('Claude subagent heading uses invocation projection while debug also exposes completion source', () => {
  const [base] = adaptClaudeRecords(records);
  const event = {
    ...base,
    projection: {
      heading_suffix: ' [completion]',
      debug_provenance: true,
      related_sources: {
        invocation_source: {
          heading_suffix: ' [invocation]',
          debug_provenance: true
        }
      }
    }
  };
  const markdown = renderCanonicalMarkdown([event]);
  assert.match(markdown, /^## Claude Sub-agent agent-safe-1 \[invocation\] <!-- record_index=0 -->/m);
  assert.match(markdown, /^<!-- record_index=1 -->$/m);
  assert.equal(markdown.includes('## Claude Sub-agent agent-safe-1 [completion]'), false);
});
