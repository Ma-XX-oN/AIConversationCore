from pathlib import Path
import re

FILES = [
  *Path('src').rglob('*.js'),
  *Path('scripts').rglob('*.mjs'),
]
FILES = [p for p in FILES if p.name != 'check-jsdoc.mjs']

PARAM_DESCRIPTIONS = {
  'event': 'The canonical event being inspected, normalized, or rendered.',
  'events': 'The ordered canonical events being processed in source order.',
  'record': 'The provider/source record being normalized.',
  'records': 'The ordered provider/source records being normalized.',
  'turn': 'The derived canonical turn whose identity or header is being projected.',
  'turnIndex': 'The zero-based index assigned to the newly derived turn.',
  'theme': 'The projection theme containing ANSI and HTML style-role mappings.',
  'base': 'The base projection theme on which overrides are applied.',
  'overrides': 'Optional projection-theme role overrides to merge with the current/base theme.',
  'provider': 'The canonical provider identifier whose display label is requested.',
  'source': 'The source descriptor or provider pointer being normalized or rendered.',
  'block': 'The canonical/provider content block being inspected or rendered.',
  'blocks': 'The ordered canonical content blocks being inspected or rendered.',
  'citation': 'The canonical citation being rendered or remapped.',
  'citations': 'The canonical citations associated with the event, in source order.',
  'reference': 'The provider content-reference object being normalized.',
  'range': 'The canonical text range associated with the reference, or null when no range exists.',
  'context': 'Normalization context containing source record, blocks, indexes, and related lookups.',
  'item': 'The provider/search-result item being converted to a canonical source descriptor.',
  'lookup': 'The normalized-URL lookup used to enrich source metadata.',
  'retrievedFiles': 'Retrieved-file metadata indexed by ChatGPT retrieval marker.',
  'path': 'The provider/sandbox path being reduced to its final path component.',
  'pointer': 'The provider sandbox pointer being converted to a /mnt/data-style path.',
  'conversationId': 'The ChatGPT conversation identifier required to construct the authenticated download route.',
  'messageId': 'The source Assistant message identifier required to construct the authenticated download route.',
  'text': 'The source or canonical text being transformed or rendered.',
  'content': 'The provider/canonical content being converted to display text.',
  'summary': 'The summary label shown for the collapsible details block.',
  'body': 'The body text placed inside the generated details block.',
  'count': 'The number of reasoning/thought items represented by the summary label.',
  'language': 'The canonical or provider code-fence language identifier.',
  'segment': 'The ordered canonical events that form one Assistant activity segment.',
  'state': 'Per-render mutable state used for numbering and other projection-local counters.',
  'callEvent': 'The canonical tool-call event being paired/rendered.',
  'resultEvent': 'The matching canonical tool-result event, or null when no result is available.',
  'input': 'The provider tool-input object being normalized.',
  'payload': 'The provider payload object being classified as a tool call or tool result.',
  'argumentsText': 'The serialized Codex tool arguments to parse and normalize.',
  'outputText': 'The serialized Codex tool output to parse and normalize.',
  'role': 'The canonical message role assigned to the generated event.',
  'channel': 'The Codex message channel, or null when the source record has no channel.',
  'contentType': 'The provider content-type label preserved in source provenance.',
  'part': 'The ChatGPT multimodal source part being normalized.',
  'replacement': 'The canonical display-replacement object whose part indexes are being remapped.',
  'resource': 'The canonical resource whose source/text part indexes are being remapped.',
  'textOrdinalToPartIndex': 'Map from ChatGPT text-only ordinals to original multimodal part indexes.',
  'extra': 'Additional source-provenance fields to merge with the event source object.',
  'assets': 'The provider tether-browsing asset object/array, or null when absent.',
  'description': 'The provider subagent description, or null when none was supplied.',
  'output': 'The displayable provider tool/subagent output text.',
  'callId': 'The correlated provider tool-call identifier, or null when unavailable.',
  'knownRecordIds': 'Set of stable source record IDs used to validate parent-event linkage.',
  'components': 'The ordered turn-header components to render.',
  'options': 'Turn-header rendering options such as timestamp, record number, turn ID visibility, format, and theme.',
  'fallback': 'Fallback display label used when the source supplies no suitable label.',
  'fallbackLabel': 'Fallback link label used when the source supplies no suitable title/attribution.',
  'preferTitle': 'Whether an available source title should be preferred over attribution/hostname.',
  'fileRef': 'The retrieved-file resource associated with a tool result, when available.',
}

