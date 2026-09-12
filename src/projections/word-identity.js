/**
 * Canonical speech/display token grammar shared by interactive Core projections.
 *
 * Decimal/fractional values are one unit, runs of periods remain one unit,
 * ordinary Unicode words retain apostrophes/hyphens, and every remaining
 * non-whitespace symbol is an individual unit.  This is intentionally the same
 * semantic grammar used by AgentPanelSpeaker's existing speech boundary model;
 * the consumer-side copy is migration debt tracked separately.
 */
const CANONICAL_WORD_PATTERN =
  /(?<![\p{L}\p{M}\p{N}_.])\d*\.\d+(?!\.\d)(?=[fFlL]|\b)|\.+|[\p{L}\p{M}\p{N}_]+(?:['’\-][\p{L}\p{M}\p{N}_]+)*|[^\s]/gu;

/** HTML tags whose boundaries separate visible speech-token runs. */
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'
]);

/** HTML elements that never contain a matching closing tag. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
]);

/** Core content containers whose descendants participate in word identity. */
const WORD_CONTENT_CLASSES = new Set([
  'presentation-content',
  'thought',
  'user-context-details',
  'subagent-content'
]);

/** Named entities emitted by Core/Marked escaping that affect visible tokens. */
const BASIC_HTML_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00a0',
  quot: '"'
});

/**
 * Creates one global word-enumeration state for a complete transcript render.
 *
 * @returns {Object<string, number>} Mutable render-local enumeration state.
 */
export function createCanonicalWordState() {
  return { nextWordId: 1 };
}

/**
 * Finds the end of one HTML tag while respecting quoted attribute values.
 *
 * Core applies this only to HTML produced by its own canonical renderer.  A
 * malformed unterminated tag is an invariant violation rather than a reason to
 * guess where visible text resumes.
 *
 * @param {string} html - Complete HTML fragment.
 * @param {number} start - Index of the opening `<`.
 * @returns {number} Exclusive end offset of the complete tag/comment.
 */
function htmlTagEnd(html, start) {
  if (html.startsWith('<!--', start)) {
    const commentEnd = html.indexOf('-->', start + 4);
    if (commentEnd < 0) {
      throw new TypeError('Canonical HTML contains an unterminated comment.');
    }
    return commentEnd + 3;
  }

  let quote = '';
  for (let index = start + 1; index < html.length; ++index) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') return index + 1;
  }
  throw new TypeError('Canonical HTML contains an unterminated tag.');
}

/**
 * Parses structural information needed from one canonical HTML tag.
 *
 * @param {string} raw - Complete raw HTML tag.
 * @returns {Object<string, *>} Parsed tag metadata.
 */
function parseHtmlTag(raw) {
  if (raw.startsWith('<!--') || raw.startsWith('<!') || raw.startsWith('<?')) {
    return {
      name: '',
      closing: false,
      selfClosing: true,
      classes: []
    };
  }

  const match = raw.match(/^<\s*(\/?)\s*([A-Za-z][\w:-]*)\b([\s\S]*?)>$/);
  if (!match) {
    throw new TypeError(`Unsupported canonical HTML tag: ${raw.slice(0, 80)}`);
  }
  const name = match[2].toLowerCase();
  const attributes = match[3] ?? '';
  const classMatch = attributes.match(
    /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
  );
  const classes = (classMatch?.[1] ?? classMatch?.[2] ?? classMatch?.[3] ?? '')
    .split(/\s+/u)
    .filter(Boolean);
  return {
    name,
    closing: match[1] === '/',
    selfClosing: VOID_TAGS.has(name) || /\/\s*$/.test(attributes),
    classes
  };
}

/**
 * Decodes one HTML entity to the single visible character/string it represents.
 *
 * Numeric entities and the entities Core/Marked itself emits are authoritative.
 * Other named entities are preserved as their literal entity spelling in the
 * word text rather than guessed as a different character.
 *
 * @param {string} entity - Raw entity spelling including `&` and `;`.
 * @returns {string} Visible token text used by the word projection.
 */
function decodeHtmlEntity(entity) {
  const body = entity.slice(1, -1);
  if (/^#\d+$/u.test(body)) {
    return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
  }
  if (/^#x[\dA-Fa-f]+$/u.test(body)) {
    return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
  }
  return BASIC_HTML_ENTITIES[body] ?? entity;
}

