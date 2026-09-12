import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const original = fs.readFileSync(path, 'utf8');
  const count = original.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected exactly one replacement target, found ${count}`);
  }
  fs.writeFileSync(path, original.replace(before, after));
}

const wordPath = 'src/projections/word-identity.js';

replaceOnce(
  wordPath,
`        wordContent: isWordContent(stack),
        listItemId: listItem?.listItemId ?? null,
        speechPrefixBefore: listItem?.listOrdinal == null
          ? ''
          : \`${'${listItem.listOrdinal}'}. \`
`,
`        wordContent: isWordContent(stack),
        listItemId: listItem?.listItemId ?? null
`);

replaceOnce(
  wordPath,
`    const tag = parseHtmlTag(raw);
    const boundary = Boolean(tag.name && BLOCK_TAGS.has(tag.name));
    segments.push({
      kind: 'tag',
      rawStart: cursor,
      rawEnd: end,
      boundary
    });

    if (tag.name) {
      if (tag.closing) {
        let matched = false;
        for (let index = stack.length - 1; index >= 0; --index) {
          if (stack[index].name === tag.name) {
            stack.splice(index);
            matched = true;
            break;
          }
        }
        if (!matched) {
          throw new TypeError(\`Canonical HTML closes unopened <${'${tag.name}'}>.\`);
        }
      } else if (!tag.selfClosing) {
        stack.push({
          ...tag,
          listItemId: tag.name === 'li' ? nextListItemId++ : null
        });
      }
    }
`,
`    const tag = parseHtmlTag(raw);
    const boundary = Boolean(tag.name && BLOCK_TAGS.has(tag.name));
    const listItemId = !tag.closing && !tag.selfClosing && tag.name === 'li'
      ? nextListItemId++
      : null;
    const structuralStack = listItemId == null
      ? stack
      : [...stack, { ...tag, listItemId }];
    segments.push({
      kind: 'tag',
      rawStart: cursor,
      rawEnd: end,
      boundary,
      name: tag.name,
      closing: tag.closing,
      selfClosing: tag.selfClosing,
      listItemId,
      listOrdinal: tag.listOrdinal,
      groups: semanticGroups(structuralStack),
      wordContent: isWordContent(structuralStack)
    });

    if (tag.name) {
      if (tag.closing) {
        let matched = false;
        for (let index = stack.length - 1; index >= 0; --index) {
          if (stack[index].name === tag.name) {
            stack.splice(index);
            matched = true;
            break;
          }
        }
        if (!matched) {
          throw new TypeError(\`Canonical HTML closes unopened <${'${tag.name}'}>.\`);
        }
      } else if (!tag.selfClosing) {
        stack.push({
          ...tag,
          listItemId
        });
      }
    }
`);