# Some parameter names need a more specific type than the first documentation pass supplied.
PARAM_TYPES = {
  ('src/adapters/chatgpt.js', 'normalizeParentRelationship', 'event'): 'Object<string, *>',
  ('src/adapters/chatgpt.js', 'normalizeParentRelationship', 'record'): 'Object<string, *>',
  ('src/adapters/chatgpt.js', 'normalizeParentRelationship', 'knownRecordIds'): 'Set<string>',
  ('src/adapters/chatgpt.js', 'normalizeSourceFootnotes', 'event'): 'Object<string, *>',
  ('src/adapters/chatgpt.js', 'normalizeSourceFootnotes', 'record'): 'Object<string, *>',
  ('src/adapters/chatgpt.js', 'normalizeSourceProvenance', 'event'): 'Object<string, *>',
  ('src/adapters/chatgpt.js', 'normalizeSourceProvenance', 'record'): 'Object<string, *>',
  ('src/projections/markdown.js', 'renderCodexAssistantSegment', 'segment'): 'Array<Object<string, *>>',
  ('src/projections/markdown.js', 'renderCodexAssistantSegment', 'state'): 'Object<string, number>',
  ('src/projections/markdown.js', 'renderAssistantSegment', 'segment'): 'Array<Object<string, *>>',
  ('src/projections/markdown.js', 'renderAssistantSegment', 'events'): 'Array<Object<string, *>>',
  ('src/projections/markdown.js', 'renderAssistantSegment', 'state'): 'Object<string, number>',
  ('src/projections/markdown.js', 'renderNotice', 'event'): 'Object<string, *>',
  ('src/projections/turn-header.js', 'headingLabel', 'turn'): 'Object<string, *>',
  ('src/projections/turn-header.js', 'buildTurnHeaderComponents', 'turn'): 'Object<string, *>',
  ('src/projections/turn-header.js', 'buildTurnHeaderComponents', 'options'): 'Object<string, *>',
  ('src/projections/turn-header.js', 'renderPlain', 'components'): 'Array<Object<string, string>>',
  ('src/projections/turn-header.js', 'renderAnsi', 'components'): 'Array<Object<string, string>>',
  ('src/projections/turn-header.js', 'renderAnsi', 'theme'): 'Object<string, *>',
  ('src/projections/turn-header.js', 'renderHtml', 'components'): 'Array<Object<string, string>>',
  ('src/projections/turn-header.js', 'renderHtml', 'theme'): 'Object<string, *>',
  ('src/projections/turn-header.js', 'renderTurnHeader', 'turn'): 'Object<string, *>',
  ('src/projections/turn-header.js', 'renderTurnHeader', 'options'): 'Object<string, *>',
}

