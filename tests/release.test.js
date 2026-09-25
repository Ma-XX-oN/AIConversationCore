import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertBundleVersion,
  assertPackageLockVersion,
  assertPackageVersion,
  buildPreparePlan,
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

test('release preparation changes only version authority, lock metadata, and artifact and never creates a tag', () => {
  assert.deepEqual(buildPreparePlan('1.2.3', 'issue-102-scripted-release-tags'), {
    version: '1.2.3',
    branch: 'issue-102-scripted-release-tags',
    commitMessage: 'release: prepare v1.2.3',
    stagedPaths: [
      'package.json',
      'package-lock.json',
      'dist/aiconversationcore.chatgpt.browser.js'
    ],
    pushArgs: [
      'push',
      'origin',
      'HEAD:issue-102-scripted-release-tags'
    ]
  });
  assert.throws(() => buildPreparePlan('1.2.3', 'main'), /issue branch/);
});

test('final release is main-only and atomically publishes main plus the annotated tag', () => {
  assert.deepEqual(buildReleasePlan('1.2.3', 'main'), {
    version: '1.2.3',
    tag: 'v1.2.3',
    branch: 'main',
    tagMessage: 'AIConversationCore v1.2.3',
    pushArgs: [
      'push',
      '--atomic',
      'origin',
      'HEAD:main',
      'refs/tags/v1.2.3'
    ]
  });
  assert.throws(() => buildReleasePlan('1.2.3', 'issue-102-scripted-release-tags'), /main/);
});

test('package, package-lock, and generated browser bundle must all equal the requested release version', () => {
  assert.doesNotThrow(() => assertPackageVersion('{"version":"1.2.3"}\n', '1.2.3'));
  assert.throws(
    () => assertPackageVersion('{"version":"1.2.2"}\n', '1.2.3'),
    /package version 1\.2\.2 does not match release version 1\.2\.3/
  );

  const lock = '{"version":"1.2.3","packages":{"":{"version":"1.2.3"}}}\n';
  assert.doesNotThrow(() => assertPackageLockVersion(lock, '1.2.3'));
  assert.throws(
    () => assertPackageLockVersion('{"version":"1.2.3","packages":{"":{"version":"1.2.2"}}}\n', '1.2.3'),
    /package-lock versions 1\.2\.3\/1\.2\.2 do not match release version 1\.2\.3/
  );

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

test('package wiring and durable documentation require prepare, close, merge, then tag', async () => {
  const packageMetadata = JSON.parse(await readFile(packageUrl, 'utf8'));
  const documentation = await readFile(browserBundleDocUrl, 'utf8');

  assert.equal(packageMetadata.scripts?.['release:prepare'], 'node scripts/prepare-release.mjs');
  assert.equal(packageMetadata.scripts?.release, 'node scripts/release.mjs');
  assert.match(documentation, /npm run release:prepare -- <version>/);
  assert.match(documentation, /package-lock\.json/);
  assert.match(documentation, /close the owning issue/i);
  assert.match(documentation, /merge.*`main`/i);
  assert.match(documentation, /npm run release -- <version>/);
  assert.match(documentation, /git push --atomic/);
  assert.match(documentation, /annotated `vX\.Y\.Z` tag/);
  assert.match(documentation, /Do not manually publish/);
});
