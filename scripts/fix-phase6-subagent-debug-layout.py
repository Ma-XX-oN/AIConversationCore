#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')

old = '''  const headingEvent = relatedProjectionEvent(event, 'invocation_source');
  const body = [];
  const completionComment = headingEvent === event ? '' : projectedComment(event);
  if (completionComment) body.push(completionComment);
  if (block.description) body.push(quoteMarkdown(`**${block.description}**`));
  if (block.output) body.push(quoteMarkdown(block.output));
  const label = `## ${providerLabel(event.provider)} Sub-agent ${block.agent_id}`;
  return projectedSection(
    headingEvent,
    `${projectedHeading(headingEvent, label)}\n${body.length ? `\n${body.join('\n\n')}` : ''}`
  );'''
new = '''  const headingEvent = relatedProjectionEvent(event, 'invocation_source');
  const body = [];
  const completionComment = headingEvent === event ? '' : projectedComment(event);
  if (block.description) body.push(quoteMarkdown(`**${block.description}**`));
  if (block.output) body.push(quoteMarkdown(block.output));
  const label = `## ${providerLabel(event.provider)} Sub-agent ${block.agent_id}`;
  const secondaryProvenance = completionComment ? `\n${completionComment}` : '';
  const renderedBody = body.length ? `\n\n${body.join('\n\n')}` : '';
  return projectedSection(
    headingEvent,
    `${projectedHeading(headingEvent, label)}${secondaryProvenance}${renderedBody}`
  );'''
if old not in text:
  raise SystemExit('subagent debug layout anchor not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
