from pathlib import Path


def replace_once(path, old, new):
  file = Path(path)
  text = file.read_text(encoding='utf-8')
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{path}: expected one match, found {count}')
  file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
  'src/projections/word-identity.js',
  "export function canonicalWordTextsFromHtml(html) {\n"
  "  const value = String(html ?? '');\n"
  "  const segments = htmlSegments(value);\n"
  "  const visible = visibleWordStream(value, segments);\n"
  "  CANONICAL_WORD_PATTERN.lastIndex = 0;\n"
  "  return [...visible.text.matchAll(CANONICAL_WORD_PATTERN)]\n"
  "    .map(match => match[0]);\n"
  "}\n",
  "/**\n"
  " * Returns canonical visible words plus their exact preceding separators.\n"
  " *\n"
  " * The canonical grammar consumes every visible non-whitespace symbol, so\n"
  " * text between consecutive matches is necessarily whitespace.  Exposing it\n"
  " * from this same Core stream lets consumers preserve spaces/newlines while\n"
  " * carrying word IDs without reparsing or aligning text.\n"
  " *\n"
  " * @param {string} html - Core-rendered canonical content HTML.\n"
  " * @returns {Array<Object<string, string>>} Ordered words and separators.\n"
  " */\n"
  "export function canonicalWordDescriptorsFromHtml(html) {\n"
  "  const value = String(html ?? '');\n"
  "  const segments = htmlSegments(value);\n"
  "  const visible = visibleWordStream(value, segments);\n"
  "  const descriptors = [];\n"
  "  let previousEnd = 0;\n"
  "  CANONICAL_WORD_PATTERN.lastIndex = 0;\n"
  "  for (const match of visible.text.matchAll(CANONICAL_WORD_PATTERN)) {\n"
  "    const start = match.index;\n"
  "    const end = start + match[0].length;\n"
  "    descriptors.push({\n"
  "      text: match[0],\n"
  "      separator_before: visible.text.slice(previousEnd, start)\n"
  "    });\n"
  "    previousEnd = end;\n"
  "  }\n"
  "  return descriptors;\n"
  "}\n\n"
  "/**\n"
  " * Returns the canonical visible word texts in one Core HTML fragment.\n"
  " *\n"
  " * @param {string} html - Core-rendered canonical content HTML.\n"
  " * @returns {Array<string>} Canonical visible word texts in render order.\n"
  " */\n"
  "export function canonicalWordTextsFromHtml(html) {\n"
  "  return canonicalWordDescriptorsFromHtml(html).map(word => word.text);\n"
  "}\n"
)

replace_once(
  'src/projections/html-visibility.js',
  "import {\n"
  "  annotateCanonicalHtmlWords,\n"
  "  canonicalWordTextsFromHtml,\n"
  "  createCanonicalWordState\n"
  "} from './word-identity.js';",
  "import {\n"
  "  annotateCanonicalHtmlWords,\n"
  "  canonicalWordDescriptorsFromHtml,\n"
  "  createCanonicalWordState\n"
  "} from './word-identity.js';"
)

replace_once(
  'src/projections/html-visibility.js',
  "    const texts = canonicalWordTextsFromHtml(html);\n"
  "    texts.forEach((text, blockWordIndex) => {\n"
  "      output.push({\n"
  "        text,\n"
  "        provenance: {",
  "    const descriptors = canonicalWordDescriptorsFromHtml(html);\n"
  "    descriptors.forEach((descriptor, blockWordIndex) => {\n"
  "      output.push({\n"
  "        text: descriptor.text,\n"
  "        separator_before: descriptor.separator_before,\n"
  "        provenance: {"
)

replace_once(
  'src/projections/html-visibility.js',
  "    return {\n"
  "      ...word,\n"
  "      provenance: descriptor.provenance\n"
  "    };",
  "    return {\n"
  "      ...word,\n"
  "      separator_before: descriptor.separator_before,\n"
  "      provenance: descriptor.provenance\n"
  "    };"
)

replace_once(
  'scripts/build-browser-bundle.mjs',
  "  const wordIdentity = multiExportModuleBody(wordIdentitySource, [\n"
  "    'createCanonicalWordState',\n"
  "    'canonicalWordTextsFromHtml',\n"
  "    'annotateCanonicalHtmlWords'\n"
  "  ]);",
  "  const wordIdentity = multiExportModuleBody(wordIdentitySource, [\n"
  "    'createCanonicalWordState',\n"
  "    'canonicalWordDescriptorsFromHtml',\n"
  "    'canonicalWordTextsFromHtml',\n"
  "    'annotateCanonicalHtmlWords'\n"
  "  ]);"
)

replace_once(
  'scripts/build-browser-bundle.mjs',
  "    \"import {\\n  annotateCanonicalHtmlWords,\\n  canonicalWordTextsFromHtml,\\n  createCanonicalWordState\\n} from './word-identity.js';\",",
  "    \"import {\\n  annotateCanonicalHtmlWords,\\n  canonicalWordDescriptorsFromHtml,\\n  createCanonicalWordState\\n} from './word-identity.js';\","
)
