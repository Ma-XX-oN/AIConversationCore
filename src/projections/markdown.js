function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function quoteMarkdown(text) {
  return String(text).split('\n').map(line => line ? `> ${line}` : '>').join('\n');
}

function providerLabel(provider) {
  if (provider === 'claude') return 'Claude';
  if (provider === 'codex') return 'Codex';
  return 'ChatGPT';
}

function resourceById(event, resourceId) {
  return event.resources?.find(resource => resource.id === resourceId) ?? null;
}

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

function faviconDomain(url) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

function sourceTooltip(source) {
  const title = source?.title ?? '';
  const snippet = source?.snippet ?? '';
  if (title && snippet) return `${title}\n\n${snippet}`;
  return title || snippet;
}

function sourceLabel(source, fallback = '') {
  return source?.attribution || source?.title || fallback;
}

function renderSourceAnchor(source, fallbackLabel = '', preferTitle = false) {
  const url = source?.url ?? '';
  const tooltip = sourceTooltip(source);
  const label = preferTitle ? (source?.title || source?.attribution || fallbackLabel)
    : sourceLabel(source, fallbackLabel);
  const favicon = `https://www.google.com/s2/favicons?domain=${faviconDomain(url)}&sz=32`;
  const escapedTooltip = htmlEscape(tooltip).replaceAll('\n', '&#10;');
  return `<a href="${htmlEscape(url)}" title="${escapedTooltip}" style="display:inline-block;white-space:nowrap;"><img alt="" src="${htmlEscape(favicon)}" width="15" height="15" title="${escapedTooltip}" style="width:0.97em;height:0.97em;vertical-align:-0.13em;margin-right:0.22em;border-radius:2px;">${htmlEscape(label)}</a>`;
}

function renderWebCitation(citation) {
  const rendered = [];
  for (const source of citation.web?.sources ?? []) {
    rendered.push(renderSourceAnchor(source));
    for (const supporting of source.supporting_sources ?? []) {
      rendered.push(renderSourceAnchor(supporting));
    }
  }
  return `**(cite: ${rendered.join(', ')})**`;
}

function renderMemoryCitation(citation) {
  const rendered = (citation.memory?.sources ?? [])
    .map(source => renderSourceAnchor(source, source?.title ?? 'memory', true));
  return `**(memory: ${rendered.join(', ')})**`;
}

function retrievedLineLabel(citation) {
  const matched = citation?.matched_text;
  if (typeof matched !== 'string') return '';
  const match = matched.match(/(L\d+(?:-L?\d+)?)$/);
  return match ? ` ${match[1].replace(/-(?=\d)/, '-L')}` : '';
}

function renderCitation(citation) {
  if (citation.citation_kind === 'file') {
    return `\`${citation.file?.name ?? 'file'}\``;
  }
  if (citation.citation_kind === 'retrieved_file') {
    const file = citation.retrieved_file ?? {};
    if (!file.resolved || !file.url) return file.title ?? citation.matched_text ?? '';
    return `<a href="${htmlEscape(file.url)}">${htmlEscape(file.title ?? 'file')}${retrievedLineLabel(citation)}</a>`;
  }
  if (citation.citation_kind === 'web') return renderWebCitation(citation);
  if (citation.citation_kind === 'memory') return renderMemoryCitation(citation);
  return citation.matched_text ?? '';
}

function textReplacements(event, partIndex) {
  const replacements = [];

  for (const replacement of event.display_replacements ?? []) {
    if (replacement?.text_range?.part_index !== partIndex) continue;
    replacements.push({
      start: replacement.text_range.start,
      end: replacement.text_range.end,
      text: replacement.display_text ?? ''
    });
  }

  for (const citation of event.citations ?? []) {
    if (citation?.text_range?.part_index !== partIndex) continue;
    replacements.push({
      start: citation.text_range.start,
      end: citation.text_range.end,
      text: renderCitation(citation)
    });
  }

  return replacements.sort((a, b) => b.start - a.start || b.end - a.end);
}

function renderTextBlock(event, block, partIndex) {
  let text = block.text ?? '';
  for (const replacement of textReplacements(event, partIndex)) {
    text = text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end);
  }
  return text;
}

