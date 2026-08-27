import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-sources-footnote.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('normalizes the GPTSpy-documented ChatGPT sources_footnote structure', async () => {
  const records = await loadJsonl(fixtureUrl);
  const [event] = adaptChatGPTRecords(records);
  const [citation] = event.citations;

  assert.equal(citation.type, 'citation');
  assert.equal(citation.citation_kind, 'sources_footnote');
  assert.equal(citation.matched_text, null);
  assert.equal(citation.text_range, null);
  assert.deepEqual(citation.sources_footnote.sources, [
    {
      title: 'Primary source',
      url: 'https://example.com/primary',
      attribution: 'Example'
    },
    {
      title: 'Secondary source',
      url: 'https://example.org/secondary',
      attribution: 'Example Org'
    }
  ]);
  assert.deepEqual(citation.source, {
    provider: 'chatgpt',
    record_id: 'assistant-footnote',
    record_index: 0,
    reference_index: 0
  });
});

test('source footnotes remain distinct from grouped web citations and search hits', async () => {
  const records = await loadJsonl(fixtureUrl);
  records[0].metadata.search_result_groups = [{
    entries: [{
      title: 'Fetched but not selected',
      url: 'https://example.net/hidden-hit',
      attribution: 'Hidden Hit'
    }]
  }];

  const [event] = adaptChatGPTRecords(records);
  const [citation] = event.citations;
  const canonical = JSON.stringify(citation);

  assert.equal(citation.citation_kind, 'sources_footnote');
  assert.equal(citation.web, undefined);
  assert.doesNotMatch(canonical, /hidden-hit/);
  assert.doesNotMatch(canonical, /search_result_groups/);
});

test('source footnote normalization does not change event order or derived semantics', async () => {
  const records = await loadJsonl(fixtureUrl);
  records.unshift({
    id: 'user-footnote',
    author: { role: 'user', name: null },
    content: { content_type: 'text', parts: ['Question'] },
    metadata: {},
    channel: null
  });

  const events = adaptChatGPTRecords(records);
  assert.deepEqual(events.map(event => event.source_record_id), [
    'user-footnote',
    'assistant-footnote'
  ]);
  assert.equal(events[0].citations.length, 0);
  assert.equal(events[1].citations[0].citation_kind, 'sources_footnote');
});
