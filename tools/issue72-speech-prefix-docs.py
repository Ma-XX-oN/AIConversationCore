from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
  target = Path(path)
  text = target.read_text(encoding='utf-8')
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{path}: expected one replacement target, found {count}')
  target.write_text(text.replace(old, new), encoding='utf-8', newline='\n')


decisions = Path('DECISIONS.md')
text = decisions.read_text(encoding='utf-8')
entry = '''\n\n## D023 — Structural speech prefixes are Core-owned but are not word identities\n\n**Status:** Accepted\n\n**Decision:** Canonical words may carry `speech_prefix_before`, a Core-owned\nstructural string that a speech consumer emits immediately before that word.  The\ninitial use is the resolved marker of an ordered-list item, such as `3. ` before\nthe first canonical word in that item.  Words without such structure carry an\nempty prefix.\n\nA structural prefix is not a canonical transcript word.  Its characters do not\nreceive numeric `word_id` values and do not create additional `word-N` DOM\nelements.  Consumers may tokenize the prefix for their platform speech engine,\nbut those structural speech tokens have no word handle.  Consumers must not\nfabricate IDs for them, borrow an adjacent word ID, or parse source Markdown to\nreconstruct list ordinals.\n\n`renderCanonicalHtmlUnits()`, `projectCanonicalWords()`, and\n`locateCanonicalWord()` expose the same prefix-enriched canonical word records.\nThe prefix is derived from Core-owned rendered structure, including\n`data-list-ordinal`, in the same projection pass that allocates word IDs.\n\n**Reason:** Issue #72 established that ordered-list ordinals are Core semantics and\nmust be available to speech consumers, while issue #75 exposed that the previous\nHTML-only ordinal metadata was insufficient to carry word identity through a real\nspeech pipeline.  Treating an implicit list marker as a fake word would violate\nD019's one-word/one-DOM-element contract; parsing the list again in a consumer\nwould duplicate Core semantics.  An explicit structural speech prefix preserves\nboth invariants.\n'''
if '## D023 — Structural speech prefixes' in text:
  raise RuntimeError('D023 already exists')
decisions.write_text(text.rstrip() + entry, encoding='utf-8', newline='\n')

section = '''## Canonical structural speech prefixes\n\nCanonical `speech_words` may include `speech_prefix_before`.  The value is empty\nfor ordinary words.  When Core-owned structure has spoken content that is not\nitself a transcript word, the first canonical word following that structure\ncarries the exact prefix to speak.  Ordered-list items currently use this to carry\nthe resolved marker, for example `3. ` before the first word of item 3.\n\nThe prefix is derived from the same canonical HTML structure that already exposes\nordered-list `data-list-ordinal`; consumers do not parse Markdown or infer list\nnumbers.  Prefix characters are structural speech tokens rather than canonical\ninteractive words.  They therefore have no numeric word ID and no `word-N` DOM\nelement.  A speech engine may tokenize the prefix for playback, but must represent\nthose tokens as having no word handle rather than inventing or borrowing identity.\n\nThis preserves the distinction between semantic structure and word identity while\nallowing a consumer to build its exact spoken stream from Core output.  Exact word\nlookup returns the same prefix-enriched word record, so off-window materialization\nand speech preparation observe one contract.\n\n'''
replace_once('DESIGN.md', '## Consumer boundaries\n', section + '## Consumer boundaries\n')
