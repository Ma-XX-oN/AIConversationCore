from pathlib import Path


def replace_once(text, old, new, label):
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{label}: expected exactly one match, found {count}')
  return text.replace(old, new, 1)


# Preserve source values required for Core-owned heading projection.
path = Path('src/adapters/chatgpt-base.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  """      source: {
        provider: 'chatgpt',
        record_id: sourceRecordId,
        record_index: sourceIndex
      }
""",
  """      source: {
        provider: 'chatgpt',
        record_id: sourceRecordId,
        record_index: sourceIndex,
        turn_id: sourceRecordId,
        timestamp: record?.create_time ?? record?.update_time ?? null
      }
""",
  'ChatGPT event source provenance'
)
path.write_text(text, encoding='utf-8')

path = Path('src/adapters/claude.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  """  const source = {
    provider: 'claude',
    record_id: record?.uuid ?? record?.message?.id ?? null,
    record_index: sourceIndex
  };
""",
  """  const source = {
    provider: 'claude',
    record_id: record?.uuid ?? record?.message?.id ?? null,
    record_index: sourceIndex,
    turn_id: typeof record?.uuid === 'string' ? record.uuid : null,
    timestamp: record?.timestamp ?? null
  };
""",
  'Claude source provenance'
)
path.write_text(text, encoding='utf-8')

path = Path('src/adapters/codex.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  """  return {
    provider: 'codex',
    record_id: null,
    record_index: sourceIndex
  };
""",
  """  return {
    provider: 'codex',
    record_id: null,
    record_index: sourceIndex,
    turn_id: null,
    timestamp: record?.timestamp ?? null
  };
""",
  'Codex source provenance'
)
path.write_text(text, encoding='utf-8')

# Make the Markdown serializer consume only Core-owned semantic metadata.
path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')
text = "import { renderHeadingDebugComment } from './heading-metadata.js';\n\n" + text
text = replace_once(
  text,
  """  const turnId = metadata.turn_id ?? event?.source_record_id;
  if (metadata.show_turn_id && turnId != null) {
    fields.push(`turn_id=${turnId}`);
  }
""",
  """  if (metadata.turn_id != null) {
    fields.push(`turn_id=${metadata.turn_id}`);
  }
""",
  'Markdown first-class turn ID'
)
text = replace_once(
  text,
  """function projectedComment(event, quoted = false) {
  const projection = event?.projection ?? {};
  if (!projection.debug_provenance) return '';
  const fields = [];
  if (event?.source_record_id != null) fields.push(`record_id=${event.source_record_id}`);
  if (Number.isInteger(event?.source_index)) fields.push(`record_index=${event.source_index}`);
  if (!fields.length) return '';
  const comment = `<!-- ${fields.join(' ')} -->`;
  return quoted ? quoteMarkdown(comment) : comment;
}
""",
  """function projectedComment(event, quoted = false) {
  const projection = event?.projection ?? {};
  const coreComment = renderHeadingDebugComment(projection.heading_metadata ?? {});
  if (coreComment) return quoted ? quoteMarkdown(coreComment) : coreComment;

  // Internal compatibility for old direct-renderer tests. Public Core renderers
  // strip this caller field and derive debug provenance from canonical source.
  if (!projection.debug_provenance) return '';
  const fields = [];
  if (event?.source_record_id != null) fields.push(`record_id=${event.source_record_id}`);
  if (Number.isInteger(event?.source_index)) fields.push(`record_index=${event.source_index}`);
  if (!fields.length) return '';
  const comment = `<!-- ${fields.join(' ')} -->`;
  return quoted ? quoteMarkdown(comment) : comment;
}
""",
  'Markdown debug provenance'
)
text = replace_once(
  text,
  """  const headingEvent = segment[0];
  // Consumer response-heading metadata may differ from the first activity event's own heading metadata.
  const responseHeadingEvent = headingEvent?.projection?.response_heading_suffix != null
    ? {
        ...headingEvent,
        projection: {
          ...headingEvent.projection,
          heading_suffix: headingEvent.projection.response_heading_suffix
        }
      }
    : headingEvent;
  return [projectedSection(responseHeadingEvent, `${projectedHeading(responseHeadingEvent, '## ChatGPT')}\n\n${body.join('\n\n')}`)];
