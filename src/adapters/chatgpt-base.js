/**
 * Implements `textParts`.
 */
function textParts(record) {
  const parts = record?.content?.parts;
  if (!Array.isArray(parts)) return [];
  return parts.filter(part => typeof part === 'string');
}

/**
 * Implements `reasoningBlocks`.
 */
function reasoningBlocks(record, sourceRecordId, sourceIndex) {
  const thoughts = record?.content?.thoughts;
  if (!Array.isArray(thoughts)) return [];

  return thoughts.map((thought, thoughtIndex) => ({
    id: `${sourceRecordId}:thought:${thoughtIndex}`,
    type: 'reasoning_summary',
    summary: thought?.summary ?? null,
    content: thought?.content ?? null,
    chunks: Array.isArray(thought?.chunks) ? [...thought.chunks] : null,
    finished: thought?.finished ?? null,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex,
      thought_index: thoughtIndex
    }
  }));
}

/**
 * Parses a JSON string when valid, otherwise returns no parsed value.
 */
function parsedJson(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Implements `launcherToken`.
 */
function launcherToken(value) {
  if (typeof value !== 'string') return null;
  const match = value.trimStart().match(/^([A-Za-z0-9_./+-]+)/);
  return match?.[1]?.split('/').at(-1)?.toLowerCase() ?? null;
}

/**
 * Normalizes ChatGPT tool-call presentation without discarding the persisted source form.
 *
 * Source -> canonical transformations:
 * - `api_tool.*` + provider `language: python3` + JSON object text -> unchanged JSON input, `input_format: json`, `language: json`.
 * - `container.exec` + provider `language: unknown` + `bash`/`sh` launcher -> original command text with `bash`/`sh` language.
 * - `container.exec` + provider `language: unknown` + flattened Python `-c` command -> preserve the full persisted command in `source_input`, render only the Python program in `input`, and set `language: python`.
 * The source language is always retained separately as `source_language`.
 */
function normalizedToolCallPresentation(record) {
  const name = record?.recipient ?? null;
  const sourceInput = record?.content?.text ?? null;
  const sourceLanguage = record?.content?.language ?? null;
  let input = sourceInput;
  let inputFormat = 'code';
  let language = sourceLanguage;

  // ChatGPT currently labels api_tool call arguments as python3 even when the
  // payload is a serialized JSON object.  The recipient plus successful JSON
  // parse is stronger semantic evidence than that provider presentation label.
  if (typeof name === 'string' && name.startsWith('api_tool.') && parsedJson(sourceInput) !== null) {
    inputFormat = 'json';
    language = 'json';
  } else if (name === 'container.exec' && typeof sourceInput === 'string') {
    const launcher = launcherToken(sourceInput);
    if (launcher === 'bash') language = 'bash';
    else if (launcher === 'sh') language = 'sh';
    else if (['python', 'python3', 'py'].includes(launcher)) {
      const command = sourceInput.trimStart();
      const pythonCommand = command.match(/^[A-Za-z0-9_./+-]+\s+-c(?:\s+|$)/);
      if (pythonCommand) {
        // The persisted ChatGPT record has already flattened the argv boundary
        // around Python's -c program.  Do not invent shell quoting.  Preserve
        // the source string separately and render the program itself as Python.
        input = command.slice(pythonCommand[0].length);
        language = 'python';
      }
    }
  }

  return { input, inputFormat, language, sourceInput, sourceLanguage };
}

/**
 * Projects a persisted ChatGPT assistant tool-call record into one canonical `tool_call` block.
 *
 * The block carries both the normalized input/language used for output and the original persisted input/language for provenance.
 */
function toolCallBlocks(record, sourceRecordId, sourceIndex) {
  const presentation = normalizedToolCallPresentation(record);
  return [{
    id: `${sourceRecordId}:tool_call:0`,
    type: 'tool_call',
    call_id: null,
    name: record?.recipient ?? null,
    input: presentation.input,
    input_format: presentation.inputFormat,
    language: presentation.language,
    source_input: presentation.sourceInput,
    source_language: presentation.sourceLanguage,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex
    }
  }];
}

