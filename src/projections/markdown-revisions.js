import { renderCanonicalMarkdown as renderBaseMarkdown } from './markdown.js';

/**
 * Returns the human-readable Assistant label for one canonical provider.
 *
 * @param {string} provider - Canonical provider identifier.
 * @returns {string} Canonical transcript actor label.
 */
function providerLabel(provider) {
  if (provider === 'claude') return 'Claude';
  if (provider === 'codex') return 'Codex';
  return 'ChatGPT';
}

/**
 * Returns the visible revision/execution suffix for one canonical turn event.
 *
 * @param {Object<string, *>} event - Canonical User/Assistant event.
 * @returns {string} Parenthesized status suffix or an empty string.
 */
function turnStatusSuffix(event) {
  const statuses = [];
  if (event?.revision_status && event.revision_status !== 'normal') {
    statuses.push(Number.isInteger(event.revision_depth)
      ? `${event.revision_status} ${event.revision_depth}`
      : event.revision_status);
  }
  if (event?.execution_status === 'aborted') statuses.push('aborted');
  return statuses.length ? ` (${statuses.join(', ')})` : '';
}

/**
 * Returns the canonical Markdown heading label for one revision-bearing message.
 *
 * @param {Object<string, *>} event - Canonical User/Assistant message event.
 * @returns {string} Heading label without status or metadata.
 */
function headingLabel(event) {
  return event?.role === 'user'
    ? '## User'
    : `## ${providerLabel(event?.provider)}`;
}

/**
 * Positions revision status immediately after User/Assistant labels.
 *
 * Base rendering may append `projection.heading_suffix` after consumer heading
 * metadata, and an Assistant section may be headed by reasoning/commentary that
 * precedes its final message.  This canonical post-pass therefore pairs visible
 * message generations with their rendered actor headings and places the status
 * next to the actor label without depending on which event opened the section.
 *
 * @param {string} markdown - Base canonical Markdown.
 * @param {Array<Object<string, *>>} events - Ordered canonical events.
 * @returns {string} Revision-aware Markdown.
 */
function positionTurnStatuses(markdown, events) {
  const statuses = events
    .filter(event => event?.visibility !== 'hidden' && event?.kind === 'message' &&
      (event?.role === 'user' || event?.role === 'assistant'))
    .map(event => ({
      label: headingLabel(event),
      suffix: turnStatusSuffix(event)
    }))
    .filter(item => item.suffix);
  if (!statuses.length) return markdown;

  let statusIndex = 0;
  return markdown.split('\n').map(line => {
    if (statusIndex >= statuses.length) return line;
    const item = statuses[statusIndex];
    const labelIndex = line.indexOf(item.label);
    if (labelIndex < 0) return line;

    const afterLabel = labelIndex + item.label.length;
    let resetEnd = afterLabel;
    const resetMatch = line.slice(afterLabel).match(/^(\x1b\[[0-9;]*m)/);
    if (resetMatch) resetEnd += resetMatch[1].length;

    let withoutTrailingSuffix = line;
    if (withoutTrailingSuffix.endsWith(item.suffix)) {
      withoutTrailingSuffix = withoutTrailingSuffix.slice(0, -item.suffix.length);
    }
    statusIndex += 1;
    return `${withoutTrailingSuffix.slice(0, resetEnd)}${item.suffix}` +
      `${withoutTrailingSuffix.slice(resetEnd)}`;
  }).join('\n');
}

/**
 * Renders canonical Markdown with revision/execution status positioned as part
 * of both User and Assistant heading labels before consumer metadata.
 *
 * @param {Array<Object<string, *>>} events - Ordered canonical event stream.
 * @returns {string} Canonical transcript Markdown.
 */
export function renderCanonicalMarkdown(events) {
  return positionTurnStatuses(renderBaseMarkdown(events), events);
}
