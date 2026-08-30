#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')

anchor = "function providerLabel(provider) {\n  if (provider === 'claude') return 'Claude';\n  if (provider === 'codex') return 'Codex';\n  return 'ChatGPT';\n}\n"
helpers = r'''

/**
 * Renders a transcript heading with optional consumer-supplied projection metadata.
 *
 * @param {Object<string, *>} event - The canonical event whose source projection metadata is being used.
 * @param {string} label - The canonical Markdown heading label before consumer decoration.
 * @returns {string} The heading with consumer-specific ANSI colour and suffix metadata applied.
 */
function projectedHeading(event, label) {
  const projection = event?.projection ?? {};
  const colors = projection.colors ?? {};
  const color = label === '## User' ? colors.user : colors.ai;
  const reset = colors.reset ?? '';
  const heading = color ? `${color}${label}${reset}` : label;
  return `${heading}${projection.heading_suffix ?? ''}`;
}

/**
 * Renders a numbered thought heading with optional consumer projection metadata.
 *
 * @param {Object<string, *>} event - The canonical reasoning/tool event being headed.
 * @param {number} number - The one-based thought number within the current Assistant section.
 * @returns {string} The consumer-decorated thought heading.
 */
function projectedThoughtHeading(event, number) {
  const projection = event?.projection ?? {};
  const colors = projection.colors ?? {};
  const label = `### Thought ${number}`;
  const heading = colors.thought ? `${colors.thought}${label}${colors.reset ?? ''}` : label;
  return `${heading}${projection.heading_suffix ?? ''}`;
}

/**
 * Returns the optional source-record debug comment supplied by the consumer.
 *
 * @param {Object<string, *>} event - The canonical event whose projection metadata is being read.
 * @param {boolean} quoted - Whether the comment must remain inside an existing Markdown blockquote.
 * @returns {string} The record comment in plain or blockquoted form, or an empty string when disabled.
 */
function projectedComment(event, quoted = false) {
  const comment = event?.projection?.record_comment ?? '';
  if (!comment) return '';
  return quoted ? quoteMarkdown(comment) : comment;
}

/**
 * Prefixes a rendered section with the source-record debug comment when enabled.
 *
 * @param {Object<string, *>} event - The canonical event whose record comment identifies the section.
 * @param {string} section - The already-rendered Markdown section.
 * @returns {string} The section with its optional source-record comment prefix.
 */
function projectedSection(event, section) {
  const comment = projectedComment(event);
  return comment ? `${comment}\n\n${section}` : section;
}
'''
if 'function projectedHeading(' not in text:
  if anchor not in text:
    raise SystemExit('providerLabel anchor not found')
  text = text.replace(anchor, anchor + helpers, 1)

old = "function renderUser(event) {\n  return `## User\\n\\n${quoteMarkdown(renderMessageBlocks(event))}`;\n}"
new = "function renderUser(event) {\n  return projectedSection(event, `${projectedHeading(event, '## User')}\\n\\n${quoteMarkdown(renderMessageBlocks(event))}`);\n}"
if old in text:
  text = text.replace(old, new, 1)

old = "  return body.length ? `## ChatGPT Commentary\\n\\n${body.join('\\n\\n')}` : null;"
new = "  if (!body.length) return null;\n  const headingEvent = segment.find(event => event.kind === 'commentary') ?? segment[0];\n  return projectedSection(headingEvent, `${projectedHeading(headingEvent, '## ChatGPT Commentary')}\\n\\n${body.join('\\n\\n')}`);"
if old in text:
  text = text.replace(old, new, 1)

old = "  if (body.length) sections.push(`## ChatGPT\\n\\n${body.join('\\n\\n')}`);"
new = "  if (body.length) {\n    const headingEvent = messages[0] ?? segment[0];\n    sections.push(projectedSection(headingEvent, `${projectedHeading(headingEvent, '## ChatGPT')}\\n\\n${body.join('\\n\\n')}`));\n  }"
if old in text:
  text = text.replace(old, new, 1)

old = "  return `## ${providerLabel(event.provider)} Sub-agent ${block.agent_id}\\n\\n${body.join('\\n\\n')}`;"
new = "  const label = `## ${providerLabel(event.provider)} Sub-agent ${block.agent_id}`;\n  return projectedSection(event, `${projectedHeading(event, label)}\\n\\n${body.join('\\n\\n')}`);"
if old in text:
  text = text.replace(old, new, 1)

old = "function renderClaudePlanApproval(block) {"
new = "function renderClaudePlanApproval(event, block) {"
if old in text:
  text = text.replace(old, new, 1)
old = "  return `## User\\n\\n${parts.join('\\n\\n')}`;"
new = "  return projectedSection(event, `${projectedHeading(event, '## User')}\\n\\n${parts.join('\\n\\n')}`);"
# Only the first occurrence after renderClaudePlanApproval should be changed.
pos = text.find('function renderClaudePlanApproval(event, block)')
if pos >= 0:
  tail = text[pos:]
  if old in tail:
    tail = tail.replace(old, new, 1)
    text = text[:pos] + tail
