import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertBundleVersion,
  buildReleasePlan,
  parseReleaseVersion
} from '../scripts/release-lib.mjs';

const packageUrl = new URL('../package.json', import.meta.url);
const browserBundleDocUrl = new URL('../BROWSER_BUNDLE.md', import.meta.url);

test('release versions are plain semantic versions and reject development qualifiers', () => {
  assert.equal(parseReleaseVersion('1.2.3'), '1.2.3');
  assert.throws(() => parseReleaseVersion('1.2.3-issue.102.1'), /plain semantic version/);
  assert.throws(() => parseReleaseVersion('v1.2.3'), /plain semantic version/);
  assert.throws(() => parseReleaseVersion('1.2'), /plain semantic version/);
});

test('release plan stages the version authority and artifact and atomically pushes commit plus tag', () => {
  assert.deepEqual(buildReleasePlan('1.2.3', 'main'), {
    version: '1.2.3',
    tag: 'v1.2.3',
    branch: 'main',
    commitMessage: 'release: v1.2.3',
    tagMessage: 'AIConversationCore v1.2.3',
    stagedPaths: [
      'package.json',
      'dist/aiconversationcore.chatgpt.browser.js'
    ],
    pushArgs: [
      'push',
      '--atomic',
      'origin',
      'HEAD:main',
      'refs/tags/v1.2.3'
    ]
  });
});

test('release bundle version must exactly equal the requested release version', () => {
  assert.doesNotThrow(() => assertBundleVersion('const VERSION = "1.2.3";\n', '1.2.3'));
  assert.throws(
    () => assertBundleVersion('const VERSION = "1.2.2";\n', '1.2.3'),
    /bundle version 1\.2\.2 does not match release version 1\.2\.3/
  );
  assert.throws(
    () => assertBundleVersion('no version here\n', '1.2.3'),
    /exactly one generated VERSION declaration/
  );
});

test('package wiring and durable browser-bundle documentation require the scripted release path', async () => {
  const packageMetadata = JSON.parse(await readFile(packageUrl, 'utf8'));
  const documentation = await readFile(browserBundleDocUrl, 'utf8');

  assert.equal(packageMetadata.scripts?.release, 'node scripts/release.mjs');
  assert.match(documentation, /npm run release -- <version>/);
  assert.match(documentation, /git push --atomic/);
  assert.match(documentation, /annotated `vX\.Y\.Z` tag/);
  assert.match(documentation, /Do not manually publish/);
});
