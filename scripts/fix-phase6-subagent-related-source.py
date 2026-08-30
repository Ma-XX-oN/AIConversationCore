#!/usr/bin/env python3

from pathlib import Path

adapter = Path('src/adapters/claude.js')
text = adapter.read_text(encoding='utf-8')

old = ''' * @param {number|null} sourceBlockIndex - The zero-based source block index.
 * @returns {Object<string, *>} A canonical Claude subagent completion event with source/tool-call provenance.
 */
function subagentEvent(record, sourceIndex, agentId, description, output, callId, sourceBlockIndex = null) {
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
new = ''' * @param {number|null} sourceBlockIndex - The zero-based source block index of the completion record.
 * @param {Object<string, *>|null} invocationSource - Canonical source provenance for the Agent invocation that produced this completion, or null when unavailable.
 * @returns {Object<string, *>} A canonical Claude subagent completion event retaining both completion and invocation provenance.
 */
function subagentEvent(record, sourceIndex, agentId, description, output, callId,
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
}'''
if old not in text:
  raise SystemExit('subagentEvent anchor not found')
text = text.replace(old, new, 1)

old = '''          agentCalls.set(block.id, { description: typeof block?.input?.description === 'string' ? block.input.description : null });'''
new = '''          agentCalls.set(block.id, {
            description: typeof block?.input?.description === 'string' ? block.input.description : null,
            source: baseSource(record, sourceIndex, blockIndex)
          });'''
if old not in text:
  raise SystemExit('agentCalls anchor not found')
text = text.replace(old, new, 1)

old = '''        events.push(subagentEvent(record, sourceIndex, agentIdFromResult(rawOutput) ?? callId,
          agentCall.description, cleanAgentResult(rawOutput), callId, blockIndex));'''
new = '''        events.push(subagentEvent(
          record,
          sourceIndex,
          agentIdFromResult(rawOutput) ?? callId,
          agentCall.description,
          cleanAgentResult(rawOutput),
          callId,
          blockIndex,
          agentCall.source
        ));'''
if old not in text:
  raise SystemExit('subagent result anchor not found')
text = text.replace(old, new, 1)

adapter.write_text(text, encoding='utf-8')

test = Path('tests/claude-adapter.test.js')
t = test.read_text(encoding='utf-8')
anchor = "  assert.equal(successful.relationships.tool_call_id, 'toolu_agent_ok');\n"
addition = "  assert.equal(successful.relationships.invocation_source.record_index, 2);\n  assert.equal(successful.source_index, 3);\n"
if addition not in t:
  if anchor not in t:
    raise SystemExit('Claude adapter test anchor not found')
  t = t.replace(anchor, anchor + addition, 1)
test.write_text(t, encoding='utf-8')
