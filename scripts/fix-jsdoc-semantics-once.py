from pathlib import Path
import re

# Documentation-only semantic corrections.  Every entry is keyed by source file
# and function name so no runtime statement can be rewritten accidentally.
CORRECTIONS = {
  'src/derive/turns.js': {
    'isVisibleTurnEvent': {'params': {'event': 'Object<string, *>|null'}, 'returns': ('boolean', 'Whether the canonical event is a visible User/Assistant turn event.')},
    'sourceRecord': {'params': {'event': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'The normalized source-provenance record carried by a derived turn.')},
    'appendEvent': {'params': {'turn': 'Object<string, *>', 'event': 'Object<string, *>'}, 'returns': ('void', 'No value is returned; the supplied turn is updated in place.')},
    'newTurn': {'params': {'event': 'Object<string, *>', 'turnIndex': 'number'}, 'returns': ('Object<string, *>', 'A new derived turn initialized from the supplied canonical event.')},
    'deriveTurns': {'params': {'events': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Derived turns in the same canonical event order, with contiguous Assistant activity grouped into its turn.')},
  },
  'src/projections/style.js': {
    'cloneTheme': {'params': {'theme': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A detached projection-theme object containing copied ANSI and HTML role maps.')},
    'mergeTheme': {'params': {'base': 'Object<string, *>', 'overrides': 'Object<string, *>|null'}, 'returns': ('Object<string, *>', 'A new projection theme formed by overlaying the supplied role maps on the base theme.')},
    'getDefaultProjectionTheme': {'returns': ('Object<string, *>', 'A detached copy of the currently configured projection theme.')},
    'configureProjectionTheme': {'params': {'overrides': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A detached copy of the newly configured projection theme.')},
    'resetProjectionTheme': {'returns': ('Object<string, *>', 'A detached copy of the restored built-in projection theme.')},
    'resolveProjectionTheme': {'params': {'overrides': 'Object<string, *>|null'}, 'returns': ('Object<string, *>', 'A new effective projection theme combining the configured theme with optional per-call overrides.')},
  },
  'src/adapters/chatgpt-base.js': {
    'textParts': {'params': {'record': 'Object<string, *>'}, 'returns': ('Array<string>', 'String-valued ChatGPT content parts in their source order.')},
    'reasoningBlocks': {'params': {'record': 'Object<string, *>'}, 'returns': ('Array<Object<string, *>>', 'Canonical reasoning-summary blocks derived from the ChatGPT thoughts record.')},
    'normalizedToolCallPresentation': {'params': {'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'Normalized output-facing tool-call input/format/language together with the exact persisted source input and source language.')},
    'toolCallBlocks': {'params': {'record': 'Object<string, *>'}, 'returns': ('Array<Object<string, *>>', 'The single canonical tool-call block array for the source record.')},
    'toolResultBlocks': {'params': {'record': 'Object<string, *>'}, 'returns': ('Array<Object<string, *>>', 'The single canonical tool-result block array for the source record.')},
    'eventVisibility': {'params': {'record': 'Object<string, *>'}},
    'isToolCall': {'params': {'record': 'Object<string, *>'}},
    'isToolResult': {'params': {'record': 'Object<string, *>'}},
    'eventKind': {'params': {'record': 'Object<string, *>'}},
    'eventBlocks': {'params': {'record': 'Object<string, *>', 'blocks': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical content blocks for the classified ChatGPT source record.')},
    'searchResultLookup': {'params': {'record': 'Object<string, *>'}, 'returns': ('Map<string, Object<string, *>>', 'Search-result entries indexed by normalized URL.')},
    'retrievedFileLookup': {'params': {'records': 'Array<Object<string, *>>'}, 'returns': ('Map<string, Object<string, *>>', 'Retrieved-file citation metadata indexed by ChatGPT retrieval marker.')},
    'locateReference': {'params': {'blocks': 'Array<Object<string, *>>'}, 'returns': ('Object<string, number>|null', 'The matching canonical text range, or null when the literal reference text is absent.')},
    'citationBase': {'params': {'reference': 'Object<string, *>', 'range': 'Object<string, number>|null'}, 'returns': ('Object<string, *>', 'Common canonical citation fields and source provenance.')},
    'webSource': {'params': {'item': 'Object<string, *>', 'lookup': 'Map<string, Object<string, *>>'}, 'returns': ('Object<string, *>', 'A canonical web-source descriptor with any normalized supporting-source evidence.')},
    'normalizeCitation': {'params': {'reference': 'Object<string, *>', 'context': 'Object<string, *>'}, 'returns': ('Object<string, *>|null', 'The canonical citation for a supported provider reference, or null for an unsupported reference shape.')},
    'eventCitations': {'params': {'record': 'Object<string, *>', 'blocks': 'Array<Object<string, *>>', 'retrievedFiles': 'Map<string, Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical citations associated with the source record in source-reference order.')},
    'conversationId': {'params': {'records': 'Array<Object<string, *>>'}, 'returns': ('string|null', 'The ChatGPT conversation identifier from the metadata record, or null when metadata is absent.')},
    'isConversationMetadata': {'params': {'record': 'Object<string, *>'}},
    'basename': {'params': {'path': 'string'}, 'returns': ('string|null', 'The last non-empty path component, or null when the path has no component.')},
    'sandboxPath': {'params': {'pointer': 'string'}, 'returns': ('string|null', 'The /mnt/data-style path represented by a supported sandbox pointer, or null for unsupported pointer forms.')},
    'sandboxDownloadUrl': {'returns': ('string|null', 'The authenticated ChatGPT generated-file download URL, or null when required identity is unavailable.')},
    'sandboxLinks': {'returns': ('Array<Object<string, *>>', 'Generated sandbox-link descriptors in source-text order, including label, pointer, and character range.')},
    'citationResources': {'params': {'citations': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical file resources derived from supported citation objects in citation order.')},
    'sandboxResources': {'params': {'blocks': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical generated-file resources derived from sandbox links in block/source order.')},
    'eventResources': {'params': {'record': 'Object<string, *>', 'blocks': 'Array<Object<string, *>>', 'citations': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical citation and generated-file resources for the source event.')},
    'adaptChatGPTRecords': {'params': {'records': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical events derived from ChatGPT source records while preserving source order and provenance.')},
  },
  'src/adapters/chatgpt.js': {
    'imagePointerSource': {'params': {'part': 'Object<string, *>'}, 'returns': ('string|null', 'The first usable image asset pointer exposed by the multimodal part, or null when none is present.')},
    'sedimentDownloadUrl': {'params': {'source': 'string'}, 'returns': ('string|null', 'The authenticated ChatGPT file-download URL for a sediment file pointer, or null for another pointer form.')},
    'imageResource': {'params': {'part': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'The canonical conversation-image resource corresponding to the source image-pointer part.')},
    'remapTextRange': {'params': {'range': 'Object<string, *>|null', 'textOrdinalToPartIndex': 'Map<number, number>'}, 'returns': ('Object<string, *>|null', 'The supplied text range with its text-only ordinal remapped to the original multimodal part index, or the original null/range when no remap applies.')},
    'remapCitation': {'params': {'citation': 'Object<string, *>', 'textOrdinalToPartIndex': 'Map<number, number>'}, 'returns': ('Object<string, *>', 'A copy of the canonical citation whose text range uses the original multimodal part index.')},
    'remapDisplayReplacement': {'params': {'replacement': 'Object<string, *>', 'textOrdinalToPartIndex': 'Map<number, number>'}, 'returns': ('Object<string, *>', 'A copy of the display replacement whose text range uses the original multimodal part index.')},
    'remapExistingResource': {'params': {'resource': 'Object<string, *>', 'textOrdinalToPartIndex': 'Map<number, number>'}, 'returns': ('Object<string, *>', 'A copy of the canonical resource with text/source part indexes remapped to original multimodal indexes when applicable.')},
    'normalizeMultimodalImages': {'params': {'event': 'Object<string, *>', 'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'The canonical event with source-order image blocks/resources inserted, or the original event when no image pointers are present.')},
    'sourceFor': {'params': {'event': 'Object<string, *>', 'extra': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'Canonical ChatGPT source provenance extended with any supplied block/reference fields.')},
    'locateTextRange': {'params': {'blocks': 'Array<Object<string, *>>'}, 'returns': ('Object<string, number>|null', 'The located text range within canonical blocks, or null when the literal text is absent.')},
    'normalizeDisplayReplacements': {'params': {'event': 'Object<string, *>', 'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'The canonical event with normalized alt-text display replacements appended, or the original event when none apply.')},
    'normalizedTetherAssets': {'params': {'assets': 'Object<string, *>|Array<Object<string, *>>|null'}, 'returns': ('Array<Object<string, *>>|null', 'Normalized tether asset descriptors in source order, or null when the source assets field is absent.')},
    'normalizeTetherBrowsingDisplay': {'params': {'event': 'Object<string, *>', 'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical tool-result event for tether browsing display content, or the original event when the source shape does not match.')},
    'normalizeReasoningRecap': {'params': {'event': 'Object<string, *>', 'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical reasoning-summary event for reasoning recap content, or the original event when the source shape does not match.')},
    'normalizeModelEditableContext': {'params': {'event': 'Object<string, *>', 'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical system-context event for model editable context content, or the original event when the source shape does not match.')},
    'normalizeNonPartsContent': {'params': {'event': 'Object<string, *>', 'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'The canonical event after applying supported non-parts ChatGPT content normalizers.')},
  },
  'src/adapters/claude.js': {
    'sourceRecordIdentity': {'params': {'record': 'Object<string, *>'}, 'returns': ('string', 'The stable source identity used to derive Claude canonical IDs.')},
    'baseSource': {'params': {'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'Canonical Claude source provenance for the record or content block.')},
    'textBlock': {'params': {'record': 'Object<string, *>', 'block': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical text block derived from the Claude source block.')},
    'reasoningBlock': {'params': {'record': 'Object<string, *>', 'block': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical reasoning-summary block derived from the Claude thinking block.')},
    'normalizedAskUserQuestion': {'params': {'input': 'Object<string, *>'}, 'returns': ('Object<string, *>|null', 'Normalized AskUserQuestion question data, or null when the provider input has no questions array.')},
    'toolCallEvent': {'params': {'record': 'Object<string, *>', 'block': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical Claude tool-call event preserving source identity and call correlation.')},
    'toolResultEvent': {'params': {'record': 'Object<string, *>', 'block': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical Claude tool-result event preserving source identity and call correlation.')},
    'messageEvent': {'params': {'record': 'Object<string, *>', 'block': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical Claude message event for the provider text block.')},
    'reasoningEvent': {'params': {'record': 'Object<string, *>', 'block': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical Claude reasoning-summary event for the provider thinking block.')},
    'noticeEvent': {'params': {'record': 'Object<string, *>', 'block': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical system notice event for the synthetic provider message.')},
    'textFromToolResult': {'params': {'content': 'string|Array<Object<string, *>>'}, 'returns': ('string', 'Displayable text extracted from a tool-result string or concatenated text blocks.')},
    'agentIdFromResult': {'returns': ('string|null', 'The internal Claude subagent identifier embedded in the tool result, or null when absent.')},
    'cleanAgentResult': {'returns': ('string', 'Subagent result text with the internal agent-ID control line removed.')},
    'subagentEvent': {'params': {'record': 'Object<string, *>', 'description': 'string|null', 'output': 'string', 'callId': 'string|null'}, 'returns': ('Object<string, *>', 'A canonical Claude subagent completion event with source/tool-call provenance.')},
    'xmlTag': {'returns': ('string|null', 'Trimmed contents of the named XML-like tag, or null when the tag is absent.')},
    'queueSubagentEvent': {'params': {'record': 'Object<string, *>'}, 'returns': ('Object<string, *>|null', 'A canonical subagent event for a completed queue-operation notification, or null when the source record is not such a completion.')},
    'adaptClaudeToolEvents': {'params': {'records': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical Claude tool-call/tool-result events in source record/block order.')},
    'adaptClaudeRecords': {'params': {'records': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical Claude events in provider source order, including correlated subagent/tool events.')},
  },
  'src/adapters/codex.js': {
    'sourceIdentity': {'params': {'record': 'Object<string, *>'}, 'returns': ('string', 'The stable source identity used to derive Codex canonical IDs.')},
    'source': {'params': {'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'Canonical Codex source provenance for the provider record.')},
    'isToolCall': {'params': {'payload': 'Object<string, *>'}},
    'isToolResult': {'params': {'payload': 'Object<string, *>'}},
    'normalizedQuestions': {'returns': ('Array<Object<string, *>>|null', 'Normalized request-user-input questions, or null when the argument JSON has no questions array.')},
    'normalizedAnswers': {'returns': ('Object<string, Array<string>>|null', 'Answers indexed by question ID, or null when the tool output has no answers object.')},
    'toolCallEvent': {'params': {'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical Codex tool-call event preserving source index and call correlation.')},
    'toolResultEvent': {'params': {'record': 'Object<string, *>'}, 'returns': ('Object<string, *>', 'A canonical Codex tool-result event preserving source index and call correlation.')},
    'messageEvent': {'params': {'record': 'Object<string, *>', 'channel': 'string|null', 'contentType': 'string'}, 'returns': ('Object<string, *>', 'A canonical Codex message, commentary, or reasoning-summary event for the supplied provider text.')},
    'adaptCodexToolEvents': {'params': {'records': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical Codex tool events in provider source order.')},
    'adaptCodexRecords': {'params': {'records': 'Array<Object<string, *>>'}, 'returns': ('Array<Object<string, *>>', 'Canonical Codex events in provider source order.')},
  },
  'src/projections/markdown.js': {
    'resourceById': {'params': {'event': 'Object<string, *>'}, 'returns': ('Object<string, *>|null', 'The canonical resource with the requested ID, or null when the event has no matching resource.')},
    'renderImageBlock': {'params': {'event': 'Object<string, *>', 'block': 'Object<string, *>'}},
    'sourceTooltip': {'params': {'source': 'Object<string, *>'}},
    'sourceLabel': {'params': {'source': 'Object<string, *>'}},
    'renderSourceAnchor': {'params': {'source': 'Object<string, *>'}},
    'renderWebCitation': {'params': {'citation': 'Object<string, *>'}},
    'renderMemoryCitation': {'params': {'citation': 'Object<string, *>'}},
    'retrievedLineLabel': {'params': {'citation': 'Object<string, *>'}},
    'renderCitation': {'params': {'citation': 'Object<string, *>'}},
    'textReplacements': {'params': {'event': 'Object<string, *>'}, 'returns': ('Array<Object<string, *>>', 'Text replacements for the requested part, sorted from highest to lowest character offset for safe in-place rewriting.')},
    'renderTextBlock': {'params': {'event': 'Object<string, *>', 'block': 'Object<string, *>'}},
    'renderMessageBlocks': {'params': {'event': 'Object<string, *>'}, 'returns': ('string', 'Visible canonical message/image blocks rendered as Markdown text in block order.')},
    'reasoningBody': {'params': {'event': 'Object<string, *>'}},
    'details': {'returns': ('string', 'The HTML details/summary Markdown fragment containing the supplied body.')},
    'inferredToolLanguage': {'params': {'block': 'Object<string, *>'}, 'returns': ('string', 'The Markdown fence language selected from canonical tool semantics, or an empty string when no language is justified.')},
    'relatedRetrievedFile': {'params': {'events': 'Array<Object<string, *>>'}, 'returns': ('Object<string, *>|null', 'Resolved retrieved-file citation metadata associated with the source record, or null when none is related.')},
    'renderMultimodalToolOutput': {'params': {'event': 'Object<string, *>', 'block': 'Object<string, *>', 'events': 'Array<Object<string, *>>'}},
    'renderChatGPTToolBlock': {'params': {'event': 'Object<string, *>', 'block': 'Object<string, *>', 'events': 'Array<Object<string, *>>'}},
    'renderChatGPTToolEvent': {'params': {'event': 'Object<string, *>', 'events': 'Array<Object<string, *>>'}},
    'renderUser': {'params': {'event': 'Object<string, *>'}},
    'renderChatGPTCommentarySegment': {'params': {'segment': 'Array<Object<string, *>>', 'events': 'Array<Object<string, *>>'}, 'returns': ('string|null', 'The ChatGPT Commentary Markdown section for the segment, or null when the segment produces no visible body.')},
    'renderChatGPTAssistantSegment': {'params': {'segment': 'Array<Object<string, *>>', 'events': 'Array<Object<string, *>>'}, 'returns': ('Array<string>', 'One or more ChatGPT Markdown sections produced from the Assistant segment.')},
    'toolCallId': {'params': {'event': 'Object<string, *>'}, 'returns': ('string|null', 'The canonical tool-call correlation ID, or null when the event carries no call ID.')},
    'toolResultByCallId': {'params': {'segment': 'Array<Object<string, *>>'}, 'returns': ('Map<string, Object<string, *>>', 'Tool-result events indexed by their non-null call IDs.')},
    'toolOutput': {'params': {'event': 'Object<string, *>'}, 'returns': ('string', 'Tool-result output flattened to displayable text.')},
    'renderClaudeToolThought': {'params': {'callEvent': 'Object<string, *>', 'resultEvent': 'Object<string, *>|null'}},
    'renderSubagentEvent': {'params': {'event': 'Object<string, *>'}},
    'renderClaudeQuestionBlock': {'params': {'block': 'Object<string, *>'}},
    'renderClaudePlanBlock': {'params': {'block': 'Object<string, *>'}},
    'renderClaudePlanApproval': {'params': {'block': 'Object<string, *>'}},
    'renderClaudeAssistantSegment': {'params': {'segment': 'Array<Object<string, *>>'}, 'returns': ('Array<string>', 'Claude/User/subagent Markdown sections produced from the Assistant segment.')},
    'codexRequestBlock': {'params': {'event': 'Object<string, *>'}, 'returns': ('Object<string, *>|undefined', 'The request_user_input tool-call block, or undefined when the event has no such block.')},
    'codexResponseBlock': {'params': {'event': 'Object<string, *>'}, 'returns': ('Object<string, *>|undefined', 'The request_user_input tool-result block, or undefined when the event has no such block.')},
    'renderCodexRequestSections': {'params': {'callEvent': 'Object<string, *>', 'resultEvent': 'Object<string, *>|null', 'state': 'Object<string, number>'}, 'returns': ('Array<string>', 'Codex question Markdown and, when answers exist, the corresponding User answer section.')},
    'renderCodexFileChanges': {'params': {'segment': 'Array<Object<string, *>>'}, 'returns': ('string|null', 'The collapsed Codex file-change details section, or null when the segment has no apply_patch changes.')},
    'renderCodexMainResponse': {'params': {'segment': 'Array<Object<string, *>>'}},
  },
}

FN_RX = re.compile(r'^(?P<indent>[ \t]*)(?:export\s+)?(?:async\s+)?function\*?\s+(?P<name>[A-Za-z_$][\w$]*)\s*\(', re.M)
CONST_FN_RX = re.compile(r'^(?P<indent>[ \t]*)(?:export\s+)?const\s+(?P<name>[A-Za-z_$][\w$]*)\s*=.*=>', re.M)


def doc_bounds(text, start):
  prefix = text[:start]
  stripped = prefix.rstrip()
  if not stripped.endswith('*/'):
    return None
  end = len(stripped)
  begin = stripped.rfind('/**')
  if begin < 0:
    return None
  return begin, end


def param_name_from_tag(tag):
  return tag.strip('[]').split('=')[0]


def repair_doc(doc, correction):
  params = correction.get('params', {})
  lines = doc.splitlines()
  for i, line in enumerate(lines):
    match = re.search(r'@param\s+\{[^}]+\}\s+([^\s]+)(\s+-\s+.*)$', line)
    if match:
      raw_name = match.group(1)
      name = param_name_from_tag(raw_name)
      if name in params:
        lines[i] = re.sub(r'(@param\s+)\{[^}]+\}', r'\1{' + params[name] + '}', line, count=1)
  if 'returns' in correction:
    return_type, description = correction['returns']
    for i, line in enumerate(lines):
      if '@returns' in line or '@return ' in line:
        indent = line[:line.index('*') + 1]
        lines[i] = f'{indent} @returns {{{return_type}}} {description}'
        break
  return '\n'.join(lines)


for file_name, functions in CORRECTIONS.items():
  path = Path(file_name)
  text = path.read_text(encoding='utf-8')
  matches = list(FN_RX.finditer(text)) + list(CONST_FN_RX.finditer(text))
  by_name = {m.group('name'): m for m in matches}
  for name, correction in functions.items():
    match = by_name.get(name)
    if not match:
      raise SystemExit(f'{file_name}: function not found: {name}')
    bounds = doc_bounds(text, match.start())
    if not bounds:
      raise SystemExit(f'{file_name}: immediate JSDoc not found: {name}')
    begin, end = bounds
    old_doc = text[begin:end]
    new_doc = repair_doc(old_doc, correction)
    text = text[:begin] + new_doc + text[end:]
    # Re-scan because replacement lengths can change offsets for later functions.
    matches = list(FN_RX.finditer(text)) + list(CONST_FN_RX.finditer(text))
    by_name = {m.group('name'): m for m in matches}
  path.write_text(text, encoding='utf-8')
  print(f'corrected {file_name}: {len(functions)} function contracts')
