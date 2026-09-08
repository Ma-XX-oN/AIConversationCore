import { buildCanonicalPresentation as buildBasePresentation } from './presentation.js';

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
 * Finds the canonical message that supplies revision metadata for one
 * presentation turn.
 *
 * Assistant turns may begin with reasoning/commentary before their final
 * message, so the matching message is located from the turn's complete source
 * list rather than assumed to be its first event.
 *
 * @param {Object<string, *>} turn - Canonical presentation turn.
 * @param {Map<string, Object<string, *>>} eventsById - Canonical events by ID.
 * @returns {Object<string, *>|null} Matching message event or null.
 */
function revisionMessageForTurn(turn, eventsById) {
  const role = turn?.actor?.role;
  if (role !== 'user' && role !== 'assistant') return null;
  return (turn.source ?? [])
    .map(source => eventsById.get(source?.event_id))
    .find(event => event?.role === role && event?.kind === 'message') ?? null;
}

/**
 * Builds the canonical presentation tree and carries canonical revision status
 * and depth into both User and Assistant actor labels.
 *
 * @param {Array<Object<string, *>>} events - Ordered canonical event stream.
 * @returns {Object<string, *>} Canonical presentation tree.
 */
export function buildCanonicalPresentation(events) {
  const presentation = buildBasePresentation(events);
  const eventsById = new Map(events.map(event => [event?.id, event]));

  for (const turn of presentation.turns ?? []) {
    const sourceEvent = revisionMessageForTurn(turn, eventsById);
    const suffix = turnStatusSuffix(sourceEvent);
    if (!suffix) continue;
    turn.actor = {
      ...turn.actor,
      label: `${turn.actor.label}${suffix}`,
      revision_status: sourceEvent.revision_status,
      revision_depth: sourceEvent.revision_depth,
      execution_status: sourceEvent.execution_status
    };
  }

  return presentation;
}
