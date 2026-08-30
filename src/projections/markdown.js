/**
 * Escapes text for safe insertion into generated HTML fragments.
  *
 * @param {string} value - The input value to process.
 * @returns {string} The HTML-escaped form of the supplied text.
 */
function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Quotes Markdown.
  *
 * @param {string} text - The text value to process.
 * @returns {string} The text representation produced by `quoteMarkdown`.
 */
function quoteMarkdown(text) {
  return String(text).split('\n').map(line => line ? `> ${line}` : '>').join('\n');
}

/**
 * Returns the human-readable transcript speaker label for a canonical provider.
  *
 * @param {string} provider - The provider value used by this operation.
 * @returns {string} The text representation produced by `providerLabel`.
 */
function providerLabel(provider) {
  if (provider === 'claude') return 'Claude';
  if (provider === 'codex') return 'Codex';
  return 'ChatGPT';
}

/**
 * Finds one canonical event resource by resource ID.
  *
 * @param {Object} event - The event value used by this operation.
 * @param {string} resourceId - The resource id.
 * @returns {void} No value is returned.
 */
function resourceById(event, resourceId) {
  return event.resources?.find(resource => resource.id === resourceId) ?? null;
}

/**
 * Renders image block.
  *
 * @param {Object} event - The event value used by this operation.
 * @param {Object} block - The block value used by this operation.
 * @returns {string} The text representation produced by `renderImageBlock`.
 */
function renderImageBlock(event, block) {
  const resource = resourceById(event, block.resource_id);
  if (!resource || resource.status === 'missing') return '[image missing]';
  if (resource.status === 'available') {
    const source = resource.data_url ?? resource.download_url ?? resource.source_pointer;
    return source ? `![image](${source})` : '[image available]';
  }
  if (resource.source_pointer) return `[image not available](${resource.source_pointer})`;
  return '[image not available]';
}

/**
 * Returns the origin used for a citation-source favicon lookup.
  *
 * @param {string} url - The URL value to process.
 * @returns {string} The text representation produced by `faviconDomain`.
 */
function faviconDomain(url) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

/**
 * Builds citation-source tooltip text from the source title and snippet.
  *
 * @param {Object} source - The source value used by this operation.
 * @returns {string} The text representation produced by `sourceTooltip`.
 */
function sourceTooltip(source) {
  const title = source?.title ?? '';
  const snippet = source?.snippet ?? '';
  if (title && snippet) return `${title}\n\n${snippet}`;
  return title || snippet;
}

/**
 * Returns the preferred visible label for a citation source.
  *
 * @param {Object} source - The source value used by this operation.
 * @param {string} fallback - The fallback value used by this operation.
 * @returns {string} The text representation produced by `sourceLabel`.
 */
function sourceLabel(source, fallback = '') {
  return source?.attribution || source?.title || fallback;
}

/**
 * Renders source anchor.
  *
 * @param {Object} source - The source value used by this operation.
 * @param {string} fallbackLabel - The fallback label value used by this operation.
 * @param {boolean} preferTitle - The prefer title value used by this operation.
 * @returns {string} The text representation produced by `renderSourceAnchor`.
 */
function renderSourceAnchor(source, fallbackLabel = '', preferTitle = false) {
  const url = source?.url ?? '';
  const tooltip = sourceTooltip(source);
  const label = preferTitle ? (source?.title || source?.attribution || fallbackLabel)
    : sourceLabel(source, fallbackLabel);
  const favicon = `https://www.google.com/s2/favicons?domain=${faviconDomain(url)}&sz=32`;
  const escapedTooltip = htmlEscape(tooltip).replaceAll('\n', '&#10;');
  return `<a href="${htmlEscape(url)}" title="${escapedTooltip}" style="display:inline-block;white-space:nowrap;"><img alt="" src="${htmlEscape(favicon)}" width="15" height="15" title="${escapedTooltip}" style="width:0.97em;height:0.97em;vertical-align:-0.13em;margin-right:0.22em;border-radius:2px;">${htmlEscape(label)}</a>`;
}

/**
 * Renders web citation.
  *
 * @param {Object} citation - The citation value used by this operation.
 * @returns {string} The text representation produced by `renderWebCitation`.
 */
function renderWebCitation(citation) {
  const rendered = [];
  for (const source of citation.web?.sources ?? []) {
    rendered.push(renderSourceAnchor(source));
    for (const supporting of source.supporting_sources ?? []) rendered.push(renderSourceAnchor(supporting));
  }
  return `**(cite: ${rendered.join(', ')})**`;
}

