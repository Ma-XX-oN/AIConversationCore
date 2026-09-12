from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
  target = Path(path)
  text = target.read_text(encoding='utf-8')
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{path}: expected one replacement target, found {count}')
  target.write_text(text.replace(old, new), encoding='utf-8', newline='\n')


path = 'src/projections/word-identity.js'

replace_once(
  path,
  """      selfClosing: true,\n      classes: []\n""",
  """      selfClosing: true,\n      classes: [],\n      listOrdinal: null\n""")

replace_once(
  path,
  """  const classes = (classMatch?.[1] ?? classMatch?.[2] ?? classMatch?.[3] ?? '')\n    .split(/\\s+/u)\n    .filter(Boolean);\n  return {\n    name,\n    closing: match[1] === '/',\n    selfClosing: VOID_TAGS.has(name) || /\\/\\s*$/.test(attributes),\n    classes\n  };\n""",
  """  const classes = (classMatch?.[1] ?? classMatch?.[2] ?? classMatch?.[3] ?? '')\n    .split(/\\s+/u)\n    .filter(Boolean);\n  const ordinalMatch = attributes.match(\n    /\\bdata-list-ordinal\\s*=\\s*(?:\"(-?\\d+)\"|'(-?\\d+)'|(-?\\d+))/i\n  );\n  const listOrdinal = ordinalMatch\n    ? (ordinalMatch[1] ?? ordinalMatch[2] ?? ordinalMatch[3])\n    : null;\n  return {\n    name,\n    closing: match[1] === '/',\n    selfClosing: VOID_TAGS.has(name) || /\\/\\s*$/.test(attributes),\n    classes,\n    listOrdinal\n  };\n""")

replace_once(
  path,
  """  const segments = [];\n  const stack = [];\n  let cursor = 0;\n\n  while (cursor < html.length) {\n""",
  """  const segments = [];\n  const stack = [];\n  let cursor = 0;\n  let nextListItemId = 1;\n\n  while (cursor < html.length) {\n""")

replace_once(
  path,
  """      segments.push({\n        kind: 'text',\n        rawStart: cursor,\n        rawEnd,\n        groups: semanticGroups(stack),\n        wordContent: isWordContent(stack)\n      });\n""",
  """      let listItem = null;\n      for (let index = stack.length - 1; index >= 0; --index) {\n        if (stack[index].name === 'li') {\n          listItem = stack[index];\n          break;\n        }\n      }\n      segments.push({\n        kind: 'text',\n        rawStart: cursor,\n        rawEnd,\n        groups: semanticGroups(stack),\n        wordContent: isWordContent(stack),\n        listItemId: listItem?.listItemId ?? null,\n        speechPrefixBefore: listItem?.listOrdinal == null\n          ? ''\n          : `${listItem.listOrdinal}. `\n      });\n""")

replace_once(
  path,
  """      } else if (!tag.selfClosing) {\n        stack.push(tag);\n      }\n""",
  """      } else if (!tag.selfClosing) {\n        stack.push({\n          ...tag,\n          listItemId: tag.name === 'li' ? nextListItemId++ : null\n        });\n      }\n""")

replace_once(
  path,
  """    const decoded = decodeTextSegment(\n      html.slice(segment.rawStart, segment.rawEnd),\n      segment.rawStart,\n      segment.groups\n    );\n    text += decoded.text;\n    map.push(...decoded.map);\n""",
  """    const decoded = decodeTextSegment(\n      html.slice(segment.rawStart, segment.rawEnd),\n      segment.rawStart,\n      segment.groups\n    );\n    text += decoded.text;\n    map.push(...decoded.map.map(entry => ({\n      ...entry,\n      listItemId: segment.listItemId,\n      speechPrefixBefore: segment.speechPrefixBefore\n    })));\n""")

replace_once(
  path,
  """  const insertions = new Map();\n  const words = [];\n  CANONICAL_WORD_PATTERN.lastIndex = 0;\n""",
  """  const insertions = new Map();\n  const words = [];\n  const prefixedListItems = new Set();\n  CANONICAL_WORD_PATTERN.lastIndex = 0;\n""")

replace_once(
  path,
  """    words.push({ id, text: match[0], groups });\n\n    pieces.forEach((piece, pieceIndex) => {\n""",
  """    const firstMapped = visible.map.slice(start, end).find(Boolean);\n    let speechPrefixBefore = '';\n    if (firstMapped?.listItemId != null &&\n        firstMapped.speechPrefixBefore &&\n        !prefixedListItems.has(firstMapped.listItemId)) {\n      prefixedListItems.add(firstMapped.listItemId);\n      speechPrefixBefore = firstMapped.speechPrefixBefore;\n    }\n    words.push({\n      id,\n      text: match[0],\n      groups,\n      speech_prefix_before: speechPrefixBefore\n    });\n\n    pieces.forEach((piece, pieceIndex) => {\n""")
