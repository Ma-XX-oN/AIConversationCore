import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adaptSpeechSessionRecords } from '../src/index.js';

const fixtureUrl = new URL('./fixtures/claude/claude-subagent.jsonl', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('speech-session metadata keeps display subagents while preserving v212 speech eligibility', async () => {
  const records = await loadJsonl(fixtureUrl);
  const events = adaptSpeechSessionRecords('claude', records);

  const direct = events.find(event => event.kind === 'subagent' && event.source_index === 2);
  const queued = events.find(event => event.kind === 'subagent' && event.source_index === 3);

  assert.ok(direct);
  assert.equal(direct.speech.eligible, false);
  assert.deepEqual(direct.speech.background_work_identity, {
    kind: 'tool_call',
    id: 'toolu_123'
  });

  assert.ok(queued);
  assert.equal(queued.speech.eligible, true);
  assert.deepEqual(queued.speech.background_work_identity, {
    kind: 'task_timestamp',
    id: 'child-opaque-9'
  });
});

test('direct Claude completion with general-purpose toolUseResult is speech eligible', () => {
  const records = [
    {
      type: 'assistant',
      timestamp: '2026-09-05T00:00:00Z',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'toolu-direct',
          name: 'Agent',
          input: { description: 'Review' }
        }]
      }
    },
    {
      type: 'user',
      timestamp: '2026-09-05T00:00:02Z',
      toolUseResult: {
        agentType: 'general-purpose',
        totalDurationMs: 2000
      },
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'toolu-direct',
          content: 'agentId: direct-1 (internal ID - do not mention to user.)\nComplete.'
        }]
      }
    }
  ];

  const events = adaptSpeechSessionRecords('claude', records);
  const completion = events.find(event => event.kind === 'subagent');
  assert.ok(completion);
  assert.equal(completion.speech.eligible, true);
  assert.deepEqual(completion.speech.background_work_identity, {
    kind: 'tool_call',
    id: 'toolu-direct'
  });
});
