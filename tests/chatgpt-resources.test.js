import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';

const directFixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const artifactFixtureUrl = new URL('./fixtures/chatgpt/chatgpt-file-artifacts.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('normalizes uploaded ChatGPT file references as canonical attachment resources', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const final = events.find(event => event.source_record_id === 'final-1');

  assert.ok(final);
  const citation = final.citations.find(item => item.citation_kind === 'file');
  assert.ok(citation);

  const resource = final.resources.find(item => item.id === citation.resource_id);
  assert.deepEqual(resource, {
    id: 'final-1:resource:citation:1',
    type: 'file',
    resource_kind: 'attachment',
    name: 'notes.txt',
    provider_file_id: 'file_fixture_notes',
    provider_source: 'my_files',
    snippet: 'Fixture upload.',
    source: {
      provider: 'chatgpt',
      record_id: 'final-1',
      record_index: 9,
      reference_index: 1
    }
  });
});

test('normalizes resolved tool/file citations separately from uploaded attachments', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const final = events.find(event => event.source_record_id === 'final-1');

  const citation = final.citations.find(item => item.citation_kind === 'retrieved_file');
  assert.ok(citation);
  assert.equal(citation.retrieved_file.resolved, true);

  const resource = final.resources.find(item => item.id === citation.resource_id);
  assert.equal(resource.type, 'file');
  assert.equal(resource.resource_kind, 'retrieved_file');
  assert.equal(resource.name, 'AI-transcript.py');
  assert.equal(resource.source_url, 'https://example.com/AI-transcript.py');
  assert.equal(resource.source_record_id, 'tool-2');
});

test('normalizes sandbox links as generated-file artifacts with source and download URLs', async () => {
  const records = await loadJsonl(artifactFixtureUrl);
  const events = adaptChatGPTRecords(records);

  assert.deepEqual(events.map(event => event.source_record_id), [
    'fixture-user-1',
    'fixture-assistant-1'
  ]);
  assert.deepEqual(events.map(event => event.source_index), [1, 2]);

  const assistant = events[1];
  assert.equal(assistant.resources.length, 1);
  assert.deepEqual(assistant.resources[0], {
    id: 'fixture-assistant-1:resource:sandbox:0',
    type: 'artifact',
    resource_kind: 'generated_file',
    name: 'fixture(phase2).txt',
    label: 'Download fixture',
    source_pointer: 'sandbox:/mnt/data/work/fixture(phase2).txt',
    path: '/mnt/data/work/fixture(phase2).txt',
    download_url: 'https://chatgpt.com/backend-api/conversation/fixture-conversation-123/interpreter/download?message_id=fixture-assistant-1&sandbox_path=%2Fmnt%2Fdata%2Fwork%2Ffixture(phase2).txt&download_intent=true',
    text_range: {
      part_index: 0,
      start: 0,
      end: '[Download fixture](sandbox:/mnt/data/work/fixture(phase2).txt)'.length
    },
    resolution_context: {
      provider: 'chatgpt',
      conversation_id: 'fixture-conversation-123',
      message_id: 'fixture-assistant-1'
    },
    source: {
      provider: 'chatgpt',
      record_id: 'fixture-assistant-1',
      record_index: 2,
      part_index: 0
    }
  });

  assert.equal(Object.hasOwn(assistant.resources[0], 'available'), false);
  assert.equal(Object.hasOwn(assistant.resources[0], 'resolved_url'), false);
});

test('image asset pointers are not reclassified as file resources in this slice', async () => {
  const records = await loadJsonl(directFixtureUrl);
  const events = adaptChatGPTRecords(records);
  const user = events.find(event => event.source_record_id === 'user-1');

  assert.ok(user);
  assert.deepEqual(user.resources, []);
});
