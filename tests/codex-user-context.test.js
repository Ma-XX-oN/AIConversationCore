import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptCodexRecords,
  buildCanonicalPresentation,
  renderCanonicalMarkdown
} from '../src/index.js';

const CONTEXT_MESSAGE = `# Context from my IDE setup:

## Active file: sessions/example.jsonl

## Active selection of the file:
 the repo instructions and the current transcript script first
## Open tabs:
- example.jsonl: sessions/example.jsonl

## My request for Codex:
I'm doing some testing. What time is it in Paris?`;

test('Codex IDE context is semantic and renders as blockquoted details before the prompt', () => {
  const events = adaptCodexRecords([{
    type: 'event_msg',
    timestamp: '2026-09-06T15:17:11.000Z',
    payload: { type: 'user_message', message: CONTEXT_MESSAGE }
  }]);

  assert.equal(events.length, 1);
  assert.deepEqual(events[0].blocks.map(block => block.type), ['user_context', 'text']);
  assert.equal(events[0].blocks[0].summary, '# Context from my IDE setup:');
  assert.equal(events[0].blocks[0].text,
    '## Active file: sessions/example.jsonl\n\n' +
    '## Active selection of the file:\n' +
    ' the repo instructions and the current transcript script first\n' +
    '## Open tabs:\n' +
    '- example.jsonl: sessions/example.jsonl');
  assert.equal(events[0].blocks[1].text,
    "I'm doing some testing. What time is it in Paris?");

  const markdown = renderCanonicalMarkdown(events).trimEnd();
  assert.equal(markdown, `## User

> <details><summary># Context from my IDE setup:</summary>
>
> ## Active file: sessions/example.jsonl
>
> ## Active selection of the file:
>  the repo instructions and the current transcript script first
> ## Open tabs:
> - example.jsonl: sessions/example.jsonl
>
> </details>

I'm doing some testing. What time is it in Paris?`);
  assert.equal(markdown.includes('## My request for Codex:'), false);

  const presentation = buildCanonicalPresentation(events);
  assert.equal(presentation.turns.length, 1);
  assert.deepEqual(
    presentation.turns[0].children.map(child => child.kind),
    ['user_context', 'markdown']
  );
  assert.equal(presentation.turns[0].children[0].blocks[0].type, 'user_context');
  assert.equal(presentation.turns[0].children[1].blocks[0].text,
    "I'm doing some testing. What time is it in Paris?");
});

test('ordinary Codex user messages retain the existing single text block and quoted rendering', () => {
  const events = adaptCodexRecords([{
    type: 'event_msg',
    timestamp: '2026-09-06T15:18:00.000Z',
    payload: { type: 'user_message', message: 'Plain user prompt.' }
  }]);

  assert.deepEqual(events[0].blocks.map(block => block.type), ['text']);
  assert.equal(events[0].blocks[0].text, 'Plain user prompt.');
  assert.equal(renderCanonicalMarkdown(events).trimEnd(), '## User\n\n> Plain user prompt.');
});

test('a context heading without a request marker is preserved as ordinary user text', () => {
  const message = '# Context from my IDE setup:\n\n## Active file: example.txt';
  const events = adaptCodexRecords([{
    type: 'event_msg',
    timestamp: '2026-09-06T15:19:00.000Z',
    payload: { type: 'user_message', message }
  }]);

  assert.deepEqual(events[0].blocks.map(block => block.type), ['text']);
  assert.equal(events[0].blocks[0].text, message);
});
