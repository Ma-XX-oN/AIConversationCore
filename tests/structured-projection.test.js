import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  adaptClaudeRecords,
  adaptCodexRecords,
  projectCanonicalConversation
} from '../src/index.js';

async function loadJsonl(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('structured projection preserves Claude canonical identity and render provenance', async () => {
  const records = await loadJsonl('./fixtures/claude/claude-rich-subagent.jsonl');
  const events = adaptClaudeRecords(records);
  const projection = projectCanonicalConversation(events);

  assert.equal(projection.schema_version, 2);
  assert.equal(projection.events, events);
  assert.deepEqual(projection.turns.map(turn => turn.event_ids), [
    [events[0].id],
    [events[1].id, events.at(-1).id]
  ]);

  const subagent = events.find(event => event.kind === 'subagent');
  assert.ok(subagent);
  const unit = projection.units.find(item => item.event_id === subagent.id);
  assert.ok(unit);
  assert.equal(unit.id, subagent.blocks[0].id);
  assert.equal(unit.source_index, subagent.source_index);
  assert.equal(unit.source_record_id, subagent.source_record_id);
  assert.equal(unit.block_type, 'subagent');
  assert.equal(unit.block.agent_id, subagent.blocks[0].agent_id);

  assert.equal(projection.presentation.schema_version, 2);
  assert.equal(
    projection.presentation.split_policy,
    'presentation-tree'
  );
  assert.equal(projection.presentation.tree.schema_version, 2);
  assert.ok(projection.presentation.structural_units.length > 0);
  for (const structuralUnit of projection.presentation.structural_units) {
    assert.equal(structuralUnit.atomic, true);
    assert.ok([
      'reasoning_group',
      'reasoning',
      'tool'
    ].includes(structuralUnit.kind));
    // This fixture intentionally omits Claude UUIDs. Canonical record indexes
    // therefore provide the stable source identity; source_record_ids are
    // populated only when the provider record actually supplies an ID.
    assert.ok(structuralUnit.source_indexes.length > 0);
    assert.ok(Array.isArray(structuralUnit.source_record_ids));
  }

  assert.match(projection.markdown, /<!-- record_index=0 -->/);
  assert.match(projection.markdown, /Claude Sub-agent/);
});

test('structured projection preserves Codex request input and source indexes', async () => {
  const records = await loadJsonl('./fixtures/codex/codex-rich.jsonl');
  const events = adaptCodexRecords(records);
  const projection = projectCanonicalConversation(events);

  const requestUnit = projection.units.find(item =>
    item.block_type === 'tool_call' && item.block.name === 'request_user_input');
  assert.ok(requestUnit);
  assert.equal(requestUnit.provider, 'codex');
  assert.equal(requestUnit.event_kind, 'tool_call');
  assert.ok(Number.isInteger(requestUnit.source_index));
  assert.ok(Array.isArray(requestUnit.block.request_user_input.questions));

  const responseUnit = projection.units.find(item =>
    item.block_type === 'tool_result' && item.block.request_user_input_response);
  assert.ok(responseUnit);
  assert.equal(
    responseUnit.block.call_id,
    requestUnit.block.call_id
  );
  assert.match(
    projection.markdown,
    new RegExp(`record_index=${requestUnit.source_index}`)
  );
});

test('structured projection does not mutate caller canonical events', () => {
  const events = [{
    id: 'test:event',
    provider: 'claude',
    source_record_id: 'source-1',
    source_index: 0,
    kind: 'message',
    role: 'user',
    channel: 'user',
    visibility: 'visible',
    content_type: 'message',
    blocks: [{
      id: 'test:block',
      type: 'text',
      text: 'Hello',
      source: { block_index: 0 }
    }],
    projection: { existing: true }
  }];
  const original = structuredClone(events);
  projectCanonicalConversation(events);
  assert.deepEqual(events, original);
});
