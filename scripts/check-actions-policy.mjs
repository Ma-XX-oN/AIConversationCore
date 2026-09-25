import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Directory containing this Actions-policy validation script.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// Repository root used when no explicit validation root is supplied.
const defaultRoot = path.resolve(scriptDir, '..');
// Repository root whose workflow files are validated.
const root = path.resolve(process.argv[2] || defaultRoot);
// Workflow directory covered by the Actions policy.
const workflowDir = path.join(root, '.github', 'workflows');

// Permanent workflow files that must always exist.
const requiredWorkflows = new Set([
  '.github/workflows/ci.yml',
]);

// Complete allow-list of workflow files permitted by repository policy.
const allowedWorkflows = new Set([
  ...requiredWorkflows,
  '.github/workflows/build-browser-artifact.yml',
  '.github/workflows/branch-policy.yml',
  '.github/workflows/phase8-validation.yml',
]);

// Workflows that must never receive repository-write capabilities.
const readOnlyWorkflows = new Set([
  '.github/workflows/branch-policy.yml',
  '.github/workflows/phase8-validation.yml',
]);

// Sole generated browser artifact that the publisher may mutate.
const browserArtifact = 'dist/aiconversationcore.chatgpt.browser.js';

/**
 * Records one Actions-policy violation and marks validation as failed.
 *
 * @param {string} message - Human-readable policy violation to report.
 * @returns {void} This function does not return a value.
 */
function fail(message) {
  console.error(`Actions policy violation: ${message}`);
  process.exitCode = 1;
}

/**
 * Reports whether workflow text grants repository contents write permission.
 *
 * @param {string} text - Complete workflow YAML text to inspect.
 * @returns {boolean} Whether the workflow grants `contents: write`.
 */
function hasContentsWrite(text) {
  return /^\s*contents:\s*write\s*$/m.test(text);
}

/**
 * Extracts direct Git repository mutation commands from workflow text.
 *
 * @param {string} text - Complete workflow YAML text to inspect.
 * @returns {Array<string>} Direct `git add`, `git commit`, and `git push` commands.
 */
function directGitMutations(text) {
  return text.split(/\r?\n/)
    .map((line) => line.trim().replace(/^-?\s*run:\s*/, ''))
    .filter((line) => /^git\s+(?:add|commit|push)\b/.test(line));
}

/**
 * Extracts direct mutating GitHub or generic HTTP API commands from workflow text.
 *
 * @param {string} text - Complete workflow YAML text to inspect.
 * @returns {Array<string>} Mutating `gh api` or `curl` commands found in the workflow.
 */
function mutatingApiCommands(text) {
  return text.split(/\r?\n/)
    .map((line) => line.trim().replace(/^-?\s*run:\s*/, ''))
    .filter((line) => (
      /^gh\s+api\b.*(?:--method|-X)\s+(?:POST|PUT|PATCH|DELETE)\b/i.test(line)
      || /^curl\b.*(?:-X|--request)\s+(?:POST|PUT|PATCH|DELETE)\b/i.test(line)
    ));
}

/**
 * Validates the permanent CI workflow against repository mutation policy.
 *
 * @param {string} text - Complete `ci.yml` workflow text to validate.
 * @returns {void} This function reports violations through the shared failure path.
 */
function validateCi(text) {
  if (!text.includes('node --test tests/actions-policy.test.js')) {
    fail('ci.yml must run the Actions policy regression before validation');
  }
  const mutations = directGitMutations(text);
  if (mutations.length > 0) {
    fail(`ci.yml contains direct repository mutation: ${mutations.join(' | ')}`);
  }
  if (mutatingApiCommands(text).length > 0) {
    fail('ci.yml contains a direct mutating GitHub/API command');
  }
  if (hasContentsWrite(text)) {
    if (!/python\s+scripts\/ci_contract\.py\s+finalize\b[\s\S]*?--tag\s+--push\b/m.test(text)) {
      fail('ci.yml grants contents: write without the approved ci_contract.py result-tag publication path');
    }
  }
}

