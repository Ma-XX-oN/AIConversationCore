#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')

old = "  const opening = `<details>\\n<summary>${summary}</summary>${first ? ` ${first.replace(/^> /, '')}` : ''}`;"
new = "  const opening = `<details><summary>${summary}</summary>${first ? ` ${first.replace(/^> /, '')}` : ''}`;"
if old not in text:
  raise SystemExit('projectedDetails opening anchor not found')
text = text.replace(old, new, 1)

old = "  return details(summary, [fencedCode(command, 'bash'), `**OUT**\\n\\n${fencedCode(output)}`].join('\\n\\n'));"
new = "  const sources = resultEvent ? [callEvent, resultEvent] : [callEvent];\n  return projectedDetails(summary, [fencedCode(command, 'bash'), `**OUT**\\n\\n${fencedCode(output)}`].join('\\n\\n'), sources);"
if old not in text:
  raise SystemExit('Claude tool details anchor not found')
text = text.replace(old, new, 1)

old = "  if (response.approved_plan) parts.push(quoteMarkdown(details('Approved Plan', response.approved_plan)));"
new = "  if (response.approved_plan) parts.push(quoteMarkdown(projectedDetails('Approved Plan', response.approved_plan, [event])));"
if old not in text:
  raise SystemExit('Approved Plan details anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
