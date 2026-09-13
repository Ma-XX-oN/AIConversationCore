from pathlib import Path


def replace_once(text, old, new, label):
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{label}: expected exactly one match, found {count}')
  return text.replace(old, new, 1)


source_path = Path('src/projections/markdown.js')
source = source_path.read_text(encoding='utf-8')
old = """  const headingEvent = segment[0];
  // Consumer response-heading metadata may differ from the first activity event's own heading metadata.
  const responseHeadingEvent = headingEvent?.projection?.response_heading_suffix != null
    ? {
        ...headingEvent,
        projection: {
          ...headingEvent.projection,
          heading_suffix: headingEvent.projection.response_heading_suffix
        }
      }
    : headingEvent;
  return [projectedSection(responseHeadingEvent, `${projectedHeading(responseHeadingEvent, '## ChatGPT')}\n\n${body.join('\n\n')}`)];
"""
new = """  const headingEvent = segment[0];
  // Consumer response-heading metadata may differ from the first activity event's own heading metadata.
  const responseHeadingMetadata = headingEvent?.projection?.response_heading_metadata;
  const responseHeadingSuffix = headingEvent?.projection?.response_heading_suffix;
  const hasResponseHeadingProjection = responseHeadingMetadata != null || responseHeadingSuffix != null;
  const responseHeadingEvent = hasResponseHeadingProjection
    ? {
        ...headingEvent,
        projection: {
          ...headingEvent.projection,
          ...(responseHeadingMetadata != null ? { heading_metadata: responseHeadingMetadata } : {}),
          ...(responseHeadingSuffix != null ? { heading_suffix: responseHeadingSuffix } : {})
        }
      }
    : headingEvent;
  return [projectedSection(responseHeadingEvent, `${projectedHeading(responseHeadingEvent, '## ChatGPT')}\n\n${body.join('\n\n')}`)];
"""
source = replace_once(source, old, new, 'response heading projection')
source_path.write_text(source, encoding='utf-8')

test_path = Path('tests/phase6-rendering-contract.test.js')
tests = test_path.read_text(encoding='utf-8')
marker = """test('ChatGPT response heading projection can differ from first commentary heading projection', () => {
  const commentary = event(30, 'commentary', 'assistant', 'interim');
  commentary.projection = {
    heading_suffix: ' <!-- record_id=commentary-30 -->',
    response_heading_suffix: ' <!-- record_id=final-31 -->'
  };
  const final = event(31, 'message', 'assistant', 'final');
  final.projection = {};
  const markdown = renderCanonicalMarkdown([commentary, final]);

  assert.match(markdown, /^## ChatGPT <!-- record_id=final-31 -->/m);
  assert.match(markdown, /^### ChatGPT Commentary <!-- record_id=commentary-30 -->/m);
  assert.equal((markdown.match(/^## ChatGPT(?: |$)/gm) ?? []).length, 1);
});
"""
addition = marker + """

test('ChatGPT response and commentary headings can carry distinct structured metadata', () => {
  const commentary = event(40, 'commentary', 'assistant', 'interim');
  commentary.projection = {
    heading_metadata: {
      timestamp: '2026-09-13 12:00:00',
      record_number: 40,
      show_turn_id: true,
      turn_id: 'commentary-40'
    },
    response_heading_metadata: {
      timestamp: '2026-09-13 12:00:05',
      record_number: 41,
      show_turn_id: true,
      turn_id: 'final-41'
    }
  };
  const final = event(41, 'message', 'assistant', 'final');
  final.projection = {};
  const markdown = renderCanonicalMarkdown([commentary, final]);

  assert.match(markdown,
    /^## ChatGPT \\[2026-09-13 12:00:05\\]: 41: turn_id=final-41$/m);
  assert.match(markdown,
    /^### ChatGPT Commentary \\[2026-09-13 12:00:00\\]: 40: turn_id=commentary-40$/m);
  assert.equal((markdown.match(/turn_id=final-41/g) ?? []).length, 1);
  assert.equal((markdown.match(/turn_id=commentary-40/g) ?? []).length, 1);
});
"""
tests = replace_once(tests, marker, addition, 'response heading regression')
test_path.write_text(tests, encoding='utf-8')
