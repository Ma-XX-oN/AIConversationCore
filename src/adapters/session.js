import { adaptClaudeRecords } from './claude.js';
import { adaptCodexRecords } from './codex.js';

/**
 * Returns one source timestamp when the provider record supplies it.
 *
 * @param {Object<string, *>} record - Provider/source record.
 * @returns {string|null} Source timestamp or null.
 */
function sourceTimestamp(record) {
  return typeof record?.timestamp === 'string' ? record.timestamp : null;
}

/**
 * Copies source timestamp provenance onto an event and its blocks.
 *
 * @param {Object<string, *>} event - Canonical event.
 * @param {Array<Object<string, *>>} records - Ordered provider/source records.
 * @returns {Object<string, *>} Canonical event clone with timestamp provenance.
 */
function withTimestamp(event, records) {
  const sourceIndex = Number.isInteger(event?.source_index)
    ? event.source_index
    : event?.source?.record_index;
  const timestamp = Number.isInteger(sourceIndex)
    ? sourceTimestamp(records[sourceIndex])
    : null;
  if (!timestamp) return event;
  return {
    ...event,
    source: { ...(event.source ?? {}), timestamp },
    blocks: (event.blocks ?? []).map(block => ({
      ...block,
      source: { ...(block.source ?? {}), timestamp }
    }))
  };
}

/**
 * Removes Claude-injected context tags from user-authored text.
 *
 * @param {string} text - Provider text.
 * @returns {string} User-facing text with injected tags removed.
 */
function stripClaudeInjectedText(text) {
  return String(text ?? '').replace(
    /<(?:ide_opened_file|ide_selection|system[-_]reminder|system|env|claude_background_info|user[-_]prompt[-_]submit[-_]hook|command[-_]name|antml:[a-z_]+)[^>]*>[\s\S]*?<\/[^>]+>/gi,
    ''
  ).trim();
}

/**
 * Removes the IDE/request wrapper Codex may prepend to a user message.
 *
 * @param {string} text - Provider text.
 * @returns {string} User-authored request text.
 */
function stripCodexUserPreamble(text) {
  const value = String(text ?? '');
  const match = value.match(/## My request for Codex:\s*\r?\n([\s\S]+)/);
  return (match?.[1] ?? value).trim();
}

/**
 * Reads text parts from a Claude queued-command prompt.
 *
 * @param {*} prompt - Provider queued-command prompt value.
 * @returns {string} User-facing prompt text.
 */
function queuedPromptText(prompt) {
  if (typeof prompt === 'string') return stripClaudeInjectedText(prompt);
  if (!Array.isArray(prompt)) return '';
  return prompt
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => stripClaudeInjectedText(block.text))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

/**
 * Separates Claude's generated quoted queued-command card from user text.
 *
 * @param {string} text - Cleaned queued-command text.
 * @returns {Object<string, string>} Generated-context and user-text fields for the queued command.
 */
function splitQueuedCommandText(text) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  let sawQuotedLine = false;
  let leftQuotedBlock = false;
  let userStart = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const quoted = lines[index].trimStart().startsWith('>');
    if (!sawQuotedLine) {
      sawQuotedLine = quoted;
      continue;
    }
    if (!lines[index].trim()) {
      leftQuotedBlock = true;
      continue;
    }
    if (leftQuotedBlock || !quoted) {
      userStart = index;
      break;
    }
  }

  if (userStart < 0) {
    return { generated_context: '', user_text: normalized.trim() };
  }
  return {
    generated_context: lines.slice(0, userStart).join('\n').trim(),
    user_text: lines.slice(userStart).join('\n').trim()
  };
}

/**
 * Creates one canonical Claude queued-command message event.
 *
 * @param {Object<string, *>} record - Claude attachment record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @returns {Object<string, *>|null} Canonical queued-command event or null.
 */
