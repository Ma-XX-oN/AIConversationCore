import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';

const directFixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('preserves ChatGPT image parts in exact source order and source positions', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const user = events.find(event => event.source_record_id === 'user-1');

  assert.ok(user);
  assert.deepEqual(user.blocks.map(block => block.type), ['image', 'image', 'text']);
  assert.deepEqual(user.blocks.map(block => block.source.part_index), [0, 1, 2]);
  assert.deepEqual(user.blocks.map(block => block.id), [
    'user-1:part:0',
    'user-1:part:1',
    'user-1:part:2'
  ]);
  assert.equal(user.blocks[2].text, 'Find the screenshot-backed tool output and final answer.');
});

test('normalizes evidenced image pointer metadata without inventing availability', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const user = events.find(event => event.source_record_id === 'user-1');
  const images = user.resources.filter(resource => resource.type === 'image');

  assert.equal(images.length, 2);
  assert.deepEqual(images[0], {
    id: 'user-1:resource:image:0',
    type: 'image',
    resource_kind: 'conversation_image',
    source: {
      provider: 'chatgpt',
      record_id: 'user-1',
      record_index: 1,
      part_index: 0
    },
    source_pointer: 'sediment://fixture-image-1',
    size_bytes: 1234,
    width: 640,
    height: 360
  });
  assert.deepEqual(images[1], {
    id: 'user-1:resource:image:1',
    type: 'image',
    resource_kind: 'conversation_image',
    source: {
      provider: 'chatgpt',
      record_id: 'user-1',
      record_index: 1,
      part_index: 1
    },
    status: 'missing'
  });
  assert.equal(Object.hasOwn(images[0], 'status'), false);
});

test('keeps text-image-text ordering and deterministic sediment file transport mapping', () => {
  const records = [{
    id: 'u-image',
    author: { role: 'user' },
    content: {
      content_type: 'multimodal_text',
      parts: [
        'Before',
        { content_type: 'image_asset_pointer', asset_pointer: 'sediment://file_fixture-image' },
        'After'
      ]
    },
    metadata: {}
  }];

  const [event] = adaptChatGPTRecords(records);
  assert.deepEqual(event.blocks.map(block => block.type), ['text', 'image', 'text']);
  assert.deepEqual(event.blocks.map(block => block.source.part_index), [0, 1, 2]);
  assert.equal(event.blocks[0].text, 'Before');
  assert.equal(event.blocks[2].text, 'After');

  const image = event.resources.find(resource => resource.type === 'image');
  assert.equal(image.source_pointer, 'sediment://file_fixture-image');
  assert.equal(
    image.download_url,
    'https://chatgpt.com/backend-api/files/download/file_fixture-image'
  );
  assert.equal(Object.hasOwn(image, 'status'), false);
});

test('marks inline data images available without requiring host resolution', () => {
  const dataUrl = 'data:image/png;base64,AAAA';
  const [event] = adaptChatGPTRecords([{
    id: 'u-data-image',
    author: { role: 'user' },
    content: {
      content_type: 'multimodal_text',
      parts: [{ content_type: 'image_asset_pointer', asset_pointer: dataUrl }]
    },
    metadata: {}
  }]);

  const image = event.resources.find(resource => resource.type === 'image');
  assert.equal(image.status, 'available');
  assert.equal(image.source_pointer, dataUrl);
  assert.equal(image.data_url, dataUrl);
});

test('image normalization does not change ordinary record chronology', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  assert.deepEqual(events.map(event => event.source_record_id), [
    'sys-1', 'user-1', 'thought-1', 'commentary-1', 'code-1',
    'code-2', 'tool-1', 'tool-2', 'tool-3', 'final-1'
  ]);
});