/**
 * Converts one raw HTML text segment to visible text plus exact raw offsets.
 *
 * Each visible UTF-16 code unit carries the raw source interval that produced it
 * so a canonical token can later be wrapped without searching for its text.
 *
 * @param {string} raw - Raw HTML text-node serialization.
 * @param {number} absoluteStart - Raw offset of the segment in the HTML fragment.
 * @param {Array<string>} groups - Semantic ancestor groups for the text segment.
 * @returns {Object<string, *>} Visible text and exact raw-offset map.
 */
function decodeTextSegment(raw, absoluteStart, groups) {
  let text = '';
  const map = [];
  for (let index = 0; index < raw.length;) {
    if (raw[index] === '&') {
      const match = raw.slice(index).match(/^&(?:#\d+|#x[\dA-Fa-f]+|[A-Za-z][A-Za-z0-9]+);/u);
      if (match) {
        const decoded = decodeHtmlEntity(match[0]);
        text += decoded;
        for (let offset = 0; offset < decoded.length; ++offset) {
          map.push({
            rawStart: absoluteStart + index,
            rawEnd: absoluteStart + index + match[0].length,
            groups
          });
        }
        index += match[0].length;
        continue;
      }
    }

    const codePoint = raw.codePointAt(index);
    const visible = String.fromCodePoint(codePoint);
    text += visible;
    for (let offset = 0; offset < visible.length; ++offset) {
      map.push({
        rawStart: absoluteStart + index,
        rawEnd: absoluteStart + index + visible.length,
        groups
      });
    }
    index += visible.length;
  }
  return { text, map };
}

/**
 * Returns normalized semantic group names represented by the current ancestors.
 *
 * Core HTML classes remain the structural authority.  The word projection
 * normalizes hyphens to underscores only for transport-friendly group keys; it
 * does not add per-word CSS classes to the HTML.
 *
 * @param {Array<Object<string, *>>} stack - Open canonical HTML elements.
 * @returns {Array<string>} Stable semantic group keys in ancestor order.
 */
function semanticGroups(stack) {
  const groups = [];
  const seen = new Set();
  for (const element of stack) {
    for (const className of element.classes ?? []) {
      const group = className.replaceAll('-', '_');
      if (!seen.has(group)) {
        seen.add(group);
        groups.push(group);
      }
      if (className.startsWith('language-')) {
        const language = className.slice('language-'.length);
        const fenceGroup = `fence:${language}`;
        if (!seen.has('fenced_code')) {
          seen.add('fenced_code');
          groups.push('fenced_code');
        }
        if (language && !seen.has(fenceGroup)) {
          seen.add(fenceGroup);
          groups.push(fenceGroup);
        }
      }
    }
  }
  return groups;
}

/**
 * Returns whether the current element ancestry is canonical interactive content.
 *
 * Turn headings and generated disclosure summaries stay display structure rather
 * than becoming speech/interaction words.  Markdown headings inside a canonical
 * content container remain included because their content ancestor stays active.
 *
 * @param {Array<Object<string, *>>} stack - Open canonical HTML elements.
 * @returns {boolean} Whether descendant text participates in word identity.
 */
function isWordContent(stack) {
  if (stack.some(element => element.name === 'summary')) return false;
  return stack.some(element =>
    (element.classes ?? []).some(className => WORD_CONTENT_CLASSES.has(className))
  );
}

/**
 * Splits one canonical HTML fragment into tags and text with semantic ancestry.
 *
 * @param {string} html - Core-rendered HTML for one canonical unit.
 * @returns {Array<Object<string, *>>} Ordered serialization segments.
 */
function htmlSegments(html) {
  const segments = [];
  const stack = [];
  let cursor = 0;

  while (cursor < html.length) {
    if (html[cursor] !== '<') {
      const end = html.indexOf('<', cursor);
      const rawEnd = end < 0 ? html.length : end;
      segments.push({
        kind: 'text',
        rawStart: cursor,
        rawEnd,
        groups: semanticGroups(stack),
        wordContent: isWordContent(stack)
      });
      cursor = rawEnd;
      continue;
    }

    const end = htmlTagEnd(html, cursor);
    const raw = html.slice(cursor, end);
    const tag = parseHtmlTag(raw);
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
          throw new TypeError(`Canonical HTML closes unopened <${tag.name}>.`);
        }
      } else if (!tag.selfClosing) {
        stack.push(tag);
      }
    }
    cursor = end;
  }

  if (stack.length) {
    throw new TypeError(
      `Canonical HTML leaves <${stack.at(-1).name}> unclosed.`
    );
  }
  return segments;
}