/**
 * Renders memory citation.
  *
 * @param {Object} citation - The citation value used by this operation.
 * @returns {string} The text representation produced by `renderMemoryCitation`.
 */
function renderMemoryCitation(citation) {
  const rendered = (citation.memory?.sources ?? [])
    .map(source => renderSourceAnchor(source, source?.title ?? 'memory', true));
  return `**(memory: ${rendered.join(', ')})**`;
}

/**
 * Extracts and normalizes a retrieved-file line-range label from citation marker text.
  *
 * @param {Object} citation - The citation value used by this operation.
 * @returns {string} The text representation produced by `retrievedLineLabel`.
 */
function retrievedLineLabel(citation) {
  const matched = citation?.matched_text;
  if (typeof matched !== 'string') return '';
  const match = matched.match(/(L\d+(?:-L?\d+)?)$/);
  return match ? ` ${match[1].replace(/-(?=\d)/, '-L')}` : '';
}

/**
 * Renders citation.
  *
 * @param {Object} citation - The citation value used by this operation.
 * @returns {string} The text representation produced by `renderCitation`.
 */
function renderCitation(citation) {
  if (citation.citation_kind === 'file') return `\`${citation.file?.name ?? 'file'}\``;
  if (citation.citation_kind === 'retrieved_file') {
    const file = citation.retrieved_file ?? {};
    if (!file.resolved || !file.url) return file.title ?? citation.matched_text ?? '';
    return `<a href="${htmlEscape(file.url)}">${htmlEscape(file.title ?? 'file')}${retrievedLineLabel(citation)}</a>`;
  }
  if (citation.citation_kind === 'web') return renderWebCitation(citation);
  if (citation.citation_kind === 'memory') return renderMemoryCitation(citation);
  return citation.matched_text ?? '';
}

/**
 * Collects display replacements, citations, and generated-file links that apply to one text part.
  *
 * @param {Object} event - The event value used by this operation.
 * @param {number} partIndex - The zero-based content-part index.
 * @returns {Array<Object>} The ordered values produced by `textReplacements`.
 */
function textReplacements(event, partIndex) {
  const replacements = [];
  for (const replacement of event.display_replacements ?? []) {
    if (replacement?.text_range?.part_index !== partIndex) continue;
    replacements.push({ start: replacement.text_range.start, end: replacement.text_range.end, text: replacement.display_text ?? '' });
  }
  for (const citation of event.citations ?? []) {
    if (citation?.text_range?.part_index !== partIndex) continue;
    replacements.push({ start: citation.text_range.start, end: citation.text_range.end, text: renderCitation(citation) });
  }
  for (const resource of event.resources ?? []) {
  if (resource?.type !== 'artifact' || resource?.resource_kind !== 'generated_file') continue;
  if (resource?.text_range?.part_index !== partIndex) continue;
  const destination = resource.download_url ?? resource.source_pointer;
  if (!destination) continue;
  const label = resource.label ?? resource.name ?? 'Download';
  replacements.push({
    start: resource.text_range.start,
    end: resource.text_range.end,
    text: `[${label}](${destination})`
  });
}
  return replacements.sort((a, b) => b.start - a.start || b.end - a.end);
}

/**
 * Renders text block.
  *
 * @param {Object} event - The event value used by this operation.
 * @param {Object} block - The block value used by this operation.
 * @param {number} partIndex - The zero-based content-part index.
 * @returns {string} The text representation produced by `renderTextBlock`.
 */
function renderTextBlock(event, block, partIndex) {
  let text = block.text ?? '';
  for (const replacement of textReplacements(event, partIndex)) {
    text = text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end);
  }
  return text;
}

/**
 * Renders message blocks.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {Array<Object>} The ordered values produced by `renderMessageBlocks`.
 */
function renderMessageBlocks(event) {
  return (event.blocks ?? []).map((block, blockIndex) => {
    if (block.type === 'text') {
      const partIndex = Number.isInteger(block?.source?.part_index) ? block.source.part_index : blockIndex;
      return renderTextBlock(event, block, partIndex);
    }
    if (block.type === 'image') return renderImageBlock(event, block);
    return '';
  }).filter(text => text !== '').join('\n\n');
}