replaceOnce(
  wordPath,
`function visibleWordStream(html, segments) {
  let text = '';
  const map = [];
  for (const segment of segments) {
    if (segment.kind === 'tag') {
      if (segment.boundary && text && !/\\s$/u.test(text)) {
        text += '\\n';
        map.push(null);
      }
      continue;
    }
    if (!segment.wordContent) continue;
    const decoded = decodeTextSegment(
      html.slice(segment.rawStart, segment.rawEnd),
      segment.rawStart,
      segment.groups
    );
    text += decoded.text;
    map.push(...decoded.map.map(entry => ({
      ...entry,
      listItemId: segment.listItemId,
      speechPrefixBefore: segment.speechPrefixBefore
    })));
  }
  return { text, map };
}

/**
 * Returns canonical visible words plus their exact preceding separators.
 *
 * The canonical grammar consumes every visible non-whitespace symbol, so
 * text between consecutive matches is necessarily whitespace.  Exposing it
 * from this same Core stream lets consumers preserve spaces/newlines while
 * carrying word IDs without reparsing or aligning text.
 *
 * @param {string} html - Core-rendered canonical content HTML.
 * @returns {Array<Object<string, string>>} Ordered words and separators.
 */
export function canonicalWordDescriptorsFromHtml(html) {
  const value = String(html ?? '');
  const segments = htmlSegments(value);
  const visible = visibleWordStream(value, segments);
  const descriptors = [];
  let previousEnd = 0;
  CANONICAL_WORD_PATTERN.lastIndex = 0;
  for (const match of visible.text.matchAll(CANONICAL_WORD_PATTERN)) {
    const start = match.index;
    const end = start + match[0].length;
    descriptors.push({
      text: match[0],
      separator_before: visible.text.slice(previousEnd, start)
    });
    previousEnd = end;
  }
  return descriptors;
}
`,
`function visibleWordStream(html, segments) {
  let text = '';
  const map = [];
  const structuralWords = [];
  for (const segment of segments) {
    if (segment.kind === 'tag') {
      if (segment.boundary && text && !/\\s$/u.test(text)) {
        text += '\\n';
        map.push(null);
      }
      if (segment.name === 'li' &&
          !segment.closing &&
          segment.wordContent &&
          segment.listOrdinal != null) {
        structuralWords.push({
          kind: 'list_ordinal',
          text: \`${'${segment.listOrdinal}'}.\`,
          start: text.length,
          end: text.length,
          groups: segment.groups,
          listItemId: segment.listItemId,
          rawStart: segment.rawStart,
          rawEnd: segment.rawEnd
        });
      }
      continue;
    }
    if (!segment.wordContent) continue;
    const decoded = decodeTextSegment(
      html.slice(segment.rawStart, segment.rawEnd),
      segment.rawStart,
      segment.groups
    );
    text += decoded.text;
    map.push(...decoded.map.map(entry => ({
      ...entry,
      listItemId: segment.listItemId
    })));
  }
  return { text, map, structuralWords };
}

/**
 * Returns the complete canonical interactive-word occurrences in HTML order.
 *
 * Ordered-list ordinals are canonical spoken words even though the browser
 * renders their marker structurally rather than as a text node.  They therefore
 * enter the same global word stream here, before the item's textual body.  The
 * ordinal's DOM identity is carried by its <li>; ordinary words retain exact raw
 * text pieces for span annotation.
 *
 * @param {string} html - Core-rendered canonical content HTML.
 * @returns {Object<string, *>} Visible stream plus ordered word occurrences.
 */
function canonicalWordOccurrences(html) {
  const value = String(html ?? '');
  const segments = htmlSegments(value);
  const visible = visibleWordStream(value, segments);
  const occurrences = [...visible.structuralWords];

  CANONICAL_WORD_PATTERN.lastIndex = 0;
  for (const match of visible.text.matchAll(CANONICAL_WORD_PATTERN)) {
    const start = match.index;
    const end = start + match[0].length;
    const groups = [];
    const seenGroups = new Set();
    for (let index = start; index < end; ++index) {
      for (const group of visible.map[index]?.groups ?? []) {
        if (!seenGroups.has(group)) {
          seenGroups.add(group);
          groups.push(group);
        }
      }
    }
    const firstMapped = visible.map.slice(start, end).find(Boolean);
    occurrences.push({
      kind: 'text',
      text: match[0],
      start,
      end,
      groups,
      listItemId: firstMapped?.listItemId ?? null,
      pieces: rawTokenPieces(visible.map, start, end)
    });
  }

  occurrences.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    if (left.kind === right.kind) return 0;
    return left.kind === 'list_ordinal' ? -1 : 1;
  });

  const awaitingBody = new Set();
  let previousEnd = 0;
  for (const occurrence of occurrences) {
    let separator = visible.text.slice(previousEnd, occurrence.start);
    if (occurrence.kind === 'list_ordinal') {
      awaitingBody.add(occurrence.listItemId);
      previousEnd = occurrence.start;
    } else {
      if (occurrence.listItemId != null && awaitingBody.has(occurrence.listItemId)) {
        awaitingBody.delete(occurrence.listItemId);
        if (separator === '') separator = ' ';
      }
      previousEnd = occurrence.end;
    }
    occurrence.separator_before = separator;
  }

  return { value, occurrences };
}

/**
 * Returns canonical visible words plus their exact preceding separators.
 *
 * The same sequence contains both text-node words and Core-owned structural words
 * such as ordered-list ordinals.  Consumers therefore receive one lossless spoken
 * word stream without parsing Markdown or inventing a second identity space.
 *
 * @param {string} html - Core-rendered canonical content HTML.
 * @returns {Array<Object<string, string>>} Ordered words and separators.
 */
export function canonicalWordDescriptorsFromHtml(html) {
  return canonicalWordOccurrences(html).occurrences.map(occurrence => ({
    text: occurrence.text,
    separator_before: occurrence.separator_before
  }));
}
`);

