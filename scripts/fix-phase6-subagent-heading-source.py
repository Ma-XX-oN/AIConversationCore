#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')

section_anchor = '''function projectedSection(event, section) {
  const comment = projectedComment(event);
  if (!comment) return section;
  const newline = section.indexOf('\\n');
  if (newline < 0) return `${section} ${comment}`;
  return `${section.slice(0, newline)} ${comment}${section.slice(newline)}`;
}
'''
helper = r'''

/**
 * Returns an event-shaped projection view for a related source record.
 *
 * Primary canonical event provenance is preserved unchanged. This view is used
 * only when a renderer-generated structure has separately evidenced provenance.
 *
 * @param {Object<string, *>} event - The canonical event whose related source is being projected.
 * @param {string} relationshipName - The relationship/source role to project.
 * @returns {Object<string, *>} An event-shaped view using the related source and projection, or the original event when unavailable.
 */
function relatedProjectionEvent(event, relationshipName) {
  const source = event?.relationships?.[relationshipName];
  if (!source || typeof source !== 'object') return event;
  const relatedProjection = event?.projection?.related_sources?.[relationshipName];
  return {
    ...event,
    source_record_id: source.record_id ?? null,
    source_index: Number.isInteger(source.record_index) ? source.record_index : null,
    projection: relatedProjection ?? event?.projection ?? {}
  };
}
'''
if 'function relatedProjectionEvent(' not in text:
  if section_anchor not in text:
    raise SystemExit('projectedSection anchor not found')
  text = text.replace(section_anchor, section_anchor + helper, 1)

marker = 'function renderSubagentEvent(event) {'
start = text.find(marker)
if start < 0:
  raise SystemExit('renderSubagentEvent function not found')
doc_start = text.rfind('/**', 0, start)
next_doc = text.find('\n/**', start)
if doc_start < 0 or next_doc < 0:
  raise SystemExit('renderSubagentEvent function boundary not found')
replacement = r'''/**
 * Renders a Claude subagent section with invocation and completion provenance.
 *
 * The heading represents the originating Agent invocation when that related
 * source is available. The completion remains the primary event source and is
 * emitted as a second debug provenance line so neither source is lost.
 *
 * @param {Object<string, *>} event - The canonical subagent completion event being rendered.
 * @returns {string} Markdown representation of the Claude subagent completion event.
 */
function renderSubagentEvent(event) {
  const block = event?.blocks?.find(item => item.type === 'subagent');
  if (!block?.agent_id) return '';
  const headingEvent = relatedProjectionEvent(event, 'invocation_source');
  const body = [];
  const completionComment = headingEvent === event ? '' : projectedComment(event);
  if (completionComment) body.push(completionComment);
  if (block.description) body.push(quoteMarkdown(`**${block.description}**`));
  if (block.output) body.push(quoteMarkdown(block.output));
  const label = `## ${providerLabel(event.provider)} Sub-agent ${block.agent_id}`;
  return projectedSection(
    headingEvent,
    `${projectedHeading(headingEvent, label)}\n${body.length ? `\n${body.join('\n\n')}` : ''}`
  );
}
'''
text = text[:doc_start] + replacement.rstrip() + text[next_doc:]
path.write_text(text, encoding='utf-8')
