from pathlib import Path


def replace_once(path, old, new):
  file = Path(path)
  text = file.read_text(encoding='utf-8')
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{path}: expected one match, found {count}')
  file.write_text(text.replace(old, new, 1), encoding='utf-8')


stale_jsdoc = """/**
 * Returns the canonical visible word texts in one Core HTML fragment.
 *
 * This is the same tokenizer used by canonical word-ID annotation.  It
 * exists so other Core projection stages can verify provenance without
 * copying the token grammar or assigning a second identity.
 *
 * @param {string} html - Core-rendered canonical content HTML.
 * @returns {Array<string>} Canonical visible word texts in render order.
 */
"""
replace_once('src/projections/word-identity.js', stale_jsdoc, '')

word_separator_design = """## Canonical word separators

Canonical `speech_words` retain the exact visible whitespace immediately before
each word in `separator_before`.  Core derives that separator from the same
rendered visible stream and canonical token grammar that allocate the word ID;
it is not reconstructed from source Markdown or inferred by a consumer.

The first word of each canonical content block has an empty separator.  Subsequent
separators preserve spaces and newlines inside that block exactly.  Because the
canonical word grammar consumes every visible non-whitespace symbol, this retained
separator is the complete inter-word information needed to reconstruct a block's
visible word stream without introducing another tokenizer or text-alignment path.

`separator_before` is transport metadata on the authoritative word record.  It
does not create another identity, alter the one-element `word-N` DOM contract, or
permit consumers to use text as an identity fallback.  `renderCanonicalHtmlUnits()`,
`projectCanonicalWords()`, and `locateCanonicalWord()` expose the same enriched
word records, and the browser bundle must remain equivalent to the ESM projection.

A speech/display consumer may use the separator stream to segment canonical words
into platform-specific utterances while carrying the existing numeric word IDs
through that transformation.  It must not retokenize rendered HTML, search for a
matching subsequence, or reconstruct block-relative ordinals to recover identity.

"""
replace_once(
  'DESIGN.md',
  '## Consumer boundaries\n',
  word_separator_design + '## Consumer boundaries\n'
)

path = Path('DECISIONS.md')
text = path.read_text(encoding='utf-8')
if '## D022 — Canonical word streams retain Core-owned separators' in text:
  raise RuntimeError('DECISIONS.md: D022 already exists')
text = text.rstrip() + """


## D022 — Canonical word streams retain Core-owned separators

**Status:** Accepted

**Decision:** Every canonical interactive word record retains the exact visible
whitespace that precedes that word inside its owning canonical content block as
`separator_before`.  Core derives this value from the same rendered visible stream
and token grammar that allocate the global numeric word ID.  The first word in each
block starts with an empty separator; spaces and newlines between later words are
preserved exactly.

The separator is part of the canonical word projection, not a second identity or a
consumer hint to re-tokenize text.  `renderCanonicalHtmlUnits()`,
`projectCanonicalWords()`, and `locateCanonicalWord()` return the same enriched word
record, and the browser bundle remains equivalent to the ESM API.  The public HTML
contract remains one `<span id="word-N">...</span>` per canonical word.

Consumers may use these separators to divide the canonical word stream into
platform-specific speech/display segments while carrying the existing word IDs
through the transformation.  They must not recover identity by text search,
subsequence matching, independent tokenization, or reconstructed ordinals.

**Reason:** AgentPanelSpeaker needs to preserve Core word IDs while its speech layer
applies sentence, fence-line, and other platform-specific segmentation.  Word text
and provenance alone omit the spaces/newlines that define those boundaries.  If the
consumer reconstructed them from rendered/source text, it would recreate the
alignment machinery D019–D021 were intended to remove.  Core already has the exact
visible stream at word-allocation time, so retaining its separators keeps one
identity path and makes the transformation lossless without a fallback.
"""
path.write_text(text, encoding='utf-8')
