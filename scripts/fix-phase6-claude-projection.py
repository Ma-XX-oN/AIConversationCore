#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')

old = "  const color = label === '## User' ? colors.user : colors.ai;"
new = "  const color = label === '## User' ? colors.user : (label.includes(' Sub-agent ') ? '' : colors.ai);"
if old not in text:
  raise SystemExit('projectedHeading colour anchor not found')
text = text.replace(old, new, 1)

old = "  const headingEvent = segment.find(event => event.kind === 'message' && event.role === 'assistant') ?? segment[0];"
new = "  const headingEvent = segment[0];"
if old not in text:
  raise SystemExit('Claude heading provenance anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