/**
 * Builds the Markdown body for canonical reasoning-summary blocks in one event.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {string} The text representation produced by `reasoningBody`.
 */
function reasoningBody(event) {
  return (event.blocks ?? []).map(block => {
    if (block.type !== 'reasoning_summary') return '';
    const parts = [];
    if (block.summary) parts.push(`**${block.summary}**`);
    if (block.content) parts.push(block.content);
    return parts.join('\n\n');
  }).filter(Boolean).join('\n\n');
}

/**
 * Wraps a summary and body in the HTML `details` structure used by Markdown output.
  *
 * @param {string} summary - The summary value used by this operation.
 * @param {string} body - The body value used by this operation.
 * @returns {void} No value is returned.
 */
function details(summary, body) {
  return `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

/**
 * Returns the singular/plural human-readable summary for a count of thoughts.
  *
 * @param {number} count - The count value used by this operation.
 * @returns {string} The text representation produced by `thoughtSummary`.
 */
function thoughtSummary(count) {
  return count === 1 ? 'Having a thought' : `Having ${count} thoughts`;
}

/**
 * Wraps literal content in an adaptive Markdown code fence that cannot collide with backtick runs in the payload.
  *
 * @param {string} content - The content value used by this operation.
 * @param {string} language - The source or canonical language identifier.
 * @returns {string} The Markdown code-fence representation of the literal payload.
 */
function fencedCode(content, language = '') {
  const text = String(content ?? '');
  const runs = text.match(/`+/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${text}\n${fence}`;
}

/**
 * Selects the Markdown fence language from canonical tool-call semantics.
 *
 * A normalized non-`unknown` canonical language is emitted unchanged; the historical `container.exec` fallback emits `bash` only when no stronger normalized language is present.
  *
 * @param {Object} block - The block value used by this operation.
 * @returns {void} No value is returned.
 */
function inferredToolLanguage(block) {
  const language = typeof block.language === 'string' ? block.language.trim() : '';
  if (language && language !== 'unknown') return language;
  if (block.name === 'container.exec') return 'bash';
  return '';
}

/**
 * Handles related retrieved file.
  *
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @param {string} sourceRecordId - The stable provider/source record identifier.
 * @returns {void} No value is returned.
 */
function relatedRetrievedFile(events, sourceRecordId) {
  for (const event of events) {
    for (const citation of event.citations ?? []) {
      if (citation.citation_kind === 'retrieved_file' && citation.retrieved_file?.source_record_id === sourceRecordId && citation.retrieved_file?.resolved) return citation.retrieved_file;
    }
  }
  return null;
}

/**
 * Renders multimodal tool output.
  *
 * @param {Object} event - The event value used by this operation.
 * @param {Object} block - The block value used by this operation.
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @returns {string} The text representation produced by `renderMultimodalToolOutput`.
 */
function renderMultimodalToolOutput(event, block, events) {
  const values = Array.isArray(block.output) ? block.output : [];
  const visible = values.filter(value => typeof value === 'string' && !value.startsWith('Make sure to include ')).map(value => value.trim());
  const retrieved = relatedRetrievedFile(events, event.source_record_id);
  if (retrieved?.url) {
    for (let index = 0; index < visible.length; index += 1) {
      if (visible[index].startsWith('Citation Marker:')) visible[index] = `Citation Marker: <a href="${htmlEscape(retrieved.url)}">${htmlEscape(retrieved.title ?? 'file')}</a>`;
    }
  }
  return visible.join('\n\n');
}

/**
 * Renders a canonical ChatGPT tool block into the Markdown details/fence representation.
 *
 * The renderer consumes canonical `input`, `language`, `output`, and `output_format`; it does not reinterpret the provider source label once normalization has supplied those output-facing fields.
  *
 * @param {Object} event - The event value used by this operation.
 * @param {Object} block - The block value used by this operation.
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @returns {string} The text representation produced by `renderChatGPTToolBlock`.
 */
function renderChatGPTToolBlock(event, block, events) {
  if (block.type === 'tool_call') {
    const language = inferredToolLanguage(block);
    return details(`${block.name ?? 'tool'} code`, fencedCode(block.input ?? '', language));
  }
  if (block.type === 'tool_result') {
    let output = block.output ?? '';
    if (block.output_format === 'multimodal_text') output = renderMultimodalToolOutput(event, block, events);
    else if (block.output_format === 'tether_browsing_display') output = [block.output?.summary, block.output?.result].filter(Boolean).join('\n\n');
    return details(`${block.name ?? 'tool'} output`, fencedCode(output));
  }
  return '';
}

/**
 * Renders all canonical tool blocks belonging to one ChatGPT tool event.
  *
 * @param {Object} event - The event value used by this operation.
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @returns {string} The text representation produced by `renderChatGPTToolEvent`.
 */
function renderChatGPTToolEvent(event, events) {
  return (event.blocks ?? []).map(block => renderChatGPTToolBlock(event, block, events)).filter(Boolean).join('\n\n');
}

/**
 * Renders user.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {string} The text representation produced by `renderUser`.
 */
function renderUser(event) {
  return `## User\n\n${quoteMarkdown(renderMessageBlocks(event))}`;
}