RETURN_CORRECTIONS = {
  ('src/adapters/claude.js', 'normalizeExitPlanResponse'):
    ('Object<string, *>|null', 'Normalized exit-plan approval metadata, or null when the provider output is not a recognizable approval response.'),
  ('src/adapters/codex.js', 'parseJsonObject'):
    ('Object<string, *>|null', 'The parsed non-array JSON object, or null when parsing fails or the value is not an object.'),
  ('src/adapters/chatgpt.js', 'normalizeSourceFootnotes'):
    ('Object<string, *>', 'The canonical event with sources-footnote citations appended, or the original event when none are present.'),
  ('src/adapters/chatgpt.js', 'normalizeParentRelationship'):
    ('Object<string, *>', 'The canonical event with parent source/event relationship fields derived from provider metadata.'),
  ('src/adapters/chatgpt.js', 'normalizeSourceProvenance'):
    ('Object<string, *>', 'The canonical event with stable ChatGPT record identity, indexes, timestamps, and turn-linkage provenance.'),
  ('src/projections/markdown.js', 'quoteMarkdown'):
    ('string', 'The supplied text rendered as Markdown blockquote lines.'),
  ('src/projections/markdown.js', 'providerLabel'):
    ('string', 'The human-readable provider name used in transcript headings.'),
  ('src/projections/markdown.js', 'renderImageBlock'):
    ('string', 'Markdown for the canonical image resource, including available/missing/unavailable state.'),
  ('src/projections/markdown.js', 'faviconDomain'):
    ('string', 'The hostname used for favicon lookup, or an empty string when the URL cannot be parsed.'),
  ('src/projections/markdown.js', 'sourceTooltip'):
    ('string', 'Tooltip text assembled from the source title/snippet metadata.'),
  ('src/projections/markdown.js', 'sourceLabel'):
    ('string', 'The preferred visible source label, falling back to the supplied label/hostname.'),
  ('src/projections/markdown.js', 'renderSourceAnchor'):
    ('string', 'The HTML anchor (with optional favicon/tooltip) for the canonical web source.'),
  ('src/projections/markdown.js', 'renderWebCitation'):
    ('string', 'Markdown/HTML rendering of the canonical web citation and its supporting sources.'),
  ('src/projections/markdown.js', 'renderMemoryCitation'):
    ('string', 'Markdown/HTML rendering of the canonical memory citation sources.'),
  ('src/projections/markdown.js', 'retrievedLineLabel'):
    ('string', 'Human-readable line/range label for a retrieved-file citation, or an empty string when no line metadata exists.'),
  ('src/projections/markdown.js', 'renderCitation'):
    ('string', 'Rendered Markdown for the supported canonical citation kind.'),
  ('src/projections/markdown.js', 'renderTextBlock'):
    ('string', 'Canonical text block after applying ordered display/citation replacements.'),
  ('src/projections/markdown.js', 'reasoningBody'):
    ('string', 'Visible reasoning-summary text joined from the event reasoning blocks.'),
  ('src/projections/markdown.js', 'thoughtSummary'):
    ('string', 'The singular/plural summary label for the requested number of thought items.'),
  ('src/projections/markdown.js', 'renderMultimodalToolOutput'):
    ('string', 'Rendered Markdown for a multimodal tool-result block and any related retrieved file.'),
  ('src/projections/markdown.js', 'renderChatGPTToolBlock'):
    ('string', 'Rendered Markdown details block for one ChatGPT tool call or result block.'),
  ('src/projections/markdown.js', 'renderChatGPTToolEvent'):
    ('string', 'Rendered Markdown for all tool blocks in the canonical ChatGPT tool event.'),
  ('src/projections/markdown.js', 'renderUser'):
    ('string', 'The complete User transcript section for the canonical event.'),
  ('src/projections/markdown.js', 'renderClaudeToolThought'):
    ('string', 'Collapsed Markdown representation of a Claude tool call and its optional result.'),
  ('src/projections/markdown.js', 'renderSubagentEvent'):
    ('string', 'Markdown blockquote representation of a Claude subagent completion event.'),
  ('src/projections/markdown.js', 'renderClaudeQuestionBlock'):
    ('string', 'Markdown question/options block for a normalized Claude AskUserQuestion call.'),
  ('src/projections/markdown.js', 'renderClaudePlanBlock'):
    ('string', 'Markdown details block containing a Claude exit-plan proposal.'),
  ('src/projections/markdown.js', 'renderClaudePlanApproval'):
    ('string', 'Markdown User response section for a Claude exit-plan approval result.'),
  ('src/projections/markdown.js', 'renderCodexMainResponse'):
    ('string|null', 'The main Codex transcript section for reasoning/commentary/final text, or null when the segment has no visible main response.'),
  ('src/projections/markdown.js', 'renderCodexAssistantSegment'):
    ('Array<string>', 'Ordered Markdown sections for Codex request/answer, main response, and file-change content.'),
  ('src/projections/markdown.js', 'renderAssistantSegment'):
    ('Array<string>', 'Provider-specific Markdown sections produced from one ordered Assistant activity segment.'),
  ('src/projections/markdown.js', 'renderNotice'):
    ('string', 'Blockquoted system-notice Markdown, or an empty string when the notice has no visible text.'),
  ('src/projections/turn-header.js', 'headingLabel'):
    ('string', 'The User label or human-readable Assistant provider label for the canonical turn.'),
  ('src/projections/turn-header.js', 'buildTurnHeaderComponents'):
    ('Array<Object<string, string>>', 'Ordered speaker/timestamp/record-number/turn-ID components used to render the turn header.'),
  ('src/projections/turn-header.js', 'renderPlain'):
    ('string', 'Plain-text turn header assembled from the ordered components.'),
  ('src/projections/turn-header.js', 'renderAnsi'):
    ('string', 'ANSI-styled turn header assembled from the ordered components and theme.'),
  ('src/projections/turn-header.js', 'renderHtml'):
    ('string', 'HTML h2 turn header with role-specific classes from the projection theme.'),
  ('src/projections/turn-header.js', 'renderTurnHeader'):
    ('string|Array<Object<string, string>>', 'The requested plain/ANSI/HTML header string, or the component array when format is components.'),
}

