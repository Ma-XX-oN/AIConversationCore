#!/usr/bin/env node
// Privacy-minimal offline HAR candidate extraction. No network requests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.argv.length !== 3) {
  console.error('Usage: node tools/extract-subject-har.mjs DECOMPRESSED.har');
  process.exit(2);
}
const raw = await readFile(resolve(process.argv[2]), 'utf8');
const har = JSON.parse(raw);
assert.ok(Array.isArray(har?.log?.entries), 'HAR log.entries is required');
const conversationIds = new Map();
const projectIds = new Map();
const conversationTitles = new Map();
const projectTitles = new Map();
const pseudonym = (map, rawValue, prefix) => {
  if (!map.has(rawValue)) map.set(rawValue, prefix + (map.size + 1));
  return map.get(rawValue);
};
const entries = [];
let affirmativeStandalone = 0;
let missingPayloads = 0;
for (const record of har.log.entries) {
  if (record?.request?.method !== 'GET' || record.response?.status !== 200)
    continue;
  let url;
  try { url = new URL(record.request.url); } catch { continue; }
  if (url.origin !== 'https://chatgpt.com') continue;
  const matchConversation = url.pathname.match(
    /^\/backend-api\/conversations\/([^/]+)$/);
  const matchProject = url.pathname.match(
    /^\/backend-api\/gizmos\/(g-p-[^/]+)$/);
  if (!matchConversation && !matchProject) continue;
  const content = record.response?.content;
  if (typeof content?.text !== 'string') {
    missingPayloads++;
    continue;
  }
  let data;
  try {
    const text = content.encoding === 'base64'
      ? Buffer.from(content.text, 'base64').toString('utf8')
      : content.text;
    data = JSON.parse(text);
  } catch {
    missingPayloads++;
    continue;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
  if (matchConversation) {
    if (typeof data.conversation_id !== 'string' ||
        data.conversation_id !== decodeURIComponent(matchConversation[1]))
      continue;
    const id = pseudonym(conversationIds, data.conversation_id, 'C');
    const body = { conversation_id: id };
    if (Object.hasOwn(data, 'title')) {
      body.title = typeof data.title === 'string'
        ? pseudonym(conversationTitles, data.title, 'TITLE')
        : null;
    }
    if (Object.hasOwn(data, 'gizmo_id')) {
      if (data.gizmo_id === null) {
        body.gizmo_id = null;
        affirmativeStandalone++;
      } else if (typeof data.gizmo_id === 'string' &&
                 data.gizmo_id.startsWith('g-p-')) {
        body.gizmo_id = pseudonym(projectIds, data.gizmo_id, 'g-p-P');
      }
    }
    entries.push({
      endpoint_class: 'conversation',
      request_url: '/backend-api/conversations/' + id,
      status: 200, body
    });
    continue;
  }
  const gizmo = data?.gizmo;
  if (typeof gizmo?.id !== 'string' ||
      gizmo.id !== decodeURIComponent(matchProject[1]) ||
      typeof gizmo?.display?.name !== 'string') continue;
  const id = pseudonym(projectIds, gizmo.id, 'g-p-P');
  entries.push({
    endpoint_class: 'project',
    request_url: '/backend-api/gizmos/' + id,
    status: 200, body: { gizmo: {
      id, display: { name: pseudonym(projectTitles, gizmo.display.name, 'PROJECT') }
    } }
  });
}
console.log(JSON.stringify({
  schema: 'aicc-subject-har-candidates-v1',
  evidence_class: 'HAR_RESPONSE_CANDIDATES_NOT_OBSERVER_PROOF',
  totalMatchingResponses: entries.length,
  affirmativeStandaloneResponses: affirmativeStandalone,
  missingResponsePayloads: missingPayloads,
  entries
}, null, 2));
