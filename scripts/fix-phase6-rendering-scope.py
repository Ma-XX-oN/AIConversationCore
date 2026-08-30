#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')

old = ''' * @param {boolean} quoted - Whether provenance lines must be Markdown-blockquoted.\n * @returns {string} The details group with optional per-source provenance on the summary and following lines.\n */\nfunction projectedDetails(summary, body, sourceEvents, quoted = false) {\n  const events = Array.isArray(sourceEvents) ? sourceEvents : [];\n  const comments = events.map(event => projectedComment(event, quoted)).filter(Boolean);\n  const first = comments.shift() ?? '';\n  const opening = `<details><summary>${summary}</summary>${first ? ` ${first.replace(/^> /, '')}` : ''}`;\n  const extra = comments.length ? `\\n${comments.join('\\n')}` : '';\n  return `${opening}${extra}\\n\\n${body}\\n\\n</details>`;\n}'''
new = ''' * @param {boolean} quoted - Whether provenance lines must be Markdown-blockquoted.\n * @param {boolean} inlineOpening - Whether `<details>` and `<summary>` share the opening line.\n * @returns {string} The details group with optional per-source provenance on the summary and following lines.\n */\nfunction projectedDetails(summary, body, sourceEvents, quoted = false, inlineOpening = false) {\n  const events = Array.isArray(sourceEvents) ? sourceEvents : [];\n  const comments = events.map(event => projectedComment(event, quoted)).filter(Boolean);\n  const first = comments.shift() ?? '';\n  const summaryLine = `<summary>${summary}</summary>${first ? ` ${first.replace(/^> /, '')}` : ''}`;\n  const opening = inlineOpening ? `<details>${summaryLine}` : `<details>\\n${summaryLine}`;\n  const extra = comments.length ? `\\n${comments.join('\\n')}` : '';\n  return `${opening}${extra}\\n\\n${body}\\n\\n</details>`;\n}'''
if old not in text:
  raise SystemExit('projectedDetails scope anchor not found')
text = text.replace(old, new, 1)

old = "body.push(projectedDetails(thoughtSummary(thoughts.length), rendered, thoughts.map(item => item.event)));"
new = "body.push(projectedDetails(thoughtSummary(thoughts.length), rendered, thoughts.map(item => item.event), false, true));"
if old not in text:
  raise SystemExit('ChatGPT thought group anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
