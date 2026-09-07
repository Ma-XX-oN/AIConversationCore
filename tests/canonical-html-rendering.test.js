import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderCanonicalHtml,
  renderCanonicalMarkdown
} from '../src/index.js';

const NORMALIZED_USER_CONTEXT_EVENT = Object.freeze({
  id: 'event:user-context:1',
  provider: 'codex',
  kind: 'message',
  role: 'user',
  channel: 'final',
  content_type: 'text',
  visibility: 'visible',
  source_record_id: 'record:user-context:1',
  source_index: 0,
  blocks: Object.freeze([
    Object.freeze({
      type: 'user_context',
      summary: '# Context from my IDE setup:',
      text: '## Active file: sessions/example.jsonl\n\n' +
        '## Active selection of the file:\n' +
        ' the repo instructions and the current transcript script first\n' +
        '## Open tabs:\n' +
        '- example.jsonl: sessions/example.jsonl'
    }),
    Object.freeze({
      type: 'text',
      text: "I'm doing some testing. What time is it in Paris?"
    })
  ]),
  citations: Object.freeze([]),
  resources: Object.freeze([])
});

function normalizedFixture() {
  return [NORMALIZED_USER_CONTEXT_EVENT];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function deterministicMarkdownFragment(markdown) {
  return `<div class="markdown-fixture">${escapeHtml(markdown)}</div>`;
}

test('the same normalized User-context fixture renders through both Core paths', () => {
  const events = normalizedFixture();

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

  const html = renderCanonicalHtml(events, {
    renderMarkdown: deterministicMarkdownFragment
  });

  assert.match(html, /<h2>User<\/h2>/);
  assert.match(html, /<blockquote class="transcript-turn-body">/);
  assert.match(html, /<blockquote class="user-context">\s*<details class="user-context-details"[^>]*>\s*<summary># Context from my IDE setup:<\/summary>/);
  assert.match(html, /## Active file: sessions\/example\.jsonl/);
  assert.match(html, /## Active selection of the file:/);
  assert.match(html, /## Open tabs:/);
  assert.equal(html.includes('## My request for Codex:'), false);

  const detailsEnd = html.indexOf('</details>');
  const promptStart = html.indexOf('I&#39;m doing some testing. What time is it in Paris?');
  assert.notEqual(detailsEnd, -1);
  assert.notEqual(promptStart, -1);
  assert.ok(promptStart > detailsEnd, 'The actual User prompt must remain outside the context disclosure.');
});

test('the same normalized no-context fixture emits no empty HTML disclosure', () => {
  const event = {
    ...NORMALIZED_USER_CONTEXT_EVENT,
    id: 'event:user:plain',
    source_record_id: 'record:user:plain',
    blocks: [{ type: 'text', text: 'Plain user prompt.' }]
  };
  const events = [event];

  assert.equal(renderCanonicalMarkdown(events).trimEnd(), '## User\n\n> Plain user prompt.');
  const html = renderCanonicalHtml(events, {
    renderMarkdown: deterministicMarkdownFragment
  });
  assert.equal(html.includes('user-context-details'), false);
  assert.match(html, /Plain user prompt\./);
});
