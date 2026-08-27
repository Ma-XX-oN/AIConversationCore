function sourceIdentity(record, sourceIndex) {
  return record?.payload?.call_id ?? `record:${sourceIndex}`;
}

function source(record, sourceIndex) {
  return {
    provider: 'codex',
    record_id: null,
    record_index: sourceIndex
  };
}

function isToolCall(payload) {
  return payload?.type === 'function_call' || payload?.type === 'custom_tool_call';
}

function isToolResult(payload) {
  return payload?.type === 'function_call_output' || payload?.type === 'custom_tool_call_output';
}

export function adaptCodexToolEvents(records) {
  if (!Array.isArray(records)) throw new TypeError('Codex records must be an array.');

  const events = [];

  records.forEach((record, sourceIndex) => {
    if (record?.type !== 'response_item') return;
    const payload = record?.payload;
    if (!payload || typeof payload !== 'object') return;
    const sourceInfo = source(record, sourceIndex);
    const identity = sourceIdentity(record, sourceIndex);

    if (isToolCall(payload)) {
      const callId = typeof payload.call_id === 'string' ? payload.call_id : null;
      const isFunction = payload.type === 'function_call';
      events.push({
        id: `codex:${identity}:tool_call:${sourceIndex}`,
        provider: 'codex',
        source_record_id: null,
        source_index: sourceIndex,
        kind: 'tool_call',
        role: 'assistant',
        channel: null,
        visibility: 'visible',
        content_type: payload.type,
        blocks: [{
          id: `codex:${identity}:tool_call:${sourceIndex}:block`,
          type: 'tool_call',
          call_id: callId,
          name: payload?.name ?? null,
          input: isFunction ? payload?.arguments ?? null : payload?.input ?? null,
          input_format: isFunction ? 'json_string' : 'text',
          source: sourceInfo
        }],
        relationships: {
          tool_call_id: callId
        },
        source: sourceInfo
      });
    }

    if (isToolResult(payload)) {
      const callId = typeof payload.call_id === 'string' ? payload.call_id : null;
      events.push({
        id: `codex:${identity}:tool_result:${sourceIndex}`,
        provider: 'codex',
        source_record_id: null,
        source_index: sourceIndex,
        kind: 'tool_result',
        role: 'tool',
        channel: null,
        visibility: 'visible',
        content_type: payload.type,
        blocks: [{
          id: `codex:${identity}:tool_result:${sourceIndex}:block`,
          type: 'tool_result',
          call_id: callId,
          name: null,
          output: payload?.output ?? null,
          output_format: typeof payload?.output,
          source: sourceInfo
        }],
        relationships: {
          tool_call_id: callId
        },
        source: sourceInfo
      });
    }
  });

  return events;
}
