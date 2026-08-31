#!/usr/bin/env python3
from pathlib import Path

markdown_path = Path('src/projections/markdown.js')
text = markdown_path.read_text(encoding='utf-8')

old = "  const headingEvent = segment[0];\n  return [projectedSection(headingEvent, `${projectedHeading(headingEvent, '## ChatGPT')}"
new = "  const headingEvent = segment[0];\n  // Consumer response-heading metadata may differ from the first activity event's own heading metadata.\n  const responseHeadingEvent = headingEvent?.projection?.response_heading_suffix != null\n    ? {\n        ...headingEvent,\n        projection: {\n          ...headingEvent.projection,\n          heading_suffix: headingEvent.projection.response_heading_suffix\n        }\n      }\n    : headingEvent;\n  return [projectedSection(responseHeadingEvent, `${projectedHeading(responseHeadingEvent, '## ChatGPT')}"
if old not in text:
  raise SystemExit('ChatGPT response heading anchor not found')
text = text.replace(old, new, 1)
markdown_path.write_text(text, encoding='utf-8')

test_path = Path('tests/phase6-rendering-contract.test.js')
test_text = test_path.read_text(encoding='utf-8')
addition = r'''

test('ChatGPT response heading projection can differ from first commentary heading projection', () => {
  const commentary = event(30, 'commentary', 'assistant', 'interim');
  commentary.projection = {
    heading_suffix: ' <!-- turn_id=commentary-30 -->',
    response_heading_suffix: ' <!-- turn_id=final-31 -->'
  };
  const final = event(31, 'message', 'assistant', 'final');
  final.projection = {};
  const markdown = renderCanonicalMarkdown([commentary, final]);

  assert.match(markdown, /^## ChatGPT <!-- turn_id=final-31 -->/m);
  assert.match(markdown, /^### ChatGPT Commentary <!-- turn_id=commentary-30 -->/m);
  assert.equal((markdown.match(/^## ChatGPT(?: |$)/gm) ?? []).length, 1);
});
'''
if "response heading projection can differ from first commentary" in test_text:
  raise SystemExit('Phase 7 response-heading projection test already present')
test_path.write_text(test_text.rstrip() + addition, encoding='utf-8')
