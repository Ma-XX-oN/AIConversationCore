import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory containing this repository-policy script. */
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
/** Default repository root used when no fixture root is supplied. */
const defaultRoot = path.resolve(scriptDir, '..');
/** Repository root whose workflow set is being validated. */
const root = path.resolve(process.argv[2] || defaultRoot);
/** Directory containing GitHub workflow definitions. */
const workflowDir = path.join(root, '.github', 'workflows');

/** Permanent workflow definitions that must always exist. */
const requiredWorkflows = new Set([
  '.github/workflows/ci.yml',
]);

/** Workflow definitions permitted during the RepoWorkflow migration. */
const allowedWorkflows = new Set([
  ...requiredWorkflows,
  '.github/workflows/build-browser-artifact.yml',
  '.github/workflows/branch-policy.yml',
  '.github/workflows/phase8-validation.yml',
]);

/** Legacy workflows that must remain incapable of repository writes. */
const readOnlyWorkflows = new Set([
  '.github/workflows/branch-policy.yml',
  '.github/workflows/phase8-validation.yml',
]);

/** Only tracked artifact the legacy browser publisher may modify. */
const browserArtifact = 'dist/aiconversationcore.chatgpt.browser.js';

/**
 * Records one Actions-policy failure while allowing all checks to run.
 *
 * @param {string} message - Human-readable policy violation.
 */
function fail(message) {
  console.error(`Actions policy violation: ${message}`);
  process.exitCode = 1;
}

/**
 * Reports whether a workflow grants repository write permission.
 *
 * @param {string} text - Complete workflow YAML.
 * @returns {boolean} True when contents write permission is declared.
 */
function hasContentsWrite(text) {
  return /^\s*contents:\s*write\s*$/m.test(text);
}

/**
 * Extracts direct Git mutation commands from workflow run lines.
 *
 * @param {string} text - Complete workflow YAML.
 * @returns {string[]} Direct add, commit, or push commands.
 */
function directGitMutations(text) {
  return text.split(/\r?\n/)
    .map((line) => line.trim().replace(/^-?\s*run:\s*/, ''))
    .filter((line) => /^git\s+(?:add|commit|push)\b/.test(line));
}

/**
 * Extracts direct mutating API commands from workflow run lines.
 *
 * @param {string} text - Complete workflow YAML.
 * @returns {string[]} Mutating gh or curl commands.
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
 * Identifies the canonical RepoWorkflow adapter by its invariant commands.
 *
 * @param {string} text - Complete workflow YAML.
 * @returns {boolean} True when the canonical lifecycle commands are present.
 */
function isCanonicalRepoWorkflow(text) {
  return text.includes('python RepoWorkflow/repo_workflow.py repository-policy')
    && text.includes('python RepoWorkflow/repo_workflow.py materialize-artifacts')
    && /python\s+RepoWorkflow\/repo_workflow\.py\s+(?:stable-)?finalize\b/.test(text);
}

/**
 * Validates either the canonical shared CI adapter or the legacy CI fixture.
 *
 * @param {string} text - Complete CI workflow YAML.
 */
function validateCi(text) {
  if (isCanonicalRepoWorkflow(text)) {
    if (mutatingApiCommands(text).length > 0) {
      fail('ci.yml contains a direct mutating GitHub/API command');
    }
    const mutations = directGitMutations(text);
    const allowedPush = 'git push origin "HEAD:${GITHUB_REF_NAME}"';
    for (const command of mutations) {
      if (command !== allowedPush) {
        fail(`ci.yml contains direct repository mutation: ${command}`);
      }
    }
    if (mutations.includes(allowedPush)
        && !text.includes('python RepoWorkflow/repo_workflow.py materialize-artifacts')) {
      fail('ci.yml branch push is not coupled to RepoWorkflow artifact materialization');
    }
    if (!hasContentsWrite(text)) {
      fail('canonical RepoWorkflow ci.yml must declare write permission for publication jobs');
    }
    if (!/python\s+RepoWorkflow\/repo_workflow\.py\s+materialize-artifacts\b/.test(text)) {
      fail('canonical RepoWorkflow ci.yml is missing the artifact materialization boundary');
    }
    if (!/python\s+RepoWorkflow\/repo_workflow\.py\s+(?:stable-)?finalize\b[\s\S]*?--tag\s+--push\b/m.test(text)) {
      fail('canonical RepoWorkflow ci.yml is missing the terminal-tag publication boundary');
    }
    return;
  }

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
 * Validates the temporary legacy browser-artifact publisher during migration.
 *
 * @param {string} text - Complete browser-artifact workflow YAML.
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