function renderMessageBlocks(event) {
  return (event.blocks ?? []).map((block, blockIndex) => {
    if (block.type === 'text') {
      const partIndex = Number.isInteger(block?.source?.part_index)
        ? block.source.part_index
        : blockIndex;
      return renderTextBlock(event, block, partIndex);
    }
    if (block.type === 'image') return renderImageBlock(event, block);
    return '';
  }).filter(text => text !== '').join('\n\n');
}

function reasoningBody(event) {
  return (event.blocks ?? []).map(block => {
    if (block.type !== 'reasoning_summary') return '';
    const parts = [];
    if (block.summary) parts.push(`**${block.summary}**`);
    if (block.content) parts.push(block.content);
    return parts.join('\n\n');
  }).filter(Boolean).join('\n\n');
}

function details(summary, body) {
  return `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

function thoughtSummary(count) {
  return count === 1 ? 'Having a thought' : `Having ${count} thoughts`;
}

function inferredToolLanguage(block) {
  const language = typeof block.language === 'string' ? block.language.trim() : '';
  if (language && language !== 'unknown') return language;
  if (block.name === 'container.exec') return 'bash';
  return '';
}

function relatedRetrievedFile(events, sourceRecordId) {
  for (const event of events) {
    for (const citation of event.citations ?? []) {
      if (citation.citation_kind === 'retrieved_file' &&
          citation.retrieved_file?.source_record_id === sourceRecordId &&
          citation.retrieved_file?.resolved) return citation.retrieved_file;
    }
  }
  return null;
}

function renderMultimodalToolOutput(event, block, events) {
  const values = Array.isArray(block.output) ? block.output : [];
  const visible = values.filter(value =>
    typeof value === 'string' &&
    !value.startsWith('Make sure to include ')
  ).map(value => value.trim());

  const retrieved = relatedRetrievedFile(events, event.source_record_id);
  if (retrieved?.url) {
    for (let index = 0; index < visible.length; index += 1) {
      if (!visible[index].startsWith('Citation Marker:')) continue;
      visible[index] = `Citation Marker: <a href="${htmlEscape(retrieved.url)}">${htmlEscape(retrieved.title ?? 'file')}</a>`;
    }
  }
  return visible.join('\n\n');
}

function renderChatGPTToolBlock(event, block, events) {
  if (block.type === 'tool_call') {
    const language = inferredToolLanguage(block);
    const fence = `\`\`\`${language}`;
    return details(`${block.name ?? 'tool'} code`, `${fence}\n${block.input ?? ''}\n\`\`\``);
  }

  if (block.type === 'tool_result') {
    let output = block.output ?? '';
    if (block.output_format === 'multimodal_text') {
      output = renderMultimodalToolOutput(event, block, events);
    } else if (block.output_format === 'tether_browsing_display') {
      output = [block.output?.summary, block.output?.result].filter(Boolean).join('\n\n');
    }
    return details(`${block.name ?? 'tool'} output`, `\`\`\`\n${output}\n\`\`\``);
  }
  return '';
}

function renderChatGPTToolEvent(event, events) {
  return (event.blocks ?? []).map(block => renderChatGPTToolBlock(event, block, events))
    .filter(Boolean).join('\n\n');
}

function renderUser(event) {
  return `## User\n\n${quoteMarkdown(renderMessageBlocks(event))}`;
}

function renderChatGPTCommentarySegment(reasoningEvents, commentaryEvents) {
  const body = [];
  for (const event of reasoningEvents) {
    const text = reasoningBody(event);
    if (text) body.push(details('Thoughts', text));
  }
  for (const event of commentaryEvents) {
    const text = renderMessageBlocks(event);
    if (text) body.push(quoteMarkdown(text));
  }
  if (!body.length) return null;
  return `## ChatGPT Commentary\n\n${body.join('\n\n')}`;
}

function renderChatGPTAssistantSegment(segment, events) {
  const reasoning = segment.filter(event => event.kind === 'reasoning_summary');
  const commentary = segment.filter(event => event.kind === 'commentary');
  const tools = segment.filter(event => event.kind === 'tool_call' || event.kind === 'tool_result');
  const messages = segment.filter(event => event.kind === 'message' && event.role === 'assistant');
  const sections = [];

  if (commentary.length) {
    const commentarySection = renderChatGPTCommentarySegment(reasoning, commentary);
    if (commentarySection) sections.push(commentarySection);
  }

  const assistantBody = [];
  const thoughtItems = [];
  if (!commentary.length) {
    for (const event of reasoning) {
      const text = reasoningBody(event);
      if (text) thoughtItems.push(text);
    }
  }
  for (const event of tools) {
    const text = renderChatGPTToolEvent(event, events);
    if (text) thoughtItems.push(text);
  }
  if (thoughtItems.length) assistantBody.push(details('Thoughts', thoughtItems.join('\n\n')));
  for (const event of messages) {
    const text = renderMessageBlocks(event);
    if (text) assistantBody.push(quoteMarkdown(text));
  }

  if (assistantBody.length) sections.push(`## ChatGPT\n\n${assistantBody.join('\n\n')}`);
  return sections;
}

