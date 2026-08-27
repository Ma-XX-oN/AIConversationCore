import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptChatGPTRecords } from '../src/adapters/chatgpt.js';

const fixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const goldenUrl = new URL('./golden/chatgpt/chatgpt-direct.canonical.md', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

async function finalEvent() {
  const records = await loadJsonl(fixtureUrl);
  return adaptChatGPTRecords(records).find(event => event.source_record_id === 'final-1');
}

test('normalizes only evidence-backed citation kinds without flattening their distinct data', async () => {
  const event = await finalEvent();

  assert.ok(event);
  assert.deepEqual(event.citations.map(citation => citation.citation_kind), [
    'file',
    'retrieved_file',
    'web',
    'memory'
  ]);

  const [file, retrievedFile, web, memory] = event.citations;

  assert.deepEqual(file.file, {
    id: 'file_fixture_notes',
    name: 'notes.txt',
    source: 'my_files',
    snippet: 'Fixture upload.'
  });
  assert.equal(file.web, undefined);
  assert.equal(file.memory, undefined);

  assert.deepEqual(retrievedFile.retrieved_file, {
    resolved: true,
    title: 'AI-transcript.py',
    url: 'https://example.com/AI-transcript.py',
    source_record_id: 'tool-2',
    source_index: 7
  });

  assert.deepEqual(web.web.sources[0], {
    url: 'https://docs.python.org/3/tutorial/index.html',
    title: 'The Python Tutorial',
    attribution: 'Python Docs',
    snippet: 'Official Python tutorial.',
    supporting_sources: [{
      url: 'https://example.com/python-note',
      title: 'Python note',
      attribution: 'Example',
      snippet: 'Supporting note for the transcript fixture.'
    }]
  });
  assert.deepEqual(web.web.safe_urls, [
    'https://docs.python.org/3/tutorial/index.html',
    'https://example.com/python-note'
  ]);

  assert.deepEqual(memory.memory.sources.map(source => ({
    citation_uuid: source.citation_uuid,
    title: source.title,
    category: source.category
  })), [
    { citation_uuid: 'mem-1', title: 'Prior design note', category: 'memory' },
    { citation_uuid: 'mem-2', title: 'transcript-plan.md', category: 'files' }
  ]);
});

test('citation ranges point back into canonical text without requiring provider-native metadata', async () => {
  const event = await finalEvent();
  const text = event.blocks[0].text;

  for (const citation of event.citations) {
    assert.equal(citation.type, 'citation');
    assert.equal(citation.source.provider, 'chatgpt');
    assert.equal(citation.source.record_id, 'final-1');
    assert.equal(citation.text_range.part_index, 0);
    assert.equal(
      text.slice(citation.text_range.start, citation.text_range.end),
      citation.matched_text
    );
  }

  const canonicalJson = JSON.stringify(event.citations);
  assert.doesNotMatch(canonicalJson, /content_references/);
  assert.doesNotMatch(canonicalJson, /search_result_groups/);
  assert.doesNotMatch(canonicalJson, /conversation_context_citation_metadata/);
});

test('non-citation alt-text reference is not forced into the citation schema', async () => {
  const event = await finalEvent();

  assert.equal(event.citations.some(citation => citation.matched_text.includes('Morris Plotkin')), false);
});

test('retrieved-file resolution uses a boolean because the established state is binary here', async () => {
  const event = await finalEvent();
  const citation = event.citations.find(item => item.citation_kind === 'retrieved_file');

  assert.equal(typeof citation.retrieved_file.resolved, 'boolean');
  assert.equal(citation.retrieved_file.resolved, true);
});

test('canonical citation golden preserves readable title-to-blurb vertical whitespace', async () => {
  const golden = await readFile(goldenUrl, 'utf8');

  assert.match(golden, /title="The Python Tutorial&#10;&#10;Official Python tutorial\."/);
  assert.match(golden, /title="Python note&#10;&#10;Supporting note for the transcript fixture\."/);
  assert.match(golden, /title="Prior design note&#10;&#10;Earlier design decision for the transcript fixture\."/);
  assert.match(golden, /title="transcript-plan\.md&#10;&#10;Checklist for transcript work\."/);
});
