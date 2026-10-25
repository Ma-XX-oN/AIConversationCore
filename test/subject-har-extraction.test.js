import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('HAR extractor preserves affirmative standalone and excludes secrets', () => {
  const root = mkdtempSync(join(tmpdir(), 'aicc127-har-'));
  const path = join(root, 'input.har');
  try {
    const conversation = { conversation_id: 'secret-cid',
      title: 'Sensitive title', gizmo_id: null,
      message_list: ['DO NOT EMIT'] };
    const project = { gizmo: { id: 'g-p-private',
      display: { name: 'Sensitive project' }, secret: 'DO NOT EMIT' } };
    const entry = (url, body) => ({
      request: { method: 'GET', url,
        headers: [{ name: 'authorization', value: 'SECRET_TOKEN' }] },
      response: { status: 200, content: { text: JSON.stringify(body) } }
    });
    writeFileSync(path, JSON.stringify({ log: { entries: [
      entry('https://chatgpt.com/backend-api/conversations/secret-cid',
        conversation),
      entry('https://chatgpt.com/backend-api/gizmos/g-p-private', project),
      entry('https://example.com/backend-api/conversations/secret-cid',
        conversation),
      entry('https://chatgpt.com/backend-api/conversations/%ZZ',
        conversation)
    ] } }));
    const result = spawnSync(process.execPath,
      ['tools/extract-subject-har.mjs', path],
      { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.evidence_class,
      'HAR_RESPONSE_CANDIDATES_NOT_OBSERVER_PROOF');
    assert.equal(output.affirmativeStandaloneResponses, 1);
    assert.equal(output.totalMatchingResponses, 2);
    assert.equal(output.entries[0].body.gizmo_id, null);
    assert.equal(output.entries[0].body.conversation_id, 'C1');
    assert.ok(!result.stdout.includes('secret-cid'));
    assert.ok(!result.stdout.includes('Sensitive'));
    assert.ok(!result.stdout.includes('SECRET_TOKEN'));
    assert.ok(!result.stdout.includes('DO NOT EMIT'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
