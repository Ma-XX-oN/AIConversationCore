function sourceRecordIdentity(record, sourceIndex) {
  return record?.uuid ?? record?.message?.id ?? `record:${sourceIndex}`;
}

function baseSource(record, sourceIndex, blockIndex = null) {
  const source = {
    provider: 'claude',
    record_id: record?.uuid ?? record?.message?.id ?? null,
    record_index: sourceIndex
  };
  if (Number.isInteger(blockIndex)) source.block_index = blockIndex;
  return source;
}

function textBlock(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  return {
    id: `claude:${sourceIdentity}:text:${blockIndex}`,
    type: 'text',
    text: block.text,
    source: baseSource(record, sourceIndex, blockIndex)
  };
}

function reasoningBlock(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  return {
    id: `claude:${sourceIdentity}:reasoning:${blockIndex}`,
    type: 'reasoning_summary',
    summary: null,
    content: block.thinking,
    chunks: null,
    finished: null,
    source: baseSource(record, sourceIndex, blockIndex)
  };
}

function toolCallEvent(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, blockIndex);
  const callId = typeof block.id === 'string' ? block.id : null;
  return {
    id: `claude:${sourceIdentity}:tool_call:${blockIndex}`,
    provider: 'claude',
    source_record_id: source.record_id,
    source_index: sourceIndex,
    kind: 'tool_call',
    role: record?.message?.role ?? 'assistant',
    channel: null,
    visibility: 'visible',
    content_type: 'tool_use',
    blocks: [{
      id: `claude:${sourceIdentity}:tool_call:${blockIndex}:block`,
      type: 'tool_call',
      call_id: callId,
      name: block?.name ?? null,
      input: block?.input ?? null,
      input_format: 'object',
      caller: block?.caller ?? null,
      source
    }],
    relationships: {
      tool_call_id: callId
    },
    source
  };
}

function toolResultEvent(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, blockIndex);
  const callId = typeof block.tool_use_id === 'string' ? block.tool_use_id : null;
  return {
    id: `claude:${sourceIdentity}:tool_result:${blockIndex}`,
    provider: 'claude',
    source_record_id: source.record_id,
    source_index: sourceIndex,
    kind: 'tool_result',
    role: record?.message?.role ?? 'user',
    channel: null,
    visibility: 'visible',
    content_type: 'tool_result',
    blocks: [{
      id: `claude:${sourceIdentity}:tool_result:${blockIndex}:block`,
      type: 'tool_result',
      call_id: callId,
      name: null,
      output: block?.content ?? null,
      output_format: Array.isArray(block?.content) ? 'blocks' : typeof block?.content,
      is_error: block?.is_error ?? null,
      source
    }],
    relationships: {
      tool_call_id: callId
    },
    source
  };
}

function messageEvent(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, blockIndex);
  return {
    id: `claude:${sourceIdentity}:message:${blockIndex}`,
    provider: 'claude',
    source_record_id: source.record_id,
    source_index: sourceIndex,
    kind: 'message',
    role: record?.message?.role ?? null,
    channel: null,
    visibility: 'visible',
    content_type: 'text',
    blocks: [textBlock(record, sourceIndex, block, blockIndex)],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source
  };
}

function reasoningEvent(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, blockIndex);
  return {
    id: `claude:${sourceIdentity}:reasoning:${blockIndex}`,
    provider: 'claude',
    source_record_id: source.record_id,
    source_index: sourceIndex,
    kind: 'reasoning_summary',
    role: 'assistant',
    channel: null,
    visibility: 'visible',
    content_type: 'thinking',
    blocks: [reasoningBlock(record, sourceIndex, block, blockIndex)],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source
  };
}

function textFromToolResult(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n');
}

function agentIdFromResult(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/^agentId:\s*([^\s]+)\s*\(internal ID - do not mention to user\.\)$/m);
  return match?.[1] ?? null;
}

function cleanAgentResult(text) {
  if (typeof text !== 'string') return '';
  return text
    .split('\n')
    .filter(line => !/^agentId:\s*[^\s]+\s*\(internal ID - do not mention to user\.\)$/.test(line))
    .join('\n')
    .trim();
}

function subagentEvent(record, sourceIndex, agentId, description, output, callId, sourceBlockIndex = null) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, sourceBlockIndex);
  return {
    id: `claude:${sourceIdentity}:subagent:${agentId}`,
    provider: 'claude',
    source_record_id: source.record_id,
    source_index: sourceIndex,
    kind: 'subagent',
    role: 'assistant',
    channel: null,
    visibility: 'visible',
    content_type: 'subagent',
    blocks: [{
      id: `claude:${sourceIdentity}:subagent:${agentId}:block`,
      type: 'subagent',
      agent_id: agentId,
      description,
      output,
      source
    }],
    citations: [],
    resources: [],
    relationships: {
      tool_call_id: callId ?? null
    },
    source
  };
}

function xmlTag(content, name) {
  if (typeof content !== 'string') return null;
  const match = content.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? match[1].trim() : null;
}

function queueSubagentEvent(record, sourceIndex) {
  if (record?.type !== 'queue-operation' || typeof record?.content !== 'string') return null;
  if (!record.content.includes('<task-notification>')) return null;
  if (xmlTag(record.content, 'status') !== 'completed') return null;

  const taskId = xmlTag(record.content, 'task-id');
  const summary = xmlTag(record.content, 'summary');
  const result = xmlTag(record.content, 'result');
  if (!taskId || !result) return null;

  const descriptionMatch = summary?.match(/^Agent\s+"([\s\S]+)"\s+came to rest$/);
  const description = descriptionMatch?.[1] ?? summary ?? null;
  return subagentEvent(
    record,
    sourceIndex,
    taskId,
    description,
    result,
    xmlTag(record.content, 'tool-use-id')
  );
}

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

export function adaptClaudeRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('Claude records must be an array.');

  const events = [];
  const agentCalls = new Map();

  records.forEach((record, sourceIndex) => {
    const queuedSubagent = queueSubagentEvent(record, sourceIndex);
    if (queuedSubagent) {
      events.push(queuedSubagent);
      return;
    }

    const content = record?.message?.content;
    if (!Array.isArray(content)) return;

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
        if (block.name === 'Agent' && typeof block.id === 'string') {
          agentCalls.set(block.id, {
            description: typeof block?.input?.description === 'string' ? block.input.description : null,
            source_index: sourceIndex,
            block_index: blockIndex
          });
          return;
        }
        events.push(toolCallEvent(record, sourceIndex, block, blockIndex));
        return;
      }

      if (block.type !== 'tool_result') return;
      const callId = typeof block.tool_use_id === 'string' ? block.tool_use_id : null;
      const agentCall = callId ? agentCalls.get(callId) : null;
      if (!agentCall) {
        events.push(toolResultEvent(record, sourceIndex, block, blockIndex));
        return;
      }

      const rawOutput = textFromToolResult(block.content);
      const agentId = agentIdFromResult(rawOutput) ?? callId;
      events.push(subagentEvent(
        record,
        sourceIndex,
        agentId,
        agentCall.description,
        cleanAgentResult(rawOutput),
        callId,
        blockIndex
      ));
    });
  });

  return events;
}