/**
 * Renders one canonical ChatGPT commentary segment while keeping its reasoning and tool activity together.
  *
 * @param {Object} segment - The segment value used by this operation.
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @returns {string} The text representation produced by `renderChatGPTCommentarySegment`.
 */
function renderChatGPTCommentarySegment(segment, events) {
  const body = [];
  let thoughts = [];
  /**
   * Implements `flushThoughts`.
    *
 * @returns {void} No value is returned.
 */
  const flushThoughts = () => {
    if (!thoughts.length) return;
    body.push(details('Thoughts', thoughts.join('\n\n')));
    thoughts = [];
  };
  for (const event of segment) {
    if (event.kind === 'reasoning_summary') {
      const text = reasoningBody(event);
      if (text) thoughts.push(text);
      continue;
    }
    if (event.kind === 'tool_call' || event.kind === 'tool_result') {
      const text = renderChatGPTToolEvent(event, events);
      if (text) thoughts.push(text);
      continue;
    }
    if (event.kind === 'commentary') {
      flushThoughts();
      const text = renderMessageBlocks(event);
      if (text) body.push(quoteMarkdown(text));
    }
  }
  flushThoughts();
  return body.length ? `## ChatGPT Commentary\n\n${body.join('\n\n')}` : null;
}

/**
 * Renders one canonical ChatGPT Assistant segment into the required Markdown section or sections.
  *
 * @param {Object} segment - The segment value used by this operation.
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @returns {string} The text representation produced by `renderChatGPTAssistantSegment`.
 */
function renderChatGPTAssistantSegment(segment, events) {
  const reasoning = segment.filter(event => event.kind === 'reasoning_summary');
  const commentary = segment.filter(event => event.kind === 'commentary');
  const tools = segment.filter(event => event.kind === 'tool_call' || event.kind === 'tool_result');
  const messages = segment.filter(event => event.kind === 'message' && event.role === 'assistant');
  const sections = [];
  if (commentary.length) {
    const section = renderChatGPTCommentarySegment(segment, events);
    if (section) sections.push(section);
  }
  const body = [];
  const thoughts = [];
  if (!commentary.length) {
    for (const event of reasoning) { const text = reasoningBody(event); if (text) thoughts.push(text); }
    for (const event of tools) { const text = renderChatGPTToolEvent(event, events); if (text) thoughts.push(text); }
  }
  if (thoughts.length) body.push(details('Thoughts', thoughts.join('\n\n')));
  for (const event of messages) { const text = renderMessageBlocks(event); if (text) body.push(quoteMarkdown(text)); }
  if (body.length) sections.push(`## ChatGPT\n\n${body.join('\n\n')}`);
  return sections;
}

/**
 * Handles tool call ID.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {void} No value is returned.
 */
function toolCallId(event) {
  return event?.relationships?.tool_call_id ?? event?.blocks?.[0]?.call_id ?? null;
}

/**
 * Handles tool result by call ID.
  *
 * @param {Object} segment - The segment value used by this operation.
 * @returns {void} No value is returned.
 */
function toolResultByCallId(segment) {
  const results = new Map();
  for (const event of segment) if (event.kind === 'tool_result' && toolCallId(event)) results.set(toolCallId(event), event);
  return results;
}

/**
 * Handles tool output.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {void} No value is returned.
 */
function toolOutput(event) {
  const block = event?.blocks?.find(item => item.type === 'tool_result');
  if (!block) return '';
  if (typeof block.output === 'string') return block.output;
  if (Array.isArray(block.output)) return block.output.filter(item => item?.type === 'text' && typeof item.text === 'string').map(item => item.text).join('\n');
  return String(block.output ?? '');
}

