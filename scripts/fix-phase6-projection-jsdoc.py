#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')
needle = " * Renders Claude plan approval.\n *\n * @param {Object<string, *>} block - The canonical/provider content block being inspected or rendered.\n"
replacement = " * Renders Claude plan approval.\n *\n * @param {Object<string, *>} event - The canonical tool-result event supplying source projection metadata.\n * @param {Object<string, *>} block - The canonical/provider content block being inspected or rendered.\n"
if needle not in text:
  raise SystemExit('renderClaudePlanApproval JSDoc anchor not found')
path.write_text(text.replace(needle, replacement, 1), encoding='utf-8')
