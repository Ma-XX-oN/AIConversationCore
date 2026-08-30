from pathlib import Path
import re

SPECIAL = {
  'textParts': 'Returns the string-valued text parts from a ChatGPT source record in source order.',
  'reasoningBlocks': 'Builds canonical reasoning-summary blocks from a ChatGPT `thoughts` record.',
  'launcherToken': 'Extracts the normalized executable/launcher token from the start of a persisted command string.',
  'eventVisibility': 'Returns whether a ChatGPT source record is canonically visible or hidden.',
  'eventKind': 'Classifies a ChatGPT source record into its canonical event kind.',
  'eventBlocks': 'Builds the canonical content blocks for one classified ChatGPT source record.',
  'imagePointerSource': 'Returns the first usable image asset pointer exposed by a ChatGPT multimodal part.',
  'sedimentDownloadUrl': 'Converts a ChatGPT `sediment://file_*` pointer into its authenticated download URL.',
  'imageResource': 'Builds the canonical conversation-image resource for one ChatGPT image-pointer part.',
  'sourceFor': 'Builds canonical ChatGPT source provenance for a derived event/block object.',
  'sourceRecordIdentity': 'Returns the stable source-record identity used to derive Claude canonical IDs.',
  'baseSource': 'Builds canonical source provenance for a Claude record or content block.',
  'textBlock': 'Builds a canonical text block from one provider text content block.',
  'reasoningBlock': 'Builds a canonical reasoning-summary block from one provider reasoning block.',
  'toolCallEvent': 'Builds a canonical tool-call event from the provider-specific tool-call source record/block.',
  'toolResultEvent': 'Builds a canonical tool-result event from the provider-specific tool-result source record/block.',
  'messageEvent': 'Builds a canonical message/commentary event from provider-specific message content.',
  'reasoningEvent': 'Builds a canonical reasoning-summary event from provider-specific reasoning content.',
  'noticeEvent': 'Builds a canonical notice event from provider-specific synthetic notice content.',
  'textFromToolResult': 'Extracts displayable text from a Claude tool-result string or text-block array.',
  'agentIdFromResult': 'Extracts the internal Claude subagent ID embedded in an Agent tool result.',
  'cleanAgentResult': 'Removes the internal Agent-ID control line from Claude subagent output.',
  'subagentEvent': 'Builds a canonical subagent event from Claude Agent completion data.',
  'xmlTag': 'Returns the trimmed contents of one named XML-like tag from Claude queue-operation text.',
  'queueSubagentEvent': 'Converts a completed Claude queue-operation task notification into a canonical subagent event.',
  'sourceIdentity': 'Returns the stable source identity used to derive Codex canonical IDs.',
  'source': 'Builds canonical source provenance for a Codex source record.',
  'htmlEscape': 'Escapes text for safe insertion into generated HTML fragments.',
  'providerLabel': 'Returns the human-readable transcript speaker label for a canonical provider.',
  'resourceById': 'Finds one canonical event resource by resource ID.',
  'faviconDomain': 'Returns the origin used for a citation-source favicon lookup.',
  'sourceTooltip': 'Builds citation-source tooltip text from the source title and snippet.',
  'sourceLabel': 'Returns the preferred visible label for a citation source.',
  'retrievedLineLabel': 'Extracts and normalizes a retrieved-file line-range label from citation marker text.',
  'textReplacements': 'Collects display replacements, citations, and generated-file links that apply to one text part.',
  'reasoningBody': 'Builds the Markdown body for canonical reasoning-summary blocks in one event.',
  'details': 'Wraps a summary and body in the HTML `details` structure used by Markdown output.',
  'thoughtSummary': 'Returns the singular/plural human-readable summary for a count of thoughts.',
  'fencedCode': 'Wraps literal content in an adaptive Markdown code fence that cannot collide with backtick runs in the payload.'
}

ACRONYMS = {'json': 'JSON', 'url': 'URL', 'id': 'ID', 'html': 'HTML', 'ansi': 'ANSI', 'chat gpt': 'ChatGPT'}

def humanize(name):
  value = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', name)
  value = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', value).replace('_', ' ').lower()
  for old, new in ACRONYMS.items():
    value = re.sub(rf'\b{re.escape(old)}\b', new, value)
  return value

def replacement(match):
  name = match.group(1)
  purpose = SPECIAL.get(name, f'Handles {humanize(name)}.')
  return f'/**\n * {purpose}\n */'

pattern = re.compile(r'/\*\*\n \* Implements `([A-Za-z_$][\w$]*)`\.\n \*/')
for root in [Path('src'), Path('scripts')]:
  if not root.exists():
    continue
  for path in root.rglob('*'):
    if path.suffix not in {'.js', '.mjs'}:
      continue
    text = path.read_text(encoding='utf-8')
    text = pattern.sub(replacement, text)
    path.write_text(text, encoding='utf-8')
