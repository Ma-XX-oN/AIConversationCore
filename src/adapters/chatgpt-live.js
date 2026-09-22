/** ChatGPT provider exchange-result values mapped to canonical lifecycle outcomes. */
const PROVIDER_OUTCOME = Object.freeze({
  success: 'completed',
  error: 'failed',
  canceled: 'canceled'
});

/** Exact ChatGPT telemetry message that records an exchange outcome. */
const TURN_EXCHANGE_COMPLETE = 'Turn exchange complete';
/** Exact ChatGPT telemetry message that carries a request/provider error code. */
const STREAM_ERROR = 'Stream error';
/** Exact stop-control telemetry message observed for the Escape stop action. */
const ESCAPE_STOP_MENU_ACTION = 'Escape Stop Menu Action';

/**
 * Creates an empty retained state for ChatGPT-Web live provider observations.
 *
 * The state keeps exchange outcome, conversation transport/async state and
 * trace/control state in separate dimensions. Unknown observations are retained
 * explicitly rather than being interpreted through a catch-all heuristic.
 *
 * @returns {Object<string, *>} Empty ChatGPT-Web live provider state.
 */
export function createChatGPTLiveState() {
  return {
    schema: 'chatgpt-live-state-v1',
    exchanges: {},
    conversations: {},
    traces: {},
    unhandled_observations: []
  };
}

/**
 * Gets or creates one exchange state.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {string} exchangeId - Provider turn-exchange identity.
 * @returns {Object<string, *>} Mutable exchange state owned by the reducer.
 */
function ensureExchange(state, exchangeId) {
  if (!state.exchanges[exchangeId]) {
    state.exchanges[exchangeId] = {
      exchange_id: exchangeId,
      outcome: 'unresolved',
      provider_reported_final_assistant: null,
      observed_final_assistant: false,
      error: null,
      evidence: []
    };
  }
  return state.exchanges[exchangeId];
}

/**
 * Gets or creates one conversation-level live state.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {string} conversationId - Provider conversation identity.
 * @returns {Object<string, *>} Mutable conversation state owned by the reducer.
 */
function ensureConversation(state, conversationId) {
  if (!state.conversations[conversationId]) {
    state.conversations[conversationId] = {
      conversation_id: conversationId,
      stream_status: null,
      latest_async_status: null,
      conversation_turn_complete_observed: false,
      evidence: []
    };
  }
  return state.conversations[conversationId];
}

/**
 * Gets or creates one telemetry/control trace state.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {string} traceId - Provider turn-trace identity.
 * @returns {Object<string, *>} Mutable trace state owned by the reducer.
 */
function ensureTrace(state, traceId) {
  if (!state.traces[traceId]) {
    state.traces[traceId] = {
      trace_id: traceId,
      stop_requested: false,
      exchange_ids: [],
      evidence: []
    };
  }
  return state.traces[traceId];
}

/**
 * Builds a compact provenance entry for one provider observation.
 *
 * @param {Object<string, *>} observation - Thin host acquisition/provenance envelope.
 * @param {number} observationIndex - Zero-based position in the applied observation sequence.
 * @param {string} kind - Core interpretation assigned to this evidence item.
 * @returns {Object<string, *>} Compact evidence/provenance descriptor.
 */
function evidenceOf(observation, observationIndex, kind) {
  return {
    observation_index: observationIndex,
    kind,
    observed_at: observation?.observed_at ?? null,
    transport: observation?.transport ?? null,
    direction: observation?.direction ?? null,
    endpoint: observation?.endpoint ?? null
  };
}

/**
 * Adds a value to an array only when the same scalar is not already present.
 *
 * @param {Array<*>} values - Mutable scalar array.
 * @param {*} value - Scalar value to add.
 * @returns {void} No value is returned.
 */
function addUnique(values, value) {
  if (!values.includes(value)) values.push(value);
}

/**
 * Extracts a conversation identity from the known stream-status endpoint shape.
 *
 * @param {string|null} endpoint - Captured provider request endpoint.
 * @returns {string|null} Conversation identity, or null when the endpoint is not a stream-status endpoint.
 */
