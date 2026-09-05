import { deriveTurns } from '../derive/turns.js';
import { renderCanonicalMarkdown } from './markdown.js';

/** Version of the shared presentation-boundary contract. */
const PRESENTATION_SCHEMA_VERSION = 1;
/** Policy identifying record anchors that may be split by consumers. */
const PRESENTATION_SPLIT_POLICY = 'record-anchor-except-declared-atomic-unit';
/** CSS class used by invisible structural-unit declaration markers. */
const STRUCTURAL_UNIT_MARKER_CLASS = 'aicore-structural-unit';

/**
 * Enables renderer provenance without mutating the caller's canonical events.
 *
 * @param {Object<string, *>} event - Canonical event to project.
 * @returns {Object<string, *>} Shallow event copy with debug provenance enabled.
 */
function withRenderProvenance(event) {
  return {
    ...event,
    projection: {
      ...(event?.projection ?? {}),
      debug_provenance: true
    }
  };
}

/**
 * Returns the canonical source block index when one exists.
 *
 * @param {Object<string, *>} block - Canonical block.
 * @returns {number|null} Source block index or null.
 */
function sourceBlockIndex(block) {
  const value = block?.source?.block_index;
  return Number.isInteger(value) ? value : null;
}

/**
 * Projects one canonical block into the flattened interactive-consumer shape.
 *
 * @param {Object<string, *>} event - Canonical owner event.
 * @param {Object<string, *>} block - Canonical block.
 * @param {number} blockIndex - Canonical block ordinal within the event.
 * @returns {Object<string, *>} Flattened canonical unit.
 */
function projectBlock(event, block, blockIndex) {
  return {
    id: block?.id ?? `${event.id}:block:${blockIndex}`,
    event_id: event.id,
    provider: event.provider ?? null,
    source_record_id: event.source_record_id ?? event?.source?.record_id ?? null,
    source_index: Number.isInteger(event.source_index)
      ? event.source_index
      : Number.isInteger(event?.source?.record_index)
        ? event.source.record_index
        : null,
    source_block_index: sourceBlockIndex(block),
    event_kind: event.kind ?? null,
    role: event.role ?? null,
    channel: event.channel ?? null,
    visibility: event.visibility ?? null,
    content_type: event.content_type ?? null,
    block_type: block?.type ?? null,
    block
  };
}

/**
 * Reads all source indexes encoded in one renderer provenance line.
 *
 * @param {string} line - Rendered Markdown line.
 * @returns {number[]} Source indexes in textual order.
 */
function provenanceIndexes(line) {
  const indexes = [];
  const regex = /record_index=(\d+)/g;
  for (const match of line.matchAll(regex)) indexes.push(Number(match[1]));
  return indexes;
}

/**
 * Adds invisible structural-unit markers to core-generated details disclosures.
 *
 * projectedDetails() always places the first debug-provenance comment on the
 * summary line, followed immediately by any additional source comments. That
 * lets this projection layer identify renderer-owned disclosures without
 * treating arbitrary provider/user-authored <details> markup as core structure.
 *
 * @param {string} markdown - Canonical Markdown rendered with provenance.
 * @param {Array<Object<string, *>>} events - Ordered canonical events.
 * @returns {Object<string, *>} Annotated Markdown and declared units.
 */
function declareStructuralUnits(markdown, events) {
  const sourceIds = new Map();
  for (const event of events) {
    if (!Number.isInteger(event?.source_index)) continue;
    const sourceId = event?.source_record_id ?? event?.source?.record_id ?? null;
    if (sourceId != null) sourceIds.set(event.source_index, String(sourceId));
  }

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const units = [];
  for (let index = 0; index < lines.length; ++index) {
    const detailsOffset = lines[index].indexOf('<details>');
    if (detailsOffset < 0) continue;

    let summaryIndex = index;
    if (!lines[summaryIndex].includes('<summary>')) {
      summaryIndex += 1;
      if (summaryIndex >= lines.length || !lines[summaryIndex].includes('<summary>')) continue;
    }

    const indexes = provenanceIndexes(lines[summaryIndex]);
    let markerIndex = summaryIndex + 1;
    while (markerIndex < lines.length && /<!--\s*record_(?:id|index)=/.test(lines[markerIndex])) {
      indexes.push(...provenanceIndexes(lines[markerIndex]));
      markerIndex += 1;
    }
    const uniqueIndexes = [...new Set(indexes)];
    if (!uniqueIndexes.length) continue;

    const unitId = `details-${units.length}`;
    const sourceRecordIds = uniqueIndexes
      .map(sourceIndex => sourceIds.get(sourceIndex))
      .filter(sourceId => sourceId != null);
    const quoted = /^\s*>\s?/.test(lines[index]);
    const prefix = quoted ? `${lines[index].match(/^\s*>\s?/)?.[0] ?? '> '}` : '';
    const encodedIds = sourceRecordIds.map(encodeURIComponent).join(',');
    lines.splice(
      markerIndex,
      0,
      `${prefix}<span hidden class="${STRUCTURAL_UNIT_MARKER_CLASS}" ` +
        `data-aicore-unit-id="${unitId}" ` +
        `data-aicore-source-record-ids="${encodedIds}"></span>`
    );

    units.push({
      id: unitId,
      kind: 'details',
      atomic: true,
      source_indexes: uniqueIndexes,
      source_record_ids: sourceRecordIds
    });
    index = markerIndex;
  }

  return {
    markdown: lines.join('\n'),
    units
  };
}

/**
 * Projects canonical events for interactive consumers while retaining the
 * canonical event/turn model and shared Markdown presentation.
 *
 * @param {Array<Object<string, *>>} events - Ordered canonical events.
 * @returns {Object<string, *>} Structured projection.
 */
export function projectCanonicalConversation(events) {
  if (!Array.isArray(events)) {
    throw new TypeError('projectCanonicalConversation expects an event array');
  }

  const units = [];
  for (const event of events) {
    const blocks = Array.isArray(event?.blocks) ? event.blocks : [];
    for (let blockIndex = 0; blockIndex < blocks.length; ++blockIndex) {
      units.push(projectBlock(event, blocks[blockIndex], blockIndex));
    }
  }

  const rendered = renderCanonicalMarkdown(events.map(withRenderProvenance));
  const structural = declareStructuralUnits(rendered, events);
  return {
    schema_version: 1,
    events,
    turns: deriveTurns(events),
    units,
    presentation: {
      schema_version: PRESENTATION_SCHEMA_VERSION,
      split_policy: PRESENTATION_SPLIT_POLICY,
      structural_unit_marker_class: STRUCTURAL_UNIT_MARKER_CLASS,
      structural_units: structural.units
    },
    markdown: structural.markdown
  };
}