replaceOnce(
  wordPath,
`  const segments = htmlSegments(String(html ?? ''));
  const visible = visibleWordStream(String(html ?? ''), segments);
  const insertions = new Map();
  const words = [];
  const prefixedListItems = new Set();
  CANONICAL_WORD_PATTERN.lastIndex = 0;
  for (const match of visible.text.matchAll(CANONICAL_WORD_PATTERN)) {
    const id = state.nextWordId++;
    if (!Number.isSafeInteger(id)) {
      throw new RangeError('Canonical word ID exceeded JavaScript safe integer range.');
    }
    const start = match.index;
    const end = start + match[0].length;
    const pieces = rawTokenPieces(visible.map, start, end);
    if (!pieces.length) {
      throw new TypeError(\`Canonical word ${'${id}'} has no rendered text piece.\`);
    }

    const groups = [];
    const seenGroups = new Set();
    for (let index = start; index < end; ++index) {
      for (const group of visible.map[index]?.groups ?? []) {
        if (!seenGroups.has(group)) {
          seenGroups.add(group);
          groups.push(group);
        }
      }
    }
    const firstMapped = visible.map.slice(start, end).find(Boolean);
    let speechPrefixBefore = '';
    if (firstMapped?.listItemId != null &&
        firstMapped.speechPrefixBefore &&
        !prefixedListItems.has(firstMapped.listItemId)) {
      prefixedListItems.add(firstMapped.listItemId);
      speechPrefixBefore = firstMapped.speechPrefixBefore;
    }
    words.push({
      id,
      text: match[0],
      groups,
      speech_prefix_before: speechPrefixBefore
    });

    pieces.forEach((piece, pieceIndex) => {
      const attribute = pieceIndex === 0
        ? \`id="word-${'${id}'}"\`
        : \`data-word-id="${'${id}'}"\`;
      addInsertion(insertions, piece.rawStart, \`<span ${'${attribute}'}>\`);
      addInsertion(insertions, piece.rawEnd, '</span>');
    });
  }

  return {
    html: applyInsertions(String(html ?? ''), insertions),
    words
  };
`,
`  const canonical = canonicalWordOccurrences(String(html ?? ''));
  const insertions = new Map();
  const words = [];
  for (const occurrence of canonical.occurrences) {
    const id = state.nextWordId++;
    if (!Number.isSafeInteger(id)) {
      throw new RangeError('Canonical word ID exceeded JavaScript safe integer range.');
    }

    words.push({
      id,
      text: occurrence.text,
      groups: occurrence.groups
    });

    if (occurrence.kind === 'list_ordinal') {
      const rawTag = canonical.value.slice(occurrence.rawStart, occurrence.rawEnd);
      if (/\\bid\\s*=/iu.test(rawTag)) {
        throw new TypeError(
          \`Canonical ordered-list item already has an id before word ${'${id}'}.\`);
      }
      addInsertion(
        insertions,
        occurrence.rawEnd - 1,
        \` id="word-${'${id}'}"\`
      );
      continue;
    }

    if (!occurrence.pieces.length) {
      throw new TypeError(\`Canonical word ${'${id}'} has no rendered text piece.\`);
    }
    occurrence.pieces.forEach((piece, pieceIndex) => {
      const attribute = pieceIndex === 0
        ? \`id="word-${'${id}'}"\`
        : \`data-word-id="${'${id}'}"\`;
      addInsertion(insertions, piece.rawStart, \`<span ${'${attribute}'}>\`);
      addInsertion(insertions, piece.rawEnd, '</span>');
    });
  }

  return {
    html: applyInsertions(canonical.value, insertions),
    words
  };
`);

const oldPrefixTest = 'tests/canonical-word-speech-prefix.test.js';
if (!fs.existsSync(oldPrefixTest)) {
  throw new Error(`${oldPrefixTest}: expected superseded regression file`);
}
fs.unlinkSync(oldPrefixTest);

