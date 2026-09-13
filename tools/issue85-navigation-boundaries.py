#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORD_IDENTITY = ROOT / "src/projections/word-identity.js"
TEST_FILE = ROOT / "tests/canonical-navigation-boundaries.test.js"

TEST_SOURCE = r'''import assert from 'node:assert/strict';
import test from 'node:test';

import * as core from '../src/index.js';

function textBlock(id, text) {
  return {
    id,
    type: 'text',
    text,
    source: {
      provider: 'codex',
      record_id: 'record:0',
      record_index: 0
    }
  };
}

function assistantEvent(text) {
  return {
    id: 'event:assistant',
    provider: 'codex',
    kind: 'message',
    role: 'assistant',
    channel: 'final',
    content_type: 'text',
    visibility: 'visible',
    source_record_id: 'record:0',
    source_index: 0,
    blocks: [textBlock('block:body', text)],
    citations: [],
    resources: [],
    relationships: { tool_call_id: null },
    source: {
      provider: 'codex',
      record_id: 'record:0',
      record_index: 0
    }
  };
}

test('canonical words expose structural navigation starts without promoting soft line breaks', () => {
  const [unit] = core.renderCanonicalHtmlUnits([
    assistantEvent(
      'In practice:\n\n' +
      '- For web research, use sources.\n' +
      '- For local code/files, inspect files.\n\n' +
      'Soft line\nwrap continues.'
    )
  ]);
  const words = unit.speech_words;
  const structuralStarts = words
    .filter(word => word.navigation_boundary_before === true)
    .map(word => word.text);

  assert.deepEqual(
    structuralStarts,
    ['In', 'For', 'For', 'Soft'],
    'Paragraph and list-item starts must be explicit canonical navigation boundaries.'
  );

  const wrap = words.find(word => word.text === 'wrap');
  assert.ok(wrap, 'Expected the soft-line word wrap.');
  assert.equal(wrap.separator_before, '\n');
  assert.equal(
    wrap.navigation_boundary_before,
    false,
    'A soft newline inside one paragraph must not become a navigation boundary.'
  );
});
'''


def replace_once(path: Path, old: str, new: str) -> None:
  text = path.read_text(encoding="utf-8")
  count = text.count(old)
  if count != 1:
    raise RuntimeError(
      f"Expected exactly one match in {path}: found {count} for {old[:80]!r}"
    )
  path.write_text(text.replace(old, new, 1), encoding="utf-8")


def install_test() -> None:
  TEST_FILE.write_text(TEST_SOURCE, encoding="utf-8")


def patch_production() -> None:
  replace_once(
    WORD_IDENTITY,
    "const BLOCK_TAGS = new Set([\n"
    "  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',\n"
    "  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',\n"
    "  'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',\n"
    "  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'\n"
    "]);\n",
    "const BLOCK_TAGS = new Set([\n"
    "  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',\n"
    "  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',\n"
    "  'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',\n"
    "  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'\n"
    "]);\n\n"
    "/** HTML elements whose opening begins one canonical speech-navigation unit. */\n"
    "const NAVIGATION_TAGS = new Set([\n"
    "  'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'pre', 'tr'\n"
    "]);\n"
  )

  replace_once(
    WORD_IDENTITY,
    "  const map = [];\n"
    "  const structuralWords = [];\n"
    "  for (const segment of segments) {\n"
    "    if (segment.kind === 'tag') {\n"
    "      if (segment.boundary && text && !/\\s$/u.test(text)) {\n"
    "        text += '\\n';\n"
    "        map.push(null);\n"
    "      }\n"
    "      if (segment.name === 'li' &&\n",
    "  const map = [];\n"
    "  const structuralWords = [];\n"
    "  const navigationStarts = new Set();\n"
    "  for (const segment of segments) {\n"
    "    if (segment.kind === 'tag') {\n"
    "      if (segment.boundary && text && !/\\s$/u.test(text)) {\n"
    "        text += '\\n';\n"
    "        map.push(null);\n"
    "      }\n"
    "      if (!segment.closing && NAVIGATION_TAGS.has(segment.name)) {\n"
    "        navigationStarts.add(text.length);\n"
    "      }\n"
    "      if (segment.name === 'li' &&\n"
  )

  replace_once(
    WORD_IDENTITY,
    "  return { text, map, structuralWords };\n",
    "  return { text, map, structuralWords, navigationStarts };\n"
  )

  replace_once(
    WORD_IDENTITY,
    "  const awaitingBody = new Set();\n"
    "  let previousEnd = 0;\n"
    "  for (const occurrence of occurrences) {\n"
    "    let separator = visible.text.slice(previousEnd, occurrence.start);\n",
    "  const awaitingBody = new Set();\n"
    "  const navigationStarts = [...visible.navigationStarts].sort((left, right) =>\n"
    "    left - right);\n"
    "  let navigationStartIndex = 0;\n"
    "  let previousEnd = 0;\n"
    "  for (const occurrence of occurrences) {\n"
    "    let navigationBoundaryBefore = false;\n"
    "    while (navigationStartIndex < navigationStarts.length &&\n"
    "           navigationStarts[navigationStartIndex] <= occurrence.start) {\n"
    "      if (navigationStarts[navigationStartIndex] >= previousEnd) {\n"
    "        navigationBoundaryBefore = true;\n"
    "      }\n"
    "      ++navigationStartIndex;\n"
    "    }\n"
    "    let separator = visible.text.slice(previousEnd, occurrence.start);\n"
  )

  replace_once(
    WORD_IDENTITY,
    "    occurrence.separator_before = separator;\n"
    "  }\n\n"
    "  return { value, occurrences };\n",
    "    occurrence.separator_before = separator;\n"
    "    occurrence.navigation_boundary_before = navigationBoundaryBefore;\n"
    "  }\n\n"
    "  return { value, occurrences };\n"
  )

  replace_once(
    WORD_IDENTITY,
    "    words.push({\n"
    "      id,\n"
    "      text: occurrence.text,\n"
    "      groups: occurrence.groups\n"
    "    });\n",
    "    words.push({\n"
    "      id,\n"
    "      text: occurrence.text,\n"
    "      groups: occurrence.groups,\n"
    "      navigation_boundary_before:\n"
    "        occurrence.navigation_boundary_before === true\n"
    "    });\n"
  )


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("mode", choices=("test", "production"))
  args = parser.parse_args()
  if args.mode == "test":
    install_test()
  else:
    patch_production()


if __name__ == "__main__":
  main()