/**
 * Projects a persisted ChatGPT tool-role record into one canonical `tool_result` block.
 *
 * Source -> canonical transformations:
 * - `execution_output`/`code` -> text output from the source text/content field.
 * - `text` -> string parts joined in source order with blank lines.
 * - `multimodal_text` -> source parts preserved as an ordered array.
 * The original ChatGPT content type is retained as `output_format`.
 */
function toolResultBlocks(record, sourceRecordId, sourceIndex) {
  const contentType = record?.content?.content_type ?? null;
  let output = null;
  if (contentType === 'execution_output' || contentType === 'code') {
    output = record?.content?.text ?? record?.content?.content ?? null;
  }
  if (contentType === 'text') {
    output = Array.isArray(record?.content?.parts)
      ? record.content.parts.filter(part => typeof part === 'string').join('\n\n')
      : record?.content?.text ?? null;
  }
  if (contentType === 'multimodal_text') output = Array.isArray(record?.content?.parts)
    ? [...record.content.parts]
    : null;

  return [{
    id: `${sourceRecordId}:tool_result:0`,
    type: 'tool_result',
    call_id: null,
    name: record?.author?.name ?? null,
    output,
    output_format: contentType,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex
    }
  }];
}

/**
 * Implements `eventVisibility`.
 */
function eventVisibility(record) {
  return record?.metadata?.is_visually_hidden_from_conversation ? 'hidden' : 'visible';
}

/**
 * Checks whether tool call.
 */
function isToolCall(record) {
  return record?.author?.role === 'assistant' &&
    record?.content?.content_type === 'code' &&
    typeof record?.recipient === 'string' &&
    record.recipient !== 'all';
}

/**
 * Checks whether tool result.
 */
function isToolResult(record) {
  if (record?.author?.role !== 'tool') return false;
  return ['execution_output', 'multimodal_text', 'text', 'code']
    .includes(record?.content?.content_type);
}

/**
 * Implements `eventKind`.
 */
function eventKind(record) {
  if (isToolCall(record)) return 'tool_call';
  if (isToolResult(record)) return 'tool_result';
  if (record?.author?.role === 'assistant' && record?.content?.content_type === 'thoughts') {
    return 'reasoning_summary';
  }
  if (record?.author?.role === 'assistant' && record?.channel === 'commentary') return 'commentary';
  return 'message';
}

/**
 * Implements `eventBlocks`.
 */
function eventBlocks(record, sourceRecordId, sourceIndex, kind) {
  if (kind === 'reasoning_summary') return reasoningBlocks(record, sourceRecordId, sourceIndex);
  if (kind === 'tool_call') return toolCallBlocks(record, sourceRecordId, sourceIndex);
  if (kind === 'tool_result') return toolResultBlocks(record, sourceRecordId, sourceIndex);

  return textParts(record).map((text, partIndex) => ({
    id: `${sourceRecordId}:part:${partIndex}`,
    type: 'text',
    text,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex,
      part_index: partIndex
    }
  }));
}

/**
 * Normalizes a URL for stable citation/search-result lookup.
 */
function normalizedUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    url.searchParams.delete('utm_source');
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * Implements `searchResultLookup`.
 */
function searchResultLookup(record) {
  const lookup = new Map();
  const groups = record?.metadata?.search_result_groups;
  if (!Array.isArray(groups)) return lookup;

  for (const group of groups) {
    if (!Array.isArray(group?.entries)) continue;
    for (const entry of group.entries) {
      const key = normalizedUrl(entry?.url);
      if (key) lookup.set(key, entry);
    }
  }
  return lookup;
}

/**
 * Implements `retrievedFileLookup`.
 */
function retrievedFileLookup(records) {
  const lookup = new Map();
  records.forEach((record, recordIndex) => {
    const turn = record?.metadata?.retrieval_turn_number;
    const file = record?.metadata?.retrieval_file_index;
    const citation = record?.metadata?.citation_metadata;
    if (!Number.isInteger(turn) || !Number.isInteger(file) || !citation) return;
    lookup.set(`turn${turn}file${file}`, {
      title: citation?.title ?? null,
      url: citation?.url ?? null,
      source_record_id: record?.id ?? null,
      source_index: recordIndex
    });
  });
  return lookup;
}

/**
 * Implements `fileMarkerKey`.
 */
function fileMarkerKey(matchedText) {
  if (typeof matchedText !== 'string') return null;
  const match = matchedText.match(/turn(\d+)file(\d+)/);
  return match ? `turn${match[1]}file${match[2]}` : null;
}

