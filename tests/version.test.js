import test from 'node:test';
import assert from 'node:assert/strict';

import packageMetadata from '../package.json' with { type: 'json' };
import { getVersion } from '../src/index.js';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-issue\.\d+\.\d+)?$/;

test('package version follows the project version contract', () => {
  assert.match(packageMetadata.version, VERSION_PATTERN);
});

test('public getVersion reports the authoritative package version', () => {
  assert.equal(getVersion(), packageMetadata.version);
});