""",
  """  const headingEvent = segment[0];
  const finalMessageEvent = [...messages].reverse()[0] ?? null;
  const semanticHeadingEvent = finalMessageEvent ?? headingEvent;
  // Generic caller decoration remains compatible, but semantic metadata comes
  // from the Core-selected final response event rather than an opaque suffix.
  const responseHeadingSuffix = headingEvent?.projection?.response_heading_suffix;
  const responseHeadingEvent = responseHeadingSuffix != null
    ? {
        ...semanticHeadingEvent,
        projection: {
          ...(semanticHeadingEvent?.projection ?? {}),
          heading_suffix: responseHeadingSuffix
        }
      }
    : semanticHeadingEvent;
  return [projectedSection(responseHeadingEvent, `${projectedHeading(responseHeadingEvent, '## ChatGPT')}\n\n${body.join('\n\n')}`)];
""",
  'ChatGPT final-response heading owner'
)
path.write_text(text, encoding='utf-8')

# Make canonical HTML serialize the same Core-owned metadata from the presentation tree.
path = Path('src/projections/html.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  """import { marked } from 'marked';

import { buildCanonicalPresentation } from './presentation-revisions.js';
""",
  """import { marked } from 'marked';

import {
  headingMetadataComponents,
  renderHeadingDebugComment
} from './heading-metadata.js';
import { buildCanonicalPresentation } from './presentation-revisions.js';
import { resolveProjectionTheme, STYLE_ROLES } from './style.js';
""",
  'HTML heading imports'
)
text = replace_once(
  text,
  """function renderMarkdownNode(node, emittedSourceIndexes, className = 'presentation-content') {
  const anchors = renderSourceAnchors(node, emittedSourceIndexes);
  const markdown = nodeMarkdown(node);
  const body = markdown ? renderMarkdown(markdown) : '';
  return `<div class="${className}" data-presentation-id="${htmlEscape(node?.id ?? '')}">${anchors}${body}</div>`;
}
""",
  """function renderMarkdownNode(node, emittedSourceIndexes, className = 'presentation-content') {
  const anchors = renderSourceAnchors(node, emittedSourceIndexes);
  const debug = renderHeadingDebugComment(node?.heading_metadata ?? {});
  const markdown = nodeMarkdown(node);
  const body = markdown ? renderMarkdown(markdown) : '';
  return `<div class="${className}" data-presentation-id="${htmlEscape(node?.id ?? '')}">` +
    `${debug}${anchors}${body}</div>`;
}
""",
  'HTML node debug provenance'
)
render_turn_old = """function renderTurn(turn, emittedSourceIndexes) {
  const label = turn?.actor?.label || (turn?.actor?.role === 'user' ? 'User' : 'Agent');
  const children = (turn?.children ?? [])
    .map(node => renderNode(node, emittedSourceIndexes))
    .join('');
  return `<section class="transcript-turn" data-presentation-id="${htmlEscape(turn?.id ?? '')}">` +
    `<h2>${htmlEscape(label)}</h2>` +
    `<blockquote class="transcript-turn-body">${children}</blockquote></section>`;
}
"""
render_turn_new = """function renderTurnHeading(turn, options = {}) {
  const label = turn?.actor?.label || (turn?.actor?.role === 'user' ? 'User' : 'Agent');
  const metadata = turn?.heading_metadata ?? {};
  const components = headingMetadataComponents(metadata);
  const debug = renderHeadingDebugComment(metadata);
  if (!components.length && !debug) return `<h2>${htmlEscape(label)}</h2>`;

  const theme = resolveProjectionTheme(options?.theme ?? null);
  const speakerRole = turn?.actor?.role === 'user'
    ? STYLE_ROLES.USER_HEADING
    : STYLE_ROLES.ASSISTANT_HEADING;
  const speakerClass = theme.html[speakerRole] ?? '';
  const speaker = speakerClass
    ? `<span class="${htmlEscape(speakerClass)}">${htmlEscape(label)}</span>`
    : `<span>${htmlEscape(label)}</span>`;
  const fields = components.map(component => {
    const className = theme.html[component.styleRole] ?? '';
    const value = htmlEscape(component.text);
    return className
      ? `<span class="${htmlEscape(className)}">${value}</span>`
      : `<span>${value}</span>`;
  });
  if (debug) fields.push(debug);
  return `<h2>${[speaker, ...fields].join(' ')}</h2>`;
}