function claudeQueuedCommandEvent(record, sourceIndex) {
  if (record?.type !== 'attachment' || record?.attachment?.type !== 'queued_command') {
    return null;
  }
  const text = queuedPromptText(record?.attachment?.prompt);
  if (!text) return null;
  const split = splitQueuedCommandText(text);
  const recordId = record?.uuid ?? record?.message?.id ?? null;
  const identity = recordId ?? `record:${sourceIndex}`;
  const timestamp = sourceTimestamp(record);
  const source = {
    provider: 'claude',
    record_id: recordId,
    record_index: sourceIndex,
    ...(timestamp ? { timestamp } : {})
  };
  return {
    id: `claude:${identity}:queued_command`,
    provider: 'claude',
    source_record_id: recordId,
    source_index: sourceIndex,
    kind: 'message',
    role: 'user',
    channel: null,
    visibility: 'visible',
    content_type: 'queued_command',
    blocks: [{
      id: `claude:${identity}:queued_command:block`,
      type: 'text',
      text,
      queued_command: split,
      source
    }],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source
  };
}

/**
 * Creates hidden canonical lifecycle events for top-level Claude Agent starts.
 *
 * @param {Object<string, *>} record - Claude assistant record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @returns {Array<Object<string, *>>} Agent-start lifecycle events in block order.
 */
function claudeAgentStartEvents(record, sourceIndex) {
  if (record?.type !== 'assistant' || !Array.isArray(record?.message?.content)) return [];
  const timestamp = sourceTimestamp(record);
  const recordId = record?.uuid ?? record?.message?.id ?? null;
  const identity = recordId ?? `record:${sourceIndex}`;
  const events = [];

  record.message.content.forEach((block, blockIndex) => {
    if (block?.type !== 'tool_use' || block?.name !== 'Agent') return;
    const callId = typeof block.id === 'string' ? block.id : null;
    const source = {
      provider: 'claude',
      record_id: recordId,
      record_index: sourceIndex,
      block_index: blockIndex,
      ...(timestamp ? { timestamp } : {})
    };
    events.push({
      id: `claude:${identity}:agent_start:${blockIndex}`,
      provider: 'claude',
      source_record_id: recordId,
      source_index: sourceIndex,
      kind: 'tool_call',
      role: 'assistant',
      channel: null,
      visibility: 'hidden',
      content_type: 'subagent_start',
      blocks: [{
        id: `claude:${identity}:agent_start:${blockIndex}:block`,
        type: 'tool_call',
        call_id: callId,
        name: 'Agent',
        input: block?.input ?? null,
        input_format: 'object',
        subagent_start: {
          description: typeof block?.input?.description === 'string'
            ? block.input.description
            : null
        },
        source
      }],
      citations: [],
      resources: [],
      relationships: { tool_call_id: callId },
      source
    });
  });
  return events;
}

/**
 * Returns one trimmed XML-like element from provider task-notification text.
 *
 * @param {string} content - Provider task notification text.
 * @param {string} name - Element local name.
 * @returns {string|null} Trimmed element contents or null.
 */
function xmlTag(content, name) {
  if (typeof content !== 'string') return null;
  const match = content.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? match[1].trim() : null;
}

/**
 * Extracts completed Claude task duration from queue-operation XML-like text.
 *
 * @param {Object<string, *>} record - Claude source record.
 * @returns {number|null} Duration in milliseconds or null.
 */
function queueDurationMilliseconds(record) {
  const text = record?.type === 'queue-operation' ? xmlTag(record?.content, 'duration_ms') : null;
  if (!text) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Returns the user-facing task description from a Claude completion summary.
 *
 * @param {Object<string, *>} record - Claude source record.
 * @returns {string|null} Task description or null.
 */
function queueTaskDescription(record) {
  if (record?.type !== 'queue-operation') return null;
  const summary = xmlTag(record?.content, 'summary');
  if (!summary) return null;
  const match = summary.match(/^Agent\s+["“]([\s\S]+?)["”]\s+came to rest$/i);
  return match?.[1]?.trim() ?? summary.trim();
}