/**
 * Locates reference.
 */
function locateReference(blocks, matchedText, startPartIndex = 0, startOffset = 0) {
  if (typeof matchedText !== 'string' || !matchedText) return null;
  for (let partIndex = startPartIndex; partIndex < blocks.length; partIndex += 1) {
    const block = blocks[partIndex];
    if (block?.type !== 'text' || typeof block.text !== 'string') continue;
    const from = partIndex === startPartIndex ? startOffset : 0;
    const index = block.text.indexOf(matchedText, from);
    if (index >= 0) {
      return {
        part_index: partIndex,
        start: index,
        end: index + matchedText.length
      };
    }
  }
  return null;
}

/**
 * Implements `citationBase`.
 */
function citationBase(sourceRecordId, sourceIndex, referenceIndex, reference, range, kind) {
  return {
    id: `${sourceRecordId}:citation:${referenceIndex}`,
    type: 'citation',
    citation_kind: kind,
    matched_text: reference?.matched_text ?? null,
    text_range: range,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex,
      reference_index: referenceIndex
    }
  };
}

/**
 * Implements `webSource`.
 */
function webSource(item, lookup) {
  const source = {
    url: item?.url ?? null,
    title: item?.title ?? null,
    attribution: item?.attribution ?? null,
    snippet: item?.snippet ?? null,
    supporting_sources: []
  };

  if (Array.isArray(item?.supporting_websites)) {
    source.supporting_sources = item.supporting_websites.map(site => {
      const evidence = lookup.get(normalizedUrl(site?.url));
      return {
        url: site?.url ?? null,
        title: evidence?.title ?? null,
        attribution: evidence?.attribution ?? null,
        snippet: evidence?.snippet ?? null
      };
    });
  }

  return source;
}

/**
 * Normalizes citation.
 */
function normalizeCitation(reference, context) {
  const {
    sourceRecordId,
    sourceIndex,
    referenceIndex,
    range,
    record,
    retrievedFiles
  } = context;

  if (reference?.type === 'file') {
    return {
      ...citationBase(sourceRecordId, sourceIndex, referenceIndex, reference, range, 'file'),
      file: {
        id: reference?.id ?? null,
        name: reference?.name ?? null,
        source: reference?.source ?? null,
        snippet: reference?.snippet ?? null
      }
    };
  }

  if (reference?.type === 'grouped_webpages') {
    const lookup = searchResultLookup(record);
    return {
      ...citationBase(sourceRecordId, sourceIndex, referenceIndex, reference, range, 'web'),
      web: {
        sources: Array.isArray(reference?.items)
          ? reference.items.map(item => webSource(item, lookup))
          : [],
        safe_urls: Array.isArray(reference?.safe_urls) ? [...reference.safe_urls] : []
      }
    };
  }

  if (reference?.type === 'hidden' && reference?.invalid === false &&
      reference?.matched_text === 'memcite') {
    const metadata = record?.metadata?.conversation_context_citation_metadata;
    return {
      ...citationBase(sourceRecordId, sourceIndex, referenceIndex, reference, range, 'memory'),
      memory: {
        sources: Array.isArray(metadata) ? metadata.map(entry => ({
          citation_uuid: entry?.citation_uuid ?? null,
          deleted: entry?.deleted ?? null,
          retrieval_origin: entry?.retrieval_origin ?? null,
          title: entry?.citation?.title ?? null,
          url: entry?.citation?.url ?? null,
          snippet: entry?.citation?.snippet ?? null,
          attribution: entry?.citation?.attribution ?? null,
          category: entry?.citation?.category ?? null
        })) : []
      }
    };
  }

  if (reference?.type === 'hidden' && reference?.invalid === true) {
    const key = fileMarkerKey(reference?.matched_text);
    const resolved = key ? retrievedFiles.get(key) : null;
    return {
      ...citationBase(sourceRecordId, sourceIndex, referenceIndex, reference, range, 'retrieved_file'),
      retrieved_file: {
        resolved: Boolean(resolved),
        title: resolved?.title ?? null,
        url: resolved?.url ?? null,
        source_record_id: resolved?.source_record_id ?? null,
        source_index: resolved?.source_index ?? null
      }
    };
  }

  return null;
}

