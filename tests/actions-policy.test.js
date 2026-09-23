import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const checker = path.resolve(here, '..', 'scripts', 'check-actions-policy.mjs');
const repositoryRoot = path.resolve(here, '..');

function makeRoot(workflows) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-actions-policy-'));
  const dir = path.join(root, '.github', 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(workflows)) {
    fs.writeFileSync(path.join(dir, name), text);
  }
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [checker, root], { encoding: 'utf8' });
}

const readOnlyCi = `name: CI\npermissions:\n  contents: read\njobs:\n  test:\n    steps:\n      - run: node --test tests/actions-policy.test.js\n`;

const artifactWorkflow = `name: Build
on:
  push:
    paths:
      - '.github/workflows/**'
permissions:
  contents: read
jobs:
  actions-policy:
    permissions:
      contents: read
    steps:
      - run: node --test tests/actions-policy.test.js
  build-artifact:
    needs: actions-policy
    permissions:
      contents: write
    steps:
      - run: npm run build:browser
      - run: |
          unexpected="$(git diff --name-only -- . ':!dist/aiconversationcore.chatgpt.browser.js')"
          staged="$(git diff --cached --name-only)"
          test "$staged" = 'dist/aiconversationcore.chatgpt.browser.js'
          git add -- dist/aiconversationcore.chatgpt.browser.js
          git commit -m 'build: regenerate browser artifact'
          git push origin "HEAD:\${GITHUB_REF_NAME}"
`;

test('current repository workflow set satisfies the Actions policy', () => {
  const result = run(repositoryRoot);
  assert.equal(result.status, 0, result.stderr);
});

test('accepts permanent CI and the guarded generated browser artifact workflow', () => {
  const root = makeRoot({
    'ci.yml': readOnlyCi,
    'build-browser-artifact.yml': artifactWorkflow,
  });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('accepts approved read-only branch and phase validation workflows', () => {
  const root = makeRoot({
    'ci.yml': readOnlyCi,
    'branch-policy.yml': 'name: Branch policy\npermissions:\n  contents: read\njobs: {}\n',
    'phase8-validation.yml': 'name: Phase 8\npermissions:\n  contents: read\njobs: {}\n',
  });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects a missing permanent CI workflow', () => {
  const result = run(makeRoot({}));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing required permanent workflow/);
});

test('rejects any unexpected one-shot workflow file', () => {
  const root = makeRoot({
    'ci.yml': readOnlyCi,
    'turn-id-metadata-override.yml': 'name: one shot\njobs: {}\n',
  });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unexpected workflow file/);
});

test('rejects source-editing git commands from CI', () => {
  const root = makeRoot({
    'ci.yml': `name: CI\njobs:\n  policy:\n    steps:\n      - run: node --test tests/actions-policy.test.js\n  fix:\n    permissions:\n      contents: write\n    steps:\n      - run: git commit -am fix\n      - run: git push\n`,
  });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /direct repository mutation/);
});

test('rejects a browser artifact workflow that stages any other path', () => {
  const bad = artifactWorkflow.replace(
    'git add -- dist/aiconversationcore.chatgpt.browser.js',
    'git add -- src/index.js'
  );
  const root = makeRoot({ 'ci.yml': readOnlyCi, 'build-browser-artifact.yml': bad });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stages an unapproved path|must stage exactly/);
});

test('rejects repository-write permission from read-only policy workflows', () => {
  const root = makeRoot({
    'ci.yml': readOnlyCi,
    'branch-policy.yml': 'name: Branch policy\npermissions:\n  contents: write\njobs: {}\n',
  });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must remain read-only/);
});

test('rejects browser artifact publication without an Actions-policy dependency', () => {
  const bad = artifactWorkflow.replace('    needs: actions-policy\n', '');
  const root = makeRoot({ 'ci.yml': readOnlyCi, 'build-browser-artifact.yml': bad });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /gate the write-capable build job/);
});

test('rejects a browser artifact workflow that does not run on workflow changes', () => {
  const bad = artifactWorkflow.replace("      - '.github/workflows/**'\n", '');
  const root = makeRoot({ 'ci.yml': readOnlyCi, 'build-browser-artifact.yml': bad });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /trigger when workflow definitions change/);
});

test('accepts CI result-tag publication only through ci_contract.py finalize', () => {
  const root = makeRoot({
    'ci.yml': `name: CI\njobs:\n  policy:\n    steps:\n      - run: node --test tests/actions-policy.test.js\n  finalize:\n    permissions:\n      contents: write\n    steps:\n      - run: >-\n          python scripts/ci_contract.py finalize\n          --results-dir out\n          --tag --push\n`,
  });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});