/**
 * Renders one canonical turn from the provider-independent presentation tree.
 *
 * @param {Object<string, *>} turn - Canonical presentation turn.
 * @param {Set<number>} emittedSourceIndexes - Source indexes already emitted.
 * @param {Object<string, *>} options - Projection options.
 * @returns {string} Canonical turn HTML.
 */
function renderTurn(turn, emittedSourceIndexes, options = {}) {
  const children = (turn?.children ?? [])
    .map(node => renderNode(node, emittedSourceIndexes))
    .join('');
  return `<section class="transcript-turn" data-presentation-id="${htmlEscape(turn?.id ?? '')}">` +
    `${renderTurnHeading(turn, options)}` +
    `<blockquote class="transcript-turn-body">${children}</blockquote></section>`;
}
"""
# Replace the original JSDoc+function by targeting from the function only, then
# separately update the preceding JSDoc parameter list below.
text = replace_once(text, render_turn_old, render_turn_new, 'HTML turn renderer')
text = replace_once(
  text,
  """ * @param {Set<number>} emittedSourceIndexes - Source indexes already emitted.
 * @returns {string} Canonical turn HTML.
 */
function renderTurnHeading""",
  """ * @param {Set<number>} emittedSourceIndexes - Source indexes already emitted.
 * @returns {string} Canonical turn HTML.
 */
function renderTurnHeading""",
  'HTML retained turn heading JSDoc marker'
) if False else text
text = replace_once(
  text,
  """ * @param {Array<Object<string, *>>} events - Ordered normalized canonical events.
 * @returns {Array<Object<string, *>>} Ordered indivisible canonical HTML units.
 */
export function renderCanonicalHtmlUnits(events) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');
  const presentation = buildCanonicalPresentation(events);
""",
  """ * @param {Array<Object<string, *>>} events - Ordered normalized canonical events.
 * @param {Object<string, *>} options - Projection options.
 * @returns {Array<Object<string, *>>} Ordered indivisible canonical HTML units.
 */
export function renderCanonicalHtmlUnits(events, options = {}) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');
  const presentation = buildCanonicalPresentation(events, options);
""",
  'HTML unit options'
)
text = replace_once(
  text,
  """    source: (turn?.source ?? []).map(source => ({ ...source })),
    html: renderTurn(turn, emittedSourceIndexes)
""",
  """    source: (turn?.source ?? []).map(source => ({ ...source })),
    html: renderTurn(turn, emittedSourceIndexes, options)
""",
  'HTML turn options'
)
text = replace_once(
  text,
  """ * @param {Array<Object<string, *>>} events - Ordered normalized canonical events.
 * @returns {string} Complete canonical HTML transcript.
 */
export function renderCanonicalHtml(events) {
  return renderCanonicalHtmlUnits(events)
""",
  """ * @param {Array<Object<string, *>>} events - Ordered normalized canonical events.
 * @param {Object<string, *>} options - Projection options.
 * @returns {string} Complete canonical HTML transcript.
 */
export function renderCanonicalHtml(events, options = {}) {
  return renderCanonicalHtmlUnits(events, options)
""",
  'HTML complete options'
)
path.write_text(text, encoding='utf-8')
