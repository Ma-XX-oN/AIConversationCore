import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';
import { deriveTurns } from '../src/derive/turns.js';

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

const fixture = new URL('./fixtures/chatgpt/chatgpt-non-parts.jsonl', import.meta.url);

test('ChatGPT reasoning_recap preserves evidenced content as reasoning_summary', async () => {
  const events = adaptChatGPTRecords(await loadJsonl(fixture));
  const event = events.find(item => item.source_record_id === 'recap-1');

  assert.equal(event.kind, 'reasoning_summary');
  assert.equal(event.content_type, 'reasoning_recap');
  assert.equal(event.blocks.length, 1);
  assert.equal(event.blocks[0].type, 'reasoning_summary');
  assert.equal(event.blocks[0].content, 'Checked the relevant records.');
  assert.equal(event.blocks[0].source.record_id, 'recap-1');
});

test('ChatGPT model_editable_context preserves established context fields without making a turn', async () => {
  const events = adaptChatGPTRecords(await loadJsonl(fixture));
  const event = events.find(item => item.source_record_id === 'context-1');

  assert.equal(event.kind, 'system_context');
  assert.equal(event.content_type, 'model_editable_context');
  assert.deepEqual(event.blocks.map(block => [block.context_kind, block.text]), [
    ['model_set_context', 'Project context text.'],
    ['repo_summary', 'Repository summary text.']
  ]);
  assert.equal(event.visibility, 'hidden');

  const turns = deriveTurns(events);
  assert.equal(turns.some(turn => turn.event_ids.includes('chatgpt:context-1')), false);
});

test('ChatGPT tether_browsing_display preserves summary, result, assets and tether identity', async () => {
  const events = adaptChatGPTRecords(await loadJsonl(fixture));
  const event = events.find(item => item.source_record_id === 'tether-1');

  assert.equal(event.kind, 'tool_result');
  assert.equal(event.content_type, 'tether_browsing_display');
  assert.equal(event.blocks.length, 1);

  const block = event.blocks[0];
  assert.equal(block.type, 'tool_result');
  assert.equal(block.output_format, 'tether_browsing_display');
  assert.equal(block.output.summary, 'Browser is searching.');
  assert.equal(block.output.result, 'Waiting for sources.');
  assert.equal(block.output.tether_id, 'fixture-tether-1');
  assert.deepEqual(block.output.assets, [{
    asset_index: 0,
    title: 'Source title',
    text: 'Source text',
    alt: 'Source alt',
    caption: 'Source caption',
    url: 'https://example.com/source'
  }]);
  assert.equal(block.call_id, null);
  assert.equal(event.relationships.tool_call_id, null);
});

test('non-parts normalization preserves source order and ordinary event behaviour', async () => {
  const records = await loadJsonl(fixture);
  const events = adaptChatGPTRecords(records);
  assert.deepEqual(events.map(event => event.source_index), [0, 1, 2]);
  assert.deepEqual(events.map(event => event.source_record_id), ['recap-1', 'context-1', 'tether-1']);
});
