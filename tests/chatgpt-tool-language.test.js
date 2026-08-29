import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptChatGPTRecords, renderCanonicalMarkdown } from '../src/index.js';

function codeRecord(id, recipient, language, text) {
  return {
    id,
    author: { role: 'assistant', name: null, metadata: {} },
    content: { content_type: 'code', language, text },
    metadata: {},
    recipient,
    channel: null
  };
}

function adaptOne(record) {
  const events = adaptChatGPTRecords([record]);
  assert.equal(events.length, 1);
  return events[0].blocks[0];
}

test('api_tool structured JSON arguments override the misleading provider python3 label', () => {
  const source = '{"path":"/files/list","args":{"surface":"conversation","limit":20}}';
  const block = adaptOne(codeRecord('api-call', 'api_tool.call_tool', 'python3', source));

  assert.equal(block.input, source);
  assert.equal(block.input_format, 'json');
  assert.equal(block.language, 'json');
  assert.equal(block.source_input, source);
  assert.equal(block.source_language, 'python3');

  const markdown = renderCanonicalMarkdown(adaptChatGPTRecords([
    codeRecord('api-call', 'api_tool.call_tool', 'python3', source)
  ]));
  assert.match(markdown, /<summary>api_tool\.call_tool code<\/summary>\n\n```json\n/);
});

test('container.exec infers Bash from a persisted bash launcher when language is unknown', () => {
  const source = 'bash -lc grep -n -F "browser packaging" file.md | head -5';
  const block = adaptOne(codeRecord('bash-call', 'container.exec', 'unknown', source));

  assert.equal(block.input, source);
  assert.equal(block.language, 'bash');
  assert.equal(block.source_input, source);
  assert.equal(block.source_language, 'unknown');

  const markdown = renderCanonicalMarkdown(adaptChatGPTRecords([
    codeRecord('bash-call', 'container.exec', 'unknown', source)
  ]));
  assert.match(markdown, /<summary>container\.exec code<\/summary>\n\n```bash\n/);
});

test('container.exec Python -c preserves raw source but renders the persisted program without fake argv quoting', () => {
  const source = [
    'python -c from pathlib import Path',
    "p=Path('/mnt/data/H1 Heading.jsonl')",
    "print(p.read_text(encoding='utf-8', errors='replace')[:12000])"
  ].join('\n');
  const expectedProgram = [
    'from pathlib import Path',
    "p=Path('/mnt/data/H1 Heading.jsonl')",
    "print(p.read_text(encoding='utf-8', errors='replace')[:12000])"
  ].join('\n');
  const block = adaptOne(codeRecord('python-call', 'container.exec', 'unknown', source));

  assert.equal(block.input, expectedProgram);
  assert.equal(block.language, 'python');
  assert.equal(block.source_input, source);
  assert.equal(block.source_language, 'unknown');

  const markdown = renderCanonicalMarkdown(adaptChatGPTRecords([
    codeRecord('python-call', 'container.exec', 'unknown', source)
  ]));
  assert.match(markdown, /<summary>container\.exec code<\/summary>\n\n```python\nfrom pathlib import Path\n/);
  assert.equal(markdown.includes('python -c from pathlib import Path'), false);
});

test('api_tool does not relabel invalid JSON merely because of the recipient', () => {
  const source = 'not-json()';
  const block = adaptOne(codeRecord('api-non-json', 'api_tool.call_tool', 'python3', source));
  assert.equal(block.input, source);
  assert.equal(block.language, 'python3');
  assert.equal(block.source_language, 'python3');
});


function toolRecord(id, content) {
  return {
    id,
    author: { role: 'tool', name: 'example_tool', metadata: {} },
    content,
    metadata: {},
    recipient: 'all',
    channel: 'commentary'
  };
}

test('tool-role text records normalize as tool_result without guessing unsupported shapes', () => {
  const record = toolRecord('tool-text', {
    content_type: 'text',
    parts: ['first line', 'second line']
  });
  const [event] = adaptChatGPTRecords([record]);
  assert.equal(event.kind, 'tool_result');
  assert.equal(event.source_record_id, 'tool-text');
  assert.equal(event.source_index, 0);
  assert.equal(event.blocks[0].type, 'tool_result');
  assert.equal(event.blocks[0].output_format, 'text');
  assert.equal(event.blocks[0].output, 'first line\n\nsecond line');

  const markdown = renderCanonicalMarkdown([event]);
  assert.match(markdown, /<summary>example_tool output<\/summary>/);
  assert.match(markdown, /first line\n\nsecond line/);
});

test('tool-role code records normalize as tool_result and preserve source content type', () => {
  const record = toolRecord('tool-code', {
    content_type: 'code',
    language: 'json',
    text: '{"ok":true}'
  });
  const [event] = adaptChatGPTRecords([record]);
  assert.equal(event.kind, 'tool_result');
  assert.equal(event.source_record_id, 'tool-code');
  assert.equal(event.source_index, 0);
  assert.equal(event.blocks[0].type, 'tool_result');
  assert.equal(event.blocks[0].output_format, 'code');
  assert.equal(event.blocks[0].output, '{"ok":true}');

  const markdown = renderCanonicalMarkdown([event]);
  assert.match(markdown, /<summary>example_tool output<\/summary>/);
  assert.match(markdown, /\{"ok":true\}/);
});

test('unknown tool-role content types are not guessed into tool_result', () => {
  const [event] = adaptChatGPTRecords([toolRecord('tool-unknown', {
    content_type: 'unsupported_tool_payload',
    text: 'opaque'
  })]);
  assert.equal(event.kind, 'message');
});
