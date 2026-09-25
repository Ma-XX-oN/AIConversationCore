import {
  agentIdFromResult,
  baseSource,
  cleanAgentResult,
  messageEvent,
  noticeEvent,
  queueSubagentEvent,
  reasoningEvent,
  subagentEvent,
  textFromToolResult,
  toolCallEvent,
  toolResultEvent
} from './claude-events.js';

/**
 * Adapts Claude tool events.
 *
 * @param {Array<Object<string, *>>} records - The ordered provider/source records to process.
 * @returns {Array<Object<string, *>>} Canonical Claude tool-call/tool-result events in source record/block order.
 */
export function adaptClaudeToolEvents(records) {
  if (!Array.isArray(records)) throw new TypeError('Claude records must be an array.');
  const events = [];
  records.forEach((record, sourceIndex) => {
    const content = record?.message?.content;
    if (!Array.isArray(content)) return;
    content.forEach((block, blockIndex) => {
      if (!block || typeof block !== 'object') return;
      if (block.type === 'tool_use') events.push(toolCallEvent(record, sourceIndex, block, blockIndex));
      if (block.type === 'tool_result') events.push(toolResultEvent(record, sourceIndex, block, blockIndex));
    });
  });
  return events;
}

/**
 * Creates the retained cross-record state required by Claude normalization.
 *
 * @returns {Object<string, *>} Empty retained Claude adapter state.
 */
export function createClaudeAdapterState() {
  return {
    agentCalls: new Map(),
    toolNames: new Map()
  };
}

/**
 * Adapts one contiguous Claude record slice at its absolute source position.
 *
 * The source representation is an append-only slice of Claude provider records.
 * The output representation is canonical Claude events whose source indexes remain
 * absolute across repeated slices while correlation state is retained by the caller.
 *
 * @param {Array<Object<string, *>>} records - Newly observed Claude records.
 * @param {number} firstSourceIndex - Absolute source index of the first record.
 * @param {Object<string, *>} state - Retained Claude adapter state.
 * @returns {Array<Object<string, *>>} Canonical events created by this slice.
 */
export function adaptClaudeRecordSlice(records, firstSourceIndex, state) {
  if (!Array.isArray(records)) throw new TypeError('Claude records must be an array.');
  if (!Number.isInteger(firstSourceIndex) || firstSourceIndex < 0) {
    throw new TypeError('Claude firstSourceIndex must be a non-negative integer.');
  }
  if (!(state?.agentCalls instanceof Map) || !(state?.toolNames instanceof Map)) {
    throw new TypeError('Claude adapter state is invalid.');
  }

  const events = [];
  records.forEach((record, offset) => {
    const sourceIndex = firstSourceIndex + offset;
    const queuedSubagent = queueSubagentEvent(record, sourceIndex);
    if (queuedSubagent) {
      events.push(queuedSubagent);
      return;
    }
    const content = record?.message?.content;
    if (!Array.isArray(content)) return;

    if (record?.type === 'assistant' && record?.message?.model === '<synthetic>') {
      content.forEach((block, blockIndex) => {
        if (block?.type === 'text' && typeof block.text === 'string') {
          events.push(noticeEvent(record, sourceIndex, block, blockIndex));
        }
      });
      return;
    }

    content.forEach((block, blockIndex) => {
      if (!block || typeof block !== 'object') return;
      if (block.type === 'text' && typeof block.text === 'string') {
        events.push(messageEvent(record, sourceIndex, block, blockIndex));
        return;
      }
      if (block.type === 'thinking' && typeof block.thinking === 'string') {
        events.push(reasoningEvent(record, sourceIndex, block, blockIndex));
        return;
      }
      if (block.type === 'tool_use') {
        if (typeof block.id === 'string') {
          state.toolNames.set(block.id, block.name ?? null);
        }
        if (block.name === 'Agent' && typeof block.id === 'string') {
          state.agentCalls.set(block.id, {
            description: typeof block?.input?.description === 'string'
              ? block.input.description
              : null,
            source: baseSource(record, sourceIndex, blockIndex)
          });
          return;
        }
        events.push(toolCallEvent(record, sourceIndex, block, blockIndex));
        return;
      }
      if (block.type !== 'tool_result') return;
      const callId = typeof block.tool_use_id === 'string' ? block.tool_use_id : null;
      const agentCall = callId ? state.agentCalls.get(callId) : null;
      if (agentCall) {
        const rawOutput = textFromToolResult(block.content);
        events.push(subagentEvent(
          record,
          sourceIndex,
          agentIdFromResult(rawOutput) ?? callId,
          agentCall.description,
          cleanAgentResult(rawOutput),
          callId,
          blockIndex,
          agentCall.source
        ));
        return;
      }
      events.push(toolResultEvent(
        record,
        sourceIndex,
        block,
        blockIndex,
        callId ? state.toolNames.get(callId) : null));
    });
  });
  return events;
}

/**
 * Adapts a complete Claude record inventory.
 *
 * The source representation is an ordered Claude provider record array. The output
 * representation is the complete canonical Claude event sequence with provider
 * correlations resolved across the entire array.
 *
 * @param {Array<Object<string, *>>} records - The ordered provider/source records to process.
 * @returns {Array<Object<string, *>>} Canonical Claude events in provider source order.
 */
export function adaptClaudeRecords(records) {
  return adaptClaudeRecordSlice(records, 0, createClaudeAdapterState());
}
