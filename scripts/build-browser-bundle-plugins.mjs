import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBrowserBundle as buildBaseBrowserBundle } from './build-browser-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'dist/aiconversationcore.chatgpt.browser.js');

function replaceOnce(text, search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`Plugin browser build could not find ${label}.`);
  if (text.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Plugin browser build found multiple ${label} matches.`);
  }
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

function removeImport(text, declaration, label) {
  return replaceOnce(text, `${declaration}\n`, '', `import ${label}`);
}

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
  return replaceOnce(
    result,
    'export class PluginCanonicalSession',
    'class PluginCanonicalSession',
    'PluginCanonicalSession export'
  ).trim();
}

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

export async function buildBrowserBundle() {
  const [base, sessionSource, registrySource] = await Promise.all([
    buildBaseBrowserBundle(),
    readFile(resolve(ROOT, 'src/session/plugin-canonical-session.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/plugins/registry.js'), 'utf8')
  ]);
  const session = pluginSessionBody(sessionSource);
  const registry = registryBody(registrySource);
  const objectMarker = '  global.AIConversationCore = Object.freeze({\n';
  let result = replaceOnce(
    base,
    objectMarker,
    `${session}\n\n${registry}\n\n${objectMarker}`,
    'AIConversationCore browser export object'
  );
  result = replaceOnce(
    result,
    '    getVersion,\n',
    '    getVersion,\n    AgentPluginRegistry,\n    PUBLIC_PI,\n    validateAgentPluginDescriptor,\n',
    'browser getVersion export'
  );
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = await buildBrowserBundle();
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, bundle, 'utf8');
}
