function textParts(record) {
  const parts = record?.content?.parts;
  if (!Array.isArray(parts)) return [];
  return parts.filter(part => typeof part === 'string');
}

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

function toolCallBlocks(record, sourceRecordId, sourceIndex) {
  return [{
    id: `${sourceRecordId}:tool_call:0`,
    type: 'tool_call',
    call_id: null,
    name: record?.recipient ?? null,
    input: record?.content?.text ?? null,
    input_format: 'code',
    language: record?.content?.language ?? null,
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex
    }
  }];
}

function toolResultBlocks(record, sourceRecordId, sourceIndex) {
  const contentType = record?.content?.content_type ?? null;
  let output = null;
  if (contentType === 'execution_output') output = record?.content?.text ?? null;
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

function eventVisibility(record) {
  return record?.metadata?.is_visually_hidden_from_conversation ? 'hidden' : 'visible';
}

function isToolCall(record) {
  return record?.author?.role === 'assistant' &&
    record?.content?.content_type === 'code' &&
    typeof record?.recipient === 'string' &&
    record.recipient !== 'all';
}

function isToolResult(record) {
  if (record?.author?.role !== 'tool') return false;
  return record?.content?.content_type === 'execution_output' ||
    record?.content?.content_type === 'multimodal_text';
}

function eventKind(record) {
  if (isToolCall(record)) return 'tool_call';
  if (isToolResult(record)) return 'tool_result';
  if (record?.author?.role === 'assistant' && record?.content?.content_type === 'thoughts') {
    return 'reasoning_summary';
  }
  if (record?.author?.role === 'assistant' && record?.channel === 'commentary') return 'commentary';
  return 'message';
}

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

function fileMarkerKey(matchedText) {
  if (typeof matchedText !== 'string') return null;
  const match = matchedText.match(/turn(\d+)file(\d+)/);
  return match ? `turn${match[1]}file${match[2]}` : null;
}

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

export function adaptChatGPTRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('ChatGPT records must be an array.');

  const retrievedFiles = retrievedFileLookup(records);

  return records.map((record, sourceIndex) => {
    const sourceRecordId = typeof record?.id === 'string' ? record.id : null;
    if (!sourceRecordId) throw new Error(`ChatGPT source record at index ${sourceIndex} is missing id.`);

    const role = record?.author?.role ?? null;
    const channel = record?.channel ?? null;
    const contentType = record?.content?.content_type ?? null;
    const kind = eventKind(record);
    const blocks = eventBlocks(record, sourceRecordId, sourceIndex, kind);

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
      citations: eventCitations(record, sourceRecordId, sourceIndex, blocks, retrievedFiles),
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
