import { withCoreHeadingMetadata } from './heading-metadata.js';
import { renderCanonicalMarkdown as renderBaseMarkdown } from './markdown.js';

/**
 * Renders canonical Markdown with Core-owned heading semantics.
 *
 * Callers select heading visibility and presentation policy only. Semantic
 * heading values are derived from canonical source provenance before the
 * established Markdown renderer is invoked.
 *
 * @param {Array<Object<string, *>>} events - Complete ordered canonical event inventory.
 * @param {Object<string, *>} options - Public projection options.
 * @returns {string} Canonical Markdown with Core-derived heading metadata.
 */
export function renderCanonicalMarkdown(events, options = {}) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');
  const projected = events.map(event => withCoreHeadingMetadata(event, options));
  return renderBaseMarkdown(projected);
}