function toolCallId(event) {
  return event?.relationships?.tool_call_id ?? event?.blocks?.[0]?.call_id ?? null;
}

function toolResultByCallId(segment) {
  const results = new Map();
  for (const event of segment) {
    if (event.kind !== 'tool_result') continue;
    const callId = toolCallId(event);
    if (callId) results.set(callId, event);
  }
  return results;
}

function toolOutput(event) {
  const block = event?.blocks?.find(item => item.type === 'tool_result');
  if (!block) return '';
  if (typeof block.output === 'string') return block.output;
  if (Array.isArray(block.output)) {
    return block.output
      .filter(item => item?.type === 'text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('\n');
  }
  return String(block.output ?? '');
}

function renderClaudeToolThought(callEvent, resultEvent) {
  const block = callEvent?.blocks?.find(item => item.type === 'tool_call');
  if (!block) return '';

  if (block.name === 'Bash') {
    const command = typeof block.input?.command === 'string' ? block.input.command : '';
    const summary = typeof block.input?.description === 'string' && block.input.description
      ? block.input.description
      : 'Bash';
    const output = resultEvent ? toolOutput(resultEvent) : '';
    const body = [
      `\`\`\`bash\n${command}\n\`\`\``,
      `**OUT**\n\n\`\`\`\n${output}\n\`\`\``
    ].join('\n\n');
    return details(summary, body);
  }

  return '';
}

function renderSubagentEvent(event) {
  const block = event?.blocks?.find(item => item.type === 'subagent');
  if (!block?.agent_id) return '';
  const label = providerLabel(event.provider);
  const body = [];
  if (block.description) body.push(quoteMarkdown(`**${block.description}**`));
  if (block.output) body.push(quoteMarkdown(block.output));
  return `## ${label} Sub-agent ${block.agent_id}\n\n${body.join('\n\n')}`;
}

function renderClaudeAssistantSegment(segment) {
  const sections = [];
  const thoughtItems = [];
  const toolResults = toolResultByCallId(segment);

  for (const event of segment) {
    if (event.kind === 'reasoning_summary') {
      const text = reasoningBody(event);
      if (text) thoughtItems.push(text);
      continue;
    }
    if (event.kind !== 'tool_call') continue;
    const callId = toolCallId(event);
    const result = callId ? toolResults.get(callId) : null;
    const rendered = renderClaudeToolThought(event, result);
    if (rendered) thoughtItems.push(rendered);
  }

  const mainBody = [];
  if (thoughtItems.length) {
    const thoughtBody = thoughtItems.join('\n\n***\n\n');
    mainBody.push(quoteMarkdown(details(thoughtSummary(thoughtItems.length), thoughtBody)));
  }
  for (const event of segment) {
    if (event.kind !== 'message' || event.role !== 'assistant') continue;
    const text = renderMessageBlocks(event);
    if (text) mainBody.push(quoteMarkdown(text));
  }
  if (mainBody.length) sections.push(`## Claude\n\n${mainBody.join('\n\n')}`);

  for (const event of segment) {
    if (event.kind !== 'subagent') continue;
    const rendered = renderSubagentEvent(event);
    if (rendered) sections.push(rendered);
  }

  return sections;
}

function codexRequestBlock(event) {
  return event?.blocks?.find(block =>
    block.type === 'tool_call' && block.name === 'request_user_input');
}

function codexResponseBlock(event) {
  return event?.blocks?.find(block =>
    block.type === 'tool_result' && block.request_user_input_response);
}

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
    for (const option of question.options ?? []) {
      if (!option?.label) continue;
      const description = option.description ? ` - ${option.description}` : '';
      lines.push(`- ${option.label}${description}`);
    }
    questionParts.push(`### Question ${state.codexQuestionNumber}\n\n${quoteMarkdown(lines.join('\n'))}`);

    const selected = response?.request_user_input_response?.answers?.[question.id] ?? [];
    if (question.question && selected.length) {
      const renderedAnswers = selected.map(value => `"${value}"`).join(', ');
      answerLines.push(`**${question.question}** → ${renderedAnswers}`);
    }
  }

  const sections = [`## Codex\n\n${questionParts.join('\n\n')}`];
  if (answerLines.length) sections.push(`## User\n\n${quoteMarkdown(answerLines.join('\n'))}`);
  return sections;
}

