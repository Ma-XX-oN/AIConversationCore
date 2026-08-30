#!/usr/bin/env python3

from pathlib import Path

path = Path('src/adapters/claude.js')
text = path.read_text(encoding='utf-8')

old = '''function subagentEvent(record, sourceIndex, agentId, description, output, callId, sourceBlockIndex = null) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, sourceBlockIndex);
  return {
    id: `claude:${sourceIdentity}:subagent:${agentId}`,
    provider: 'claude', source_record_id: source.record_id, source_index: sourceIndex,
    kind: 'subagent', role: 'assistant', channel: null, visibility: 'visible', content_type: 'subagent',
    blocks: [{ id: `claude:${sourceIdentity}:subagent:${agentId}:block`, type: 'subagent', agent_id: agentId, description, output, source }],
    citations: [], resources: [], relationships: { tool_call_id: callId ?? null }, source
  };
}'''
new = '''function subagentEvent(record, sourceIndex, agentId, description, output, callId,
                       sourceBlockIndex = null, outputRecord = null,
                       outputSourceIndex = null, outputBlockIndex = null) {
  const sourceIdentity = sourceRecordIdentity(record, sourceIndex);
  const source = baseSource(record, sourceIndex, sourceBlockIndex);
  const outputSource = outputRecord && Number.isInteger(outputSourceIndex)
    ? baseSource(outputRecord, outputSourceIndex, outputBlockIndex)
    : source;
  return {
    id: `claude:${sourceIdentity}:subagent:${agentId}`,
    provider: 'claude', source_record_id: source.record_id, source_index: sourceIndex,
    kind: 'subagent', role: 'assistant', channel: null, visibility: 'visible', content_type: 'subagent',
    blocks: [{ id: `claude:${sourceIdentity}:subagent:${agentId}:block`, type: 'subagent', agent_id: agentId, description, output, source: outputSource }],
    citations: [], resources: [], relationships: { tool_call_id: callId ?? null }, source
  };
}'''
if old not in text:
  raise SystemExit('subagentEvent anchor not found')
text = text.replace(old, new, 1)

old = '''          agentCalls.set(block.id, { description: typeof block?.input?.description === 'string' ? block.input.description : null });'''
new = '''          agentCalls.set(block.id, {
            description: typeof block?.input?.description === 'string' ? block.input.description : null,
            record,
            source_index: sourceIndex,
            block_index: blockIndex
          });'''
if old not in text:
  raise SystemExit('agentCalls metadata anchor not found')
text = text.replace(old, new, 1)

old = '''        events.push(subagentEvent(record, sourceIndex, agentIdFromResult(rawOutput) ?? callId,
          agentCall.description, cleanAgentResult(rawOutput), callId, blockIndex));'''
new = '''        events.push(subagentEvent(
          agentCall.record,
          agentCall.source_index,
          agentIdFromResult(rawOutput) ?? callId,
          agentCall.description,
          cleanAgentResult(rawOutput),
          callId,
          agentCall.block_index,
          record,
          sourceIndex,
          blockIndex
        ));'''
if old not in text:
  raise SystemExit('Agent result subagent anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
