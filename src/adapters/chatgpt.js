import { adaptChatGPTRecords as adaptBaseChatGPTRecords } from './chatgpt-base.js';

function imagePointerSource(part) {
  if (!part || typeof part !== 'object') return null;
  const metadata = part?.metadata && typeof part.metadata === 'object' ? part.metadata : {};
  for (const value of [metadata.asset_pointer_link, part.asset_pointer_link, part.asset_pointer]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function sedimentDownloadUrl(source) {
  if (typeof source !== 'string' || !source.startsWith('sediment://')) return null;
  const assetId = source.slice('sediment://'.length).split(/[?#]/, 1)[0];
  if (!assetId.startsWith('file_')) return null;
  return `https://chatgpt.com/backend-api/files/download/${encodeURIComponent(assetId)}`;
}

function imageResource(part, sourceRecordId, sourceIndex, partIndex) {
  const sourcePointer = imagePointerSource(part);
  const resource = {
    id: `${sourceRecordId}:resource:image:${partIndex}`,
    type: 'image',
    resource_kind: 'conversation_image',
    source: {
      provider: 'chatgpt',
      record_id: sourceRecordId,
      record_index: sourceIndex,
      part_index: partIndex
    }
  };

  if (sourcePointer) resource.source_pointer = sourcePointer;
  if (Number.isFinite(part?.size_bytes)) resource.size_bytes = part.size_bytes;
  if (Number.isFinite(part?.width)) resource.width = part.width;
  if (Number.isFinite(part?.height)) resource.height = part.height;

  if (!sourcePointer) {
    resource.status = 'missing';
    return resource;
  }

  if (sourcePointer.startsWith('data:image/')) {
    resource.status = 'available';
    resource.data_url = sourcePointer;
    return resource;
  }

  const downloadUrl = sedimentDownloadUrl(sourcePointer);
  if (downloadUrl) resource.download_url = downloadUrl;
  return resource;
}

function remapTextRange(range, textOrdinalToPartIndex) {
  if (!range || !Number.isInteger(range.part_index)) return range;
  const partIndex = textOrdinalToPartIndex.get(range.part_index);
  if (!Number.isInteger(partIndex)) return range;
  return { ...range, part_index: partIndex };
}

function remapCitation(citation, textOrdinalToPartIndex) {
  if (!citation || typeof citation !== 'object') return citation;
  return {
    ...citation,
    text_range: remapTextRange(citation.text_range, textOrdinalToPartIndex)
  };
}

function remapExistingResource(resource, textOrdinalToPartIndex) {
  if (!resource || typeof resource !== 'object') return resource;
  const remapped = {
    ...resource,
    text_range: remapTextRange(resource.text_range, textOrdinalToPartIndex)
  };
  if (resource.source && Number.isInteger(resource.source.part_index)) {
    const partIndex = textOrdinalToPartIndex.get(resource.source.part_index);
    if (Number.isInteger(partIndex)) {
      remapped.source = { ...resource.source, part_index: partIndex };
    }
  }
  return remapped;
}

function normalizeMultimodalImages(event, record) {
  const parts = record?.content?.parts;
  if (!Array.isArray(parts)) return event;
  if (!parts.some(part => part?.content_type === 'image_asset_pointer')) return event;

  const blocks = [];
  const images = [];
  const textOrdinalToPartIndex = new Map();
  let textOrdinal = 0;

  parts.forEach((part, partIndex) => {
    if (typeof part === 'string') {
      textOrdinalToPartIndex.set(textOrdinal, partIndex);
      textOrdinal += 1;
      blocks.push({
        id: `${event.source_record_id}:part:${partIndex}`,
        type: 'text',
        text: part,
        source: {
          provider: 'chatgpt',
          record_id: event.source_record_id,
          record_index: event.source_index,
          part_index: partIndex
        }
      });
      return;
    }

    if (part?.content_type !== 'image_asset_pointer') return;
    const resource = imageResource(part, event.source_record_id, event.source_index, partIndex);
    images.push(resource);
    blocks.push({
      id: `${event.source_record_id}:part:${partIndex}`,
      type: 'image',
      resource_id: resource.id,
      source: {
        provider: 'chatgpt',
        record_id: event.source_record_id,
        record_index: event.source_index,
        part_index: partIndex
      }
    });
  });

  return {
    ...event,
    blocks,
    citations: event.citations.map(citation => remapCitation(citation, textOrdinalToPartIndex)),
    resources: [
      ...event.resources.map(resource => remapExistingResource(resource, textOrdinalToPartIndex)),
      ...images
    ]
  };
}

export function adaptChatGPTRecords(records) {
  const events = adaptBaseChatGPTRecords(records);
  return events.map(event => normalizeMultimodalImages(event, records[event.source_index]));
}