/**
 * Validates the generated browser-artifact publisher against repository policy.
 *
 * @param {string} text - Complete browser-artifact workflow text to validate.
 * @returns {void} This function reports violations through the shared failure path.
 */
function validateBrowserArtifact(text) {
  if (!text.includes("- '.github/workflows/**'")) {
    fail('build-browser-artifact.yml must trigger when workflow definitions change');
  }
  if (!text.includes('node --test tests/actions-policy.test.js')) {
    fail('build-browser-artifact.yml must run the Actions policy regression before publication');
  }
  if (!/^permissions:\n  contents:\s*read\s*$/m.test(text)) {
    fail('build-browser-artifact.yml must default to read-only repository permission');
  }
  if (!/build-artifact:\n\s+needs:\s*actions-policy\b[\s\S]*?permissions:\n\s+contents:\s*write\s*$/m.test(text)) {
    fail('build-browser-artifact.yml must gate the write-capable build job on actions-policy');
  }
  if (!hasContentsWrite(text)) {
    fail('build-browser-artifact.yml must declare contents: write for generated artifact publication');
  }
  if (mutatingApiCommands(text).length > 0) {
    fail('build-browser-artifact.yml contains a direct mutating GitHub/API command');
  }
  if (!text.includes('npm run build:browser')) {
    fail('build-browser-artifact.yml must build through the repository-owned browser build command');
  }
  const exclusion = `':!${browserArtifact}'`;
  if (!text.includes(exclusion)) {
    fail(`build-browser-artifact.yml must reject mutations outside ${browserArtifact}`);
  }
  const stagedGuard = `test "$staged" = '${browserArtifact}'`;
  if (!text.includes(stagedGuard)) {
    fail(`build-browser-artifact.yml must verify the staged path is exactly ${browserArtifact}`);
  }
  const mutations = directGitMutations(text);
  const allowedAdd = `git add -- ${browserArtifact}`;
  for (const command of mutations) {
    if (command.startsWith('git add') && command !== allowedAdd) {
      fail(`build-browser-artifact.yml stages an unapproved path: ${command}`);
    }
    if (command.startsWith('git push') && !command.includes('HEAD:${GITHUB_REF_NAME}')) {
      fail(`build-browser-artifact.yml uses an unapproved push target: ${command}`);
    }
  }
  if (!mutations.includes(allowedAdd)) {
    fail(`build-browser-artifact.yml must stage exactly ${browserArtifact}`);
  }
  if (!mutations.some((command) => command.startsWith('git commit '))) {
    fail('build-browser-artifact.yml must commit the generated artifact before publication');
  }
  if (!mutations.some((command) => command.startsWith('git push '))) {
    fail('build-browser-artifact.yml must publish the generated artifact commit');
  }
}

if (!fs.existsSync(workflowDir)) {
  fail('missing .github/workflows directory');
} else {
  const names = fs.readdirSync(workflowDir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
  const paths = new Set(names.map((name) => `.github/workflows/${name}`));

  for (const required of requiredWorkflows) {
    if (!paths.has(required)) fail(`missing required permanent workflow ${required}`);
  }

  for (const name of names) {
    const relativePath = `.github/workflows/${name}`;
    const text = fs.readFileSync(path.join(workflowDir, name), 'utf8');

    if (!allowedWorkflows.has(relativePath)) {
      fail(`unexpected workflow file ${relativePath}`);
      continue;
    }

    if (readOnlyWorkflows.has(relativePath)) {
      if (hasContentsWrite(text)) fail(`${relativePath} must remain read-only`);
      if (directGitMutations(text).length > 0 || mutatingApiCommands(text).length > 0) {
        fail(`${relativePath} contains repository mutation commands despite being read-only`);
      }
      continue;
    }

    if (relativePath.endsWith('/ci.yml')) validateCi(text);
    if (relativePath.endsWith('/build-browser-artifact.yml')) validateBrowserArtifact(text);
  }
}
