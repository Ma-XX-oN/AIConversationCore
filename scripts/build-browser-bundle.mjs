import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root used to resolve source modules and the generated browser bundle. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Generated browser-bundle path consumed by browser integrations. */
const OUTPUT = resolve(ROOT, 'dist/aiconversationcore.chatgpt.browser.js');

/**
 * Replaces exactly one expected source fragment while building the browser bundle.
 *
 * @param {string} text - Source text in which the replacement is made.
 * @param {string} search - Exact source fragment that must occur once.
 * @param {string} replacement - Replacement text to insert.
 * @param {string} label - Human-readable fragment name used in build errors.
 * @returns {string} Source text with exactly one expected fragment replaced.
 */
function replaceOnce(text, search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`Browser bundle build could not find ${label}.`);
  if (text.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Browser bundle build found multiple ${label} matches.`);
  }
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

/**
 * Removes one exact ESM import statement from a source module.
 *
 * @param {string} text - Complete UTF-8 ESM module source.
 * @param {string} importLine - Exact import statement without the trailing newline.
 * @returns {string} Module source with the requested import removed.
 */
function removeImport(text, importLine) {
  return replaceOnce(text, `${importLine}\n`, '', `import ${importLine}`);
}

/**
 * Converts exported declarations into local declarations for classic-script namespacing.
 *
 * @param {string} text - ESM source module after its imports have been removed.
 * @returns {string} Source with supported export declaration prefixes removed.
 */
function localizeExports(text) {
  return text
    .replaceAll('export async function ', 'async function ')
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ');
}

/**
 * Wraps one localized source module in an isolated namespace factory.
 *
 * @param {string} name - Generated local namespace variable name.
 * @param {string} body - Localized source module body.
 * @param {Array<string>} exports - Local declaration names returned by the namespace factory.
 * @param {Array<string>} parameters - Optional factory parameter names used to inject dependencies.
 * @param {Array<string>} argumentsList - Optional dependency expressions supplied to the factory.
 * @returns {string} Classic-script namespace factory source.
 */
function namespaceModule(name, body, exports, parameters = [], argumentsList = []) {
  if (parameters.length !== argumentsList.length) {
    throw new Error(`Browser bundle namespace ${name} dependency arity mismatch.`);
  }
  const parameterText = parameters.join(', ');
  const argumentText = argumentsList.join(', ');
  return `const ${name} = ((${parameterText}) => {\n${body.trim()}\n\n` +
    `  return Object.freeze({ ${exports.join(', ')} });\n` +
    `})(${argumentText});`;
}

/**
 * Builds the deterministic classic-script ChatGPT browser bundle from authoritative ESM sources.
 *
 * Browser hosts receive the same canonical presentation model, Markdown renderer,
 * HTML renderer, stylesheet/theme contract, and high-level renderConversation API
 * as ESM consumers. Provider-record adaptation in this ChatGPT-specific artifact
 * remains intentionally limited to ChatGPT; callers with canonical events may use
 * every renderer regardless of where those canonical events were obtained.
 *
 * @returns {Promise<string>} Promise resolving to the complete generated browser-bundle source text.
 */
export async function buildBrowserBundle() {
  const [
    baseSource,
    chatgptSource,
    markdownSource,
    styleSource,
    presentationSource,
    htmlSource,
    renderSource
  ] = await Promise.all([
    readFile(resolve(ROOT, 'src/adapters/chatgpt-base.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/adapters/chatgpt.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/markdown.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/style.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/presentation.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/html.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/render.js'), 'utf8')
  ]);

  const base = namespaceModule(
    'chatgptBaseModule',
    localizeExports(baseSource),
    ['adaptChatGPTRecords']
  );

  const chatgptLocalized = localizeExports(removeImport(
    chatgptSource,
    "import { adaptChatGPTRecords as adaptBaseChatGPTRecords } from './chatgpt-base.js';"
  ));
  const chatgpt = namespaceModule(
    'chatgptModule',
    chatgptLocalized,
    ['adaptChatGPTRecords'],
    ['adaptBaseChatGPTRecords'],
    ['chatgptBaseModule.adaptChatGPTRecords']
  );

  const markdown = namespaceModule(
    'markdownModule',
    localizeExports(markdownSource),
    ['renderCanonicalMarkdown']
  );

  const style = namespaceModule(
    'styleModule',
    localizeExports(styleSource),
    [
      'STYLE_ROLES',
      'configureProjectionTheme',
      'getDefaultProjectionTheme',
      'resetProjectionTheme',
      'resolveProjectionTheme'
    ]
  );

  const presentation = namespaceModule(
    'presentationModule',
    localizeExports(presentationSource),
    ['PRESENTATION_SCHEMA_VERSION', 'buildCanonicalPresentation']
  );

  let htmlLocalized = htmlSource;
  htmlLocalized = removeImport(
    htmlLocalized,
    "import { renderCanonicalMarkdown } from './markdown.js';"
  );
  htmlLocalized = removeImport(
    htmlLocalized,
    "import { buildCanonicalPresentation } from './presentation.js';"
  );
  htmlLocalized = removeImport(
    htmlLocalized,
    "import { resolveProjectionTheme, STYLE_ROLES } from './style.js';"
  );
  const html = namespaceModule(
    'htmlModule',
    localizeExports(htmlLocalized),
    ['markdownToHtml', 'renderCanonicalHtml', 'renderCanonicalStylesheet'],
    ['renderCanonicalMarkdown', 'buildCanonicalPresentation', 'resolveProjectionTheme', 'STYLE_ROLES'],
    [
      'markdownModule.renderCanonicalMarkdown',
      'presentationModule.buildCanonicalPresentation',
      'styleModule.resolveProjectionTheme',
      'styleModule.STYLE_ROLES'
    ]
  );

  let renderLocalized = renderSource;
  for (const importLine of [
    "import { adaptChatGPTRecords } from './adapters/chatgpt.js';",
    "import { adaptClaudeRecords } from './adapters/claude.js';",
    "import { adaptCodexRecords } from './adapters/codex.js';",
    "import { renderCanonicalMarkdown } from './projections/markdown.js';",
    "import { renderCanonicalHtml } from './projections/html.js';",
    "import { buildCanonicalPresentation } from './projections/presentation.js';"
  ]) {
    renderLocalized = removeImport(renderLocalized, importLine);
  }
  const render = namespaceModule(
    'renderModule',
    localizeExports(renderLocalized),
    ['RENDER_FORMATS', 'RENDER_INPUT_KINDS', 'renderConversation'],
    [
      'adaptChatGPTRecords',
      'adaptClaudeRecords',
      'adaptCodexRecords',
      'renderCanonicalMarkdown',
      'renderCanonicalHtml',
      'buildCanonicalPresentation'
    ],
    [
      'chatgptModule.adaptChatGPTRecords',
      'unsupportedBrowserProvider',
      'unsupportedBrowserProvider',
      'markdownModule.renderCanonicalMarkdown',
      'htmlModule.renderCanonicalHtml',
      'presentationModule.buildCanonicalPresentation'
    ]
  );

  return `// Generated by scripts/build-browser-bundle.mjs. Do not edit directly.\n` +
    `// Authoritative source modules are isolated below so helper names cannot collide.\n` +
    `(function bootstrapAIConversationCore(global) {\n` +
    `  'use strict';\n\n` +
    `  function unsupportedBrowserProvider() {\n` +
    `    throw new RangeError('This browser artifact adapts ChatGPT provider records only.');\n` +
    `  }\n\n` +
    `${base}\n\n` +
    `${chatgpt}\n\n` +
    `${markdown}\n\n` +
    `${style}\n\n` +
    `${presentation}\n\n` +
    `${html}\n\n` +
    `${render}\n\n` +
    `  global.AIConversationCore = Object.freeze({\n` +
    `    adaptChatGPTRecords: chatgptModule.adaptChatGPTRecords,\n` +
    `    renderCanonicalMarkdown: markdownModule.renderCanonicalMarkdown,\n` +
    `    STYLE_ROLES: styleModule.STYLE_ROLES,\n` +
    `    configureProjectionTheme: styleModule.configureProjectionTheme,\n` +
    `    getDefaultProjectionTheme: styleModule.getDefaultProjectionTheme,\n` +
    `    resetProjectionTheme: styleModule.resetProjectionTheme,\n` +
    `    resolveProjectionTheme: styleModule.resolveProjectionTheme,\n` +
    `    PRESENTATION_SCHEMA_VERSION: presentationModule.PRESENTATION_SCHEMA_VERSION,\n` +
    `    buildCanonicalPresentation: presentationModule.buildCanonicalPresentation,\n` +
    `    markdownToHtml: htmlModule.markdownToHtml,\n` +
    `    renderCanonicalHtml: htmlModule.renderCanonicalHtml,\n` +
    `    renderCanonicalStylesheet: htmlModule.renderCanonicalStylesheet,\n` +
    `    RENDER_FORMATS: renderModule.RENDER_FORMATS,\n` +
    `    RENDER_INPUT_KINDS: renderModule.RENDER_INPUT_KINDS,\n` +
    `    renderConversation: renderModule.renderConversation\n` +
    `  });\n` +
    `})(globalThis);\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = await buildBrowserBundle();
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, bundle, 'utf8');
}
