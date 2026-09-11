import assert from 'node:assert/strict';
import test from 'node:test';

import * as core from '../src/index.js';

function messageEvent(id, sourceIndex, role, text) {
  return {
    id,
    provider: 'codex',
    kind: 'message',
    role,
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

function allSpeechWords(units) {
  return units.flatMap(unit => unit.speech_words ?? []);
}

test('canonical HTML and speech words share one global monotonically increasing word identity', () => {
  const events = [
    messageEvent(
      'event:user:1',
      0,
      'user',
      'START=2026-08-25T11:39:35.4401545-04:00 turn_id**s**'
    ),
    messageEvent(
      'event:assistant:1',
      1,
      'assistant',
      'ELAPSED=2:13.234'
    )
  ];

  const units = core.renderCanonicalHtmlUnits(events);
  assert.equal(units.length, 2);

  const words = allSpeechWords(units);
  assert.ok(words.length > 0, 'Core must project interactive speech words.');
  assert.deepEqual(
    words.map(word => word.id),
    Array.from({ length: words.length }, (_, index) => index + 1),
    'Word IDs must be globally monotonic and contiguous in canonical transcript order.'
  );

  const fractionalSeconds = words.find(word => word.text === '35.4401545');
  const elapsed = words.find(word => word.text === '13.234');
  const splitMarkup = words.find(word => word.text === 'turn_ids');
  assert.ok(fractionalSeconds, 'Fractional seconds must be one canonical word.');
  assert.ok(elapsed, 'Elapsed fractional seconds must be one canonical word.');
  assert.ok(splitMarkup, 'Inline Markdown must not split one canonical word identity.');

  const html = units.map(unit => unit.html).join('');
  assert.match(
    html,
    new RegExp(`<span id="word-${fractionalSeconds.id}">35\\.4401545<\\/span>`)
  );
  assert.match(
    html,
    new RegExp(`<span id="word-${elapsed.id}">13\\.234<\\/span>`)
  );
  assert.match(
    html,
    new RegExp(`<span id="word-${splitMarkup.id}">turn_id<\\/span>`)
  );
  assert.match(
    html,
    new RegExp(`<span data-word-id="${splitMarkup.id}">s<\\/span>`)
  );
});

test('Core-owned semantic containers remain the grouping authority around canonical word IDs', () => {
  const event = {
    ...messageEvent('event:user-context:1', 0, 'user', 'Prompt.'),
    blocks: [
      {
        id: 'event:user-context:1:block:0',
        type: 'user_context',
        summary: '# Context from my IDE setup:',
        text: 'Active file: example.md'
      },
      {
        id: 'event:user-context:1:block:1',
        type: 'text',
        text: 'Prompt.'
      }
    ]
  };

  const [unit] = core.renderCanonicalHtmlUnits([event]);
  const contextWord = unit.speech_words.find(word => word.text === 'Active');
  const promptWord = unit.speech_words.find(word => word.text === 'Prompt');
  assert.ok(contextWord && promptWord);
  assert.match(
    unit.html,
    /<summary># Context from my IDE setup:<\/summary>/,
    'Generated disclosure summaries are display structure, not canonical words.'
  );
  assert.equal(
    unit.html.includes('<summary><span'),
    false,
    'Generated disclosure summaries must not acquire word identities.'
  );
  assert.match(
    unit.html,
    new RegExp(
      `<blockquote class="user-context"><details class="user-context-details"[^>]*>[\\s\\S]*` +
      `<span id="word-${contextWord.id}">Active<\\/span>[\\s\\S]*<\\/details><\\/blockquote>`
    )
  );
  assert.match(
    unit.html,
    new RegExp(`<span id="word-${promptWord.id}">Prompt<\\/span>`)
  );
});
