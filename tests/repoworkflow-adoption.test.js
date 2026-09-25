import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOWORKFLOW_SHA = '0a051ab09200ff2824e7c901d6fe0efa652a912a';

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

test('RepoWorkflow is pinned as the released v0.1.0 submodule', async () => {
  const modules = await readText('.gitmodules');
  assert.match(modules, /\[submodule "RepoWorkflow"\]/);
  assert.match(modules, /path = RepoWorkflow/);
  assert.match(modules, /url = https:\/\/github\.com\/Ma-XX-oN\/RepoWorkflow\.git/);
  const tree = execFileSync('git', ['ls-tree', 'HEAD', 'RepoWorkflow'], {
    cwd: root,
    encoding: 'utf8'
  }).trim();
  assert.equal(tree, `160000 commit ${REPOWORKFLOW_SHA}\tRepoWorkflow`);
});

test('Core declares the preserved required environment and browser artifact to RepoWorkflow', async () => {
  const config = await readJson('.ci/repoworkflow.json');
  assert.deepEqual(config, {
    schema: 1,
    versionCommand: ['python', 'scripts/workflow-version.py'],
    repository: {
      integrationBranch: 'main',
      authoritativeRemote: 'origin'
    },
    environments: [{
      id: 'ubuntu-node22-python313',
      required: true,
      platform: 'linux',
      capabilities: ['node-22', 'python-3.13'],
      validationCommand: ['python', 'scripts/repoworkflow-validate.py']
    }],
    artifacts: [{
      id: 'browser-bundle',
      generatorCommand: ['python', 'scripts/repoworkflow-build-browser.py'],
      verifierCommand: ['node', '--test', 'tests/browser-bundle.test.js'],
      outputs: ['dist/aiconversationcore.chatgpt.browser.js'],
      committed: true,
      platform: 'linux',
      capabilities: ['node-22']
    }]
  });
  await access(path.join(root, 'scripts/repoworkflow-build-browser.py'));
  assert.match(await readText('.gitignore'), /^node_modules\/$/m);
});

test('Core uses the canonical RepoWorkflow GitHub adapter and repository-owned hooks', async () => {
  await access(path.join(root, 'scripts/workflow-version.py'));
  await access(path.join(root, 'scripts/repoworkflow-validate.py'));
  const actual = await readText('.github/workflows/ci.yml');
  const canonical = await readText('RepoWorkflow/templates/github/ci.yml');
  assert.equal(actual, canonical);
});
