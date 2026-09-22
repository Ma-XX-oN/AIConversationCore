import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as core from '../src/index.js';

const fixtureUrl = new URL('./fixtures/chatgpt-live-lifecycle.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));

function scenario(name) {
  const found = fixture.scenarios.find((candidate) => candidate.name === name);
  assert.ok(found, `Missing fixture scenario: ${name}`);
  return found;
}

function replay(name) {
  assert.equal(
    typeof core.reduceChatGPTLiveObservations,
    'function',
    'AIConversationCore must expose the issue #34 ChatGPT-Web live observation reducer'
  );
  return core.reduceChatGPTLiveObservations(scenario(name).observations);
}

function exchange(state, exchangeId) {
  const found = state?.exchanges?.[exchangeId];
  assert.ok(found, `Missing exchange state: ${exchangeId}`);
  return found;
}

function conversation(state, conversationId) {
  const found = state?.conversations?.[conversationId];
  assert.ok(found, `Missing conversation state: ${conversationId}`);
  return found;
}

function trace(state, traceId) {
  const found = state?.traces?.[traceId];
  assert.ok(found, `Missing trace state: ${traceId}`);
  return found;
}

test('ordinary provider success produces completed exchange outcome', () => {
  const item = scenario('ordinary-initial-success');
  const state = replay(item.name);
  const actual = exchange(state, item.expected.exchange_id);

  assert.equal(actual.outcome, item.expected.outcome);
  assert.equal(
    actual.provider_reported_final_assistant,
    item.expected.provider_reported_final_assistant
  );
  assert.equal(actual.observed_final_assistant, item.expected.observed_final_assistant);
});

test('async exchange success remains distinct from later WebSocket final delivery', () => {
  const item = scenario('async-success-before-websocket-final');
  const state = replay(item.name);
  const actualExchange = exchange(state, item.expected.exchange_id);
  const actualConversation = conversation(state, item.expected.conversation_id);

  assert.equal(actualExchange.outcome, item.expected.outcome);
  assert.equal(
    actualExchange.provider_reported_final_assistant,
    item.expected.provider_reported_final_assistant
  );
  assert.equal(actualExchange.observed_final_assistant, item.expected.observed_final_assistant);
  assert.equal(
    actualConversation.conversation_turn_complete_observed,
    item.expected.conversation_turn_complete_observed
  );
  assert.equal(actualConversation.latest_async_status, item.expected.latest_async_status);
  assert.equal('work_complete' in actualExchange, false);
});

test('later exchange error overrides provisional final-message success evidence', () => {
  const item = scenario('final-assistant-does-not-prevent-later-exchange-failure');
  const state = replay(item.name);
  const actual = exchange(state, item.expected.exchange_id);

  assert.equal(actual.outcome, item.expected.outcome);
  assert.equal(
    actual.provider_reported_final_assistant,
    item.expected.provider_reported_final_assistant
  );
  assert.equal(actual.observed_final_assistant, item.expected.observed_final_assistant);
  assert.equal(actual.error?.reason, item.expected.error_reason);
  assert.equal(actual.error?.status_code, item.expected.error_status_code);
  assert.equal(actual.error?.provider_code, item.expected.provider_code);
});

test('explicit provider canceled outcome is distinct from stop control', () => {
  const item = scenario('explicit-user-stop-cancellation');
  const state = replay(item.name);
  const actualExchange = exchange(state, item.expected.exchange_id);
  const actualTrace = trace(state, item.expected.trace_id);

  assert.equal(actualExchange.outcome, item.expected.outcome);
  assert.equal(
    actualExchange.provider_reported_final_assistant,
    item.expected.provider_reported_final_assistant
  );
  assert.equal(actualTrace.stop_requested, item.expected.stop_requested);
});

test('stop-like control does not manufacture cancellation when provider later succeeds', () => {
  const item = scenario('stop-control-is-not-cancellation');
  const state = replay(item.name);
  const actualExchange = exchange(state, item.expected.exchange_id);
  const actualTrace = trace(state, item.expected.trace_id);

  assert.equal(actualExchange.outcome, item.expected.outcome);
  assert.equal(actualTrace.stop_requested, item.expected.stop_requested);
});

test('stream_status COMPLETE records transport state without inventing an exchange outcome', () => {
  const item = scenario('stream-status-complete-is-not-exchange-success');
  const state = replay(item.name);
  const actual = conversation(state, item.expected.conversation_id);

  assert.equal(actual.stream_status, item.expected.stream_status);
  assert.equal(Object.keys(state.exchanges).length, item.expected.exchange_count);
});

test('IS_STOP_REQUESTED records control/recovery state without inventing an exchange outcome', () => {
  const item = scenario('is-stop-requested-is-control-not-outcome');
  const state = replay(item.name);
  const actual = conversation(state, item.expected.conversation_id);

  assert.equal(actual.stream_status, item.expected.stream_status);
  assert.equal(Object.keys(state.exchanges).length, item.expected.exchange_count);
});