/**
 * Implements `eventCitations`.
 */
function eventCitations(record, sourceRecordId, sourceIndex, blocks, retrievedFiles) {
  const references = record?.metadata?.content_references;
  if (!Array.isArray(references)) return [];

  const citations = [];
  let partIndex = 0;
  let offset = 0;

  references.forEach((reference, referenceIndex) => {
    const range = locateReference(blocks, reference?.matched_text, partIndex, offset);
    if (range) {
      partIndex = range.part_index;
      offset = range.end;
    }

    const citation = normalizeCitation(reference, {
      sourceRecordId,
      sourceIndex,
      referenceIndex,
      range,
      record,
      retrievedFiles
    });
    if (citation) citations.push(citation);
  });

  return citations;
}

/**
 * Implements `conversationId`.
 */
function conversationId(records) {
  const metadata = records.find(record =>
    record?.record_type === 'chatgpt_conversation_metadata' &&
    typeof record?.conversation_id === 'string'
  );
  return metadata?.conversation_id ?? null;
}

/**
 * Checks whether conversation metadata.
 */
function isConversationMetadata(record) {
  return record?.record_type === 'chatgpt_conversation_metadata';
}

/**
 * Implements `basename`.
 */
function basename(path) {
  if (typeof path !== 'string') return null;
  const pieces = path.split('/').filter(Boolean);
  return pieces.length ? pieces[pieces.length - 1] : null;
}

/**
 * Implements `sandboxPath`.
 */
function sandboxPath(pointer) {
  if (typeof pointer !== 'string') return null;
  const value = pointer.trim();
  if (!value.startsWith('sandbox:/') || value.startsWith('sandbox://')) return null;
  return value.slice('sandbox:'.length);
}

/**
 * Implements `sandboxDownloadUrl`.
 */
function sandboxDownloadUrl(path, sourceRecordId, chatgptConversationId) {
  if (!path || !sourceRecordId || !chatgptConversationId) return null;
  const conversation = encodeURIComponent(chatgptConversationId);
  const message = encodeURIComponent(sourceRecordId);
  const sandbox = encodeURIComponent(path);
  return (
    `https://chatgpt.com/backend-api/conversation/${conversation}/` +
    `interpreter/download?message_id=${message}&sandbox_path=${sandbox}` +
    '&download_intent=true'
  );
}

/**
 * Implements `sandboxLinks`.
 */
function sandboxLinks(text) {
  if (typeof text !== 'string' || !text) return [];
  const links = [];
  let cursor = 0;

  while (cursor < text.length) {
    const destinationMarker = text.indexOf('](', cursor);
    if (destinationMarker < 0) break;

    const labelStart = text.lastIndexOf('[', destinationMarker);
    if (labelStart < 0) {
      cursor = destinationMarker + 2;
      continue;
    }

    const destinationStart = destinationMarker + 2;
    if (!text.startsWith('sandbox:/', destinationStart) ||
        text.startsWith('sandbox://', destinationStart)) {
      cursor = destinationStart;
      continue;
    }

    let depth = 0;
    let destinationEnd = -1;
    for (let index = destinationStart; index < text.length; index += 1) {
      const char = text[index];
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        if (depth === 0) {
          destinationEnd = index;
          break;
        }
        depth -= 1;
      }
    }

    if (destinationEnd < 0) break;

    links.push({
      label: text.slice(labelStart + 1, destinationMarker),
      source_pointer: text.slice(destinationStart, destinationEnd),
      start: labelStart,
      end: destinationEnd + 1
    });
    cursor = destinationEnd + 1;
  }

  return links;
}

/**
 * Implements `citationResources`.
 */
