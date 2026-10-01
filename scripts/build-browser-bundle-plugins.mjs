import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBrowserBundle as buildBaseBrowserBundle } from './build-browser-bundle.mjs';

/** Repository root used to resolve source modules and the generated browser bundle. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Generated classic-script browser artifact consumed by browser integrations. */
const OUTPUT = resolve(ROOT, 'dist/aiconversationcore.chatgpt.browser.js');

/**
 * Replaces exactly one expected source fragment.
 *
 * @param {string} text - Complete source text.
 * @param {string} search - Exact fragment that must occur once.
 * @param {string} replacement - Replacement fragment.
 * @param {string} label - Human-readable diagnostic label.
 * @returns {string} Source with the required replacement applied.
 */
function replaceOnce(text, search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`Plugin browser build could not find ${label}.`);
  if (text.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Plugin browser build found multiple ${label} matches.`);
  }
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

/**
 * Removes one exact ESM import before embedding a module in the classic bundle.
 *
 * @param {string} text - Complete source text.
 * @param {string} declaration - Import declaration without trailing newline.
 * @param {string} label - Human-readable imported-symbol label.
 * @returns {string} Source without the requested import.
 */
function removeImport(text, declaration, label) {
  return replaceOnce(text, `${declaration}\n`, '', `import ${label}`);
}

/**
 * Rewrites Core's visibility-aware structured projection for classic-script use.
 *
 * @param {string} source - ESM structured-visibility source.
 * @returns {string} Classic-script local-function source.
 */
function structuredVisibilityBody(source) {
  let result = source;
  result = removeImport(
    result,
    "import { projectRevisionVisibility } from './revision-visibility.js';",
    'projectRevisionVisibility'
  );
  result = removeImport(
    result,
    "import { projectCanonicalConversation as projectBaseConversation } from './structured.js';",
    'projectBaseConversation'
  );
  result = result.replaceAll('projectBaseConversation', 'projectBaseConversationBrowser');
  return replaceOnce(
    result,
    'export function projectCanonicalConversation',
    'function projectVisibleConversation',
    'structured visibility projection export'
  ).trim();
}

/**
 * Rewrites the Core-owned plugin canonical session for classic-script use.
 *
 * @param {string} source - ESM plugin-session source.
 * @returns {string} Classic-script local-class source.
 */
function pluginSessionBody(source) {
  let result = source;
  result = removeImport(
    result,
    "import { renderCanonicalHtml } from '../projections/html-visibility.js';",
    'renderCanonicalHtml'
  );
  result = removeImport(
    result,
    "import { renderCanonicalMarkdown } from '../projections/markdown-visibility.js';",
    'renderCanonicalMarkdown'
  );
  result = removeImport(
    result,
    "import { projectCanonicalConversation } from '../projections/structured-visibility.js';",
    'projectCanonicalConversation'
  );
  result = replaceOnce(
    result,
    'return projectCanonicalConversation(this.#events, options);',
    'return projectVisibleConversation(this.#events, options);',
    'plugin session projection call'
  );
  return replaceOnce(
    result,
    'export class PluginCanonicalSession',
    'class PluginCanonicalSession',
    'PluginCanonicalSession export'
  ).trim();
}

/**
 * Rewrites the provider-neutral plugin registry for classic-script use.
 *
 * @param {string} source - ESM registry source.
 * @returns {string} Classic-script local-class/function source.
 */
function registryBody(source) {
  let result = source;
  result = removeImport(
    result,
    "import { deriveTurns } from '../derive/turns.js';",
    'deriveTurns'
  );
  result = removeImport(
    result,
    "import { PluginCanonicalSession } from '../session/plugin-canonical-session.js';",
    'PluginCanonicalSession'
  );
  result = replaceOnce(
    result,
    'export function validateAgentPluginDescriptor',
    'function validateAgentPluginDescriptor',
    'validateAgentPluginDescriptor export'
  );
  result = replaceOnce(
    result,
    'export class AgentPluginRegistry',
    'class AgentPluginRegistry',
    'AgentPluginRegistry export'
  );
  result = replaceOnce(result, '\nexport { PUBLIC_PI };\n', '\n', 'PUBLIC_PI export');
  return result.trim();
}

/**
 * Rewrites Core-owned agent plugin catalogue/loading for classic-script use.
 *
 * @param {string} source - ESM loading source.
 * @returns {string} Classic-script local-function source.
 */
function loadingBody(source) {
  let result = removeImport(
    source,
    "import { AgentPluginRegistry } from './registry.js';",
    'AgentPluginRegistry'
  );
  result = replaceOnce(
    result,
    'export function getAgentPluginArtifact',
    'function getAgentPluginArtifact',
    'getAgentPluginArtifact export'
  );
  result = replaceOnce(
    result,
    'export async function loadAgent',
    'async function loadAgent',
    'loadAgent export'
  );
  result = replaceOnce(
    result,
    '\nexport { AGENT_PLUGIN_CATALOG };\n',
    '\n',
    'AGENT_PLUGIN_CATALOG export'
  );
  return result.trim();
}

/**
 * Builds the browser artifact with provider-neutral plugin registry/session/loading.
 *
 * @returns {Promise<string>} Complete deterministic classic-script bundle source.
 */
export async function buildBrowserBundle() {
  const [
    baseSource,
    structuredVisibilitySource,
    sessionSource,
    registrySource,
    loadingSource
  ] = await Promise.all([
    buildBaseBrowserBundle(),
    readFile(resolve(ROOT, 'src/projections/structured-visibility.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/session/plugin-canonical-session.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/plugins/registry.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/plugins/loading.js'), 'utf8')
  ]);

  let base = replaceOnce(
    baseSource,
    'function projectCanonicalConversation(events) {',
    'function projectBaseConversationBrowser(events) {',
    'base structured projection function'
  );
  base = replaceOnce(
    base,
    'markdown: renderCanonicalMarkdown(events.map(withRenderProvenance))',
    'markdown: renderRevisionMarkdown(events.map(withRenderProvenance))',
    'base structured Markdown renderer'
  );

  const structuredVisibility = structuredVisibilityBody(structuredVisibilitySource);
  const session = pluginSessionBody(sessionSource);
  const registry = registryBody(registrySource);
  const loading = loadingBody(loadingSource);
  const objectMarker = '  global.AIConversationCore = Object.freeze({\n';
  let result = replaceOnce(
    base,
    objectMarker,
    `${structuredVisibility}\n\n${session}\n\n${registry}\n\n${loading}\n\n${objectMarker}`,
    'AIConversationCore browser export object'
  );
  result = replaceOnce(
    result,
    '    getVersion,\n',
    '    getVersion,\n    AgentPluginRegistry,\n    PUBLIC_PI,\n    validateAgentPluginDescriptor,\n    getAgentPluginArtifact,\n    loadAgent,\n',
    'browser getVersion export'
  );
  result = replaceOnce(
    result,
    '    projectCanonicalConversation\n',
    '    projectCanonicalConversation: projectVisibleConversation\n',
    'browser structured projection export'
  );
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = await buildBrowserBundle();
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, bundle, 'utf8');
}
