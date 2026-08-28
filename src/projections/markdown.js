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
    for (const supporting of source.supporting_sources ?? []) rendered.push(renderSourceAnchor(supporting));
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
      const partIndex = Number.isInteger(block?.source?.part_index) ? block.source.part_index : blockIndex;
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

function fencedCode(content, language = '') {
  const text = String(content ?? '');
  const runs = text.match(/`+/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${text}\n${fence}`;
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
      if (citation.citation_kind === 'retrieved_file' && citation.retrieved_file?.source_record_id === sourceRecordId && citation.retrieved_file?.resolved) return citation.retrieved_file;
    }
  }
  return null;
}

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

function renderChatGPTToolBlock(event, block, events) {
  if (block.type === 'tool_call') {
    const language = inferredToolLanguage(block);
    return details(`${block.name ?? 'tool'} code`, `\`\`\`${language}\n${block.input ?? ''}\n\`\`\``);
  }
  if (block.type === 'tool_result') {
    let output = block.output ?? '';
    if (block.output_format === 'multimodal_text') output = renderMultimodalToolOutput(event, block, events);
    else if (block.output_format === 'tether_browsing_display') output = [block.output?.summary, block.output?.result].filter(Boolean).join('\n\n');
    return details(`${block.name ?? 'tool'} output`, `\`\`\`\n${output}\n\`\`\``);
  }
  return '';
}

function renderChatGPTToolEvent(event, events) {
  return (event.blocks ?? []).map(block => renderChatGPTToolBlock(event, block, events)).filter(Boolean).join('\n\n');
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
  return body.length ? `## ChatGPT Commentary\n\n${body.join('\n\n')}` : null;
}

function renderChatGPTAssistantSegment(segment, events) {
  const reasoning = segment.filter(event => event.kind === 'reasoning_summary');
  const commentary = segment.filter(event => event.kind === 'commentary');
  const tools = segment.filter(event => event.kind === 'tool_call' || event.kind === 'tool_result');
  const messages = segment.filter(event => event.kind === 'message' && event.role === 'assistant');
  const sections = [];
  if (commentary.length) {
    const section = renderChatGPTCommentarySegment(reasoning, commentary);
    if (section) sections.push(section);
  }
  const body = [];
  const thoughts = [];
  if (!commentary.length) for (const event of reasoning) { const text = reasoningBody(event); if (text) thoughts.push(text); }
  for (const event of tools) { const text = renderChatGPTToolEvent(event, events); if (text) thoughts.push(text); }
  if (thoughts.length) body.push(details('Thoughts', thoughts.join('\n\n')));
  for (const event of messages) { const text = renderMessageBlocks(event); if (text) body.push(quoteMarkdown(text)); }
  if (body.length) sections.push(`## ChatGPT\n\n${body.join('\n\n')}`);
  return sections;
}

function toolCallId(event) {
  return event?.relationships?.tool_call_id ?? event?.blocks?.[0]?.call_id ?? null;
}

function toolResultByCallId(segment) {
  const results = new Map();
  for (const event of segment) if (event.kind === 'tool_result' && toolCallId(event)) results.set(toolCallId(event), event);
  return results;
}

function toolOutput(event) {
  const block = event?.blocks?.find(item => item.type === 'tool_result');
  if (!block) return '';
  if (typeof block.output === 'string') return block.output;
  if (Array.isArray(block.output)) return block.output.filter(item => item?.type === 'text' && typeof item.text === 'string').map(item => item.text).join('\n');
  return String(block.output ?? '');
}

function renderClaudeToolThought(callEvent, resultEvent) {
  const block = callEvent?.blocks?.find(item => item.type === 'tool_call');
  if (!block || block.name !== 'Bash') return '';
  const command = typeof block.input?.command === 'string' ? block.input.command : '';
  const summary = typeof block.input?.description === 'string' && block.input.description ? block.input.description : 'Bash';
  const output = resultEvent ? toolOutput(resultEvent) : '';
  return details(summary, [fencedCode(command, 'bash'), `**OUT**\n\n${fencedCode(output)}`].join('\n\n'));
}

function renderSubagentEvent(event) {
  const block = event?.blocks?.find(item => item.type === 'subagent');
  if (!block?.agent_id) return '';
  const body = [];
  if (block.description) body.push(quoteMarkdown(`**${block.description}**`));
  if (block.output) body.push(quoteMarkdown(block.output));
  return `## ${providerLabel(event.provider)} Sub-agent ${block.agent_id}\n\n${body.join('\n\n')}`;
}

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

