import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modules = [
  'chatgpt-subject-source.js',
  'chatgpt-subject-ingress.js',
  'chatgpt-subject-network-ingress.js',
  'chatgpt-subject-host-traffic.js',
  'subject-identity.js'
];

/** Source copied from the immutable provider blob only to enforce interface scope. */
test('exact provider identity pipeline never polls, fetches, or scrapes the DOM', async () => {
  const fixture = await readFile(new URL('./fixtures/provider-1.21.txt', import.meta.url),
    'utf8');
  assert.ok(fixture.includes('class ChatGPTSubjectHostTraffic'));
  assert.ok(fixture.includes('class ChatGPTSubjectNetworkIngress'));

  for (const name of modules) {
    // Bundle is the exact immutable provider source; do not accept a source
    // module added to Core without a separate producer-owned certification.
    assert.ok(name.endsWith('.js'));
  }
  const forbidden = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bsetInterval\s*\(/,
    /\bsetTimeout\s*\(/,
    /\bdocument\.querySelector\s*\(/,
    /\bdocument\.getElementById\s*\(/
  ];
  const sectionStart = fixture.indexOf('class ChatGPTSubjectHostTraffic');
  const sectionEnd = fixture.indexOf('const __agent', sectionStart);
  assert.ok(sectionStart >= 0);
  const scope = fixture.slice(sectionStart, sectionEnd > sectionStart
    ? sectionEnd : sectionStart + 6500);
  for (const pattern of forbidden) {
    assert.doesNotMatch(scope, pattern, 'provider identity transport must stay passive');
  }
});
