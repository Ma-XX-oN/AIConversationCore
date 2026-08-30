import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptClaudeRecords, renderCanonicalMarkdown } from '../src/index.js';

function render(records) {
  return renderCanonicalMarkdown(adaptClaudeRecords(records));
}

test('Claude thinking escapes nested blockquote HTML outside fenced code', () => {
  const markdown = render([
    {
      type: 'user',
      timestamp: '2026-01-01T00:00:01.000Z',
      message: { role: 'user', content: [{ type: 'text', text: 'Explain HTML tags.' }] }
    },
    {
      type: 'assistant',
      timestamp: '2026-01-01T00:00:02.000Z',
      message: {
        role: 'assistant',
        content: [{
          type: 'thinking',
          thinking: [
            'Normal line - fine.',
            '> <details>Outside fence - should be escaped.',
            '',
            '```',
            '> <code>Inside fence - should NOT be escaped.',
            '```',
            '',
            '> <span>After fence - should also be escaped.</span>'
          ].join('\n')
        }]
      }
    }
  ]);

  assert.match(markdown, /> > &lt;details>Outside fence - should be escaped\./);
  assert.match(markdown, /> > <code>Inside fence - should NOT be escaped\./);
  assert.match(markdown, /> > &lt;span>After fence - should also be escaped\.<\/span>/);
});

test('Claude ExitPlanMode approval collapses historical Approved Plan heading forms', () => {
  const markdown = render([
    {
      type: 'user',
      timestamp: '2026-01-01T00:00:01.000Z',
      message: { role: 'user', content: [{ type: 'text', text: 'Please plan this task.' }] }
    },
    {
      type: 'assistant',
      timestamp: '2026-01-01T00:00:02.000Z',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_plan_01', name: 'ExitPlanMode', input: {} }]
      }
    },
    {
      type: 'user',
      timestamp: '2026-01-01T00:00:03.000Z',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'toolu_plan_01',
          content: 'I approve this.\n\n# Approved Plan: Implement the feature\n\nStep 1: Do this.\nStep 2: Do that.'
        }]
      }
    }
  ]);

  assert.match(markdown, /> I approve this\./);
  assert.match(markdown, /> <details>\n> <summary>Approved Plan<\/summary>/);
  assert.match(markdown, /> # Approved Plan: Implement the feature/);
});