/**
 * Renders Claude tool thought.
  *
 * @param {Object} callEvent - The call event value used by this operation.
 * @param {Object} resultEvent - The result event value used by this operation.
 * @returns {string} The text representation produced by `renderClaudeToolThought`.
 */
function renderClaudeToolThought(callEvent, resultEvent) {
  const block = callEvent?.blocks?.find(item => item.type === 'tool_call');
  if (!block || block.name !== 'Bash') return '';
  const command = typeof block.input?.command === 'string' ? block.input.command : '';
  const summary = typeof block.input?.description === 'string' && block.input.description ? block.input.description : 'Bash';
  const output = resultEvent ? toolOutput(resultEvent) : '';
  return details(summary, [fencedCode(command, 'bash'), `**OUT**\n\n${fencedCode(output)}`].join('\n\n'));
}

/**
 * Renders subagent event.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {string} The text representation produced by `renderSubagentEvent`.
 */
function renderSubagentEvent(event) {
  const block = event?.blocks?.find(item => item.type === 'subagent');
  if (!block?.agent_id) return '';
  const body = [];
  if (block.description) body.push(quoteMarkdown(`**${block.description}**`));
  if (block.output) body.push(quoteMarkdown(block.output));
  return `## ${providerLabel(event.provider)} Sub-agent ${block.agent_id}\n\n${body.join('\n\n')}`;
}

/**
 * Renders Claude question block.
  *
 * @param {Object} block - The block value used by this operation.
 * @returns {string} The text representation produced by `renderClaudeQuestionBlock`.
 */
function renderClaudeQuestionBlock(block) {
  const questions = block?.ask_user_question?.questions ?? [];
  const chunks = [];
  questions.forEach((question, index) => {
    const lines = [];
    if (question.question) lines.push(`**${question.question}**`);
    for (const option of question.options ?? []) {
      if (!option?.label) continue;
      lines.push(`- ${option.label}${option.description ? ` - ${option.description}` : ''}`);
    }
    chunks.push(`### Question ${index + 1}\n\n${quoteMarkdown(lines.join('\n'))}`);
  });
  return chunks.join('\n\n');
}

/**
 * Renders Claude plan block.
  *
 * @param {Object} block - The block value used by this operation.
 * @returns {string} The text representation produced by `renderClaudePlanBlock`.
 */
function renderClaudePlanBlock(block) {
  const plan = block?.exit_plan?.plan;
  if (typeof plan !== 'string' || !plan.trim()) return '';
  return quoteMarkdown(`### Plan\n\n${quoteMarkdown(plan.trim())}`);
}

/**
 * Renders Claude plan approval.
  *
 * @param {Object} block - The block value used by this operation.
 * @returns {string} The text representation produced by `renderClaudePlanApproval`.
 */
function renderClaudePlanApproval(block) {
  const response = block?.exit_plan_response;
  if (!response) return '';
  const parts = [];
  if (response.intro) parts.push(quoteMarkdown(response.intro));
  if (response.approved_plan) parts.push(quoteMarkdown(details('Approved Plan', response.approved_plan)));
  return `## User\n\n${parts.join('\n\n')}`;
}

/**
 * Renders Claude assistant segment.
  *
 * @param {Object} segment - The segment value used by this operation.
 * @returns {string} The text representation produced by `renderClaudeAssistantSegment`.
 */
