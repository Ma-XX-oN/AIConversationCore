import { renderCanonicalMarkdown } from './markdown.js';
import { buildCanonicalPresentation } from './presentation.js';
import { resolveProjectionTheme, STYLE_ROLES } from './style.js';

/**
 * Escapes plain text for safe insertion into canonical HTML.
 *
 * @param {string} value - Plain text to HTML-escape.
 * @returns {string} HTML-escaped text.
 */
function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Protects renderer-generated raw HTML fragments while inline Markdown is escaped and transformed.
 *
 * @param {string} text - Inline Markdown text that may contain canonical raw HTML fragments.
 * @returns {Object<string, *>} Protected text plus ordered raw HTML fragments for later restoration.
 */
function protectRawHtml(text) {
  const fragments = [];
  const protectedText = String(text).replace(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g, match => {
    const token = `\u0000HTML${fragments.length}\u0000`;
    fragments.push(match);
    return token;
  });
  return { text: protectedText, fragments };
}

/**
 * Restores protected raw HTML fragments after canonical inline-Markdown conversion.
 *
 * @param {string} text - Converted inline HTML containing raw-fragment placeholders.
 * @param {Array<string>} fragments - Ordered protected raw HTML fragments.
 * @returns {string} Inline HTML with raw fragments restored at their original positions.
 */
function restoreRawHtml(text, fragments) {
  let result = text;
  fragments.forEach((fragment, index) => {
    result = result.replaceAll(`\u0000HTML${index}\u0000`, fragment);
  });
  return result;
}

/**
 * Converts the inline Markdown subset emitted by the canonical renderer into deterministic HTML.
 *
 * @param {string} text - Canonical inline Markdown text.
 * @returns {string} Deterministic inline HTML preserving canonical raw HTML fragments.
 */
function renderInline(text) {
  const protectedRaw = protectRawHtml(text);
  let result = htmlEscape(protectedRaw.text);
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return restoreRawHtml(result, protectedRaw.fragments);
}

/**
 * Returns whether one line is canonical block-level raw HTML.
 *
 * Canonical disclosure openings may contain their complete summary on the same
 * line (`<details><summary>…</summary>`). Treating that line as paragraph text
 * would create invalid `<p><details>` nesting, so disclosure openings/closings
 * are classified as block HTML even when the summary shares the opening line.
 *
 * @param {string} line - Markdown source line being classified.
 * @returns {boolean} True for canonical block-level raw HTML boundaries.
 */
function isRawHtmlBlockLine(line) {
  const trimmed = line.trim();
  if (/^<!--[\s\S]*-->$/.test(trimmed)) return true;
  if (/^<details\b[^>]*>(?:<summary\b[^>]*>[\s\S]*<\/summary>)?$/.test(trimmed)) return true;
  if (/^<\/details>$/.test(trimmed)) return true;
  return /^<\/?(?:summary|section|article|div|aside|figure|figcaption|table|thead|tbody|tr|th|td)\b[^>]*>$/.test(trimmed);
}

/**
 * Renders one contiguous paragraph from canonical Markdown lines.
 *
 * @param {Array<string>} lines - Nonblank paragraph lines.
 * @returns {string} Canonical paragraph HTML.
 */
function renderParagraph(lines) {
  return `<p>${renderInline(lines.join('\n')).replaceAll('\n', '<br>')}</p>`;
}

/**
 * Renders one canonical fenced-code block.
 *
 * @param {string} language - Optional fenced-code language label.
 * @param {Array<string>} lines - Raw code lines inside the fence.
 * @returns {string} Canonical pre/code HTML with escaped code contents.
 */
function renderCodeFence(language, lines) {
  const languageClass = language ? ` class="language-${htmlEscape(language)}"` : '';
  return `<pre><code${languageClass}>${htmlEscape(lines.join('\n'))}</code></pre>`;
}

/**
 * Renders one contiguous Markdown blockquote using the same canonical block renderer recursively.
 *
 * @param {Array<string>} lines - Blockquote lines including their leading greater-than markers.
 * @returns {string} Canonical blockquote HTML.
 */
function renderBlockquote(lines) {
  const inner = lines.map(line => line.replace(/^> ?/, '')).join('\n');
  return `<blockquote>${markdownToHtml(inner)}</blockquote>`;
}

/**
 * Renders one contiguous unordered-list block.
 *
 * @param {Array<string>} lines - Canonical unordered-list lines.
 * @returns {string} Canonical unordered-list HTML.
 */
function renderUnorderedList(lines) {
  const items = lines.map(line => line.replace(/^\s*[-*+]\s+/, ''));
  return `<ul>${items.map(item => `<li>${renderInline(item)}</li>`).join('')}</ul>`;
}

/**
 * Converts canonical Markdown into deterministic semantic HTML.
 *
 * The converter intentionally targets the Markdown structures emitted by
 * AIConversationCore itself plus common inline Markdown retained from provider
 * messages. Raw renderer-generated HTML such as details/citation anchors is
 * preserved, so HTML and Markdown share one authoritative semantic projection
 * rather than maintaining independent grouping logic.
 *
 * @param {string} markdown - Complete canonical Markdown transcript projection.
 * @returns {string} Deterministic semantic HTML fragment.
 */
