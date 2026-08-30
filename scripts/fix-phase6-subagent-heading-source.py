#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')

anchor = '''function projectedSection(event, section) {
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
 * Primary canonical event provenance is preserved unchanged.  This helper is
 * used only when a renderer-generated structure has a separately evidenced
 * source relationship, such as a Claude sub-agent heading representing the
 * originating Agent invocation while the completion event remains sourced from
 * the tool-result record.
 *
 * @param {Object<string, *>} event - The canonical event whose related source is being projected.
 * @param {string} relationshipName - The relationship/source role to project.
 * @returns {Object<string, *>} An event-shaped view using the related source and its consumer projection when available, otherwise the original event.
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
if helper.strip() not in text:
  if anchor not in text:
    raise SystemExit('projectedSection anchor not found')
  text = text.replace(anchor, anchor + helper, 1)

old = '''function renderSubagentEvent(event) {
  const block = event?.blocks?.find(item => item.type === 'subagent');
  if (!block?.agent_id) return '';
  const body = [];
  if (block.description) body.push(quoteMarkdown(`**${block.description}**`));
  if (block.output) body.push(quoteMarkdown(block.output));
  const label = `## ${providerLabel(event.provider)} Sub-agent ${block.agent_id}`;
  return projectedSection(event, `${projectedHeading(event, label)}\n\n${body.join('\n\n')}`);
}'''
new = '''function renderSubagentEvent(event) {
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
}'''
if old not in text:
  raise SystemExit('renderSubagentEvent anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
