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
  const turnsWithMessage = new Set();
  for (const event of events) {
    if (!isVisibleTurnEvent(event)) continue;

    const current = turns.at(-1);
    if (event.kind === 'commentary' && current?.role === 'assistant') {
      current.event_ids.push(event.id);
      current.source.record_ids.push(event.source_record_id);
      continue;
    }

    if (event.kind === 'message' && event.role === 'assistant' &&
        current?.role === 'assistant' && !turnsWithMessage.has(current.id)) {
      current.event_ids.push(event.id);
      current.source.record_ids.push(event.source_record_id);
      turnsWithMessage.add(current.id);
      continue;
    }

    const turn = newTurn(event, turns.length);
    turns.push(turn);
    if (event.kind === 'message') turnsWithMessage.add(turn.id);
  }
  return turns;
}
