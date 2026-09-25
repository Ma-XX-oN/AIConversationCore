import { STYLE_ROLES } from './style.js';

/** Default heading-presentation policy when a caller supplies no preference. */
const DEFAULT_HEADING_POLICY = Object.freeze({
  timestamp: false,
  recordNumber: false,
  recordNumberWidth: null,
  turnId: false,
  debugProvenance: false,
  timeZone: null
});

/**
 * Resolves the Core heading-presentation policy from public projection options.
 *
 * Callers select visibility/presentation preferences only. Semantic values such
 * as timestamps, record numbers, source turn IDs, and debug identities are
 * always derived by Core from canonical source provenance.
 *
 * @param {Object<string, *>} options - Public Core projection options.
 * @returns {Object<string, *>} Normalized heading-presentation policy.
 */
export function resolveHeadingPolicy(options = {}) {
  const heading = options?.heading && typeof options.heading === 'object'
    ? options.heading
    : {};
  return {
    timestamp: heading.timestamp === true,
    recordNumber: heading.recordNumber === true,
    recordNumberWidth: Number.isInteger(heading.recordNumberWidth) &&
        heading.recordNumberWidth > 0
      ? heading.recordNumberWidth
      : DEFAULT_HEADING_POLICY.recordNumberWidth,
    turnId: heading.turnId === true,
    debugProvenance: heading.debugProvenance === true,
    timeZone: typeof heading.timeZone === 'string' && heading.timeZone.trim()
      ? heading.timeZone.trim()
      : DEFAULT_HEADING_POLICY.timeZone
  };
}

/**
 * Converts one provider timestamp retained in canonical source provenance to a Date.
 *
 * Numeric provider timestamps are interpreted as Unix seconds unless their
 * magnitude already indicates milliseconds. ISO/date strings are parsed using
 * the platform Date implementation. Invalid or absent values yield null.
 *
 * @param {*} raw - Canonical source timestamp value.
 * @returns {Date|null} Parsed source timestamp or null.
 */
