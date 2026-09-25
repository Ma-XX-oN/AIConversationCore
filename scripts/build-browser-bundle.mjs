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
 * @param {string} text - The source text in which the replacement is made.
 * @param {string} search - The exact source fragment that must occur once.
 * @param {string} replacement - The replacement text to insert.
 * @param {string} label - The human-readable fragment name used in build errors.
 * @returns {string} The source text with exactly one expected fragment replaced.
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
 * Converts one single-export ESM module into a local-function browser body.
 *
 * @param {string} text - Complete UTF-8 ESM module source.
 * @param {Object<string, string|null>} options - Import/export rewriting options.
 * @param {string|null} [options.importLine=null] - Exact import line to remove.
 * @param {string} options.exportedFunction - Exported function name in the ESM source.
 * @param {string} options.localFunction - Local function name to emit.
 * @returns {string} Rewritten classic-script module body.
 */
function moduleBody(text, { importLine = null, exportedFunction, localFunction }) {
  let result = text;
  if (importLine) result = replaceOnce(result, `${importLine}\n\n`, '', 'module import');
  result = replaceOnce(
    result,
    `export function ${exportedFunction}`,
    `function ${localFunction}`,
    `${exportedFunction} export`
  );
  return result.trim();
}

/**
 * Converts a multi-export ESM module into a local classic-script body.
 *
 * @param {string} text - Complete UTF-8 ESM module source.
 * @param {Object<string, *>} options - Import and export rewriting options.
 * @param {Array<string>} [options.importLines=[]] - Exact import lines to remove.
 * @param {Array<string>} [options.exportedFunctions=[]] - Exported function names to localize.
 * @param {Array<string>} [options.exportedConsts=[]] - Exported const names to localize.
 * @returns {string} Rewritten classic-script module body.
 */
function multiExportModuleBody(text, {
  importLines = [],
  exportedFunctions = [],
  exportedConsts = []
} = {}) {
  let result = text;
  for (const importLine of importLines) {
    result = replaceOnce(result, `${importLine}\n\n`, '', `${importLine} import`);
  }
  for (const name of exportedFunctions) {
    result = replaceOnce(
      result,
      `export function ${name}`,
      `function ${name}`,
      `${name} export`
    );
  }
  for (const name of exportedConsts) {
    result = replaceOnce(
      result,
      `export const ${name}`,
      `const ${name}`,
      `${name} export`
    );
  }
  return result.trim();
}

/**
 * Builds the deterministic classic-script ChatGPT browser bundle from canonical ESM sources.
 *
 * @returns {Promise<string>} A promise resolving to the complete generated browser-bundle source text.
 */
export async function buildBrowserBundle() {
  const [
    baseSource,
    chatgptSource,
    styleSource,
    headingMetadataSource,
    markdownSource,
    markdownHeadingSource,
    packageSource
  ] = await Promise.all([
    readFile(resolve(ROOT, 'src/adapters/chatgpt-base.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/adapters/chatgpt.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/style.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/heading-metadata.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/markdown.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/markdown-heading.js'), 'utf8'),
    readFile(resolve(ROOT, 'package.json'), 'utf8')
  ]);
  const version = JSON.parse(packageSource).version;
  if (typeof version !== 'string' || !version) {
    throw new Error('AIConversationCore package.json must contain a non-empty version string.');
  }

  const base = moduleBody(baseSource, {
    exportedFunction: 'adaptChatGPTRecords',
    localFunction: 'adaptBaseChatGPTRecords'
  });
  const chatgpt = moduleBody(chatgptSource, {
    importLine: "import { adaptChatGPTRecords as adaptBaseChatGPTRecords } from './chatgpt-base.js';",
    exportedFunction: 'adaptChatGPTRecords',
    localFunction: 'adaptChatGPTRecords'
  });
  const style = multiExportModuleBody(styleSource, {
    exportedFunctions: [
      'getDefaultProjectionTheme',
      'configureProjectionTheme',
      'resetProjectionTheme',
      'resolveProjectionTheme'
    ],
    exportedConsts: ['STYLE_ROLES']
  });
  const headingMetadata = multiExportModuleBody(headingMetadataSource, {
    importLines: ["import { STYLE_ROLES } from './style.js';"],
    exportedFunctions: [
      'resolveHeadingPolicy',
      'formatHeadingTimestamp',
      'deriveHeadingMetadata',
      'withCoreHeadingMetadata',
      'headingMetadataComponents',
      'renderHeadingDebugComment'
    ]
  });
  const markdown = moduleBody(markdownSource, {
    importLine: "import { renderHeadingDebugComment } from './heading-metadata.js';",
    exportedFunction: 'renderCanonicalMarkdown',
    localFunction: 'renderBaseMarkdown'
  });
  const markdownHeading = multiExportModuleBody(markdownHeadingSource, {
    importLines: [
      "import { withCoreHeadingMetadata } from './heading-metadata.js';",
      "import { renderCanonicalMarkdown as renderBaseMarkdown } from './markdown.js';"
    ],
    exportedFunctions: ['renderCanonicalMarkdown']
  });

  return `// Generated by scripts/build-browser-bundle.mjs. Do not edit directly.\n` +
    `// Source modules:\n` +
    `// - src/adapters/chatgpt-base.js\n` +
    `// - src/adapters/chatgpt.js\n` +
    `// - src/projections/style.js\n` +
    `// - src/projections/heading-metadata.js\n` +
    `// - src/projections/markdown.js\n` +
    `// - src/projections/markdown-heading.js\n` +
    `// Version source: package.json\n` +
    `(function bootstrapAIConversationCore(global) {\n` +
    `  'use strict';\n\n` +
    `const VERSION = ${JSON.stringify(version)};\n\n` +
    `/**\n` +
    ` * Returns the authoritative AIConversationCore version.\n` +
    ` *\n` +
    ` * @returns {string} The authoritative AIConversationCore version.\n` +
    ` */\n` +
    `function getVersion() {\n` +
    `  return VERSION;\n` +
    `}\n\n` +
    `${base}\n\n` +
    `${chatgpt}\n\n` +
    `${style}\n\n` +
    `${headingMetadata}\n\n` +
    `${markdown}\n\n` +
    `${markdownHeading}\n\n` +
    `  global.AIConversationCore = Object.freeze({\n` +
    `    getVersion,\n` +
    `    adaptChatGPTRecords,\n` +
    `    renderCanonicalMarkdown\n` +
    `  });\n` +
    `})(globalThis);\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = await buildBrowserBundle();
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, bundle, 'utf8');
}