function renderClaudePlanBlock(block) {
  const plan = block?.exit_plan?.plan;
  if (typeof plan !== 'string' || !plan.trim()) return '';
  return quoteMarkdown(`### Plan\n\n${quoteMarkdown(plan.trim())}`);
}

function renderClaudePlanApproval(block) {
  const response = block?.exit_plan_response;
  if (!response) return '';
  const parts = [];
  if (response.intro) parts.push(quoteMarkdown(response.intro));
  if (response.approved_plan) parts.push(quoteMarkdown(details('Approved Plan', response.approved_plan)));
  return `## User\n\n${parts.join('\n\n')}`;
}

function renderClaudeAssistantSegment(segment) {
  const sections = [];
  const subagents = segment.filter(event => event.kind === 'subagent');
  const results = toolResultByCallId(segment);
  const consumedResults = new Set();
  let body = [];
  let thoughts = [];

  const flushThoughts = () => {
    if (!thoughts.length) return;
    body.push(quoteMarkdown(details(thoughtSummary(thoughts.length), thoughts.join('\n\n***\n\n'))));
    thoughts = [];
  };
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
    if (event.kind === 'message' && event.role === 'assistant') {
      flushThoughts();
      const text = renderMessageBlocks(event);
      if (text) body.push(quoteMarkdown(text));
      continue;
    }
    if (event.kind === 'tool_call') {
      const block = event.blocks?.find(item => item.type === 'tool_call');
      if (block?.name === 'Bash') {
        const id = toolCallId(event);
        const result = id ? results.get(id) : null;
        const text = renderClaudeToolThought(event, result);
        if (text) thoughts.push(text);
        if (result) consumedResults.add(result.source_record_id);
      } else if (block?.name === 'AskUserQuestion') {
        flushThoughts();
        flushClaude();
        const question = renderClaudeQuestionBlock(block);
        if (question) sections.push(question);
      } else if (block?.name === 'ExitPlanMode') {
        flushThoughts();
        flushClaude();
        const plan = renderClaudePlanBlock(block);
        if (plan) sections.push(plan);
      }
      continue;
    }
    if (event.kind === 'tool_result' && consumedResults.has(event.source_record_id)) continue;
    if (event.kind === 'tool_result') {
      const block = event.blocks?.find(item => item.type === 'tool_result');
      if (block?.output_format === 'exit_plan_response') {
        flushThoughts();
        flushClaude();
        const approval = renderClaudePlanApproval(block);
        if (approval) sections.push(approval);
      }
    }
  }

  flushClaude();
  for (const subagent of subagents) {
    const rendered = renderSubagentEvent(subagent);
    if (rendered) sections.push(rendered);
  }
  return sections;
}

function renderCodexAssistantSegment(segment) {
  const sections = [];
  const body = [];
  const thoughts = [];
  for (const event of segment) {
    if (event.kind === 'reasoning_summary') {
      const text = reasoningBody(event);
      if (text) thoughts.push(text);
      continue;
    }
    if (event.kind === 'message' && event.role === 'assistant') {
      const text = renderMessageBlocks(event);
      if (text) body.push(quoteMarkdown(text));
    }
  }
  if (thoughts.length) body.unshift(quoteMarkdown(details(thoughtSummary(thoughts.length), thoughts.join('\n\n***\n\n'))));
  if (body.length) sections.push(`## Codex\n\n${body.join('\n\n')}`);
  return sections;
}

function segmentAssistantEvents(events, startIndex) {
  const provider = events[startIndex]?.provider;
  const segment = [];
  let index = startIndex;
  while (index < events.length) {
    const event = events[index];
    if (event.provider !== provider) break;
    if (event.kind === 'message' && event.role === 'user') break;
    segment.push(event);
    index += 1;
  }
  return { segment, nextIndex: index };
}

export function renderCanonicalMarkdown(events) {
  const sections = [];
  for (let index = 0; index < events.length;) {
    const event = events[index];
    if (event.kind === 'message' && event.role === 'user') {
      sections.push(renderUser(event));
      index += 1;
      continue;
    }
    const { segment, nextIndex } = segmentAssistantEvents(events, index);
    if (!segment.length) {
      index += 1;
      continue;
    }
    if (event.provider === 'claude') sections.push(...renderClaudeAssistantSegment(segment));
    else if (event.provider === 'codex') sections.push(...renderCodexAssistantSegment(segment));
    else sections.push(...renderChatGPTAssistantSegment(segment, events));
    index = nextIndex;
  }
  return `${sections.filter(Boolean).join('\n\n')}\n`;
}
