from pathlib import Path


def replace_once(path, old, new):
  text = Path(path).read_text(encoding='utf-8')
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{path}: expected one match, found {count}')
  Path(path).write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
  'src/projections/html.js',
  "  if (block.type === 'code') {\n"
  "    const language = block.language ?? '';\n"
  "    const code = block.code ?? block.text ?? '';\n"
  "    return `\\`\\`\\`${language}\\n${code}\\n\\`\\`\\``;\n"
  "  }\n"
  "  return block.text ?? '';\n"
  "}\n",
  "  if (block.type === 'code') {\n"
  "    const language = block.language ?? '';\n"
  "    const code = block.code ?? block.text ?? '';\n"
  "    return `\\`\\`\\`${language}\\n${code}\\n\\`\\`\\``;\n"
  "  }\n"
  "  if (block.type === 'subagent') {\n"
  "    return block.output ?? block.text ?? block.description ?? '';\n"
  "  }\n"
  "  return block.text ?? '';\n"
  "}\n\n"
  "/**\n"
  " * Renders one canonical content block as its isolated HTML leaf.\n"
  " *\n"
  " * This helper shares the exact block-to-Markdown and Markdown-to-HTML\n"
  " * implementation used by the complete renderer. Interactive word provenance\n"
  " * uses it only to verify block ownership inside Core.\n"
  " *\n"
  " * @param {Object<string, *>} block - Canonical content block.\n"
  " * @returns {string} Canonical HTML represented by the block.\n"
  " */\n"
  "export function renderCanonicalBlockHtml(block) {\n"
  "  const markdown = blockMarkdown(block);\n"
  "  return markdown ? renderMarkdown(markdown) : '';\n"
  "}\n"
)

replace_once(
  'src/projections/word-identity.js',
  "function rawTokenPieces(map, start, end) {",
  "/**\n"
  " * Returns canonical visible word texts in one Core HTML fragment.\n"
  " *\n"
  " * This is the same tokenizer used by canonical word-ID annotation, allowing\n"
  " * other Core stages to verify provenance without copying token grammar.\n"
  " *\n"
  " * @param {string} html - Core-rendered canonical content HTML.\n"
  " * @returns {Array<string>} Canonical visible word texts in render order.\n"
  " */\n"
  "export function canonicalWordTextsFromHtml(html) {\n"
  "  const value = String(html ?? '');\n"
  "  const segments = htmlSegments(value);\n"
  "  const visible = visibleWordStream(value, segments);\n"
  "  CANONICAL_WORD_PATTERN.lastIndex = 0;\n"
  "  return [...visible.text.matchAll(CANONICAL_WORD_PATTERN)]\n"
  "    .map(match => match[0]);\n"
  "}\n\n"
  "/**\n"
  " * Returns exact raw HTML pieces covered by one canonical visible token.\n"
  " *\n"
  " * @param {Array<Object<string, *>|null>} map - Visible-to-raw offset map.\n"
  " * @param {number} start - Inclusive visible start offset.\n"
  " * @param {number} end - Exclusive visible end offset.\n"
  " * @returns {Array<Object<string, number>>} Contiguous raw text pieces.\n"
  " */\n"
  "function rawTokenPieces(map, start, end) {"
)

replace_once(
  'src/projections/html-visibility.js',
  "import {\n"
  "  renderCanonicalHtmlUnits as renderBaseHtmlUnits\n"
  "} from './html.js';",
  "import {\n"
  "  renderCanonicalBlockHtml,\n"
  "  renderCanonicalHtmlUnits as renderBaseHtmlUnits\n"
  "} from './html.js';"
)
replace_once(
  'src/projections/html-visibility.js',
  "import {\n"
  "  annotateCanonicalHtmlWords,\n"
  "  createCanonicalWordState\n"
  "} from './word-identity.js';",
  "import {\n"
  "  annotateCanonicalHtmlWords,\n"
  "  canonicalWordTextsFromHtml,\n"
  "  createCanonicalWordState\n"
  "} from './word-identity.js';"
)

