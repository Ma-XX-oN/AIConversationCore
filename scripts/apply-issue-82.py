from pathlib import Path


def append_once(path, marker, text):
  value = Path(path).read_text(encoding='utf-8')
  if marker in value:
    raise RuntimeError(f'{path}: documentation marker already exists')
  Path(path).write_text(value.rstrip() + '\n\n' + text.rstrip() + '\n', encoding='utf-8')


def insert_before_once(path, marker, heading, text):
  value = Path(path).read_text(encoding='utf-8')
  if heading in value:
    raise RuntimeError(f'{path}: documentation heading already exists')
  count = value.count(marker)
  if count != 1:
    raise RuntimeError(f'{path}: expected one insertion marker, found {count}')
  replacement = text.rstrip() + '\n\n' + marker
  Path(path).write_text(value.replace(marker, replacement, 1), encoding='utf-8')


append_once(
  'DECISIONS.md',
  '## D021 — Canonical words carry Core-owned source provenance',
  '''## D021 — Canonical words carry Core-owned source provenance

**Status:** Accepted

**Decision:** Every canonical interactive word exposed by Core carries the stable
canonical provenance needed to associate that word with its presentation node,
event, content block, block-relative word position, and source metadata.  The
word's global numeric `id` remains its authoritative cross-boundary identity.

`renderCanonicalHtmlUnits()` exposes this provenance on each `speech_words`
record.  `locateCanonicalWord()` returns the same word record, including the same
provenance.  Consumers must not reconstruct this relationship by matching visible
text, counting independently tokenized words, correlating DOM fragments, or
maintaining a second word-to-content identity model.

Core verifies provenance against the same canonical word grammar and rendered
content used to allocate word IDs.  If block-level provenance cannot be reconciled
exactly with the rendered canonical word sequence, Core treats that as an invariant
failure rather than selecting a best-effort or fallback association.

**Reason:** A complete rendered turn can contain multiple canonical events and
blocks, including reasoning, commentary, final response text, User Context, and
ordinary User content.  A unit-level lookup alone cannot tell a speech/display
consumer which event/block owns a word when several sources share one turn or even
identical visible text.  Keeping that relationship in Core prevents the same
consumer-side alignment machinery that D019 and D020 were introduced to remove.'''
)

insert_before_once(
  'DESIGN.md',
  '## Consumer boundaries',
  '## Canonical word provenance',
  '''## Canonical word provenance

Canonical word identity includes Core-owned provenance in addition to the global
numeric word handle.  Each `speech_words` record carries a `provenance` object with
the owning presentation node, canonical event, canonical content block,
block-relative canonical word index, and retained block source metadata.  The
canonical `word_id` remains the identity used for seeking, highlighting,
virtualization, and other cross-boundary operations; provenance describes what
that word belongs to rather than creating another identity.

Core derives this metadata from the same canonical presentation/block structures
used by its renderer.  For leaves containing multiple blocks, Core builds the
ordered per-block word provenance with the canonical word grammar and verifies it
exactly against the words produced by the complete rendered unit before returning
the projection.  A count or text mismatch is an invariant failure.  There is no
fuzzy alignment, rendered-text search, or fallback association.

`renderCanonicalHtmlUnits()` and `locateCanonicalWord()` expose the same
provenance-bearing word record.  This lets consumers associate a word with their
speech/display structures using canonical event/block identity without duplicating
Core tokenization or maintaining a word-to-event/block map inferred from text.'''
)
