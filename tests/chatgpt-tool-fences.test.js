import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalMarkdown } from '../src/projections/markdown.js';

function baseEvent(overrides = {}) {
  return {
    id: 'chatgpt:event',
    provider: 'chatgpt',
    source_record_id: 'event',
    source_index: 0,
    kind: 'message',
    role: 'assistant',
    channel: 'final',
    visibility: 'visible',
    content_type: 'text',
    blocks: [],
    citations: [],
    display_replacements: [],
    resources: [],
    relationships: {},
    source: { provider: 'chatgpt', record_id: 'event', record_index: 0 },
    ...overrides
  };
}

test('ChatGPT tool calls size the outer fence from the complete payload', () => {
  const payload = [
    'first',
    '```',
    'inside',
    '````',
    'nested four-backtick fence',
    '````',
    'last'
  ].join('\n');
  const events = [baseEvent({
    id: 'chatgpt:call',
    source_record_id: 'call',
    kind: 'tool_call',
    role: 'assistant',
    channel: 'commentary',
    content_type: 'code',
    blocks: [{
      id: 'call:tool_call:0',
      type: 'tool_call',
      name: 'container.exec',
      input: payload,
      input_format: 'code',
      language: 'bash',
      source: { provider: 'chatgpt', record_id: 'call', record_index: 0 }
    }]
  }), baseEvent({
    id: 'chatgpt:final',
    source_record_id: 'final',
    source_index: 1,
    blocks: [{ type: 'text', text: 'Final answer.' }]
  })];

  const markdown = renderCanonicalMarkdown(events);
  assert.ok(markdown.includes(`\`\`\`\`\`bash\n${payload}\n\`\`\`\`\``));
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
  const events = [baseEvent({
    id: 'chatgpt:result',
    source_record_id: 'result',
    kind: 'tool_result',
    role: 'tool',
    channel: null,
    content_type: 'execution_output',
    blocks: [{
      id: 'result:tool_result:0',
      type: 'tool_result',
      name: 'api_tool',
      output: payload,
      output_format: 'execution_output',
      source: { provider: 'chatgpt', record_id: 'result', record_index: 0 }
    }]
  }), baseEvent({
    id: 'chatgpt:final',
    source_record_id: 'final',
    source_index: 1,
    blocks: [{ type: 'text', text: 'Final answer' }]
  })];

  const markdown = renderCanonicalMarkdown(events);
  assert.ok(markdown.includes(`<summary>api_tool output</summary>\n\n\`\`\`\`\`\n${payload}\n\`\`\`\`\``));
  assert.ok(markdown.includes('literal marker: memcite'));
  assert.ok(markdown.includes('\`\`\`\`\`\n\n</details>\n\n> Final answer'));
});


test('ChatGPT commentary with tool activity stays in one ChatGPT response', () => {
  const payload = [
    '[L339] ```unknown',
    'tool text',
    '```',
    '````',
    'nested four-backtick fence',
    '````',
    "literal marker: memcite"
  ].join('\n');
  const events = [{
    id: 'chatgpt:call-commentary',
    provider: 'chatgpt',
    source_record_id: 'call-commentary',
    source_index: 0,
    kind: 'tool_call',
    role: 'assistant',
    channel: 'commentary',
    visibility: 'visible',
    content_type: 'code',
    blocks: [{
      id: 'call-commentary:tool_call:0',
      type: 'tool_call',
      name: 'api_tool',
      input: 'inspect()',
      input_format: 'code',
      language: 'javascript',
      source: { provider: 'chatgpt', record_id: 'call-commentary', record_index: 0 }
    }],
    citations: [], display_replacements: [], resources: [], relationships: {},
    source: { provider: 'chatgpt', record_id: 'call-commentary', record_index: 0 }
  }, {
    id: 'chatgpt:result-commentary',
    provider: 'chatgpt',
    source_record_id: 'result-commentary',
    source_index: 1,
    kind: 'tool_result',
    role: 'tool',
    channel: null,
    visibility: 'visible',
    content_type: 'execution_output',
    blocks: [{
      id: 'result-commentary:tool_result:0',
      type: 'tool_result',
      name: 'api_tool',
      output: payload,
      output_format: 'execution_output',
      source: { provider: 'chatgpt', record_id: 'result-commentary', record_index: 1 }
    }],
    citations: [], display_replacements: [], resources: [], relationships: {},
    source: { provider: 'chatgpt', record_id: 'result-commentary', record_index: 1 }
  }, {
    id: 'chatgpt:commentary-2',
    provider: 'chatgpt',
    source_record_id: 'commentary-2',
    source_index: 2,
    kind: 'commentary',
    role: 'assistant',
    channel: 'commentary',
    visibility: 'visible',
    content_type: 'text',
    blocks: [{
      id: 'commentary-2:part:0',
      type: 'text',
      text: 'Continuing after the tool.',
      source: { provider: 'chatgpt', record_id: 'commentary-2', record_index: 2, part_index: 0 }
    }],
    citations: [], display_replacements: [], resources: [], relationships: {},
    source: { provider: 'chatgpt', record_id: 'commentary-2', record_index: 2 }
  }];

  const markdown = renderCanonicalMarkdown(events);
  assert.equal((markdown.match(/^## ChatGPT$/gm) ?? []).length, 1);
  assert.equal((markdown.match(/^### ChatGPT Commentary$/gm) ?? []).length, 1);
  assert.equal(markdown.includes('Having 2 thoughts'), false,
    'Tool call/result records must not be counted as thoughts.');
  assert.ok(markdown.includes(`<summary>api_tool output</summary>\n\n\`\`\`\`\`\n${payload}\n\`\`\`\`\``));
  assert.ok(markdown.includes('literal marker: memcite'));
  const closeFence = markdown.indexOf('`````', markdown.indexOf(payload) + payload.length);
  const commentary = markdown.indexOf('> Continuing after the tool.');
  assert.ok(closeFence >= 0 && commentary > closeFence,
    'Commentary following tool output must remain outside the adaptive fence.');
});
