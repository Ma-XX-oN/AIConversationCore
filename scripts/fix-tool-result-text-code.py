from pathlib import Path

base = Path('src/adapters/chatgpt-base.js')
text = base.read_text(encoding='utf-8')
old = """function toolResultBlocks(record, sourceRecordId, sourceIndex) {
  const contentType = record?.content?.content_type ?? null;
  let output = null;
  if (contentType === 'execution_output') output = record?.content?.text ?? null;
  if (contentType === 'multimodal_text') output = Array.isArray(record?.content?.parts)
    ? [...record.content.parts]
    : null;

  return [{
"""
new = """function toolResultBlocks(record, sourceRecordId, sourceIndex) {
  const contentType = record?.content?.content_type ?? null;
  let output = null;
  if (contentType === 'execution_output' || contentType === 'code') {
    output = record?.content?.text ?? record?.content?.content ?? null;
  }
  if (contentType === 'text') {
    output = Array.isArray(record?.content?.parts)
      ? record.content.parts.filter(part => typeof part === 'string').join('\\n\\n')
      : record?.content?.text ?? null;
  }
  if (contentType === 'multimodal_text') output = Array.isArray(record?.content?.parts)
    ? [...record.content.parts]
    : null;

  return [{
"""
assert text.count(old) == 1, 'toolResultBlocks target changed'
text = text.replace(old, new, 1)
old = """function isToolResult(record) {
  if (record?.author?.role !== 'tool') return false;
  return record?.content?.content_type === 'execution_output' ||
    record?.content?.content_type === 'multimodal_text';
}
"""
new = """function isToolResult(record) {
  if (record?.author?.role !== 'tool') return false;
  return ['execution_output', 'multimodal_text', 'text', 'code']
    .includes(record?.content?.content_type);
}
"""
assert text.count(old) == 1, 'isToolResult target changed'
text = text.replace(old, new, 1)
base.write_text(text, encoding='utf-8')

test = Path('tests/chatgpt-tool-language.test.js')
value = test.read_text(encoding='utf-8')
append = r'''

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
  assert.equal(event.blocks[0].output, 'first line\\n\\nsecond line');

  const markdown = renderCanonicalMarkdown([event]);
  assert.match(markdown, /<summary>example_tool output<\\/summary>/);
  assert.match(markdown, /first line\\n\\nsecond line/);
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
  assert.match(markdown, /<summary>example_tool output<\\/summary>/);
  assert.match(markdown, /\\{"ok":true\\}/);
});

test('unknown tool-role content types are not guessed into tool_result', () => {
  const [event] = adaptChatGPTRecords([toolRecord('tool-unknown', {
    content_type: 'unsupported_tool_payload',
    text: 'opaque'
  })]);
  assert.equal(event.kind, 'message');
});
'''
assert "tool-role text records normalize as tool_result" not in value, 'tests already patched'
test.write_text(value + append, encoding='utf-8')
