import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countLogicalLines,
  evaluateFileSizePolicy
} from '../scripts/file-size-policy-lib.mjs';

test('maintained file policy accepts exactly 500 lines', () => {
  assert.deepEqual(evaluateFileSizePolicy({
    path: 'src/example.js',
    lineCount: 500,
    maxLines: 500,
    legacyMaxLines: {}
  }), []);
});

test('maintained file policy rejects 501 ordinary lines', () => {
  assert.deepEqual(evaluateFileSizePolicy({
    path: 'src/example.js',
    lineCount: 501,
    maxLines: 500,
    legacyMaxLines: {}
  }), [
    'src/example.js: 501 lines exceeds maintained-file limit 500; split by responsibility'
  ]);
});

test('legacy ceiling allows existing oversized file without allowing growth', () => {
  const legacy = { 'src/legacy.js': 535 };
  assert.deepEqual(evaluateFileSizePolicy({
    path: 'src/legacy.js',
    lineCount: 535,
    maxLines: 500,
    legacyMaxLines: legacy
  }), []);
  assert.deepEqual(evaluateFileSizePolicy({
    path: 'src/legacy.js',
    lineCount: 536,
    maxLines: 500,
    legacyMaxLines: legacy
  }), [
    'src/legacy.js: 536 lines exceeds recorded legacy ceiling 535; split before growth'
  ]);
});

test('logical line counting ignores only the trailing newline', () => {
  assert.equal(countLogicalLines('one\ntwo\n'), 2);
  assert.equal(countLogicalLines('one\ntwo'), 2);
  assert.equal(countLogicalLines(''), 0);
});