FUNCTION_START = re.compile(r'^(?:export\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)\s*\(', re.M)
CONST_START = re.compile(r'^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=.*=>', re.M)


def immediate_doc_bounds(text, start):
  prefix = text[:start]
  stripped = prefix.rstrip()
  if not stripped.endswith('*/'):
    return None
  end = len(stripped)
  begin = stripped.rfind('/**')
  return (begin, end) if begin >= 0 else None


def function_matches(text):
  matches = list(FUNCTION_START.finditer(text)) + list(CONST_START.finditer(text))
  return {m.group(1): m for m in matches}


def parameter_name(raw):
  return raw.strip('[]').split('=')[0]


def update_doc(path, name, doc):
  lines = doc.splitlines()
  for i, line in enumerate(lines):
    m = re.search(r'@param\s+\{([^}]+)\}\s+([^\s]+)\s+-\s+(.+)$', line)
    if m:
      raw = m.group(2)
      param = parameter_name(raw)
      type_override = PARAM_TYPES.get((path.as_posix(), name, param))
      if type_override:
        line = re.sub(r'(@param\s+)\{[^}]+\}', r'\1{' + type_override + '}', line, count=1)
      if 'value used by this operation' in line.lower() or 'value required by this function' in line.lower():
        description = PARAM_DESCRIPTIONS.get(param)
        if not description:
          raise SystemExit(f'No semantic parameter description configured for {path}:{name}:{param}')
        line = re.sub(r'\s+-\s+.*$', ' - ' + description, line)
      lines[i] = line

  correction = RETURN_CORRECTIONS.get((path.as_posix(), name))
  if correction:
    return_type, description = correction
    for i, line in enumerate(lines):
      if '@returns' in line or '@return ' in line:
        indent = line[:line.index('*') + 1]
        lines[i] = f'{indent} @returns {{{return_type}}} {description}'
        break
  return '\n'.join(lines)


for path in sorted(FILES):
  text = path.read_text(encoding='utf-8')
  changed = False
  names = function_matches(text)
  # Iterate by name and re-scan after each replacement because comment lengths change offsets.
  for name in list(names):
    names = function_matches(text)
    match = names[name]
    bounds = immediate_doc_bounds(text, match.start())
    if not bounds:
      continue
    begin, end = bounds
    old = text[begin:end]
    new = update_doc(path, name, old)
    if new != old:
      text = text[:begin] + new + text[end:]
      changed = True
  if changed:
    path.write_text(text, encoding='utf-8')
    print(f'updated descriptions/types in {path}')
