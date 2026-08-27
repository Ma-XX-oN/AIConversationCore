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

function eventVisibility(record) {
  return record?.metadata?.is_visually_hidden_from_conversation ? 'hidden' : 'visible';
}

function eventKind(record) {
  if (record?.author?.role === 'assistant' && record?.content?.content_type === 'thoughts') {
    return 'reasoning_summary';
  }
  if (record?.author?.role === 'assistant' && record?.channel === 'commentary') return 'commentary';
  return 'message';
}

export function adaptChatGPTRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('ChatGPT records must be an array.');

  return records.map((record, sourceIndex) => {
    const sourceRecordId = typeof record?.id === 'string' ? record.id : null;
    if (!sourceRecordId) throw new Error(`ChatGPT source record at index ${sourceIndex} is missing id.`);

    const role = record?.author?.role ?? null;
    const channel = record?.channel ?? null;
    const contentType = record?.content?.content_type ?? null;
    const blocks = contentType === 'thoughts'
      ? reasoningBlocks(record, sourceRecordId, sourceIndex)
      : textParts(record).map((text, partIndex) => ({
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

    return {
      id: `chatgpt:${sourceRecordId}`,
      provider: 'chatgpt',
      source_record_id: sourceRecordId,
      source_index: sourceIndex,
      kind: eventKind(record),
      role,
      channel,
      visibility: eventVisibility(record),
      content_type: contentType,
      blocks,
      relationships: {
        turn_exchange_id: record?.metadata?.turn_exchange_id ?? null,
        working_turn_id: record?.metadata?.working_turn_id ?? null
      },
      source: {
        provider: 'chatgpt',
        record_id: sourceRecordId,
        record_index: sourceIndex
      }
    };
  });
}
