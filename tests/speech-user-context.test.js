import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptSpeechSessionRecords,
  renderCanonicalHtml,
  renderCanonicalMarkdown
} from '../src/index.js';

const contextMessage = [
  '# Context from my IDE setup:',
  '',
  '## Active file: sessions/example.jsonl',
  '',
  '## Open tabs:',
  '- sessions/example.jsonl',
  '',
  '## My request for Codex:',
  'What time is it in Paris?'
].join('\n');

const contextRecord = {
  type: 'event_msg',
  timestamp: '2026-09-07T00:00:00Z',
  payload: {
    type: 'user_message',
    message: contextMessage
  }
};

const plainRecord = {
  type: 'event_msg',
  timestamp: '2026-09-07T00:00:00Z',
  payload: {
    type: 'user_message',
    message: 'What time is it in Paris?'
  }
};

function userMessage(events) {
  return events.find(event => event?.role === 'user' && event?.kind === 'message');
}

function block(event, type) {
  return event?.blocks?.find(item => item?.type === type);
}

test('Codex user-context speech is disabled by default while the prompt remains speakable', () => {
  const events = adaptSpeechSessionRecords('codex', [contextRecord]);
  const user = userMessage(events);
  const context = block(user, 'user_context');
  const prompt = block(user, 'text');

  assert.ok(context);
  assert.deepEqual(context.speech, {
    eligible: false,
    voice_role: 'user_context'
  });
  assert.ok(prompt);
  assert.equal(prompt.text, 'What time is it in Paris?');
  assert.deepEqual(prompt.speech, {
    eligible: true,
    voice_role: 'user'
  });
});

test('includeUserContext enables context speech before the normal User prompt', () => {
  const events = adaptSpeechSessionRecords('codex', [contextRecord], {
    includeUserContext: true
  });
  const user = userMessage(events);

  assert.deepEqual(user.blocks.map(item => item.type), ['user_context', 'text']);
  assert.deepEqual(user.blocks[0].speech, {
    eligible: true,
    voice_role: 'user_context'
  });
  assert.deepEqual(user.blocks[1].speech, {
    eligible: true,
    voice_role: 'user'
  });
});

test('includeUserContext has no effect when the User message has no IDE context', () => {
  for (const includeUserContext of [false, true]) {
    const events = adaptSpeechSessionRecords('codex', [plainRecord], {
      includeUserContext
    });
    const user = userMessage(events);

    assert.equal(user.blocks.length, 1);
    assert.equal(user.blocks[0].type, 'text');
    assert.equal(user.blocks[0].text, 'What time is it in Paris?');
    assert.deepEqual(user.blocks[0].speech, {
      eligible: true,
      voice_role: 'user'
    });
  }
});

test('speech selection metadata never changes canonical Markdown or HTML', () => {
  const disabled = adaptSpeechSessionRecords('codex', [contextRecord], {
    includeUserContext: false
  });
  const enabled = adaptSpeechSessionRecords('codex', [contextRecord], {
    includeUserContext: true
  });

  assert.equal(renderCanonicalMarkdown(disabled), renderCanonicalMarkdown(enabled));
  assert.equal(renderCanonicalHtml(disabled), renderCanonicalHtml(enabled));
  assert.match(renderCanonicalMarkdown(enabled), /<details><summary># Context from my IDE setup:<\/summary>/);
  assert.match(renderCanonicalHtml(enabled), /<details class="user-context-details"/);
});