export function markdownToHtml(markdown) {
  const lines = String(markdown ?? '').replaceAll('\r\n', '\n').split('\n');
  const html = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = line.match(/^```([^`]*)$/);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      html.push(renderCodeFence(fence[1].trim(), code));
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*(?:\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)\s*$/.test(line)) {
      html.push('<hr>');
      index += 1;
      continue;
    }
    if (/^>/.test(line)) {
      const quoted = [];
      while (index < lines.length && (/^>/.test(lines[index]) || !lines[index].trim())) {
        quoted.push(lines[index]);
        index += 1;
      }
      html.push(renderBlockquote(quoted));
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index]);
        index += 1;
      }
      html.push(renderUnorderedList(items));
      continue;
    }
    if (isRawHtmlBlockLine(line)) {
      html.push(line.trim());
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^>/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !isRawHtmlBlockLine(lines[index]) &&
      !/^\s*(?:\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)\s*$/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(renderParagraph(paragraph));
  }
  return html.join('\n');
}

/**
 * Renders the canonical stylesheet for one effective projection theme.
 *
 * @param {Object<string, *>|null} themeOverrides - Optional per-render theme overrides merged with configured core defaults.
 * @returns {string} Deterministic CSS implementing canonical transcript style roles.
 */
export function renderCanonicalStylesheet(themeOverrides = null) {
  const theme = resolveProjectionTheme(themeOverrides);
  const classes = theme.html;
  const css = theme.css;
  return `.${classes[STYLE_ROLES.BODY]}{font-family:${css.font_family};font-size:${css.font_size};line-height:${css.line_height};color:${css.foreground};background:${css.background};max-width:${css.content_max_width};}` +
    `.${classes[STYLE_ROLES.BODY]} p{margin:${css.paragraph_gap} 0;}` +
    `.${classes[STYLE_ROLES.BODY]} h1,.${classes[STYLE_ROLES.BODY]} h2,.${classes[STYLE_ROLES.BODY]} h3,.${classes[STYLE_ROLES.BODY]} h4,.${classes[STYLE_ROLES.BODY]} h5,.${classes[STYLE_ROLES.BODY]} h6{margin:${css.section_gap} 0 ${css.paragraph_gap};}` +
    `.${classes[STYLE_ROLES.USER_HEADING]}{color:${css.user_heading};}` +
    `.${classes[STYLE_ROLES.ASSISTANT_HEADING]}{color:${css.assistant_heading};}` +
    `.${classes[STYLE_ROLES.TIMESTAMP]},.${classes[STYLE_ROLES.RECORD_NUMBER]},.${classes[STYLE_ROLES.TURN_ID]}{color:${css.metadata};}` +
    `.${classes[STYLE_ROLES.REASONING]}{color:${css.reasoning};}` +
    `.${classes[STYLE_ROLES.TOOL]}{color:${css.tool};}` +
    `.${classes[STYLE_ROLES.CITATION]}{color:${css.citation};}` +
    `.${classes[STYLE_ROLES.BODY]} a{color:${css.link};}` +
    `.${classes[STYLE_ROLES.BODY]} code,.${classes[STYLE_ROLES.BODY]} pre{font-family:${css.monospace_font_family};color:${css.code_foreground};background:${css.code_background};}` +
    `.${classes[STYLE_ROLES.BODY]} pre{padding:.75rem;border:1px solid ${css.border};border-radius:${css.border_radius};overflow:auto;}` +
    `.${classes[STYLE_ROLES.BODY]} details{margin:${css.paragraph_gap} 0;padding:.25rem .75rem;border-left:3px solid ${css.border};}` +
    `.${classes[STYLE_ROLES.BODY]} blockquote{margin:${css.paragraph_gap} 0;padding-left:1rem;border-left:2px solid ${css.border};}`;
}

/**
 * Applies canonical semantic classes to renderer-generated transcript headings.
 *
 * @param {string} html - Canonical HTML fragment whose transcript headings should receive stable classes.
 * @param {Object<string, *>} theme - Effective projection theme containing HTML class mappings.
 * @returns {string} HTML fragment with stable user/assistant heading classes applied.
 */
function applySemanticClasses(html, theme) {
  const userClass = theme.html[STYLE_ROLES.USER_HEADING];
  const assistantClass = theme.html[STYLE_ROLES.ASSISTANT_HEADING];
  return html
    .replace(/<h2>User([^<]*)<\/h2>/g, `<h2 class="${userClass}">User$1</h2>`)
    .replace(/<h2>(ChatGPT|Claude|Codex)([^<]*)<\/h2>/g, `<h2 class="${assistantClass}">$1$2</h2>`);
}

/**
 * Renders canonical events as semantic HTML using the same canonical Markdown projection as the Markdown API.
 *
 * @param {Array<Object<string, *>>} events - Ordered canonical events to render.
 * @param {Object<string, *>} options - Rendering options containing optional theme overrides and document wrapping.
 * @returns {Object<string, *>} HTML rendering result containing content, stylesheet, and canonical structural presentation metadata.
 */
export function renderCanonicalHtml(events, options = {}) {
  if (!Array.isArray(events)) throw new TypeError('Canonical events must be an array.');
  const theme = resolveProjectionTheme(options.theme ?? null);
  const presentation = buildCanonicalPresentation(events, options.display ?? {});
  const markdown = renderCanonicalMarkdown(events);
  const fragment = applySemanticClasses(markdownToHtml(markdown), theme);
  const bodyClass = theme.html[STYLE_ROLES.BODY];
  const article = `<article class="${bodyClass}" data-ai-conversation-core="1" data-presentation-schema="${presentation.schema_version}">${fragment}</article>`;
  const stylesheet = renderCanonicalStylesheet(options.theme ?? null);
  const html = options.document
    ? `<!doctype html><html><head><meta charset="utf-8"><style>${stylesheet}</style></head><body>${article}</body></html>`
    : article;
  return { html, stylesheet, presentation, markdown };
}
