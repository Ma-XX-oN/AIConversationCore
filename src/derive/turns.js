function isVisibleMessageEvent(event) {
  return event?.kind === 'message' &&
    event?.visibility === 'visible' &&
    (event?.role === 'user' || event?.role === 'assistant');
}

export function deriveTurns(events) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');

  return events
    .filter(isVisibleMessageEvent)
    .map((event, turnIndex) => ({
      id: `turn:${event.id}`,
      index: turnIndex,
      role: event.role,
      event_ids: [event.id],
      source: {
        provider: event.source?.provider ?? event.provider ?? null,
        record_ids: [event.source_record_id]
      }
    }));
}
