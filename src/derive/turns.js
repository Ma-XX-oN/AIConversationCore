function isVisibleTurnEvent(event) {
  return event?.visibility === 'visible' &&
    (event?.role === 'user' || event?.role === 'assistant') &&
    (event?.kind === 'message' || event?.kind === 'commentary');
}

function newTurn(event, turnIndex) {
  return {
    id: `turn:${event.id}`,
    index: turnIndex,
    role: event.role,
    event_ids: [event.id],
    source: {
      provider: event.source?.provider ?? event.provider ?? null,
      record_ids: [event.source_record_id]
    }
  };
}

export function deriveTurns(events) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');

  const turns = [];
  for (const event of events) {
    if (!isVisibleTurnEvent(event)) continue;

    if (event.kind === 'commentary') {
      const current = turns.at(-1);
      if (current?.role === 'assistant') {
        current.event_ids.push(event.id);
        current.source.record_ids.push(event.source_record_id);
        continue;
      }
    }

    turns.push(newTurn(event, turns.length));
  }
  return turns;
}
