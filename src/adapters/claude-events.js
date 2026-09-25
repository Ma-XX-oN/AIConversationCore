/**
 * Returns the stable source-record identity used to derive Claude canonical IDs.
 *
 * @param {Object<string, *>} record - The provider/source record to process.
 * @param {number} sourceIndex - The zero-based index of the source record.
 * @returns {string} The stable source identity used to derive Claude canonical IDs.
 */
function sourceRecordIdentity(record, sourceIndex) {
  return record?.uuid ?? record?.message?.id ?? `record:${sourceIndex}`;
}

/**
 * Builds canonical source provenance for a Claude record or content block.
 *
 * @param {Object<string, *>} record - The provider/source record to process.
 * @param {number} sourceIndex - The zero-based index of the source record.
 * @param {number|null} blockIndex - The zero-based block index.
 * @returns {Object<string, *>} Canonical Claude source provenance for the record or content block.
 */
export function baseSource(record, sourceIndex, blockIndex = null) {
  const source = {
    provider: 'claude',
    record_id: record?.uuid ?? record?.message?.id ?? null,
    record_index: sourceIndex,
    turn_id: typeof record?.uuid === 'string' ? record.uuid : null,
    timestamp: record?.timestamp ?? null
  };
  if (Number.isInteger(blockIndex)) source.block_index = blockIndex;
  return source;
}

/**
 * Builds a canonical text block from one provider text content block.
 *
 * @param {Object<string, *>} record - The provider/source record to process.
 * @param {number} sourceIndex - The zero-based index of the source record.
 * @param {Object<string, *>} block - The canonical/provider content block being inspected or rendered.
 * @param {number} blockIndex - The zero-based block index.
 * @returns {Object<string, *>} A canonical text block derived from the Claude source block.
 */
function textBlock(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  return {
    id: `claude:${sourceIdentity}:text:${blockIndex}`,
    type: 'text',
    text: block.text,
    source: baseSource(record, sourceIndex, blockIndex)
  };
}

/**
 * Builds a canonical reasoning-summary block from one provider reasoning block.
 *
 * @param {Object<string, *>} record - The provider/source record to process.
 * @param {number} sourceIndex - The zero-based index of the source record.
 * @param {Object<string, *>} block - The canonical/provider content block being inspected or rendered.
 * @param {number} blockIndex - The zero-based block index.
 * @returns {Object<string, *>} A canonical reasoning-summary block derived from the Claude thinking block.
 */
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

/**
 * Normalizes AskUserQuestion input into canonical question metadata.
 *
 * @param {Object<string, *>} input - Provider tool-input object.
 * @returns {Object<string, *>|null} Normalized question metadata, or null when absent.
 */
function normalizedAskUserQuestion(input) {
  if (!Array.isArray(input?.questions)) return null;
  return {
    questions: input.questions.map(question => ({
      question: typeof question?.question === 'string' ? question.question : null,
      header: typeof question?.header === 'string' ? question.header : null,
      multi_select: Boolean(question?.multiSelect),
      options: Array.isArray(question?.options)
        ? question.options.map(option => ({
            label: typeof option?.label === 'string' ? option.label : null,
            description: typeof option?.description === 'string' ? option.description : null
          }))
        : []
    }))
  };
}

/**
 * Builds a canonical tool-call event from one Claude tool-use block.
 *
 * @param {Object<string, *>} record - Provider/source record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @param {Object<string, *>} block - Claude tool-use block.
 * @param {number} blockIndex - Zero-based block index.
 * @returns {Object<string, *>} Canonical Claude tool-call event.
 */
