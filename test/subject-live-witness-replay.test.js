import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAgentPluginArtifact } from '../src/plugins/loading.js';

test('privacy-minimal standalone witness replays but never asserts authenticity', () => {
  const root = mkdtempSync(join(tmpdir(), 'aicc127-witness-'));
  const capturePath = join(root, 'capture.json');
  try {
    const content = {
      schema: 'aicc-subject-capture-v1',
      origin: 'https://chatgpt.com',
      providerGitBlobSha1: getAgentPluginArtifact('chatgpt-web').gitBlobSha1,
      events: [
        { kind: 'begin', conversationId: 'C' },
        { kind: 'request', network_sequence: 1, method: 'GET',
          request_url: '/backend-api/conversations/C' },
        { kind: 'response', network_sequence: 1, status: 200,
          body: { conversation_id: 'C', title: 'Redacted', gizmo_id: null } },
        { kind: 'expect', readiness: 'resolved',
          conversation: { status: 'identified', id: 'C', name: 'Redacted' },
          project: { status: 'none', id: null, name: null } }
      ]
    };
    writeFileSync(capturePath, JSON.stringify(content));
    const result = spawnSync(process.execPath, [
      'tools/replay-subject-witness.mjs', capturePath
    ], { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    const replay = JSON.parse(result.stdout);
    assert.equal(replay.verdict, 'REPLAY_PASS');
    assert.equal(replay.provenStandaloneResponsesInCapture, 1);
    assert.equal(replay.liveSourceAuthenticity, 'UNVERIFIED');
    content.events[2].body = { conversation_id: 'C', title: 'Redacted' };
    writeFileSync(capturePath, JSON.stringify(content));
    const missing = spawnSync(process.execPath, [
      'tools/replay-subject-witness.mjs', capturePath
    ], { encoding: 'utf8', timeout: 15000 });
    assert.equal(missing.status, 1, 'missing membership must not match none');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
