import {
  renderCanonicalHtmlUnits as renderBaseHtmlUnits
} from './html.js';
import { buildCanonicalPresentation } from './presentation-revisions.js';
import {
  isHistoricalRevision,
  projectRevisionVisibility
} from './revision-visibility.js';

/**
 * Resolves canonical revision metadata for one presentation turn.
 *
 * @param {Object<string, *>} turn - Canonical presentation turn.
 * @param {Map<string, Object<string, *>>} eventsById - Projected events by ID.
 * @returns {Object<string, *>} Revision and effective-visibility metadata.
 */
function turnRevisionProjection(turn, eventsById) {
  const sourceEvents = (turn?.source ?? [])
    .map(source => eventsById.get(source?.event_id))
    .filter(Boolean);
  const revisionEvent = sourceEvents.find(event =>
    typeof event?.revision_status === 'string' && event.revision_status.length);
  const visible = sourceEvents.length === 0 ||
    sourceEvents.some(event => event?.projection?.visible !== false);
  return {
    visible,
    revision_status: revisionEvent?.revision_status ?? null,
    revision_depth: Number.isInteger(revisionEvent?.revision_depth)
      ? revisionEvent.revision_depth
      : null,
    historical: revisionEvent ? isHistoricalRevision(revisionEvent) : false
  };
}

/**
 * Applies canonical revision/visibility attributes to one already-rendered turn.
 *
 * This remains a Core serializer operation. Interactive consumers receive the
 * completed unit and never need to interpret revision status or rewrite HTML.
 *
 * @param {string} html - Base canonical HTML for one complete turn.
 * @param {Map<string, Object<string, *>>} turnsById - Turn projection metadata.
 * @returns {string} Canonical turn HTML with revision visibility attributes.
 */
function applyTurnRevisionAttributes(html, turnsById) {
  return html.replace(
    /<section class="transcript-turn" data-presentation-id="([^"]*)">/,
    (match, id) => {
      const projection = turnsById.get(id);
      if (!projection) return match;
      const status = projection.revision_status;
      const className = status
        ? `transcript-turn revision-${status}`
        : 'transcript-turn';
      const statusAttribute = status
        ? ` data-revision-status="${status}"`
        : '';
      const depthAttribute = Number.isInteger(projection.revision_depth)
        ? ` data-revision-depth="${projection.revision_depth}"`
        : '';
      const hiddenAttribute = projection.historical && !projection.visible
        ? ' hidden'
        : '';
      return `<section class="${className}" data-presentation-id="${id}"` +
        `${statusAttribute}${depthAttribute}${hiddenAttribute}>`;
    }
  );
}

/**
 * Renders canonical HTML as ordered complete-turn units while retaining
 * historical revision turns and their stable identities.
 *
 * @param {Array<Object<string, *>>} events - Complete canonical event inventory.
 * @param {Object<string, *>} options - Projection options.
 * @returns {Array<Object<string, *>>} Ordered canonical HTML units.
 */
export function renderCanonicalHtmlUnits(events, options = {}) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');
  const projectedEvents = projectRevisionVisibility(events, options);
  const presentation = buildCanonicalPresentation(projectedEvents);
  const eventsById = new Map(projectedEvents.map(event => [event?.id, event]));
  const turnsById = new Map((presentation.turns ?? []).map(turn => [
    String(turn?.id ?? ''),
    turnRevisionProjection(turn, eventsById)
  ]));

  return renderBaseHtmlUnits(projectedEvents).map(unit => ({
    ...unit,
    html: applyTurnRevisionAttributes(unit.html, turnsById)
  }));
}

/**
 * Renders canonical HTML while retaining historical revision turns in the DOM.
 *
 * Historical turns always remain serialized with stable presentation IDs and
 * semantic revision attributes. The selected projection controls only their
 * `hidden` state, allowing an interactive consumer to show/hide the already
 * materialized DOM without reparsing provider records or changing identities.
 *
 * @param {Array<Object<string, *>>} events - Complete canonical event inventory.
 * @param {Object<string, *>} options - Projection options.
 * @returns {string} Canonical structural HTML containing all revision turns.
 */
export function renderCanonicalHtml(events, options = {}) {
  return renderCanonicalHtmlUnits(events, options)
    .map(unit => unit.html)
    .join('');
}
