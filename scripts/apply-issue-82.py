from pathlib import Path


def replace_once(path, old, new):
  text = Path(path).read_text(encoding='utf-8')
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{path}: expected one match, found {count}')
  Path(path).write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
  'src/projections/word-identity.js',
  "/**\n"
  " * Returns exact raw HTML pieces covered by one canonical visible token.\n"
  " *\n"
  " * @param {Array<Object<string, *>|null>} map - Visible-to-raw offset map.\n"
  " * @param {number} start - Inclusive visible start offset.\n"
  " * @param {number} end - Exclusive visible end offset.\n"
  " * @returns {Array<Object<string, number>>} Contiguous raw text pieces.\n"
  " */\n"
  "/**\n"
  " * Returns the canonical visible word texts in one Core HTML fragment.\n",
  "/**\n"
  " * Returns the canonical visible word texts in one Core HTML fragment.\n"
)

replace_once(
  'src/projections/html-visibility.js',
  "        provenance: {\n"
  "presentation_id: node?.id ?? null,\n"
  "event_id: node?.event_id ?? null,\n"
  "block_id: block?.id ?? null,\n"
  "block_word_index: blockWordIndex,\n"
  "source: block?.source && typeof block.source === 'object'\n"
  "  ? { ...block.source }\n"
  "  : null\n"
  "        }",
  "        provenance: {\n"
  "          presentation_id: node?.id ?? null,\n"
  "          event_id: node?.event_id ?? null,\n"
  "          block_id: block?.id ?? null,\n"
  "          block_word_index: blockWordIndex,\n"
  "          source: block?.source && typeof block.source === 'object'\n"
  "            ? { ...block.source }\n"
  "            : null\n"
  "        }"
)
