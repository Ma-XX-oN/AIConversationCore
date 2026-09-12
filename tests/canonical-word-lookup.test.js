import assert from 'node:assert/strict';
import test from 'node:test';

import * as core from '../src/index.js';

function messageEvent(id, sourceIndex, text) {
  return {
    id,
    provider: 'codex',
    kind: 'message',
    role: sourceIndex % 2 === 0 ? 'user' : 'assistant',
    channel: 'final',
    content_type: 'text',
    visibility: 'visible',
    source_record_id: `record:${sourceIndex}`,
    source_index: sourceIndex,
    blocks: [{
      id: `${id}:block:0`,
      type: 'text',
      text
    }],
    citations: [],
    resources: []
  };
}

test('word lookup resolves a canonical unit outside the currently materialized window', () => {
  assert.equal(
    typeof core.locateCanonicalWord,
    'function',
    'Core must expose high-level lookup by canonical word ID.'
  );

  const events = [
    messageEvent('event:lookup:0', 0, 'first window'),
    messageEvent('event:lookup:1', 1, 'middle window'),
    messageEvent('event:lookup:2', 2, 'target window')
  ];
  const units = core.renderCanonicalHtmlUnits(events);
  const materializedUnits = units.slice(0, 1);
  const targetWord = units[2].speech_words[0];

  assert.equal(
    materializedUnits.some(unit =>
      unit.speech_words.some(word => word.id === targetWord.id)
    ),
    false,
    'The regression must request a word outside the simulated materialized window.'
  );

  const location = core.locateCanonicalWord(events, targetWord.id);
  assert.ok(location);
  assert.equal(location.word.id, targetWord.id);
  assert.equal(location.unit.id, units[2].id);
  assert.equal(location.unit.html, units[2].html);
});

test('duplicate visible text cannot impersonate the requested canonical word ID', () => {
  const events = [
    messageEvent('event:duplicate:0', 0, 'duplicate first'),
    messageEvent('event:duplicate:1', 1, 'duplicate second')
  ];
  const units = core.renderCanonicalHtmlUnits(events);
  const firstDuplicate = units[0].speech_words.find(word => word.text === 'duplicate');
  const secondDuplicate = units[1].speech_words.find(word => word.text === 'duplicate');
  assert.ok(firstDuplicate && secondDuplicate);
  assert.notEqual(firstDuplicate.id, secondDuplicate.id);

  const location = core.locateCanonicalWord(events, secondDuplicate.id);
  assert.ok(location);
  assert.equal(location.word.id, secondDuplicate.id);
  assert.equal(location.word.text, 'duplicate');
  assert.equal(location.unit.id, units[1].id);
  assert.notEqual(location.unit.id, units[0].id);
});

test('boundary word IDs resolve to the correct adjacent canonical units', () => {
  const events = [
    messageEvent('event:boundary:0', 0, 'alpha omega'),
    messageEvent('event:boundary:1', 1, 'beta gamma')
  ];
  const units = core.renderCanonicalHtmlUnits(events);
  const leftBoundary = units[0].speech_words.at(-1);
  const rightBoundary = units[1].speech_words[0];
  assert.ok(leftBoundary && rightBoundary);
  assert.equal(rightBoundary.id, leftBoundary.id + 1);

  const left = core.locateCanonicalWord(events, leftBoundary.id);
  const right = core.locateCanonicalWord(events, rightBoundary.id);
  assert.equal(left?.word.id, leftBoundary.id);
  assert.equal(left?.unit.id, units[0].id);
  assert.equal(right?.word.id, rightBoundary.id);
  assert.equal(right?.unit.id, units[1].id);
});

test('valid but absent canonical word IDs resolve to null without text fallback', () => {
  const events = [messageEvent('event:absent:0', 0, 'only words')];
  const units = core.renderCanonicalHtmlUnits(events);
  const absentWordId = units[0].speech_words.at(-1).id + 100;
  assert.equal(core.locateCanonicalWord(events, absentWordId), null);
});
