#!/usr/bin/env python3

from pathlib import Path

path = Path(__file__).resolve().parents[1] / "DESIGN.md"
text = path.read_text(encoding="utf-8")
needle = """`separator_before` is transport metadata on the authoritative word record.  It\ndoes not create another identity, alter the one-element `word-N` DOM contract, or\npermit consumers to use text as an identity fallback.  `renderCanonicalHtmlUnits()`,\n`projectCanonicalWords()`, and `locateCanonicalWord()` expose the same enriched\nword records, and the browser bundle must remain equivalent to the ESM projection.\n\n"""
replacement = needle + """## Canonical speech-navigation boundaries\n\nCanonical `speech_words` expose `navigation_boundary_before` on the first word of\neach structural speech-navigation unit.  The boundary is derived from the same\nCore-owned rendered structure used for canonical HTML and word identity.  Paragraphs,\nheadings, list items, block quotes, preformatted blocks, and table rows therefore\nretain explicit navigation starts without requiring a consumer to parse HTML or\ninfer structure from whitespace.\n\nA soft source newline inside one paragraph is not a structural navigation boundary,\neven though its exact newline remains available through `separator_before`.  The\nboundary flag is descriptive transport metadata on the existing numeric word\nidentity; it neither allocates another identity nor changes the DOM word contract.\nInteractive consumers may use it to split platform-specific speech/navigation\nfragments while carrying the original canonical word IDs through unchanged.\n\n"""
if text.count(needle) != 1:
  raise RuntimeError("Canonical word-separator design paragraph was not found exactly once.")
path.write_text(text.replace(needle, replacement, 1), encoding="utf-8")
