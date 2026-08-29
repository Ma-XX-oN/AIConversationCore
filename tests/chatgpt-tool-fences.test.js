import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalMarkdown } from '../src/index.js';

function finalMessage(sourceIndex = 1) {
  return {
    id: `chatgpt:final-${sourceIndex}`,
    provider: 'chatgpt',
    source_record_id: `final-${sourceIndex}`,
    source_index: sourceIndex,
    kind: 'message',
    role: 'assistant',
    channel: 'final',
    visibility: 'visible',
    content_type: 'text',
    blocks: [{
      id: `final-${sourceIndex}:part:0`,
      type: 'text',
      text: 'Final answer',
      source: {
        provider: 'chatgpt',
        record_id: `final-${sourceIndex}`,
        record_index: sourceIndex,
        part_index: 0
      }
    }],
    citations: [],
    display_replacements: [],
    resources: [],
    relationships: {},
    source: {
      provider: 'chatgpt',
      record_id: `final-${sourceIndex}`,
      record_index: sourceIndex
    }
  };
}

test('ChatGPT tool calls size the outer fence from the complete payload', () => {
  const payload = [
    'before',
    '```',
    'inner',
    '```',
    '````',
    'longer inner fence',
    '````',
    'after'
  ].join('\n');
  const events = [{
    id: 'chatgpt:call-1',
    provider: 'chatgpt',
    source_record_id: 'call-1',
    source_index: 0,
    kind: 'tool_call',
    role: 'assistant',
    channel: 'commentary',
    visibility: 'visible',
    content_type: 'code',
    blocks: [{
      id: 'call-1:tool_call:0',
      type: 'tool_call',
      name: 'web.run',
      input: payload,
      input_format: 'code',
      language: 'unknown',
      source: { provider: 'chatgpt', record_id: 'call-1', record_index: 0 }
    }],
    citations: [],
    display_replacements: [],
    resources: [],
    relationships: {},
    source: { provider: 'chatgpt', record_id: 'call-1', record_index: 0 }
  }, finalMessage()];

  const markdown = renderCanonicalMarkdown(events);
  assert.ok(markdown.includes(`<summary>web.run code</summary>\n\n\`\`\`\`\`\n${payload}\n\`\`\`\`\``));
  assert.ok(markdown.includes('\`\`\`\`\`\n\n</details>\n\n</details>\n\n> Final answer'));
});

test('ChatGPT tool results contain arbitrary Markdown and literal memcite text', () => {
  const payload = [
    '[L339] ```unknown',
    'tool text',
    '```',
    '````',
    'nested four-backtick fence',
    '````',
    'literal marker: memcite'
  ].join('\n');
  const events = [{
    id: 'chatgpt:result-1',
    provider: 'chatgpt',
    source_record_id: 'result-1',
    source_index: 0,
    kind: 'tool_result',
    role: 'tool',
    channel: null,
    visibility: 'visible',
    content_type: 'multimodal_text',
    blocks: [{
      id: 'result-1:tool_result:0',
      type: 'tool_result',
      name: 'api_tool',
      output: [
        'Make sure to include a file citation in your response.',
        payload
      ],
      output_format: 'multimodal_text',
      source: { provider: 'chatgpt', record_id: 'result-1', record_index: 0 }
    }],
    citations: [],
    display_replacements: [],
    resources: [],
    relationships: {},
    source: { provider: 'chatgpt', record_id: 'result-1', record_index: 0 }
  }, finalMessage()];

  const markdown = renderCanonicalMarkdown(events);
  assert.ok(markdown.includes(`<summary>api_tool output</summary>\n\n\`\`\`\`\`\n${payload}\n\`\`\`\`\``));
  assert.ok(markdown.includes('literal marker: memcite'));
  assert.ok(markdown.includes('\`\`\`\`\`\n\n</details>\n\n</details>\n\n> Final answer'));
});