function citationResources(citations, sourceRecordId, sourceIndex) {
  const resources = [];

  for (const citation of citations) {
    if (citation?.citation_kind === 'file') {
      const resourceId = `${sourceRecordId}:resource:citation:${citation.source.reference_index}`;
      citation.resource_id = resourceId;
      resources.push({
        id: resourceId,
        type: 'file',
        resource_kind: 'attachment',
        name: citation.file?.name ?? null,
        provider_file_id: citation.file?.id ?? null,
        provider_source: citation.file?.source ?? null,
        snippet: citation.file?.snippet ?? null,
        source: {
          provider: 'chatgpt',
          record_id: sourceRecordId,
          record_index: sourceIndex,
          reference_index: citation.source.reference_index
        }
      });
    }

    if (citation?.citation_kind === 'retrieved_file' && citation.retrieved_file?.resolved) {
      const resourceId = `${sourceRecordId}:resource:citation:${citation.source.reference_index}`;
      citation.resource_id = resourceId;
      resources.push({
        id: resourceId,
        type: 'file',
        resource_kind: 'retrieved_file',
        name: citation.retrieved_file?.title ?? null,
        source_url: citation.retrieved_file?.url ?? null,
        source_record_id: citation.retrieved_file?.source_record_id ?? null,
        source: {
          provider: 'chatgpt',
          record_id: sourceRecordId,
          record_index: sourceIndex,
          reference_index: citation.source.reference_index
        }
      });
    }
  }

  return resources;
}

/**
 * Implements `sandboxResources`.
 */
function sandboxResources(blocks, sourceRecordId, sourceIndex, chatgptConversationId) {
  const resources = [];
  let resourceIndex = 0;

  blocks.forEach((block, partIndex) => {
    if (block?.type !== 'text') return;
    for (const link of sandboxLinks(block.text)) {
      const path = sandboxPath(link.source_pointer);
      if (!path) continue;
      resources.push({
        id: `${sourceRecordId}:resource:sandbox:${resourceIndex}`,
        type: 'artifact',
        resource_kind: 'generated_file',
        name: basename(path),
        label: link.label,
        source_pointer: link.source_pointer,
        path,
        download_url: sandboxDownloadUrl(path, sourceRecordId, chatgptConversationId),
        text_range: {
          part_index: partIndex,
          start: link.start,
          end: link.end
        },
        resolution_context: {
          provider: 'chatgpt',
          conversation_id: chatgptConversationId,
          message_id: sourceRecordId
        },
        source: {
          provider: 'chatgpt',
          record_id: sourceRecordId,
          record_index: sourceIndex,
          part_index: partIndex
        }
      });
      resourceIndex += 1;
    }
  });

  return resources;
}

/**
 * Implements `eventResources`.
 */
function eventResources(record, sourceRecordId, sourceIndex, blocks, citations,
                        chatgptConversationId) {
  return [
    ...citationResources(citations, sourceRecordId, sourceIndex),
    ...sandboxResources(blocks, sourceRecordId, sourceIndex, chatgptConversationId)
  ];
}

/**
 * Adapts ordered ChatGPT provider records into ordered canonical events while preserving source identity and provenance.
 */
export function adaptChatGPTRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('ChatGPT records must be an array.');

  const chatgptConversationId = conversationId(records);
  const retrievedFiles = retrievedFileLookup(records);
  const sourceRecords = records
    .map((record, sourceIndex) => ({ record, sourceIndex }))
    .filter(({ record }) => !isConversationMetadata(record));

  return sourceRecords.map(({ record, sourceIndex }) => {
    const sourceRecordId = typeof record?.id === 'string' ? record.id : null;
    if (!sourceRecordId) throw new Error(`ChatGPT source record at index ${sourceIndex} is missing id.`);

    const role = record?.author?.role ?? null;
    const channel = record?.channel ?? null;
    const contentType = record?.content?.content_type ?? null;
    const kind = eventKind(record);
    const blocks = eventBlocks(record, sourceRecordId, sourceIndex, kind);
    const citations = eventCitations(record, sourceRecordId, sourceIndex, blocks, retrievedFiles);
    const resources = eventResources(
      record,
      sourceRecordId,
      sourceIndex,
      blocks,
      citations,
      chatgptConversationId
    );

    return {
      id: `chatgpt:${sourceRecordId}`,
      provider: 'chatgpt',
      source_record_id: sourceRecordId,
      source_index: sourceIndex,
      kind,
      role,
      channel,
      visibility: eventVisibility(record),
      content_type: contentType,
      blocks,
      citations,
      resources,
      relationships: {
        turn_exchange_id: record?.metadata?.turn_exchange_id ?? null,
        working_turn_id: record?.metadata?.working_turn_id ?? null,
        tool_call_id: null
      },
      source: {
        provider: 'chatgpt',
        record_id: sourceRecordId,
        record_index: sourceIndex
      }
    };
  });
}
