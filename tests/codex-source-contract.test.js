import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  loadConversationSources,
  projectCanonicalConversation
} from '../src/index.js';
import { adaptCodexRecords } from '../src/adapters/codex.js';

function jsonl(records) {
  return records.map(record => JSON.stringify(record)).join('\n') + '\n';
}

function records() {
  return [
    {
      timestamp: '2026-09-06T20:00:00.000Z',
      type: 'session_meta',
      payload: { id: '01a07804-bcf3-7af3-8321-bdcf0c1ddc89' }
    },
    {
      timestamp: '2026-09-06T20:00:01.000Z',
      type: 'turn_context',
      payload: { model: 'gpt-5.4' }
    },
    {
      timestamp: '2026-09-06T20:00:02.000Z',
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Original prompt' }
    },
    {
      timestamp: '2026-09-06T20:00:03.000Z',
      type: 'event_msg',
      payload: { type: 'turn_aborted' }
    },
    {
      timestamp: '2026-09-06T20:00:04.000Z',
      type: 'event_msg',
      payload: { type: 'thread_rolled_back', num_turns: 1 }
    },
    {
      timestamp: '2026-09-06T20:00:05.000Z',
      type: 'turn_context',
      payload: { model: 'gpt-5.5' }
    },
    {
      timestamp: '2026-09-06T20:00:06.000Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: '# Context from my IDE setup:\n\n## My request for Codex:\nEdited prompt'
      }
    }
  ];
}

test('loadConversationSources reads caller-supplied Codex files and owns JSONL parsing', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aicore-codex-source-'));
  try {
    const rollout = path.join(root, 'rollout.jsonl');
    const index = path.join(root, 'session_index.jsonl');
    writeFileSync(rollout, jsonl(records()), 'utf8');
    writeFileSync(index, jsonl([
      { id: '01a07804-bcf3-7af3-8321-bdcf0c1ddc89', thread_name: 'Find London time' },
      { id: '01a07804-bcf3-7af3-8321-bdcf0c1ddc89', thread_name: 'Find London time (MODIFIED)' }
    ]), 'utf8');

    const loaded = loadConversationSources({
      provider: 'codex',
      primarySource: { path: rollout },
      supplementarySources: {
        codexSessionIndex: { path: index }
      }
    });

    assert.equal(loaded.session_metadata.title, 'Find London time (MODIFIED)');
    assert.equal(loaded.session_metadata.title_source, 'codex-session-index');
    assert.equal(loaded.records.length, records().length);
    assert.doesNotMatch(loaded.projection.markdown, /Original prompt/);
    assert.match(loaded.projection.markdown, /## User \(edited\)/);
    assert.match(loaded.projection.markdown, /# Context from my IDE setup:/);
    assert.match(loaded.projection.markdown, /Edited prompt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadConversationSources accepts in-memory text and exposes rolled-back history only when requested', () => {
  const loaded = loadConversationSources({
    provider: 'codex',
    primarySource: { text: jsonl(records()) },
    options: { includeRolledBackTurns: true }
  });

  assert.match(loaded.projection.markdown, /## User \(original, aborted\)[\s\S]*Original prompt/);
  assert.match(loaded.projection.markdown, /## User \(edited\)/);
});

test('structured projection carries the same revision and aborted status as Markdown', () => {
  const events = adaptCodexRecords(records(), { includeRolledBackTurns: true });
  const projection = projectCanonicalConversation(events);
  const userTurns = projection.presentation.tree.turns.filter(turn =>
    turn?.actor?.role === 'user');

  assert.deepEqual(userTurns.map(turn => turn.actor.label), [
    'User (original, aborted)',
    'User (edited)'
  ]);
  assert.equal(userTurns[0].actor.revision_status, 'original');
  assert.equal(userTurns[0].actor.execution_status, 'aborted');
  assert.equal(userTurns[1].actor.revision_status, 'edited');
  assert.equal(userTurns[1].actor.execution_status, 'completed');
  assert.match(projection.markdown, /## User \(original, aborted\)/);
  assert.match(projection.markdown, /## User \(edited\)/);
});

test('unchanged Codex model does not emit a duplicate model-change notice', () => {
  const sameModel = records().map(record => {
    if (record?.type === 'turn_context') {
      return { ...record, payload: { ...record.payload, model: 'gpt-5.5' } };
    }
    return record;
  });
  const events = adaptCodexRecords(sameModel, { includeRolledBackTurns: true });
  assert.equal(events.filter(event => event.content_type === 'model_change').length, 0);
});