export function toolCallEvent(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, blockIndex);
  const callId = typeof block.id === 'string' ? block.id : null;
  const canonicalBlock = {
    id: `claude:${sourceIdentity}:tool_call:${blockIndex}:block`,
    type: 'tool_call',
    call_id: callId,
    name: block?.name ?? null,
    input: block?.input ?? null,
    input_format: 'object',
    caller: block?.caller ?? null,
    source
  };
  if (block?.name === 'AskUserQuestion') {
    canonicalBlock.ask_user_question = normalizedAskUserQuestion(block?.input) ?? { questions: [] };
  }
  if (block?.name === 'ExitPlanMode') {
    canonicalBlock.exit_plan = {
      plan: typeof block?.input?.plan === 'string' ? block.input.plan : null,
      plan_file_path: typeof block?.input?.planFilePath === 'string' ? block.input.planFilePath : null
    };
  }
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
    blocks: [canonicalBlock],
    relationships: { tool_call_id: callId },
    source
  };
}

/**
 * Normalizes an ExitPlanMode result string into canonical response metadata.
 *
 * @param {string} text - Provider result text.
 * @returns {Object<string, *>|null} Canonical exit-plan response metadata.
 */
function normalizeExitPlanResponse(text) {
  if (typeof text !== 'string') return null;
  const heading = text.match(/^#{0,6}\s*Approved Plan(?::|\s)/m);
  if (!heading || heading.index == null) return { intro: text.trim(), approved_plan: null };
  return {
    intro: text.slice(0, heading.index).trim(),
    approved_plan: text.slice(heading.index).trim()
  };
}

/**
 * Extracts displayable text from a Claude tool-result string or text-block array.
 *
 * @param {string|Array<Object<string, *>>} content - Provider/canonical tool-result content.
 * @returns {string} Displayable tool-result text.
 */
export function textFromToolResult(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text).join('\n');
}

/**
 * Builds a canonical tool-result event from one Claude tool-result block.
 *
 * @param {Object<string, *>} record - Provider/source record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @param {Object<string, *>} block - Claude tool-result block.
 * @param {number} blockIndex - Zero-based block index.
 * @param {string|null} callName - Correlated provider tool name.
 * @returns {Object<string, *>} Canonical Claude tool-result event.
 */
export function toolResultEvent(record, sourceIndex, block, blockIndex, callName = null) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, blockIndex);
  const callId = typeof block.tool_use_id === 'string' ? block.tool_use_id : null;
  const canonicalBlock = {
    id: `claude:${sourceIdentity}:tool_result:${blockIndex}:block`,
    type: 'tool_result',
    call_id: callId,
    name: callName,
    output: block?.content ?? null,
    output_format: Array.isArray(block?.content) ? 'blocks' : typeof block?.content,
    is_error: block?.is_error ?? null,
    source
  };
  if (callName === 'AskUserQuestion') {
    canonicalBlock.ask_user_question_response = { text: textFromToolResult(block?.content) };
  }
  if (callName === 'ExitPlanMode') {
    canonicalBlock.exit_plan_response = normalizeExitPlanResponse(textFromToolResult(block?.content));
  }
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
    blocks: [canonicalBlock],
    relationships: { tool_call_id: callId },
    source
  };
}

/**
 * Builds a canonical message event from one Claude text block.
 *
 * @param {Object<string, *>} record - Provider/source record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @param {Object<string, *>} block - Claude text block.
 * @param {number} blockIndex - Zero-based block index.
 * @returns {Object<string, *>} Canonical Claude message event.
 */
export function messageEvent(record, sourceIndex, block, blockIndex) {
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

/**
 * Builds a canonical reasoning-summary event from one Claude thinking block.
 *
 * @param {Object<string, *>} record - Provider/source record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @param {Object<string, *>} block - Claude thinking block.
 * @param {number} blockIndex - Zero-based block index.
 * @returns {Object<string, *>} Canonical Claude reasoning event.
 */
export function reasoningEvent(record, sourceIndex, block, blockIndex) {
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

/**
 * Builds a canonical system notice from one synthetic Claude text block.
 *
 * @param {Object<string, *>} record - Provider/source record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @param {Object<string, *>} block - Synthetic Claude text block.
 * @param {number} blockIndex - Zero-based block index.
 * @returns {Object<string, *>} Canonical Claude notice event.
 */
export function noticeEvent(record, sourceIndex, block, blockIndex) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, blockIndex);
  return {
    id: `claude:${sourceIdentity}:notice:${blockIndex}`,
    provider: 'claude',
    source_record_id: source.record_id,
    source_index: sourceIndex,
    kind: 'notice',
    role: 'system',
    channel: null,
    visibility: 'visible',
    content_type: 'synthetic_notice',
    blocks: [{ id: `claude:${sourceIdentity}:notice:${blockIndex}:block`, type: 'text', text: block.text, source }],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source
  };
}

