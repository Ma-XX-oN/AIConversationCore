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

function parseJsonObject(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizedQuestions(argumentsText) {
  const parsed = parseJsonObject(argumentsText);
  if (!Array.isArray(parsed?.questions)) return null;
  return parsed.questions.map(question => ({
    id: typeof question?.id === 'string' ? question.id : null,
    question: typeof question?.question === 'string' ? question.question : null,
    options: Array.isArray(question?.options)
      ? question.options.map(option => ({
          label: typeof option?.label === 'string' ? option.label : null,
          description: typeof option?.description === 'string' ? option.description : null
        }))
      : []
  }));
}

function normalizedAnswers(outputText) {
  const parsed = parseJsonObject(outputText);
  const answers = parsed?.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const normalized = {};
  for (const [id, answer] of Object.entries(answers)) {
    normalized[id] = Array.isArray(answer?.answers)
      ? answer.answers.filter(value => typeof value === 'string')
      : [];
  }
  return normalized;
}

function toolCallEvent(record, sourceIndex) {
  const payload = record.payload;
  const sourceInfo = source(record, sourceIndex);
  const identity = sourceIdentity(record, sourceIndex);
  const callId = typeof payload.call_id === 'string' ? payload.call_id : null;
  const isFunction = payload.type === 'function_call';
  const block = {
    id: `codex:${identity}:tool_call:${sourceIndex}:block`,
    type: 'tool_call',
    call_id: callId,
    name: payload?.name ?? null,
    input: isFunction ? payload?.arguments ?? null : payload?.input ?? null,
    input_format: isFunction ? 'json_string' : 'text',
    source: sourceInfo
  };

  if (payload?.name === 'request_user_input') {
    block.request_user_input = { questions: normalizedQuestions(payload?.arguments) ?? [] };
  }
  if (payload?.name === 'apply_patch' && typeof payload?.input === 'string') {
    block.file_change = { patch: payload.input };
  }

  return {
    id: `codex:${identity}:tool_call:${sourceIndex}`,
    provider: 'codex',
    source_record_id: null,
    source_index: sourceIndex,
    kind: 'tool_call',
    role: 'assistant',
    channel: null,
    visibility: 'visible',
    content_type: payload.type,
    blocks: [block],
    citations: [],
    resources: [],
    relationships: {
      tool_call_id: callId
    },
    source: sourceInfo
  };
}

function toolResultEvent(record, sourceIndex) {
  const payload = record.payload;
  const sourceInfo = source(record, sourceIndex);
  const identity = sourceIdentity(record, sourceIndex);
  const callId = typeof payload.call_id === 'string' ? payload.call_id : null;
  const block = {
    id: `codex:${identity}:tool_result:${sourceIndex}:block`,
    type: 'tool_result',
    call_id: callId,
    name: null,
    output: payload?.output ?? null,
    output_format: typeof payload?.output,
    source: sourceInfo
  };
  const answers = normalizedAnswers(payload?.output);
  if (answers) block.request_user_input_response = { answers };

  return {
    id: `codex:${identity}:tool_result:${sourceIndex}`,
    provider: 'codex',
    source_record_id: null,
    source_index: sourceIndex,
    kind: 'tool_result',
    role: 'tool',
    channel: null,
    visibility: 'visible',
    content_type: payload.type,
    blocks: [block],
    citations: [],
    resources: [],
    relationships: {
      tool_call_id: callId
    },
    source: sourceInfo
  };
}

function messageEvent(record, sourceIndex, role, kind, channel, text, contentType) {
  const sourceInfo = source(record, sourceIndex);
  return {
    id: `codex:record:${sourceIndex}:${kind}`,
    provider: 'codex',
    source_record_id: null,
    source_index: sourceIndex,
    kind,
    role,
    channel,
    visibility: 'visible',
    content_type: contentType,
    blocks: [{
      id: `codex:record:${sourceIndex}:${kind}:block`,
      type: kind === 'reasoning_summary' ? 'reasoning_summary' : 'text',
      ...(kind === 'reasoning_summary'
        ? { summary: null, content: text, chunks: null, finished: null }
        : { text }),
      source: sourceInfo
    }],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source: sourceInfo
  };
}

export function adaptCodexToolEvents(records) {
  if (!Array.isArray(records)) throw new TypeError('Codex records must be an array.');

  const events = [];

  records.forEach((record, sourceIndex) => {
    if (record?.type !== 'response_item') return;
    const payload = record?.payload;
    if (!payload || typeof payload !== 'object') return;
    if (isToolCall(payload)) events.push(toolCallEvent(record, sourceIndex));
    if (isToolResult(payload)) events.push(toolResultEvent(record, sourceIndex));
  });

  return events;
}

export function adaptCodexRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('Codex records must be an array.');

  const events = [];
  records.forEach((record, sourceIndex) => {
    const payload = record?.payload;
    if (!payload || typeof payload !== 'object') return;

    if (record.type === 'response_item') {
      if (isToolCall(payload)) events.push(toolCallEvent(record, sourceIndex));
      if (isToolResult(payload)) events.push(toolResultEvent(record, sourceIndex));
      return;
    }

    if (record.type !== 'event_msg') return;
    if (payload.type === 'user_message' && typeof payload.message === 'string') {
      events.push(messageEvent(record, sourceIndex, 'user', 'message', null,
        payload.message, 'user_message'));
      return;
    }
    if (payload.type === 'agent_reasoning' && typeof payload.text === 'string') {
      events.push(messageEvent(record, sourceIndex, 'assistant', 'reasoning_summary', null,
        payload.text, 'agent_reasoning'));
      return;
    }
    if (payload.type === 'agent_message' && typeof payload.message === 'string') {
      const channel = payload.phase === 'commentary' ? 'commentary' : 'final';
      const kind = channel === 'commentary' ? 'commentary' : 'message';
      events.push(messageEvent(record, sourceIndex, 'assistant', kind, channel,
        payload.message, 'agent_message'));
    }
  });

  return events;
}
