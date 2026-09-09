import assert from 'node:assert/strict';
import test from 'node:test';

import * as core from '../src/index.js';

const USER_CONTEXT_EVENT = Object.freeze({
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
        '## Open tabs:\n- example.jsonl: sessions/example.jsonl'
    }),
    Object.freeze({
      type: 'text',
      text: 'Actual user prompt.'
    })
  ]),
  citations: Object.freeze([]),
  resources: Object.freeze([])
});

function reasoningToolFixture() {
  return [
    {
      id: 'event:reasoning:1',
      provider: 'codex',
      kind: 'reasoning_summary',
      role: 'assistant',
      channel: 'analysis',
      content_type: 'text',
      visibility: 'visible',
      source_record_id: 'record:reasoning:1',
      source_index: 0,
      blocks: [{
        type: 'reasoning_summary',
        content: 'Inspecting the current implementation.'
      }]
    },
    {
      id: 'event:tool-call:1',
      provider: 'codex',
      kind: 'tool_call',
      role: 'assistant',
      channel: 'analysis',
      content_type: 'tool_call',
      visibility: 'visible',
      source_record_id: 'record:tool-call:1',
      source_index: 1,
      relationships: { tool_call_id: 'call-1' },
      blocks: [{
        type: 'tool_call',
        call_id: 'call-1',
        name: 'shell',
        input: { description: 'Inspect source' }
      }]
    },
    {
      id: 'event:tool-result:1',
      provider: 'codex',
      kind: 'tool_result',
      role: 'assistant',
      channel: 'analysis',
      content_type: 'tool_result',
      visibility: 'visible',
      source_record_id: 'record:tool-result:1',
      source_index: 2,
      relationships: { tool_call_id: 'call-1' },
      blocks: [{
        type: 'tool_result',
        call_id: 'call-1',
        name: 'shell',
        output: 'source output'
      }]
    },
    {
      id: 'event:assistant:1',
      provider: 'codex',
      kind: 'message',
      role: 'assistant',
      channel: 'final',
      content_type: 'text',
      visibility: 'visible',
      source_record_id: 'record:assistant:1',
      source_index: 3,
      blocks: [{ type: 'text', text: 'Finished.' }]
    }
  ];
}

test('single-anchor User Context is a declared atomic presentation boundary', () => {
  const presentation = core.buildCanonicalPresentation([USER_CONTEXT_EVENT]);
  const context = presentation.turns[0]?.children?.find(
    child => child?.kind === 'user_context'
  );

  assert.ok(context, 'Expected one canonical User Context presentation node.');
  assert.equal(
    context.atomic,
    true,
    'User Context must declare its atomicity in Core rather than requiring a caller to infer it from <details>.'
  );
});

test('Core exposes complete rendered HTML units with stable source identity', () => {
  assert.equal(
    typeof core.renderCanonicalHtmlUnits,
    'function',
    'Core must expose a rendered-unit API instead of requiring consumers to split completed HTML.'
  );

  const events = [USER_CONTEXT_EVENT];
  const units = core.renderCanonicalHtmlUnits(events);
  assert.equal(units.length, 1);

  const [unit] = units;
  assert.equal(unit.kind, 'turn');
  assert.equal(unit.atomic, true);
  assert.equal(unit.source.length, 1);
  assert.equal(unit.source[0].record_id, 'record:user-context:1');
  assert.equal(unit.source[0].record_index, 0);
  assert.match(unit.html, /<blockquote class="user-context">/);
  assert.match(unit.html, /<details class="user-context-details"/);
  assert.match(unit.html, /Actual user prompt\./);
  assert.equal(
    units.map(item => item.html).join(''),
    core.renderCanonicalHtml(events),
    'Concatenating Core units must reproduce the complete canonical HTML exactly.'
  );
});

test('reasoning and tool disclosures cannot be split by legal rendered-unit boundaries', () => {
  assert.equal(
    typeof core.renderCanonicalHtmlUnits,
    'function',
    'Core must expose a rendered-unit API instead of requiring consumers to discover boundaries.'
  );

  const events = reasoningToolFixture();
  const presentation = core.buildCanonicalPresentation(events);
  const group = presentation.turns[0]?.children?.find(
    child => child?.kind === 'reasoning_group'
  );
  assert.ok(group);
  assert.equal(group.atomic, true);
  assert.equal(group.children.some(child => child?.kind === 'tool'), true);

  const units = core.renderCanonicalHtmlUnits(events);
  assert.equal(units.length, 1);
  assert.deepEqual(
    units[0].source.map(source => source.record_id),
    [
      'record:reasoning:1',
      'record:tool-call:1',
      'record:tool-result:1',
      'record:assistant:1'
    ]
  );
  assert.match(units[0].html, /<details class="reasoning"/);
  assert.match(units[0].html, /<details class="tool"/);
  assert.equal(
    units[0].html,
    core.renderCanonicalHtml(events),
    'A one-turn fixture must render identically through the unit and complete APIs.'
  );
});


test('revision visibility is preserved identically in complete and unit HTML', () => {
  const historical = {
    ...USER_CONTEXT_EVENT,
    id: 'event:user-context:historical',
    source_record_id: 'record:user-context:historical',
    revision_status: 'original',
    revision_depth: 0,
    rolled_back: true
  };
  const units = core.renderCanonicalHtmlUnits([historical], {
    includeRolledBackTurns: false
  });
  const html = core.renderCanonicalHtml([historical], {
    includeRolledBackTurns: false
  });

  assert.equal(units.length, 1);
  assert.equal(units[0].html, html);
  assert.match(units[0].html, /class="transcript-turn revision-original"/);
  assert.match(units[0].html, /data-revision-status="original"/);
  assert.match(units[0].html, /data-revision-depth="0"/);
  assert.match(units[0].html, / hidden>/);
});

test('equivalent provider turns use the same complete-unit boundary policy', () => {
  for (const provider of ['chatgpt', 'claude', 'codex']) {
    const event = {
      ...USER_CONTEXT_EVENT,
      id: `event:user-context:${provider}`,
      provider,
      source_record_id: `record:user-context:${provider}`
    };
    const units = core.renderCanonicalHtmlUnits([event]);
    assert.equal(units.length, 1, provider);
    assert.equal(units[0].kind, 'turn', provider);
    assert.equal(units[0].atomic, true, provider);
    assert.equal(units[0].source[0].provider, provider);
    assert.match(units[0].html, /<details class="user-context-details"/);
  }
});

test('subagent presentation is returned as one complete Core unit', () => {
  const event = {
    id: 'event:subagent:1',
    provider: 'claude',
    kind: 'subagent',
    role: 'assistant',
    channel: 'final',
    content_type: 'subagent',
    visibility: 'visible',
    source_record_id: 'record:subagent:1',
    source_index: 0,
    blocks: [{
      type: 'subagent',
      agent_id: 'worker-1',
      output: 'Subagent result.'
    }]
  };
  const units = core.renderCanonicalHtmlUnits([event]);
  assert.equal(units.length, 1);
  assert.equal(units[0].atomic, true);
  assert.equal(units[0].source[0].record_id, 'record:subagent:1');
  assert.match(units[0].html, /<h2>Claude Sub-agent worker-1<\/h2>/);
  assert.match(units[0].html, /Subagent result\./);
});