/**
 * Extracts the internal Claude subagent ID embedded in an Agent tool result.
 *
 * @param {string} text - Provider result text.
 * @returns {string|null} Internal subagent identifier, or null when absent.
 */
export function agentIdFromResult(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/^agentId:\s*([^\s]+)\s*\(internal ID - do not mention to user\.\)$/m);
  return match?.[1] ?? null;
}

/**
 * Removes the internal Agent-ID control line from Claude subagent output.
 *
 * @param {string} text - Provider result text.
 * @returns {string} Displayable subagent result text.
 */
export function cleanAgentResult(text) {
  if (typeof text !== 'string') return '';
  return text.split('\n')
    .filter(line => !/^agentId:\s*[^\s]+\s*\(internal ID - do not mention to user\.\)$/.test(line))
    .join('\n').trim();
}

/**
 * Builds a canonical subagent completion event.
 *
 * @param {Object<string, *>} record - Provider/source record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @param {string} agentId - Canonical subagent identifier.
 * @param {string|null} description - Provider subagent description.
 * @param {string} output - Displayable subagent output.
 * @param {string|null} callId - Correlated tool-call identifier.
 * @param {number|null} sourceBlockIndex - Zero-based completion block index.
 * @param {Object<string, *>|null} invocationSource - Canonical invocation provenance.
 * @returns {Object<string, *>} Canonical Claude subagent event.
 */
export function subagentEvent(record, sourceIndex, agentId, description, output, callId,
                              sourceBlockIndex = null, invocationSource = null) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, sourceBlockIndex);
  return {
    id: `claude:${sourceIdentity}:subagent:${agentId}`,
    provider: 'claude', source_record_id: source.record_id, source_index: sourceIndex,
    kind: 'subagent', role: 'assistant', channel: null, visibility: 'visible', content_type: 'subagent',
    blocks: [{ id: `claude:${sourceIdentity}:subagent:${agentId}:block`, type: 'subagent', agent_id: agentId, description, output, source }],
    citations: [], resources: [],
    relationships: {
      tool_call_id: callId ?? null,
      invocation_source: invocationSource
    },
    source
  };
}

/**
 * Returns the trimmed contents of one named XML-like tag from Claude queue text.
 *
 * @param {string} content - Provider queue-operation text.
 * @param {string} name - XML-like tag name.
 * @returns {string|null} Trimmed tag contents, or null when absent.
 */
function xmlTag(content, name) {
  if (typeof content !== 'string') return null;
  const match = content.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? match[1].trim() : null;
}

/**
 * Converts a completed Claude queue-operation task notification into a canonical subagent event.
 *
 * @param {Object<string, *>} record - Provider/source record.
 * @param {number} sourceIndex - Zero-based source record index.
 * @returns {Object<string, *>|null} Canonical subagent event, or null when not a completed task notification.
 */
export function queueSubagentEvent(record, sourceIndex) {
  if (record?.type !== 'queue-operation' || typeof record?.content !== 'string') return null;
  if (!record.content.includes('<task-notification>') || xmlTag(record.content, 'status') !== 'completed') return null;
  const taskId = xmlTag(record.content, 'task-id');
  const summary = xmlTag(record.content, 'summary');
  const result = xmlTag(record.content, 'result');
  if (!taskId || !result) return null;
  const descriptionMatch = summary?.match(/^Agent\s+"([\s\S]+)"\s+came to rest$/);
  return subagentEvent(record, sourceIndex, taskId,
    descriptionMatch?.[1] ?? summary ?? null, result, xmlTag(record.content, 'tool-use-id'));
}
