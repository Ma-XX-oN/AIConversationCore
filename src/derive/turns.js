/**
 * Checks whether visible turn event.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {boolean} Whether the isVisibleTurnEvent condition is satisfied.
 */
function isVisibleTurnEvent(event) {
  return event?.visibility === 'visible' &&
    (event?.role === 'user' || event?.role === 'assistant') &&
    (event?.kind === 'message' || event?.kind === 'commentary' || event?.kind === 'reasoning_summary');
}

/**
 * Handles source record.
  *
 * @param {Object} event - The event value used by this operation.
 * @returns {Object} The structured value produced by `sourceRecord`.
 */
function sourceRecord(event) {
  const source = event?.source && typeof event.source === 'object' ? event.source : {};
  const sourceIndex = Number.isInteger(event?.source_index)
    ? event.source_index
    : Number.isInteger(source.record_index) ? source.record_index : null;
  const recordId = event?.source_record_id ?? source.record_id ?? null;

  return {
    record_id: recordId,
    record_index: sourceIndex,
    turn_id: source.turn_id ?? recordId,
    create_time: source.create_time ?? null,
    update_time: source.update_time ?? null,
    turn_exchange_id: source.turn_exchange_id ?? event?.relationships?.turn_exchange_id ?? null,
    working_turn_id: source.working_turn_id ?? event?.relationships?.working_turn_id ?? null
  };
}

/**
 * Handles append event.
  *
 * @param {Object} turn - The turn value used by this operation.
 * @param {Object} event - The event value used by this operation.
 * @returns {void} No value is returned.
 */
function appendEvent(turn, event) {
  turn.event_ids.push(event.id);
  turn.source.record_ids.push(event.source_record_id);
  turn.source.records.push(sourceRecord(event));
}

/**
 * Handles new turn.
  *
 * @param {Object} event - The event value used by this operation.
 * @param {number} turnIndex - The zero-based turn index.
 * @returns {void} No value is returned.
 */
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

/**
 * Derives turns.
  *
 * @param {Array<Object>} events - The ordered canonical events to process.
 * @returns {void} No value is returned.
 */
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