old = "        const rendered = renderClaudePlanApproval(block);"
new = "        const rendered = renderClaudePlanApproval(event, block);"
if old in text:
  text = text.replace(old, new, 1)

# Claude section heading and -T presentation.  The canonical body semantics are
# unchanged; projection metadata only decorates headings/comments and optionally
# exposes the existing per-record boundaries requested by AI-transcript.py -T.
old = "  let body = [];\n  let thoughts = [];"
new = "  let body = [];\n  let thoughts = [];\n  const headingEvent = segment.find(event => event.kind === 'message' && event.role === 'assistant') ?? segment[0];"
# Occurs in Claude renderer only after its declaration; replace nearest there.
pos = text.find('function renderClaudeAssistantSegment(segment)')
if pos >= 0:
  before, tail = text[:pos], text[pos:]
  if old in tail:
    tail = tail.replace(old, new, 1)
  text = before + tail

old = "    body.push(quoteMarkdown(details(thoughtSummary(thoughts.length), thoughts.join('\\n\\n***\\n\\n'))));\n    thoughts = [];"
new = "    const separate = Boolean(headingEvent?.projection?.separate_thoughts);\n    const renderedThoughts = separate\n      ? thoughts.map((item, index) => `${quoteMarkdown(projectedThoughtHeading(item.event, index + 1))}\\n>\\n${quoteMarkdown(item.text)}`).join('\\n>\\n> ***\\n>\\n')\n      : thoughts.map(item => item.text).join('\\n\\n***\\n\\n');\n    body.push(quoteMarkdown(details(thoughtSummary(thoughts.length), renderedThoughts)));\n    thoughts = [];"
pos = text.find('function renderClaudeAssistantSegment(segment)')
if pos >= 0:
  before, tail = text[:pos], text[pos:]
  if old in tail:
    tail = tail.replace(old, new, 1)
  text = before + tail

old = "    sections.push(`## Claude\\n\\n${body.join('\\n\\n')}`);"
new = "    sections.push(projectedSection(headingEvent, `${projectedHeading(headingEvent, '## Claude')}\\n\\n${body.join('\\n\\n')}`));"
pos = text.find('function renderClaudeAssistantSegment(segment)')
if pos >= 0:
  before, tail = text[:pos], text[pos:]
  if old in tail:
    tail = tail.replace(old, new, 1)
  text = before + tail

# Claude thought arrays now retain event provenance.
for old, new in [
  ("if (text) thoughts.push(text);", "if (text) thoughts.push({ event, text });"),
  ("if (rendered) thoughts.push(rendered);", "if (rendered) thoughts.push({ event, text: rendered });")
]:
  pos = text.find('function renderClaudeAssistantSegment(segment)')
  if pos >= 0:
    before, tail = text[:pos], text[pos:]
    if old in tail:
      tail = tail.replace(old, new, 1)
    text = before + tail

old = "      if (text) body.push(quoteMarkdown(text));"
new = "      if (text) {\n        if (event?.projection?.separate_thoughts) {\n          const inner = `${quoteMarkdown(projectedHeading(event, '## Claude'))}\\n>\\n${quoteMarkdown(text)}`;\n          const comment = projectedComment(event);\n          body.push(comment ? `${comment}\\n\\n${inner}` : inner);\n        } else {\n          body.push(quoteMarkdown(text));\n        }\n      }"
pos = text.find('function renderClaudeAssistantSegment(segment)')
if pos >= 0:
  before, tail = text[:pos], text[pos:]
  if old in tail:
    tail = tail.replace(old, new, 1)
  text = before + tail

# User responses emitted from Claude tool results retain their source heading/comment.
old = "if (text) sections.push(`## User\\n\\n${quoteMarkdown(text)}`);"
new = "if (text) sections.push(projectedSection(event, `${projectedHeading(event, '## User')}\\n\\n${quoteMarkdown(text)}`));"
if old in text:
  text = text.replace(old, new, 1)

# Codex questions/answers and main response headings.
old = "  const sections = [`## Codex\\n\\n${questionParts.join('\\n\\n')}`];\n  if (answerLines.length) sections.push(`## User\\n\\n${quoteMarkdown(answerLines.join('\\n'))}`);"
new = "  const sections = [projectedSection(callEvent, `${projectedHeading(callEvent, '## Codex')}\\n\\n${questionParts.join('\\n\\n')}`)];\n  if (answerLines.length) sections.push(projectedSection(resultEvent, `${projectedHeading(resultEvent, '## User')}\\n\\n${quoteMarkdown(answerLines.join('\\n'))}`));"
if old in text:
  text = text.replace(old, new, 1)
old = "  return `## Codex\\n\\n${body.join('\\n\\n')}`;"
new = "  const headingEvent = segment[0];\n  return projectedSection(headingEvent, `${projectedHeading(headingEvent, '## Codex')}\\n\\n${body.join('\\n\\n')}`);"
if old in text:
  text = text.replace(old, new, 1)

# Notice comments use their own source record while preserving body text.
old = "  return text ? `> *(system: ${text})*` : '';"
new = "  if (!text) return '';\n  const rendered = `> *(system: ${text})*`;\n  return projectedSection(event, rendered);"
if old in text:
  text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
