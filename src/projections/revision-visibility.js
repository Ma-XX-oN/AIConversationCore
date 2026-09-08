/**
 * Returns whether one canonical event belongs to historical Codex revision
 * history rather than the active revision.
 *
 * Revision status is canonical data.  Consumers must not inspect provider-native
 * rollback markers to answer this question.
 *
 * @param {Object<string, *>} event - Canonical event.
 * @returns {boolean} Whether the event belongs to rolled-back revision history.
 */
export function isHistoricalRevision(event) {
  return event?.rolled_back === true ||
    event?.revision_status === 'original' ||
    event?.revision_status === 'superseded';
}

/**
 * Resolves effective projection visibility for one canonical event.
 *
 * Intrinsically hidden canonical events remain hidden.  Historical revision
 * events are additionally controlled by the projection option without changing
 * their canonical identity or removing them from the projected inventory.
 *
 * @param {Object<string, *>} event - Canonical event.
 * @param {Object<string, *>} options - Projection options.
 * @returns {boolean} Whether the event is eligible for the visible projection.
 */
export function isEventProjectionVisible(event, options = {}) {
  if (event?.visibility === 'hidden') return false;
  if (!isHistoricalRevision(event)) return true;
  return options?.includeRolledBackTurns === true;
}

/**
 * Adds effective revision visibility metadata without mutating canonical events.
 *
 * Non-revision conversations preserve the exact caller event-array reference so
 * existing structured consumers do not pay an allocation/identity cost for a
 * Codex-only projection concern.  Once a historical revision exists, every event
 * in that canonical inventory receives explicit effective visibility metadata so
 * consumers can share one eligibility policy without renumbering/removing events.
 *
 * @param {Array<Object<string, *>>} events - Ordered canonical events.
 * @param {Object<string, *>} options - Projection options.
 * @returns {Array<Object<string, *>>} Stable event inventory with projection metadata.
 */
export function projectRevisionVisibility(events, options = {}) {
  if (!Array.isArray(events)) {
    throw new TypeError('projectRevisionVisibility expects an event array');
  }
  if (!events.some(isHistoricalRevision)) return events;

  return events.map(event => {
    const visible = isEventProjectionVisible(event, options);
    return {
      ...event,
      projection: {
        ...(event?.projection ?? {}),
        visible,
        ...(visible
          ? {}
          : {
              hidden_reason: isHistoricalRevision(event)
                ? 'rolled-back-revision'
                : 'canonical-hidden'
            })
      }
    };
  });
}