function streamStatusConversationId(endpoint) {
  if (typeof endpoint !== 'string') return null;
  const match = endpoint.match(/^\/backend-api\/conversation\/([^/]+)\/stream_status(?:\?.*)?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Returns whether one telemetry message is an observed stop/control action.
 *
 * This intentionally recognizes only evidenced provider message families and
 * does not infer cancellation or terminal outcome from them.
 *
 * @param {string|null} message - Provider telemetry message.
 * @returns {boolean} True when the message is an evidenced stop/control action.
 */
function isStopControlMessage(message) {
  if (typeof message !== 'string') return false;
  return message === ESCAPE_STOP_MENU_ACTION ||
    message.startsWith('Client stop requested - ') ||
    message.startsWith('Client stop - ');
}

/**
 * Applies one explicit Turn exchange complete telemetry record.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {Object<string, *>} observation - Provider observation envelope.
 * @param {number} observationIndex - Zero-based observation index.
 * @returns {boolean} True when the observation was recognized and applied.
 */
function applyTurnExchangeComplete(state, observation, observationIndex) {
  const payload = observation?.payload;
  const analytics = payload?.turn_analytics;
  if (payload?.message !== TURN_EXCHANGE_COMPLETE || !analytics) return false;

  const exchangeId = analytics.turn_exchange_id;
  if (typeof exchangeId !== 'string' || !exchangeId) return false;

  const exchange = ensureExchange(state, exchangeId);
  const outcome = PROVIDER_OUTCOME[analytics.result];
  if (outcome) exchange.outcome = outcome;
  if (typeof analytics.received_final_assistant_message === 'boolean') {
    exchange.provider_reported_final_assistant = analytics.received_final_assistant_message;
  }
  if (analytics.error && typeof analytics.error === 'object') {
    exchange.error = {
      ...(exchange.error ?? {}),
      ...(typeof analytics.error.reason === 'string' ? { reason: analytics.error.reason } : {}),
      ...(Number.isFinite(analytics.error.status_code)
        ? { status_code: analytics.error.status_code }
        : {})
    };
  }
  exchange.evidence.push(evidenceOf(observation, observationIndex, 'turn_exchange_complete'));

  const traceId = analytics.turn_trace_id;
  if (typeof traceId === 'string' && traceId) {
    const trace = ensureTrace(state, traceId);
    addUnique(trace.exchange_ids, exchangeId);
    trace.evidence.push(evidenceOf(observation, observationIndex, 'turn_exchange_complete'));
  }
  return true;
}

/**
 * Applies one explicit Stream error telemetry record without inventing outcome.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {Object<string, *>} observation - Provider observation envelope.
 * @param {number} observationIndex - Zero-based observation index.
 * @returns {boolean} True when the observation was recognized and applied.
 */
function applyStreamError(state, observation, observationIndex) {
  const payload = observation?.payload;
  if (payload?.message !== STREAM_ERROR) return false;
  const exchangeId = payload.turn_exchange_id;
  if (typeof exchangeId !== 'string' || !exchangeId) return false;

  const exchange = ensureExchange(state, exchangeId);
  exchange.error = {
    ...(exchange.error ?? {}),
    ...(typeof payload.request_code === 'string' ? { provider_code: payload.request_code } : {}),
    ...(Number.isFinite(payload.request_status) ? { status_code: payload.request_status } : {})
  };
  exchange.evidence.push(evidenceOf(observation, observationIndex, 'stream_error'));
  return true;
}

/**
 * Applies one telemetry stop/control observation to trace state only.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {Object<string, *>} observation - Provider observation envelope.
 * @param {number} observationIndex - Zero-based observation index.
 * @returns {boolean} True when the observation was recognized and applied.
 */
function applyStopControl(state, observation, observationIndex) {
  const payload = observation?.payload;
  if (!isStopControlMessage(payload?.message)) return false;
  const traceId = payload.turn_trace_id;
  if (typeof traceId !== 'string' || !traceId) return false;

  const trace = ensureTrace(state, traceId);
  trace.stop_requested = true;
  trace.evidence.push(evidenceOf(observation, observationIndex, 'stop_control'));
  return true;
}

/**
 * Applies one stream-status response as conversation transport/control state.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {Object<string, *>} observation - Provider observation envelope.
 * @param {number} observationIndex - Zero-based observation index.
 * @returns {boolean} True when the observation was recognized and applied.
 */
function applyStreamStatus(state, observation, observationIndex) {
  const conversationId = streamStatusConversationId(observation?.endpoint);
  if (!conversationId || typeof observation?.payload?.status !== 'string') return false;

  const conversation = ensureConversation(state, conversationId);
  conversation.stream_status = observation.payload.status;
  conversation.evidence.push(evidenceOf(observation, observationIndex, 'stream_status'));
  return true;
}

/**
 * Unwraps the two observed WebSocket conversation-event envelope forms.
 *
 * @param {Object<string, *>} payload - Provider-native WebSocket payload.
 * @returns {Object<string, *>|null} Conversation event payload, or null when not recognized.
 */
function unwrapConversationWebSocketEvent(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.type === 'conversation-update') return payload;
  if (payload.type === 'message' && payload.payload && typeof payload.payload === 'object') {
    return payload.payload;
  }
  return null;
}

/**
 * Applies an observed final Assistant message without treating it as an exchange outcome.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {Object<string, *>} message - Provider Assistant message.
 * @param {Object<string, *>} observation - Provider observation envelope.
 * @param {number} observationIndex - Zero-based observation index.
 * @returns {boolean} True when the message carried a correlated final Assistant observation.
 */
function applyFinalAssistantMessage(state, message, observation, observationIndex) {
  if (message?.author?.role !== 'assistant') return false;
  if (message?.channel !== 'final' || message?.end_turn !== true) return false;
  const exchangeId = message?.metadata?.turn_exchange_id ?? message?.metadata?.working_turn_id;
  if (typeof exchangeId !== 'string' || !exchangeId) return false;

  const exchange = ensureExchange(state, exchangeId);
  exchange.observed_final_assistant = true;
  exchange.evidence.push(evidenceOf(observation, observationIndex, 'final_assistant'));
  return true;
}

/**
 * Applies one recognized ChatGPT conversation WebSocket event.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {Object<string, *>} observation - Provider observation envelope.
 * @param {number} observationIndex - Zero-based observation index.
 * @returns {boolean} True when the WebSocket event was recognized and applied.
 */
function applyConversationWebSocketEvent(state, observation, observationIndex) {
  if (observation?.transport !== 'websocket') return false;
  const event = unwrapConversationWebSocketEvent(observation?.payload);
  if (!event) return false;

  if (event.type === 'conversation-turn-complete') {
    const conversationId = event?.payload?.conversation_id;
    if (typeof conversationId !== 'string' || !conversationId) return false;
    const conversation = ensureConversation(state, conversationId);
    conversation.conversation_turn_complete_observed = true;
    conversation.evidence.push(evidenceOf(observation, observationIndex, 'conversation_turn_complete'));
    return true;
  }

  if (event.type !== 'conversation-update') return false;
  const conversationId = event?.payload?.conversation_id;
  if (typeof conversationId !== 'string' || !conversationId) return false;
  const conversation = ensureConversation(state, conversationId);
  const updateType = event.payload.update_type;
  const updateContent = event.payload.update_content;

  if (updateType === 'set-conversation-async-status') {
    conversation.latest_async_status = updateContent?.conversation_async_status ?? null;
    conversation.evidence.push(evidenceOf(observation, observationIndex, 'conversation_async_status'));
    return true;
  }

  if (updateType === 'add-messages' && Array.isArray(updateContent?.messages)) {
    let handled = false;
    for (const message of updateContent.messages) {
      handled = applyFinalAssistantMessage(state, message, observation, observationIndex) || handled;
    }
    if (handled) {
      conversation.evidence.push(evidenceOf(observation, observationIndex, 'conversation_add_messages'));
    }
    return handled;
  }

  return false;
}

/**
 * Applies one provider-native ChatGPT-Web observation to retained Core state.
 *
 * Recognized evidence updates only the dimension it directly establishes. For
 * example, stop-control and stream-status observations do not manufacture an
 * exchange outcome, while a final Assistant remains message evidence until an
 * explicit provider outcome establishes exchange completion/failure/cancellation.
 *
 * @param {Object<string, *>} state - Retained ChatGPT-Web live provider state.
 * @param {Object<string, *>} observation - Thin host acquisition/provenance envelope containing the raw provider payload.
 * @param {number} [observationIndex=0] - Zero-based observation sequence index used for provenance.
 * @returns {Object<string, *>} The same retained state after applying the observation.
 */
export function applyChatGPTLiveObservation(state, observation, observationIndex = 0) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('ChatGPT live observation state must be an object.');
  }
  if (!observation || typeof observation !== 'object') {
    throw new TypeError('ChatGPT live observation must be an object.');
  }

  const handled = applyTurnExchangeComplete(state, observation, observationIndex) ||
    applyStreamError(state, observation, observationIndex) ||
    applyStopControl(state, observation, observationIndex) ||
    applyStreamStatus(state, observation, observationIndex) ||
    applyConversationWebSocketEvent(state, observation, observationIndex);

  if (!handled) {
    state.unhandled_observations.push({
      ...evidenceOf(observation, observationIndex, 'unhandled'),
      payload: observation.payload ?? null
    });
  }
  return state;
}

/**
 * Reduces provider-native ChatGPT-Web observations into retained canonical live state.
 *
 * @param {Array<Object<string, *>>} observations - Ordered provider observation envelopes captured by a host.
 * @param {Object<string, *>|null} [initialState=null] - Optional existing retained state for incremental continuation.
 * @returns {Object<string, *>} Reduced ChatGPT-Web live provider state.
 */
export function reduceChatGPTLiveObservations(observations, initialState = null) {
  if (!Array.isArray(observations)) {
    throw new TypeError('ChatGPT live observations must be an array.');
  }
  const state = initialState ?? createChatGPTLiveState();
  for (let index = 0; index < observations.length; index += 1) {
    applyChatGPTLiveObservation(state, observations[index], index);
  }
  return state;
}
