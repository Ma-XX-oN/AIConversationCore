function sourceRecordIdentity(record, sourceIndex) {
  return record?.uuid ?? record?.message?.id ?? `record:${sourceIndex}`;
}

function baseSource(record, sourceIndex, blockIndex) {
  return {
    provider: 'claude',
    record_id: record?.uuid ?? record?.message?.id ?? null,
    record_index: sourceIndex,
    block_index: blockIndex
  };
}

export function adaptClaudeToolEvents(records) {
  if (!Array.isArray(records)) throw new TypeError('Claude records must be an array.');

  const events = [];

  records.forEach((record, sourceIndex) => {
    const content = record?.message?.content;
    if (!Array.isArray(content)) return;

    content.forEach((block, blockIndex) => {
      if (!block || typeof block !== 'object') return;
      const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
      const source = baseSource(record, sourceIndex, blockIndex);

      if (block.type === 'tool_use') {
        const callId = typeof block.id === 'string' ? block.id : null;
        events.push({
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
        });
      }

      if (block.type === 'tool_result') {
        const callId = typeof block.tool_use_id === 'string' ? block.tool_use_id : null;
        events.push({
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
        });
      }
    });
  });

  return events;
}
