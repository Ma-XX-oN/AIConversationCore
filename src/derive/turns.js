function isVisibleTurnEvent(event) {
  return event?.visibility === 'visible' &&
    (event?.role === 'user' || event?.role === 'assistant') &&
    (event?.kind === 'message' || event?.kind === 'commentary' || event?.kind === 'reasoning_summary');
}

function sourceRecord(event) {
  const source = event?.source && typeof event.source === 'object' ? event.source : {};
  const sourceIndex = Number.isInteger(event?.source_index)
    ? event.source_index
    : Number.isInteger(source.record_index) ? source.record_index : null;
  const recordId = event?.source_record_id ?? source.record_id ?? null;

  return {
    record_id: recordId,
    record_index: sourceIndex,
    record_number: Number.isInteger(source.record_number)
      ? source.record_number
      : Number.isInteger(sourceIndex) ? sourceIndex + 1 : null,
    turn_id: source.turn_id ?? recordId,
    create_time: source.create_time ?? null,
    update_time: source.update_time ?? null,
    turn_exchange_id: source.turn_exchange_id ?? event?.relationships?.turn_exchange_id ?? null,
    working_turn_id: source.working_turn_id ?? event?.relationships?.working_turn_id ?? null
  };
}

function appendEvent(turn, event) {
  turn.event_ids.push(event.id);
  turn.source.record_ids.push(event.source_record_id);
  turn.source.records.push(sourceRecord(event));
}

function newTurn(event, turnIndex) {
  return {
    id: `turn:${event.id}`,
    index: turnIndex,
    role: event.role,
    event_ids: [event.id],
    source: {
      provider: event.source?.provider ?? event.provider ?? null,
      record_ids: [event.source_record_id],
      records: [sourceRecord(event)]
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
    if (event.kind === 'reasoning_summary' && event.role === 'assistant' &&
        current?.role === 'assistant' && !turnsWithMessage.has(current.id)) {
      appendEvent(current, event);
      continue;
    }

    if (event.kind === 'commentary' && current?.role === 'assistant') {
      appendEvent(current, event);
      continue;
    }

    if (event.kind === 'message' && event.role === 'assistant' &&
        current?.role === 'assistant' && !turnsWithMessage.has(current.id)) {
      appendEvent(current, event);
      turnsWithMessage.add(current.id);
      continue;
    }

    const turn = newTurn(event, turns.length);
    turns.push(turn);
    if (event.kind === 'message') turnsWithMessage.add(turn.id);
  }
  return turns;
}
