import assert from 'node:assert/strict';
import test from 'node:test';

import * as core from '../src/index.js';

function block(id, text, source) {
  return {
    id,
    type: 'text',
    text,
    source
  };
}

function assistantEvent(id, sourceIndex, kind, channel, text) {
  const source = {
    provider: 'codex',
    record_id: `record:${sourceIndex}`,
    record_index: sourceIndex
  };
  return {
    id,
    provider: 'codex',
    kind,
    role: 'assistant',
    channel,
    content_type: 'text',
    visibility: 'visible',
    source_record_id: source.record_id,
    source_index: sourceIndex,
    blocks: [{
      id: `${id}:block`,
      type: kind === 'reasoning_summary' ? 'reasoning_summary' : 'text',
      ...(kind === 'reasoning_summary' ? { content: text } : { text }),
      source
    }],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source
  };
}

const MULTI_EVENT_TURN = Object.freeze([
  assistantEvent('event:reasoning', 0, 'reasoning_summary', null, 'duplicate'),
  assistantEvent('event:commentary', 1, 'commentary', 'commentary', 'duplicate'),
  assistantEvent('event:final', 2, 'message', 'final', 'duplicate')
]);

test('words in one multi-event Assistant turn retain exact event and block provenance', () => {
  const units = core.renderCanonicalHtmlUnits(MULTI_EVENT_TURN);
  assert.equal(units.length, 1);

  const duplicates = units[0].speech_words.filter(word => word.text === 'duplicate');
  assert.equal(duplicates.length, 3);
  assert.deepEqual(
    duplicates.map(word => word.provenance?.event_id),
    ['event:reasoning', 'event:commentary', 'event:final']
  );
  assert.deepEqual(
    duplicates.map(word => word.provenance?.block_id),
    [
      'event:reasoning:block',
      'event:commentary:block',
      'event:final:block'
    ]
  );
  assert.deepEqual(
    duplicates.map(word => word.provenance?.block_word_index),
    [0, 0, 0]
  );
});

test('locateCanonicalWord returns the same authoritative provenance as speech_words', () => {
  const unit = core.renderCanonicalHtmlUnits(MULTI_EVENT_TURN)[0];
  const commentary = unit.speech_words.find(
    word => word.provenance?.event_id === 'event:commentary'
  );
  assert.ok(commentary, 'Expected the commentary word to carry Core provenance.');

  const located = core.locateCanonicalWord(MULTI_EVENT_TURN, commentary.id);
  assert.ok(located);
  assert.deepEqual(located.word.provenance, commentary.provenance);
  assert.equal(located.unit.id, unit.id);
});

test('User Context and User body words retain distinct block provenance', () => {
  const source = {
    provider: 'codex',
    record_id: 'record:user',
    record_index: 0
  };
  const contextSource = { ...source, block_index: 0 };
  const promptSource = { ...source, block_index: 1 };
  const event = {
    id: 'event:user',
    provider: 'codex',
    kind: 'message',
    role: 'user',
    channel: 'final',
    content_type: 'text',
    visibility: 'visible',
    source_record_id: source.record_id,
    source_index: source.record_index,
    blocks: [
      {
        id: 'block:user-context',
        type: 'user_context',
        summary: '# Context from my IDE setup:',
        text: 'Context token',
        source: contextSource
      },
      block('block:user-prompt', 'Prompt token', promptSource)
    ],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source
  };

  const words = core.renderCanonicalHtmlUnits([event])[0].speech_words;
  const context = words.find(word => word.text === 'Context');
  const prompt = words.find(word => word.text === 'Prompt');
  assert.equal(context?.provenance?.event_id, 'event:user');
  assert.equal(context?.provenance?.block_id, 'block:user-context');
  assert.equal(context?.provenance?.source?.block_index, 0);
  assert.equal(prompt?.provenance?.event_id, 'event:user');
  assert.equal(prompt?.provenance?.block_id, 'block:user-prompt');
  assert.equal(prompt?.provenance?.source?.block_index, 1);
});

test('multiple text blocks in one presentation leaf retain exact block ownership', () => {
  const source = {
    provider: 'chatgpt',
    record_id: 'record:multi',
    record_index: 0
  };
  const event = {
    id: 'event:multi',
    provider: 'chatgpt',
    kind: 'message',
    role: 'assistant',
    channel: 'final',
    content_type: 'text',
    visibility: 'visible',
    source_record_id: source.record_id,
    source_index: source.record_index,
    blocks: [
      block('block:part:0', 'Alpha one', { ...source, part_index: 0 }),
      block('block:part:1', 'Beta two', { ...source, part_index: 1 })
    ],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source
  };

  const words = core.renderCanonicalHtmlUnits([event])[0].speech_words;
  assert.deepEqual(
    words.map(word => [
      word.text,
      word.provenance?.block_id,
      word.provenance?.block_word_index
    ]),
    [
      ['Alpha', 'block:part:0', 0],
      ['one', 'block:part:0', 1],
      ['Beta', 'block:part:1', 0],
      ['two', 'block:part:1', 1]
    ]
  );
});
