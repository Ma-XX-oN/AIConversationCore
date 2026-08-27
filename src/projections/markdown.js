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
    if (parsed.protocol === 'file:') return `${parsed.protocol}//${parsed.host}`;
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

function renderSourceAnchor(source, fallbackLabel = '') {
  const url = source?.url ?? '';
  const tooltip = sourceTooltip(source);
  const label = sourceLabel(source, fallbackLabel);
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
    .map(source => renderSourceAnchor(source, source?.title ?? 'memory'));
  return `**(memory: ${rendered.join(', ')})**`;
}

function retrievedLineLabel(citation) {
  const matched = citation?.matched_text;
  if (typeof matched !== 'string') return '';
  const match = matched.match(/(L\d+(?:-L?\d+)?)$/);
  return match ? ` ${match[1].replace('-L', '-')}` : '';
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

function renderToolBlock(event, block, events) {
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

function renderToolEvent(event, events) {
  return (event.blocks ?? []).map(block => renderToolBlock(event, block, events))
    .filter(Boolean).join('\n\n');
}

function renderUser(event) {
  return `## User\n\n${quoteMarkdown(renderMessageBlocks(event))}`;
}

function renderCommentarySegment(reasoningEvents, commentaryEvents) {
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

function renderAssistantSegment(segment, events) {
  const reasoning = segment.filter(event => event.kind === 'reasoning_summary');
  const commentary = segment.filter(event => event.kind === 'commentary');
  const tools = segment.filter(event => event.kind === 'tool_call' || event.kind === 'tool_result');
  const messages = segment.filter(event => event.kind === 'message' && event.role === 'assistant');
  const sections = [];

  if (commentary.length) {
    const commentarySection = renderCommentarySegment(reasoning, commentary);
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
    const text = renderToolEvent(event, events);
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

export function renderCanonicalMarkdown(events) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');

  const sections = [];
  let assistantSegment = [];

  const flushAssistant = () => {
    if (!assistantSegment.length) return;
    sections.push(...renderAssistantSegment(assistantSegment, events));
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
      event?.kind === 'tool_call' || event?.kind === 'tool_result';
    if (!isAssistantActivity) continue;

    assistantSegment.push(event);
    if (event?.role === 'assistant' && event?.kind === 'message') flushAssistant();
  }

  flushAssistant();
  return sections.join('\n\n') + '\n\n';
}