function renderCodexFileChanges(segment) {
  const patches = [];
  for (const event of segment) {
    if (event.kind !== 'tool_call') continue;
    const block = event.blocks?.find(item =>
      item.type === 'tool_call' && item.name === 'apply_patch' && item.file_change?.patch);
    if (block) patches.push(block.file_change.patch);
  }
  if (!patches.length) return null;

  const fileCount = patches.reduce((count, patch) =>
    count + (patch.match(/^\*\*\* (?:Update|Add|Delete) File:/gm)?.length ?? 0), 0);
  const summary = `${fileCount || patches.length} file change${(fileCount || patches.length) === 1 ? '' : 's'}`;
  const body = patches.map(patch => quoteMarkdown(`\`\`\`diff\n${patch}\n\`\`\``)).join('\n\n');
  return details(summary, body);
}

function renderCodexMainResponse(segment) {
  const thoughtItems = [];
  const finalMessages = [];

  for (const event of segment) {
    if (event.kind === 'reasoning_summary') {
      const text = reasoningBody(event);
      if (text) thoughtItems.push(text);
      continue;
    }
    if (event.kind === 'commentary') {
      const text = renderMessageBlocks(event);
      if (text) thoughtItems.push(text);
      continue;
    }
    if (event.kind === 'message' && event.role === 'assistant') {
      const text = renderMessageBlocks(event);
      if (text) finalMessages.push(text);
    }
  }

  if (!thoughtItems.length && !finalMessages.length) return null;
  const body = [];
  if (thoughtItems.length) {
    body.push(quoteMarkdown(details(
      thoughtSummary(thoughtItems.length),
      thoughtItems.join('\n\n***\n\n')
    )));
  }
  for (const text of finalMessages) body.push(quoteMarkdown(text));
  return `## Codex\n\n${body.join('\n\n')}`;
}

function renderCodexAssistantSegment(segment, state) {
  const sections = [];
  const results = toolResultByCallId(segment);
  const requestEventIds = new Set();

  for (const event of segment) {
    const request = codexRequestBlock(event);
    if (!request) continue;
    const callId = toolCallId(event);
    const result = callId ? results.get(callId) : null;
    sections.push(...renderCodexRequestSections(event, result, state));
    requestEventIds.add(event.id);
    if (result) requestEventIds.add(result.id);
  }

  const mainSegment = segment.filter(event => !requestEventIds.has(event.id));
  const main = renderCodexMainResponse(mainSegment);
  if (main) sections.push(main);

  const fileChanges = renderCodexFileChanges(mainSegment);
  if (fileChanges) sections.push(fileChanges);
  return sections;
}

function renderAssistantSegment(segment, events, state) {
  const provider = segment.find(event => event?.provider)?.provider ?? 'chatgpt';
  if (provider === 'claude') return renderClaudeAssistantSegment(segment);
  if (provider === 'codex') return renderCodexAssistantSegment(segment, state);
  return renderChatGPTAssistantSegment(segment, events);
}

export function renderCanonicalMarkdown(events) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');

  const sections = [];
  const state = { codexQuestionNumber: 0 };
  let assistantSegment = [];

  const flushAssistant = () => {
    if (!assistantSegment.length) return;
    sections.push(...renderAssistantSegment(assistantSegment, events, state));
    assistantSegment = [];
  };

  for (const event of events) {
    if (event?.visibility === 'hidden' || event?.kind === 'system_context') continue;

    if (event?.role === 'user' && event?.kind === 'message') {
      flushAssistant();
      sections.push(renderUser(event));
      continue;
    }

    const isAssistantActivity = event?.role === 'assistant' ||
      event?.kind === 'tool_call' || event?.kind === 'tool_result' || event?.kind === 'subagent';
    if (!isAssistantActivity) continue;

    assistantSegment.push(event);
    if (event?.role === 'assistant' && event?.kind === 'message') flushAssistant();
  }

  flushAssistant();
  return sections.join('\n\n') + '\n\n';
}
