import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  adaptChatGPTRecords,
  adaptClaudeRecords,
  adaptCodexRecords,
  renderCanonicalMarkdown
} from '../src/index.js';

const chatgptFixtureUrl = new URL('./fixtures/chatgpt/chatgpt-direct.jsonl', import.meta.url);
const chatgptGoldenUrl = new URL('./golden/chatgpt/chatgpt-direct.canonical.md', import.meta.url);
const claudeFixtureUrl = new URL('./fixtures/claude/claude-rich-subagent.jsonl', import.meta.url);
const claudeGoldenUrl = new URL('./golden/claude/claude-rich-subagent.canonical.md', import.meta.url);
const claudeQuestionsFixtureUrl = new URL('./fixtures/claude/claude-questions.jsonl', import.meta.url);
const claudeQuestionsGoldenUrl = new URL('./golden/claude/claude-questions.canonical.md', import.meta.url);
const claudeExitPlanFixtureUrl = new URL('./fixtures/claude/claude-exit-plan.jsonl', import.meta.url);
const claudeExitPlanGoldenUrl = new URL('./golden/claude/claude-exit-plan.canonical.md', import.meta.url);
const claudeNoticeFixtureUrl = new URL('./fixtures/claude/claude-notice.jsonl', import.meta.url);
const codexFixtureUrl = new URL('./fixtures/codex/codex-rich.jsonl', import.meta.url);
const codexGoldenUrl = new URL('./golden/codex/codex-rich.canonical.md', import.meta.url);

async function loadJsonl(url) {
  const text = await readFile(url, 'utf8');
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

test('canonical Markdown renderer reproduces the established rich ChatGPT golden exactly', async () => {
  const records = await loadJsonl(chatgptFixtureUrl);
  assert.equal(renderCanonicalMarkdown(adaptChatGPTRecords(records)), await readFile(chatgptGoldenUrl, 'utf8'));
});

test('canonical Markdown renderer reproduces the established Claude golden exactly', async () => {
  const records = await loadJsonl(claudeFixtureUrl);
  assert.equal(renderCanonicalMarkdown(adaptClaudeRecords(records)), await readFile(claudeGoldenUrl, 'utf8'));
});

test('canonical Markdown renderer reproduces Claude AskUserQuestion behaviour', async () => {
  const records = await loadJsonl(claudeQuestionsFixtureUrl);
  assert.equal(renderCanonicalMarkdown(adaptClaudeRecords(records)), await readFile(claudeQuestionsGoldenUrl, 'utf8'));
});

test('canonical Markdown renderer reproduces Claude ExitPlanMode behaviour', async () => {
  const records = await loadJsonl(claudeExitPlanFixtureUrl);
  assert.equal(renderCanonicalMarkdown(adaptClaudeRecords(records)), await readFile(claudeExitPlanGoldenUrl, 'utf8'));
});

test('canonical Markdown renderer preserves Claude synthetic notices as system notices', async () => {
  const records = await loadJsonl(claudeNoticeFixtureUrl);
  assert.equal(renderCanonicalMarkdown(adaptClaudeRecords(records)),
    '## User\n\n> Hello.\n\n## Claude\n\n> Hi there!\n\n> *(system: Context limit reached.)*\n\n## User\n\n> Continue.\n\n');
});

test('canonical Markdown renderer reproduces the established Codex golden exactly', async () => {
  const records = await loadJsonl(codexFixtureUrl);
  assert.equal(renderCanonicalMarkdown(adaptCodexRecords(records)), await readFile(codexGoldenUrl, 'utf8'));
});

test('canonical Markdown renderer consumes normalized events, not provider-native records', () => {
  const events = [{
    id: 'chatgpt:u1',
    provider: 'chatgpt',
    source_record_id: 'u1',
    source_index: 0,
    kind: 'message',
    role: 'user',
    channel: null,
    visibility: 'visible',
    content_type: 'text',
    blocks: [{
      id: 'u1:part:0',
      type: 'text',
      text: 'Hello',
      source: { provider: 'chatgpt', record_id: 'u1', record_index: 0, part_index: 0 }
    }],
    citations: [],
    display_replacements: [],
    resources: [],
    relationships: {},
    source: { provider: 'chatgpt', record_id: 'u1', record_index: 0 }
  }];

  assert.equal(renderCanonicalMarkdown(events), '## User\n\n> Hello\n\n');
});
