import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getVersion } from '../src/index.js';

const packageUrl = new URL('../package.json', import.meta.url);

test('ESM version API matches the authoritative package version', async () => {
  const packageMetadata = JSON.parse(await readFile(packageUrl, 'utf8'));
  assert.equal(getVersion(), packageMetadata.version);
});
