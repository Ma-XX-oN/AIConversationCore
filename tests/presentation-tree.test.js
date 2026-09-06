import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCanonicalPresentation } from '../src/projections/presentation.js';

function source(provider, index, id) {
  return { provider, record_index: index, record_id: id };
}

function reasoning(provider, index, text) {
  const id = `${provider}:reasoning:${index}`;
  return {
    id,
    provider,
    source_record_id: id,
    source_index: index,
    kind: 'reasoning_summary',
    role: 'assistant',
    channel: null,
    visibility: 'visible',
    content_type: 'reasoning',
    blocks: [{
      id: `${id}:block`,
      type: 'reasoning_summary',
      summary: null,
      content: text,
      source: source(provider, index, id)
    }],
    source: source(provider, index, id)
  };
}

function message(provider, index, role, text, kind = 'message') {
  const id = `${provider}:${role}:${kind}:${index}`;
  return {
    id,
    provider,
    source_record_id: id,
    source_index: index,
    kind,
    role,
    channel: kind === 'commentary' ? 'commentary' : null,
    visibility: 'visible',
    content_type: 'text',
    blocks: [{
      id: `${id}:block`,
      type: 'text',
      text,
      source: source(provider, index, id)
    }],
    source: source(provider, index, id)
  };
}

function toolCall(provider, index, callId, name = 'Bash') {
  const id = `${provider}:tool-call:${index}`;
  return {
    id,
    provider,
    source_record_id: id,
    source_index: index,
    kind: 'tool_call',
    role: 'assistant',
    visibility: 'visible',
    content_type: 'tool_call',
    blocks: [{
      id: `${id}:block`,
      type: 'tool_call',
      call_id: callId,
      name,
      input: { command: 'pwd' },
      source: source(provider, index, id)
    }],
    relationships: { tool_call_id: callId },
    source: source(provider, index, id)
  };
}

function toolResult(provider, index, callId, name = 'Bash') {
  const id = `${provider}:tool-result:${index}`;
  return {
    id,
    provider,
    source_record_id: id,
    source_index: index,
    kind: 'tool_result',
    role: 'user',
    visibility: 'visible',
    content_type: 'tool_result',
    blocks: [{
      id: `${id}:block`,
      type: 'tool_result',
      call_id: callId,
      name,
      output: '/tmp',
      source: source(provider, index, id)
    }],
    relationships: { tool_call_id: callId },
    source: source(provider, index, id)
  };
}

function canonicalScenario(provider) {
  return [
    message(provider, 0, 'user', 'Question'),
    reasoning(provider, 1, 'A'),
    reasoning(provider, 2, 'B'),
    toolCall(provider, 3, 'call-1'),
    toolResult(provider, 4, 'call-1'),
    reasoning(provider, 5, 'C'),
    message(provider, 6, 'assistant', 'Visible response'),
    reasoning(provider, 7, 'D'),
    message(provider, 8, 'assistant', 'Second visible response')
  ];
}

function semanticShape(presentation) {
  return presentation.turns.map(turn => ({
    role: turn.actor.role,
    children: turn.children.map(child => child.kind === 'reasoning_group'
      ? {
          kind: child.kind,
          thought_count: child.thought_count,
          children: child.children.map(item => ({
            kind: item.kind,
            has_result: item.kind === 'tool' ? Boolean(item.result) : undefined
          }))
        }
      : { kind: child.kind })
  }));
}

test('equivalent ChatGPT, Claude, and Codex semantics produce the same presentation grammar', () => {
  const shapes = ['chatgpt', 'claude', 'codex'].map(provider =>
    semanticShape(buildCanonicalPresentation(canonicalScenario(provider))));

  assert.deepEqual(shapes[1], shapes[0]);
  assert.deepEqual(shapes[2], shapes[0]);
  assert.deepEqual(shapes[0], [
    {
      role: 'user',
      children: [{ kind: 'markdown' }]
    },
    {
      role: 'assistant',
      children: [
        {
          kind: 'reasoning_group',
          thought_count: 3,
          children: [
            { kind: 'reasoning', has_result: undefined },
            { kind: 'reasoning', has_result: undefined },
            { kind: 'tool', has_result: true },
            { kind: 'reasoning', has_result: undefined }
          ]
        },
        { kind: 'markdown' },
        {
          kind: 'reasoning_group',
          thought_count: 1,
          children: [{ kind: 'reasoning', has_result: undefined }]
        },
        { kind: 'markdown' }
      ]
    }
  ]);
});

test('paragraphs inside one reasoning record remain one thought', () => {
  const presentation = buildCanonicalPresentation([
    reasoning('claude', 0, 'Paragraph one.\n\nParagraph two.\n\nParagraph three.')
  ]);

  const group = presentation.turns[0].children[0];
  assert.equal(group.kind, 'reasoning_group');
  assert.equal(group.thought_count, 1);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].blocks[0].content,
    'Paragraph one.\n\nParagraph two.\n\nParagraph three.');
});

test('ordinary tools are subordinate to the active reasoning group', () => {
  const presentation = buildCanonicalPresentation([
    reasoning('claude', 0, 'Need a command.'),
    toolCall('claude', 1, 'call-1'),
    toolResult('claude', 2, 'call-1'),
    message('claude', 3, 'assistant', 'Done.')
  ]);

  const turn = presentation.turns[0];
  assert.equal(turn.children[0].kind, 'reasoning_group');
  assert.equal(turn.children[0].children[1].kind, 'tool');
  assert.equal(turn.children[0].children[1].result.output, '/tmp');
  assert.equal(turn.children[1].kind, 'markdown');
});

test('commentary between reasoning tools remains inside the active group', () => {
  const presentation = buildCanonicalPresentation([
    reasoning('codex', 0, 'Need to inspect local state.'),
    toolCall('codex', 1, 'call-1', 'shell_command'),
    toolResult('codex', 2, 'call-1', 'shell_command'),
    message(
      'codex',
      3,
      'assistant',
      'I’ll load the local Codex memory for this turn, then answer plainly.',
      'commentary'),
    toolCall('codex', 4, 'call-2', 'shell_command'),
    toolResult('codex', 5, 'call-2', 'shell_command'),
    message('codex', 6, 'assistant', 'Final answer.')
  ]);

  const turn = presentation.turns[0];
  assert.equal(turn.children.length, 2);
  const group = turn.children[0];
  assert.equal(group.kind, 'reasoning_group');
  assert.deepEqual(
    group.children.map(child => child.kind),
    ['reasoning', 'tool', 'commentary', 'tool']);
  assert.equal(group.children[2].blocks[0].text,
    'I’ll load the local Codex memory for this turn, then answer plainly.');
  assert.equal(turn.children[1].kind, 'markdown');
  assert.equal(turn.children[1].blocks[0].text, 'Final answer.');
});