function renderClaudeAssistantSegment(segment) {
  const sections = [];
  const subagents = segment.filter(event => event.kind === 'subagent');
  const results = toolResultByCallId(segment);
  const consumedResults = new Set();
  let body = [];
  let thoughts = [];

  /**
   * Implements `flushThoughts`.
    *
 * @returns {void} No value is returned.
 */
  const flushThoughts = () => {
    if (!thoughts.length) return;
    body.push(quoteMarkdown(details(thoughtSummary(thoughts.length), thoughts.join('\n\n***\n\n'))));
    thoughts = [];
  };
  /**
   * Implements `flushClaude`.
    *
 * @returns {void} No value is returned.
 */
  const flushClaude = () => {
    flushThoughts();
    if (!body.length) return;
    sections.push(`## Claude\n\n${body.join('\n\n')}`);
    body = [];
  };

  for (const event of segment) {
    if (event.kind === 'subagent') continue;
    if (event.kind === 'reasoning_summary') {
      const text = reasoningBody(event);
      if (text) thoughts.push(text);
      continue;
    }
    if (event.kind === 'tool_call') {
      const block = event.blocks?.find(item => item.type === 'tool_call');
      const result = toolCallId(event) ? results.get(toolCallId(event)) : null;
      if (block?.name === 'Bash') {
        const rendered = renderClaudeToolThought(event, result);
        if (rendered) thoughts.push(rendered);
        if (result) consumedResults.add(result.id);
      } else if (block?.name === 'AskUserQuestion') {
        flushThoughts();
        const rendered = renderClaudeQuestionBlock(block);
        if (rendered) body.push(rendered);
      } else if (block?.name === 'ExitPlanMode') {
        flushThoughts();
        const rendered = renderClaudePlanBlock(block);
        if (rendered) body.push(rendered);
      }
      continue;
    }
    if (event.kind === 'tool_result') {
      if (consumedResults.has(event.id)) continue;
      const block = event.blocks?.find(item => item.type === 'tool_result');
      if (block?.name === 'AskUserQuestion') {
        flushClaude();
        const text = block.ask_user_question_response?.text ?? toolOutput(event);
        if (text) sections.push(`## User\n\n${quoteMarkdown(text)}`);
      } else if (block?.name === 'ExitPlanMode') {
        flushClaude();
        const rendered = renderClaudePlanApproval(block);
        if (rendered) sections.push(rendered);
      }
      continue;
    }
    if (event.kind === 'message' && event.role === 'assistant') {
      flushThoughts();
      const text = renderMessageBlocks(event);
      if (text) body.push(quoteMarkdown(text));
    }
  }
  flushClaude();
  for (const event of subagents) {
    const rendered = renderSubagentEvent(event);
    if (rendered) sections.push(rendered);
  }
  return sections;
}

/**
 * Handles codex request block.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {void} No value is returned.
 */
function codexRequestBlock(event) {
  return event?.blocks?.find(block => block.type === 'tool_call' && block.name === 'request_user_input');
}

/**
 * Handles codex response block.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {void} No value is returned.
 */
function codexResponseBlock(event) {
  return event?.blocks?.find(block => block.type === 'tool_result' && block.request_user_input_response);
}

/**
 * Renders Codex request sections.
  *
 * @param {Object} callEvent - The call event value used by this operation.
 * @param {Object} resultEvent - The result event value used by this operation.
 * @param {Object} state - The state value used by this operation.
 * @returns {string} The text representation produced by `renderCodexRequestSections`.
 */
function renderCodexRequestSections(callEvent, resultEvent, state) {
  const call = codexRequestBlock(callEvent);
  if (!call) return [];
  const response = codexResponseBlock(resultEvent);
  const questions = call.request_user_input?.questions ?? [];
  if (!questions.length) return [];
  const questionParts = [];
  const answerLines = [];
  for (const question of questions) {
    state.codexQuestionNumber += 1;
    const lines = [];
    if (question.question) lines.push(`**${question.question}**`);
    for (const option of question.options ?? []) if (option?.label) lines.push(`- ${option.label}${option.description ? ` - ${option.description}` : ''}`);
    questionParts.push(`### Question ${state.codexQuestionNumber}\n\n${quoteMarkdown(lines.join('\n'))}`);
    const selected = response?.request_user_input_response?.answers?.[question.id] ?? [];
    if (question.question && selected.length) answerLines.push(`**${question.question}** → ${selected.map(value => `"${value}"`).join(', ')}`);
  }
  const sections = [`## Codex\n\n${questionParts.join('\n\n')}`];
  if (answerLines.length) sections.push(`## User\n\n${quoteMarkdown(answerLines.join('\n'))}`);
  return sections;
}

/**
 * Renders Codex file changes.
  *
 * @param {Object} segment - The segment value used by this operation.
 * @returns {string} The text representation produced by `renderCodexFileChanges`.
 */
function renderCodexFileChanges(segment) {
  const patches = [];
  for (const event of segment) {
    if (event.kind !== 'tool_call') continue;
    const block = event.blocks?.find(item => item.type === 'tool_call' && item.name === 'apply_patch' && item.file_change?.patch);
    if (block) patches.push(block.file_change.patch);
  }
  if (!patches.length) return null;
  const fileCount = patches.reduce((count, patch) => count + (patch.match(/^\*\*\* (?:Update|Add|Delete) File:/gm)?.length ?? 0), 0);
  const n = fileCount || patches.length;
  return details(`${n} file change${n === 1 ? '' : 's'}`, patches.map(patch => quoteMarkdown(`\`\`\`diff\n${patch}\n\`\`\``)).join('\n\n'));
}