/**
 * Adds one insertion at a raw HTML offset.
 *
 * @param {Map<number, Array<string>>} insertions - Pending output insertions.
 * @param {number} offset - Raw HTML offset.
 * @param {string} value - Markup to insert at that offset.
 * @returns {void} The insertion is appended at the supplied offset.
 */
function addInsertion(insertions, offset, value) {
  const values = insertions.get(offset) ?? [];
  values.push(value);
  insertions.set(offset, values);
}

/**
 * Builds a tokenizable visible stream and exact raw-offset map from HTML segments.
 *
 * Block boundaries become unmapped whitespace sentinels, preventing one word
 * from joining across separate canonical block-level structures. Inline markup
 * contributes no boundary and therefore cannot split `turn_id` + `s` identity.
 *
 * @param {string} html - Complete canonical unit HTML.
 * @param {Array<Object<string, *>>} segments - Parsed HTML segments.
 * @returns {Object<string, *>} Visible stream and exact raw-offset map.
 */
function visibleWordStream(html, segments) {
  let text = '';
  const map = [];
  for (const segment of segments) {
    if (segment.kind === 'tag') {
      if (segment.boundary && text && !/\s$/u.test(text)) {
        text += '\n';
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
    map.push(...decoded.map);
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

/**
 * Returns the canonical visible word texts in one Core HTML fragment.
 *
 * @param {string} html - Core-rendered canonical content HTML.
 * @returns {Array<string>} Canonical visible word texts in render order.
 */
export function canonicalWordTextsFromHtml(html) {
  return canonicalWordDescriptorsFromHtml(html).map(word => word.text);
}

/**
 * Returns exact raw HTML pieces covered by one canonical visible token.
 *
 * @param {Array<Object<string, *>|null>} map - Visible-to-raw offset map.
 * @param {number} start - Inclusive visible start offset.
 * @param {number} end - Exclusive visible end offset.
 * @returns {Array<Object<string, number>>} Contiguous raw text pieces.
 */
function rawTokenPieces(map, start, end) {
  const pieces = [];
  let current = null;
  for (let index = start; index < end; ++index) {
    const entry = map[index];
    if (!entry) {
      throw new TypeError('Canonical word unexpectedly crosses a block boundary.');
    }
    if (current && entry.rawStart <= current.rawEnd) {
      current.rawEnd = Math.max(current.rawEnd, entry.rawEnd);
      continue;
    }
    current = {
      rawStart: entry.rawStart,
      rawEnd: entry.rawEnd
    };
    pieces.push(current);
  }
  return pieces;
}

/**
 * Renders raw HTML with all deterministic word-span insertions applied.
 *
 * @param {string} html - Original canonical unit HTML.
 * @param {Map<number, Array<string>>} insertions - Markup indexed by raw offset.
 * @returns {string} HTML containing stable `word-N` identities.
 */
function applyInsertions(html, insertions) {
  let output = '';
  for (let index = 0; index <= html.length; ++index) {
    const values = insertions.get(index);
    if (values) output += values.join('');
    if (index < html.length) output += html[index];
  }
  return output;
}

/**
 * Adds canonical global word identities to one Core-rendered HTML unit.
 *
 * Identity is allocated exactly once from the supplied transcript-wide state.
 * A word spanning inline markup uses one unique DOM `id` on its first text piece
 * and `data-word-id` on subsequent pieces, preserving one canonical handle
 * without emitting duplicate HTML IDs.
 *
 * @param {string} html - Core-rendered HTML for one complete canonical unit.
 * @param {Object<string, number>} state - Transcript-wide word enumeration state.
 * @returns {Object<string, *>} Annotated HTML and canonical word records.
 */
export function annotateCanonicalHtmlWords(html, state) {
  if (!state || !Number.isSafeInteger(state.nextWordId) || state.nextWordId < 1) {
    throw new TypeError('Canonical word state requires a positive safe nextWordId.');
  }

  const segments = htmlSegments(String(html ?? ''));
  const visible = visibleWordStream(String(html ?? ''), segments);
  const insertions = new Map();
  const words = [];
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
      throw new TypeError(`Canonical word ${id} has no rendered text piece.`);
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
    words.push({ id, text: match[0], groups });

    pieces.forEach((piece, pieceIndex) => {
      const attribute = pieceIndex === 0
        ? `id="word-${id}"`
        : `data-word-id="${id}"`;
      addInsertion(insertions, piece.rawStart, `<span ${attribute}>`);
      addInsertion(insertions, piece.rawEnd, '</span>');
    });
  }

  return {
    html: applyInsertions(String(html ?? ''), insertions),
    words
  };
}
