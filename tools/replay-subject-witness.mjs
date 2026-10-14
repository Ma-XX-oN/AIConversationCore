#!/usr/bin/env node
// Replay only. Source authenticity must be independently checked.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadAgent, getAgentPluginArtifact } from '../src/index.js';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node tools/replay-subject-witness.mjs CAPTURE.json');
  process.exit(2);
}
const raw = await readFile(resolve(path));
if (raw.length > 524288) {
  console.error('Capture exceeds privacy-limited 512 KiB maximum');
  process.exit(2);
}
const capture = JSON.parse(raw.toString('utf8'));
assert.equal(capture.schema, 'aicc-subject-capture-v1');
assert.equal(capture.origin, 'https://chatgpt.com');
assert.ok(Array.isArray(capture.events) && capture.events.length > 0);
assert.ok(capture.events.length <= 2000);
const artifact = getAgentPluginArtifact('chatgpt-web');
const bytes = await readFile(
  new URL('../test/fixtures/provider-1.21.txt', import.meta.url));
assert.equal(bytes.length, artifact.byteLength);
const blob = createHash('sha1')
  .update(Buffer.from('blob ' + bytes.length + String.fromCharCode(0)))
  .update(bytes).digest('hex');
assert.equal(blob, artifact.gitBlobSha1);
assert.equal(capture.providerGitBlobSha1, artifact.gitBlobSha1);
const provider = await import('data:text/javascript;base64,' +
  bytes.toString('base64'));
const loaded = await loadAgent('chatgpt-web', {
  loadModule: async () => provider
});
const observed = [];
const unsubscribe = loaded.agent.observeState(
  snapshot => observed.push(snapshot), 'subject-identification');
let host = null;
let matchedResponses = 0;
let provenStandalone = 0;
let assertions = 0;
for (const [index, event] of capture.events.entries()) {
  assert.ok(event && typeof event === 'object' && !Array.isArray(event),
    'event ' + index + ' must be an object');
  switch (event.kind) {
    case 'begin':
      assert.equal(typeof event.conversationId, 'string');
      if (host == null) {
        host = provider.connectChatGPTSubjectHost({
          agent: loaded.agent, origin: capture.origin,
          conversationId: event.conversationId
        });
      } else {
        host.begin(event.conversationId);
      }
      break;
    case 'request': {
      assert.ok(host, 'begin must precede request');
      assert.equal(event.method, 'GET');
      assert.equal(typeof event.request_url, 'string');
      assert.equal(host.request({
        network_sequence: event.network_sequence,
        method: event.method,
        request_url: event.request_url
      }), true, 'rejected request at event ' + index);
      break;
    }
    case 'response': {
      assert.ok(host, 'begin must precede response');
      assert.equal(event.status, 200);
      assert.ok(event.body && typeof event.body === 'object');
      assert.ok(Object.keys(event.body).every(key =>
        ['conversation_id', 'title', 'gizmo_id', 'gizmo'].includes(key)),
      'response contains fields outside minimal identity whitelist');
      const accepted = host.response({
        network_sequence: event.network_sequence,
        status: event.status,
        body: event.body
      });
      assert.equal(typeof accepted, 'boolean');
      if (accepted) matchedResponses++;
      if (accepted && Object.hasOwn(event.body, 'gizmo_id') &&
          event.body.gizmo_id === null &&
          observed.at(-1).project.status === 'none') provenStandalone++;
      break;
    }
    case 'expect': {
      const value = observed.at(-1);
      assert.ok(value, 'missing latest subject snapshot');
      for (const field of ['readiness', 'conversation', 'project']) {
        assert.ok(Object.hasOwn(event, field));
        assert.deepEqual(value[field], event[field],
          'subject ' + field + ' mismatch at event ' + index);
      }
      assertions++;
      break;
    }
    default:
      throw new Error('unknown capture event kind at index ' + index);
  }
}
unsubscribe();
assert.ok(assertions > 0, 'capture must include observer expectations');
console.log(JSON.stringify({
  verdict: 'REPLAY_PASS',
  providerGitBlobSha1: blob,
  matchedResponses,
  provenStandaloneResponsesInCapture: provenStandalone,
  observerAssertions: assertions,
  liveSourceAuthenticity: 'UNVERIFIED'
}));