replaceOnce(
  'DESIGN.md',
`## Canonical structural speech prefixes

Canonical \`speech_words\` may include \`speech_prefix_before\`.  The value is empty
for ordinary words.  When Core-owned structure has spoken content that is not
itself a transcript word, the first canonical word following that structure
carries the exact prefix to speak.  Ordered-list items currently use this to carry
the resolved marker, for example \`3. \` before the first word of item 3.

The prefix is derived from the same canonical HTML structure that already exposes
ordered-list \`data-list-ordinal\`; consumers do not parse Markdown or infer list
numbers.  Prefix characters are structural speech tokens rather than canonical
interactive words.  They therefore have no numeric word ID and no \`word-N\` DOM
element.  A speech engine may tokenize the prefix for playback, but must represent
those tokens as having no word handle rather than inventing or borrowing identity.

This preserves the distinction between semantic structure and word identity while
allowing a consumer to build its exact spoken stream from Core output.  Exact word
lookup returns the same prefix-enriched word record, so off-window materialization
and speech preparation observe one contract.
`,
`## Canonical ordered-list ordinal identity

An ordered-list ordinal is a canonical interactive/spoken word.  It participates in
the same transcript-global numeric \`word_id\` sequence as ordinary textual words;
there is no separate prefix-token or structural-highlight identity space.

The browser renders an ordered-list marker structurally, so the canonical DOM word
element for the ordinal is the corresponding \`<li>\` itself.  For example:

\`\`\`html
<li id="word-41" data-list-ordinal="3">
  <span id="word-42">Third</span>
  <span id="word-43">item</span>
</li>
\`\`\`

While word 41 is spoken, a consumer highlights \`#word-41\`, which naturally
highlights the entire list item including its descendants.  When playback advances
to word 42, ordinary word highlighting resumes.  Nested ordered-list ordinals put
their own IDs on their own nested \`<li>\` elements, never on an ancestor.

Core resolves the ordinal from ordered-list structure and exposes it through the
same \`speech_words\`, \`projectCanonicalWords()\`, and \`locateCanonicalWord()\`
contracts as every other canonical word.  Consumers do not parse Markdown, create
hidden ordinal mapping elements, or invent a second association channel.
`);

fs.appendFileSync(
  'DECISIONS.md',
`\n\n## D024 — Ordered-list ordinals are canonical word identities\n\n` +
`**Status:** Accepted; supersedes D023 for ordered-list ordinals and narrows the ` +
`span-only wording of D019.\n\n` +
`**Decision:** An ordered-list ordinal is a canonical interactive/spoken word with ` +
`its own transcript-global numeric \`word_id\`. Because the browser renders the list ` +
`marker structurally, the corresponding \`<li>\` is the one canonical DOM word element ` +
`for that ordinal and carries \`id="word-N"\`. The item body receives subsequent ` +
`canonical word IDs normally. Nested ordinals identify their own nested list items.\n\n` +
`There is no separate prefix-token identity, null-handle structural token, hidden ` +
`ordinal mapping element, or consumer-side structural-highlight association. ` +
`\`speech_words\`, \`projectCanonicalWords()\`, and \`locateCanonicalWord()\` expose ` +
`the same ordinal identity as the HTML.\n\n` +
`**Reason:** AgentPanelSpeaker's established interaction contract highlights the ` +
`entire list item while its number is spoken, then returns to ordinary word ` +
`highlighting for the body. Putting the canonical ordinal ID directly on the ` +
`\`<li>\` expresses that behaviour with the existing one-ID/one-DOM-element model and ` +
`eliminates the synthetic ordinal mapping and the incorrect no-ID prefix design.\n`
);

replaceOnce(
  'src/projections/word-element.js',
` * the public HTML contract: every canonical word leaves Core as exactly one
 * \`<span id="word-N">...</span>\`, with any applicable inline formatting nested
 * inside that span. Consumers never repair or reconstruct word identity.
`,
` * the public HTML contract: every canonical word leaves Core as exactly one DOM
 * word element. Ordinary textual words use \`<span id="word-N">...</span>\`; an
 * ordered-list ordinal uses its canonical \`<li id="word-N">\` because that
 * structural element is the visible/highlightable word object. Applicable inline
 * formatting remains nested inside ordinary word spans. Consumers never repair or
 * reconstruct word identity.
`);