marker = "/**\n * Renders canonical HTML as ordered complete-turn units while retaining\n"
helpers = r'''/**
 * Returns canonical blocks that contribute interactive words for one leaf.
 *
 * @param {Object<string, *>} node - Canonical presentation node.
 * @returns {Array<Object<string, *>>} Ordered word-bearing blocks.
 */
function wordBlocksForPresentationNode(node) {
  if (node?.kind === 'subagent_content') {
    return node?.block ? [node.block] : [];
  }
  if ([
    'user_context',
    'reasoning',
    'markdown',
    'commentary',
    'notice'
  ].includes(node?.kind)) {
    return Array.isArray(node?.blocks) ? node.blocks : [];
  }
  return [];
}

/**
 * Appends authoritative word provenance for one presentation subtree.
 *
 * Block word texts use the same Core renderer/tokenizer as the complete
 * projection. The complete unit later verifies the sequence exactly; Core never
 * silently aligns by text or ordinal when renderings disagree.
 *
 * @param {Object<string, *>} node - Canonical presentation subtree.
 * @param {Array<Object<string, *>>} output - Ordered provenance descriptors.
 * @returns {void} Descriptors are appended in canonical render order.
 */
function appendWordProvenance(node, output) {
  if (node?.kind === 'reasoning_group') {
    for (const child of node?.children ?? []) {
      appendWordProvenance(child, output);
    }
    return;
  }
  if (node?.kind === 'tool' || node?.kind === 'interaction' ||
      node?.kind === 'attachments') return;

  for (const block of wordBlocksForPresentationNode(node)) {
    const html = '<div class="presentation-content">' +
      renderCanonicalBlockHtml(block) + '</div>';
    const texts = canonicalWordTextsFromHtml(html);
    texts.forEach((text, blockWordIndex) => {
      output.push({
        text,
        provenance: {
          presentation_id: node?.id ?? null,
          event_id: node?.event_id ?? null,
          block_id: block?.id ?? null,
          block_word_index: blockWordIndex,
          source: block?.source && typeof block.source === 'object'
            ? { ...block.source }
            : null
        }
      });
    });
  }
}

/**
 * Builds authoritative ordered word provenance for one canonical turn.
 *
 * @param {Object<string, *>} turn - Canonical presentation turn.
 * @returns {Array<Object<string, *>>} Ordered provenance descriptors.
 */
function turnWordProvenance(turn) {
  const output = [];
  for (const child of turn?.children ?? []) {
    appendWordProvenance(child, output);
  }
  return output;
}

/**
 * Attaches verified canonical provenance to annotated word records.
 *
 * @param {Array<Object<string, *>>} words - Annotated unit word records.
 * @param {Array<Object<string, *>>} expected - Core provenance descriptors.
 * @param {string} unitId - Canonical unit identity for invariant errors.
 * @returns {Array<Object<string, *>>} Word records carrying provenance.
 */
function wordsWithVerifiedProvenance(words, expected, unitId) {
  if (words.length !== expected.length) {
    throw new TypeError(
      `Canonical word provenance count mismatch in unit ${unitId}: ` +
      `${words.length} rendered words versus ${expected.length} block words.`
    );
  }
  return words.map((word, index) => {
    const descriptor = expected[index];
    if (word?.text !== descriptor?.text) {
      throw new TypeError(
        `Canonical word provenance mismatch in unit ${unitId} at word ${index}: ` +
        `rendered ${JSON.stringify(word?.text)} versus block ` +
        `${JSON.stringify(descriptor?.text)}.`
      );
    }
    return {
      ...word,
      provenance: descriptor.provenance
    };
  });
}

'''
replace_once(
  'src/projections/html-visibility.js',
  marker,
  helpers + marker
)

replace_once(
  'src/projections/html-visibility.js',
  "  const wordState = createCanonicalWordState();\n\n"
  "  return renderBaseHtmlUnits(projectedEvents).map(unit => {\n"
  "    const revisionHtml = applyTurnRevisionAttributes(unit.html, turnsById);\n"
  "    const annotated = annotateCanonicalHtmlWords(revisionHtml, wordState);\n"
  "    return {\n"
  "      ...unit,\n"
  "      html: collapseCanonicalWordFragments(annotated.html),\n"
  "      speech_words: annotated.words\n"
  "    };\n"
  "  });",
  "  const wordState = createCanonicalWordState();\n"
  "  const provenanceByTurnId = new Map((presentation.turns ?? []).map(turn => [\n"
  "    String(turn?.id ?? ''),\n"
  "    turnWordProvenance(turn)\n"
  "  ]));\n\n"
  "  return renderBaseHtmlUnits(projectedEvents).map(unit => {\n"
  "    const revisionHtml = applyTurnRevisionAttributes(unit.html, turnsById);\n"
  "    const annotated = annotateCanonicalHtmlWords(revisionHtml, wordState);\n"
  "    const provenance = provenanceByTurnId.get(String(unit?.id ?? '')) ?? [];\n"
  "    const words = wordsWithVerifiedProvenance(\n"
  "      annotated.words,\n"
  "      provenance,\n"
  "      String(unit?.id ?? '')\n"
  "    );\n"
  "    return {\n"
  "      ...unit,\n"
  "      html: collapseCanonicalWordFragments(annotated.html),\n"
  "      speech_words: words\n"
  "    };\n"
  "  });"
)

replace_once(
  'scripts/build-browser-bundle.mjs',
  "    ['renderCanonicalHtmlUnits', 'renderCanonicalHtml'],",
  "    [\n"
  "      'renderCanonicalBlockHtml',\n"
  "      'renderCanonicalHtmlUnits',\n"
  "      'renderCanonicalHtml'\n"
  "    ],"
)
replace_once(
  'scripts/build-browser-bundle.mjs',
  "  const wordIdentity = multiExportModuleBody(wordIdentitySource, [\n"
  "    'createCanonicalWordState',\n"
  "    'annotateCanonicalHtmlWords'\n"
  "  ]);",
  "  const wordIdentity = multiExportModuleBody(wordIdentitySource, [\n"
  "    'createCanonicalWordState',\n"
  "    'canonicalWordTextsFromHtml',\n"
  "    'annotateCanonicalHtmlWords'\n"
  "  ]);"
)
replace_once(
  'scripts/build-browser-bundle.mjs',
  "    \"import {\\n  renderCanonicalHtmlUnits as renderBaseHtmlUnits\\n} "
  "from './html.js';\",",
  "    \"import {\\n  renderCanonicalBlockHtml,\\n  "
  "renderCanonicalHtmlUnits as renderBaseHtmlUnits\\n} from './html.js';\","
)
replace_once(
  'scripts/build-browser-bundle.mjs',
  "    \"import {\\n  annotateCanonicalHtmlWords,\\n  "
  "createCanonicalWordState\\n} from './word-identity.js';\",",
  "    \"import {\\n  annotateCanonicalHtmlWords,\\n  "
  "canonicalWordTextsFromHtml,\\n  createCanonicalWordState\\n} "
  "from './word-identity.js';\","
)
