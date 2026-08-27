function textParts(record) {
  const parts = record?.content?.parts;
  if (!Array.isArray(parts)) return [];
  return parts.filter(part => typeof part === 'string');
}

function reasoningBlocks(record, sourceRecordId, sourceIndex) {
  const thoughts = record?.content?.thoughts;
  if (!Array.isArray(thoughts)) return [];

  return thoughts.map((thought, thoughtIndex) => ({
    id: `${sourceRecordId}:thought:${thoughtIndex}`,
    type: 'reasoning_summary',
    summary: thought?.summary ?? null,
    content: thought?.content ?? null,
    chunks: Array.isArray(thought?.chunks) ? [...thought.chunks] : null,
    finished: thought?.finished ?? null,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex,
      thought_index: thoughtIndex
    }
  }));
}

function toolCallBlocks(record, sourceRecordId, sourceIndex) {
  return [{
    id: `${sourceRecordId}:tool_call:0`,
    type: 'tool_call',
    call_id: null,
    name: record?.recipient ?? null,
    input: record?.content?.text ?? null,
    input_format: 'code',
    language: record?.content?.language ?? null,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex
    }
  }];
}

function toolResultBlocks(record, sourceRecordId, sourceIndex) {
  const contentType = record?.content?.content_type ?? null;
  let output = null;
  if (contentType === 'execution_output') output = record?.content?.text ?? null;
  if (contentType === 'multimodal_text') output = Array.isArray(record?.content?.parts)
    ? [...record.content.parts]
    : null;

  return [{
    id: `${sourceRecordId}:tool_result:0`,
    type: 'tool_result',
    call_id: null,
    name: record?.author?.name ?? null,
    output,
    output_format: contentType,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex
    }
  }];
}

function eventVisibility(record) {
  return record?.metadata?.is_visually_hidden_from_conversation ? 'hidden' : 'visible';
}

function isToolCall(record) {
  return record?.author?.role === 'assistant' &&
    record?.content?.content_type === 'code' &&
    typeof record?.recipient === 'string' &&
    record.recipient !== 'all';
}

function isToolResult(record) {
  if (record?.author?.role !== 'tool') return false;
  return record?.content?.content_type === 'execution_output' ||
    record?.content?.content_type === 'multimodal_text';
}

function eventKind(record) {
  if (isToolCall(record)) return 'tool_call';
  if (isToolResult(record)) return 'tool_result';
  if (record?.author?.role === 'assistant' && record?.content?.content_type === 'thoughts') {
    return 'reasoning_summary';
  }
  if (record?.author?.role === 'assistant' && record?.channel === 'commentary') return 'commentary';
  return 'message';
}

function eventBlocks(record, sourceRecordId, sourceIndex, kind) {
  if (kind === 'reasoning_summary') return reasoningBlocks(record, sourceRecordId, sourceIndex);
  if (kind === 'tool_call') return toolCallBlocks(record, sourceRecordId, sourceIndex);
  if (kind === 'tool_result') return toolResultBlocks(record, sourceRecordId, sourceIndex);

  return textParts(record).map((text, partIndex) => ({
    id: `${sourceRecordId}:part:${partIndex}`,
    type: 'text',
    text,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex,
      part_index: partIndex
    }
  }));
}

export function adaptChatGPTRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('ChatGPT records must be an array.');

  return records.map((record, sourceIndex) => {
    const sourceRecordId = typeof record?.id === 'string' ? record.id : null;
    if (!sourceRecordId) throw new Error(`ChatGPT source record at index ${sourceIndex} is missing id.`);

    const role = record?.author?.role ?? null;
    const channel = record?.channel ?? null;
    const contentType = record?.content?.content_type ?? null;
    const kind = eventKind(record);

    return {
      id: `chatgpt:${sourceRecordId}`,
      provider: 'chatgpt',
      source_record_id: sourceRecordId,
      source_index: sourceIndex,
      kind,
      role,
      channel,
      visibility: eventVisibility(record),
      content_type: contentType,
      blocks: eventBlocks(record, sourceRecordId, sourceIndex, kind),
      relationships: {
        turn_exchange_id: record?.metadata?.turn_exchange_id ?? null,
        working_turn_id: record?.metadata?.working_turn_id ?? null,
        tool_call_id: null
      },
      source: {
        provider: 'chatgpt',
        record_id: sourceRecordId,
        record_index: sourceIndex
      }
    };
  });
}