function sourceDate(raw) {
  if (raw == null || raw === '') return null;
  let value = raw;
  if (typeof raw === 'string' && /^-?\d+(?:\.\d+)?$/.test(raw.trim())) {
    value = Number(raw);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1e12 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Formats one source timestamp using Core's canonical transcript date grammar.
 *
 * The grammar is `YYYY-MM-DD HH:MM:SS`. A caller may select an IANA timezone as
 * presentation policy, but never supplies the formatted timestamp itself.
 *
 * @param {*} raw - Canonical source timestamp value.
 * @param {string|null} timeZone - Optional IANA timezone name.
 * @returns {string|null} Canonical formatted timestamp or null.
 */
export function formatHeadingTimestamp(raw, timeZone = null) {
  const date = sourceDate(raw);
  if (!date) return null;
  const offsetMatch = typeof timeZone === 'string'
    ? timeZone.match(/^([+-])(\d{2}):(\d{2})$/)
    : null;
  if (offsetMatch) {
    const hours = Number(offsetMatch[2]);
    const minutes = Number(offsetMatch[3]);
    if (hours > 23 || minutes > 59) {
      throw new RangeError(`Invalid fixed-offset timezone: ${timeZone}`);
    }
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    const offsetMinutes = sign * ((hours * 60) + minutes);
    const shifted = new Date(date.getTime() + (offsetMinutes * 60_000));
    return shifted.toISOString().slice(0, 19).replace('T', ' ');
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {})
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
  if (!parts.year || !parts.month || !parts.day ||
      !parts.hour || !parts.minute || !parts.second) return null;
  return `${parts.year}-${parts.month}-${parts.day} ` +
    `${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * Returns canonical source provenance for heading projection from one event.
 *
 * @param {Object<string, *>} event - Canonical event.
 * @returns {Object<string, *>} Canonical source provenance view.
 */
function headingSource(event) {
  const source = event?.source && typeof event.source === 'object'
    ? event.source
    : {};
  return {
    provider: event?.provider ?? source.provider ?? null,
    record_id: source.record_id ?? event?.source_record_id ?? null,
    record_index: Number.isInteger(source.record_index)
      ? source.record_index
      : Number.isInteger(event?.source_index) ? event.source_index : null,
    turn_id: source.turn_id ?? null,
    timestamp: source.timestamp ?? source.create_time ?? source.update_time ?? null
  };
}

/**
 * Derives Core-owned semantic heading metadata for one canonical event.
 *
 * @param {Object<string, *>} event - Canonical event supplying source provenance.
 * @param {Object<string, *>} options - Public Core projection options.
 * @returns {Object<string, *>} Core-owned semantic heading metadata.
 */
export function deriveHeadingMetadata(event, options = {}) {
  const policy = resolveHeadingPolicy(options);
  const source = headingSource(event);
  const metadata = {};

  if (policy.timestamp) {
    const timestamp = formatHeadingTimestamp(source.timestamp, policy.timeZone);
    if (timestamp) metadata.timestamp = timestamp;
  }
  if (policy.recordNumber && Number.isInteger(source.record_index)) {
    metadata.record_number = source.record_index + 1;
    if (policy.recordNumberWidth != null) {
      metadata.record_number_width = policy.recordNumberWidth;
    }
  }
  if (policy.turnId && typeof source.turn_id === 'string' && source.turn_id) {
    metadata.turn_id = source.turn_id;
  }
  if (policy.debugProvenance) {
    const debug = {};
    if (source.record_id != null) debug.record_id = source.record_id;
    if (Number.isInteger(source.record_index)) debug.record_index = source.record_index;
    if (Object.keys(debug).length) metadata.debug = debug;
  }
  return metadata;
}

/**
 * Formats the Core-derived record number using optional presentation width.
 *
 * The numeric record number remains authoritative in `record_number`. Width is
 * presentation policy only and pads with leading spaces without truncating a
 * value that is already wider than the requested field.
 *
 * @param {Object<string, *>} metadata - Core-owned heading metadata.
 * @returns {string|null} Display record number, or null when absent.
 */
export function formatHeadingRecordNumber(metadata = {}) {
  if (metadata.record_number == null) return null;
  const text = String(metadata.record_number);
  const width = Number.isInteger(metadata.record_number_width) &&
      metadata.record_number_width > 0
    ? metadata.record_number_width
    : 0;
  return width ? text.padStart(width, ' ') : text;
}

/**
 * Replaces caller semantic heading projection with Core-derived metadata.
 *
 * Generic projection fields remain intact, but callers cannot override semantic
 * heading values or debug provenance by placing them in `projection`.
 *
 * @param {Object<string, *>} event - Canonical event to project.
 * @param {Object<string, *>} options - Public Core projection options.
 * @returns {Object<string, *>} Event clone carrying Core-owned heading metadata.
 */
export function withCoreHeadingMetadata(event, options = {}) {
  const projection = { ...(event?.projection ?? {}) };
  delete projection.heading_metadata;
  delete projection.debug_provenance;
  projection.heading_metadata = deriveHeadingMetadata(event, options);

  const related = projection.related_sources &&
      typeof projection.related_sources === 'object'
    ? { ...projection.related_sources }
    : {};
  for (const [name, source] of Object.entries(event?.relationships ?? {})) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const relatedProjection = {
      ...(related[name] && typeof related[name] === 'object' ? related[name] : {})
    };
    delete relatedProjection.heading_metadata;
    delete relatedProjection.debug_provenance;
    relatedProjection.heading_metadata = deriveHeadingMetadata({
      provider: source.provider ?? event?.provider ?? null,
      source_record_id: source.record_id ?? null,
      source_index: Number.isInteger(source.record_index) ? source.record_index : null,
      source
    }, options);
    related[name] = relatedProjection;
  }
  if (Object.keys(related).length) projection.related_sources = related;
  return { ...event, projection };
}

/**
 * Builds ordered semantic heading components from Core-owned metadata.
 *
 * @param {Object<string, *>} metadata - Core-owned heading metadata.
 * @returns {Array<Object<string, string>>} Ordered visible metadata components.
 */
export function headingMetadataComponents(metadata = {}) {
  const components = [];
  if (metadata.timestamp != null) {
    components.push({
      type: 'timestamp',
      styleRole: STYLE_ROLES.TIMESTAMP,
      text: `[${metadata.timestamp}]:`
    });
  }
  const recordNumber = formatHeadingRecordNumber(metadata);
  if (recordNumber != null) {
    components.push({
      type: 'record-number',
      styleRole: STYLE_ROLES.RECORD_NUMBER,
      text: `${recordNumber}:`
    });
  }
  if (metadata.turn_id != null) {
    components.push({
      type: 'turn-id',
      styleRole: STYLE_ROLES.TURN_ID,
      text: String(metadata.turn_id)
    });
  }
  return components;
}

/**
 * Renders Core-owned debug provenance as the canonical Markdown/HTML comment.
 *
 * @param {Object<string, *>} metadata - Core-owned heading metadata.
 * @returns {string} Debug provenance comment or an empty string.
 */
export function renderHeadingDebugComment(metadata = {}) {
  const debug = metadata?.debug ?? {};
  const fields = [];
  if (debug.record_id != null) fields.push(`record_id=${debug.record_id}`);
  if (Number.isInteger(debug.record_index)) fields.push(`record_index=${debug.record_index}`);
  return fields.length ? `<!-- ${fields.join(' ')} -->` : '';
}