/**
 * Renders Codex main response.
  *
 * @param {Object} segment - The segment value used by this operation.
 * @returns {string} The text representation produced by `renderCodexMainResponse`.
 */
function renderCodexMainResponse(segment) {
  const thoughts = [];
  const finals = [];
  for (const event of segment) {
    if (event.kind === 'reasoning_summary') { const text = reasoningBody(event); if (text) thoughts.push(text); }
    else if (event.kind === 'commentary') { const text = renderMessageBlocks(event); if (text) thoughts.push(text); }
    else if (event.kind === 'message' && event.role === 'assistant') { const text = renderMessageBlocks(event); if (text) finals.push(text); }
  }
  if (!thoughts.length && !finals.length) return null;
  const body = [];
  if (thoughts.length) body.push(quoteMarkdown(details(thoughtSummary(thoughts.length), thoughts.join('\n\n***\n\n'))));
  for (const text of finals) body.push(quoteMarkdown(text));
  return `## Codex\n\n${body.join('\n\n')}`;
}

/**
 * Renders Codex assistant segment.
  *
 * @param {Object} segment - The segment value used by this operation.
 * @param {Object} state - The state value used by this operation.
 * @returns {string} The text representation produced by `renderCodexAssistantSegment`.
 */
function renderCodexAssistantSegment(segment, state) {
  const sections = [];
  const results = toolResultByCallId(segment);
  const requestIds = new Set();
  for (const event of segment) {
    if (!codexRequestBlock(event)) continue;
    const result = toolCallId(event) ? results.get(toolCallId(event)) : null;
    sections.push(...renderCodexRequestSections(event, result, state));
    requestIds.add(event.id);
    if (result) requestIds.add(result.id);
  }
  const mainSegment = segment.filter(event => !requestIds.has(event.id));
  const main = renderCodexMainResponse(mainSegment);
  if (main) sections.push(main);
  const changes = renderCodexFileChanges(mainSegment);
  if (changes) sections.push(changes);
  return sections;
}

/**
 * Renders assistant segment.
  *
 * @param {Object} segment - The segment value used by this operation.
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @param {Object} state - The state value used by this operation.
 * @returns {string} The text representation produced by `renderAssistantSegment`.
 */
function renderAssistantSegment(segment, events, state) {
  const provider = segment.find(event => event?.provider)?.provider ?? 'chatgpt';
  if (provider === 'claude') return renderClaudeAssistantSegment(segment);
  if (provider === 'codex') return renderCodexAssistantSegment(segment, state);
  return renderChatGPTAssistantSegment(segment, events);
}

/**
 * Renders notice.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {string} The text representation produced by `renderNotice`.
 */
function renderNotice(event) {
  const text = renderMessageBlocks(event);
  return text ? `> *(system: ${text})*` : '';
}

/**
 * Renders canonical Markdown.
  *
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @returns {string} The complete canonical Markdown transcript projection.
 */
export function renderCanonicalMarkdown(events) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');
  const sections = [];
  const state = { codexQuestionNumber: 0 };
  let assistantSegment = [];
  /**
   * Implements `flushAssistant`.
    *
 * @returns {void} No value is returned.
 */
  const flushAssistant = () => {
    if (!assistantSegment.length) return;
    sections.push(...renderAssistantSegment(assistantSegment, events, state));
    assistantSegment = [];
  };

  for (const event of events) {
    if (event?.visibility === 'hidden' || event?.kind === 'system_context') continue;
    if (event?.kind === 'notice') {
      flushAssistant();
      const rendered = renderNotice(event);
      if (rendered) sections.push(rendered);
      continue;
    }
    if (event?.role === 'user' && event?.kind === 'message') {
      flushAssistant();
      sections.push(renderUser(event));
      continue;
    }
    const isAssistantActivity = event?.role === 'assistant' || event?.kind === 'tool_call' || event?.kind === 'tool_result' || event?.kind === 'subagent';
    if (!isAssistantActivity) continue;
    assistantSegment.push(event);
    if (event?.role === 'assistant' && event?.kind === 'message' && event?.provider !== 'claude') flushAssistant();
  }
  flushAssistant();
  return sections.join('\n\n') + '\n\n';
}
