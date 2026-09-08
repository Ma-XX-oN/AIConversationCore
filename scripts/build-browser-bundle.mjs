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
 * Converts one ESM source module into the local-function body used by the classic-script browser bundle.
 *
 * @param {string} text - The complete UTF-8 ESM module source.
 * @param {Object<string, *>} options - Export/import rewriting options.
 * @param {Array<string>} [options.importLines=[]] - Exact import lines to remove.
 * @param {string} options.exportedFunction - The exported function name present in the ESM source.
 * @param {string} options.localFunction - The local function name to emit in the classic-script bundle.
 * @returns {string} The rewritten local-function module body used by the generated browser bundle.
 */
function moduleBody(text, {
  importLines = [],
  exportedFunction,
  localFunction
}) {
  let result = text;
  for (const importLine of importLines) {
    result = replaceOnce(result, `${importLine}\n`, '', `module import ${importLine}`);
  }
  result = replaceOnce(
    result,
    `export function ${exportedFunction}`,
    `function ${localFunction}`,
    `${exportedFunction} export`
  );
  return result.trim();
}

/**
 * Converts an ESM helper module with multiple named function exports into a
 * classic-script local-function body without copying the helper semantics into
 * the bundle generator itself.
 *
 * @param {string} text - Complete UTF-8 ESM module source.
 * @param {Array<string>} exportedFunctions - Named function exports to localize.
 * @returns {string} Rewritten local-function module body.
 */
function multiExportModuleBody(text, exportedFunctions) {
  let result = text;
  for (const functionName of exportedFunctions) {
    result = replaceOnce(
      result,
      `export function ${functionName}`,
      `function ${functionName}`,
      `${functionName} export`
    );
  }
  return result.trim();
}

/**
 * Builds the deterministic classic-script ChatGPT browser bundle from the canonical ESM sources.
 *
 * @returns {Promise<string>} A promise resolving to the complete generated browser-bundle source text.
 */
export async function buildBrowserBundle() {
  const [
    markedSource,
    baseSource,
    chatgptSource,
    turnsSource,
    markdownSource,
    presentationSource,
    revisionVisibilitySource,
    presentationRevisionsSource,
    htmlSource,
    structuredSource
  ] = await Promise.all([
    readFile(resolve(ROOT, 'node_modules/marked/lib/marked.umd.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/adapters/chatgpt-base.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/adapters/chatgpt.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/derive/turns.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/markdown.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/presentation.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/revision-visibility.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/presentation-revisions.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/html.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/projections/structured.js'), 'utf8')
  ]);

  const base = moduleBody(baseSource, {
    exportedFunction: 'adaptChatGPTRecords',
    localFunction: 'adaptBaseChatGPTRecords'
  });
  const chatgpt = moduleBody(chatgptSource, {
    importLines: [
      "import { adaptChatGPTRecords as adaptBaseChatGPTRecords } from './chatgpt-base.js';"
    ],
    exportedFunction: 'adaptChatGPTRecords',
    localFunction: 'adaptChatGPTRecords'
  });
  const turns = moduleBody(turnsSource, {
    exportedFunction: 'deriveTurns',
    localFunction: 'deriveTurns'
  });
  const markdown = moduleBody(markdownSource, {
    exportedFunction: 'renderCanonicalMarkdown',
    localFunction: 'renderCanonicalMarkdown'
  });
  const presentation = moduleBody(presentationSource, {
    exportedFunction: 'buildCanonicalPresentation',
    localFunction: 'buildBasePresentation'
  });
  const revisionVisibility = multiExportModuleBody(revisionVisibilitySource, [
    'isHistoricalRevision',
    'isEventProjectionVisible',
    'projectRevisionVisibility'
  ]);
  const presentationRevisions = moduleBody(presentationRevisionsSource, {
    importLines: [
      "import { buildCanonicalPresentation as buildBasePresentation } from './presentation.js';",
      "import { isHistoricalRevision } from './revision-visibility.js';"
    ],
    exportedFunction: 'buildCanonicalPresentation',
    localFunction: 'buildCanonicalPresentation'
  });
  const html = moduleBody(htmlSource, {
    importLines: [
      "import { marked } from 'marked';",
      "import { buildCanonicalPresentation } from './presentation-revisions.js';"
    ],
    exportedFunction: 'renderCanonicalHtml',
    localFunction: 'renderCanonicalHtml'
  });
  const structured = moduleBody(structuredSource, {
    importLines: [
      "import { deriveTurns } from '../derive/turns.js';",
      "import { renderCanonicalMarkdown } from './markdown-revisions.js';",
      "import { buildCanonicalPresentation } from './presentation-revisions.js';"
    ],
    exportedFunction: 'projectCanonicalConversation',
    localFunction: 'projectCanonicalConversation'
  });

  return `// Generated by scripts/build-browser-bundle.mjs. Do not edit directly.\n` +
    `// Includes marked 18.0.11 (MIT) for Core-owned Markdown-to-HTML rendering.\n` +
    `${markedSource.trim()}\n` +
    `// AIConversationCore source modules:\n` +
    `// - src/adapters/chatgpt-base.js\n` +
    `// - src/adapters/chatgpt.js\n` +
    `// - src/derive/turns.js\n` +
    `// - src/projections/markdown.js\n` +
    `// - src/projections/presentation.js\n` +
    `// - src/projections/revision-visibility.js\n` +
    `// - src/projections/presentation-revisions.js\n` +
    `// - src/projections/html.js\n` +
    `// - src/projections/structured.js\n` +
    `(function bootstrapAIConversationCore(global) {\n` +
    `  'use strict';\n\n` +
    `${base}\n\n` +
    `${chatgpt}\n\n` +
    `${turns}\n\n` +
    `${markdown}\n\n` +
    `${presentation}\n\n` +
    `${revisionVisibility}\n\n` +
    `${presentationRevisions}\n\n` +
    `${html}\n\n` +
    `${structured}\n\n` +
    `  global.AIConversationCore = Object.freeze({\n` +
    `    adaptChatGPTRecords,\n` +
    `    renderCanonicalMarkdown,\n` +
    `    renderCanonicalHtml,\n` +
    `    buildCanonicalPresentation,\n` +
    `    projectCanonicalConversation\n` +
    `  });\n` +
    `})(globalThis);\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = await buildBrowserBundle();
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, bundle, 'utf8');
}
