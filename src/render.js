import { adaptChatGPTRecords } from './adapters/chatgpt.js';
import { adaptClaudeRecords } from './adapters/claude.js';
import { adaptCodexRecords } from './adapters/codex.js';
import { renderCanonicalMarkdown } from './projections/markdown.js';
import { renderCanonicalHtml } from './projections/html.js';
import { buildCanonicalPresentation } from './projections/presentation.js';

/** Supported high-level render output formats. */
export const RENDER_FORMATS = Object.freeze({
  MARKDOWN: 'markdown',
  HTML: 'html'
});

/** Supported high-level render input kinds. */
export const RENDER_INPUT_KINDS = Object.freeze({
  CANONICAL: 'canonical',
  PROVIDER_RECORDS: 'provider_records'
});

/**
 * Normalizes provider records through the requested canonical adapter.
 *
 * @param {Array<Object<string, *>>} records - Ordered provider-native records to normalize.
 * @param {string} provider - Provider identifier selecting the canonical adapter.
 * @returns {Array<Object<string, *>>} Ordered canonical event stream produced by the selected adapter.
 */
function adaptProviderRecords(records, provider) {
  if (!Array.isArray(records)) throw new TypeError('Provider records must be an array.');
  if (provider === 'chatgpt') return adaptChatGPTRecords(records);
  if (provider === 'claude') return adaptClaudeRecords(records);
  if (provider === 'codex') return adaptCodexRecords(records);
  throw new RangeError(`Unsupported provider: ${provider}`);
}

/**
 * Applies high-level semantic display options without mutating canonical events supplied by the caller.
 *
 * @param {Array<Object<string, *>>} events - Ordered canonical events to prepare for presentation.
 * @param {Object<string, *>} display - Semantic display settings shared across render formats.
 * @returns {Array<Object<string, *>>} Detached event views carrying requested projection/display metadata.
 */
function applyDisplayOptions(events, display) {
  const hasDebug = Object.hasOwn(display, 'debug_provenance');
  const hasSeparateThoughts = Object.hasOwn(display, 'separate_thoughts');
  const hasTurnId = Object.hasOwn(display, 'show_turn_id');
  if (!hasDebug && !hasSeparateThoughts && !hasTurnId) return events;
  return events.map(event => {
    const projection = { ...(event?.projection ?? {}) };
    if (hasDebug) projection.debug_provenance = Boolean(display.debug_provenance);
    if (hasSeparateThoughts) projection.separate_thoughts = Boolean(display.separate_thoughts);
    if (hasTurnId) {
      projection.heading_metadata = {
        ...(projection.heading_metadata ?? {}),
        show_turn_id: Boolean(display.show_turn_id)
      };
    }
    return { ...event, projection };
  });
}

/**
 * Resolves high-level API input into the canonical event stream used by all render formats.
 *
 * @param {Array<Object<string, *>>} input - Canonical events or provider-native records according to the input-kind setting.
 * @param {Object<string, *>} options - Render options containing input kind and optional provider selector.
 * @returns {Array<Object<string, *>>} Ordered canonical event stream for rendering.
 */
function resolveCanonicalEvents(input, options) {
  const inputKind = options.input_kind ?? RENDER_INPUT_KINDS.CANONICAL;
  if (inputKind === RENDER_INPUT_KINDS.CANONICAL) {
    if (!Array.isArray(input)) throw new TypeError('Canonical events must be an array.');
    return input;
  }
  if (inputKind === RENDER_INPUT_KINDS.PROVIDER_RECORDS) {
    if (!options.provider) throw new TypeError('provider is required for provider_records input.');
    return adaptProviderRecords(input, options.provider);
  }
  throw new RangeError(`Unsupported input kind: ${inputKind}`);
}

/**
 * Renders one AI conversation through the canonical normalization, structural-presentation, and output-format contract.
 *
 * This is the preferred consumer API. Provider normalization is optional when
 * callers already have canonical events. Markdown and HTML share the same
 * canonical Markdown semantics and structural presentation model; HTML adds the
 * core-owned semantic markup and stylesheet/theme contract rather than requiring
 * each host to invent its own transcript presentation.
 *
 * @param {Array<Object<string, *>>} input - Canonical events or provider-native records selected by options.input_kind.
 * @param {Object<string, *>} options - Render settings including format, input kind, provider, semantic display options, theme overrides, and HTML document wrapping.
 * @returns {Object<string, *>} Render result containing canonical events, structural presentation metadata, format, content, and format-specific companion data.
 */
export function renderConversation(input, options = {}) {
  const canonicalEvents = resolveCanonicalEvents(input, options);
  const display = { ...(options.display ?? {}) };
  const events = applyDisplayOptions(canonicalEvents, display);
  const presentation = buildCanonicalPresentation(events, display);
  const format = options.format ?? RENDER_FORMATS.MARKDOWN;

  if (format === RENDER_FORMATS.MARKDOWN) {
    const markdown = renderCanonicalMarkdown(events);
    return {
      format,
      content: markdown,
      markdown,
      html: null,
      stylesheet: null,
      presentation,
      events
    };
  }

  if (format === RENDER_FORMATS.HTML) {
    const rendered = renderCanonicalHtml(events, {
      theme: options.theme ?? null,
      display,
      document: Boolean(options.document)
    });
    return {
      format,
      content: rendered.html,
      markdown: rendered.markdown,
      html: rendered.html,
      stylesheet: rendered.stylesheet,
      presentation: rendered.presentation,
      events
    };
  }

  throw new RangeError(`Unsupported render format: ${format}`);
}
