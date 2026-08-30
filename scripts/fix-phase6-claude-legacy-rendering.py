#!/usr/bin/env python3

from pathlib import Path

adapter_path = Path('src/adapters/claude.js')
adapter = adapter_path.read_text(encoding='utf-8')
old_normalize = '''function normalizeExitPlanResponse(text) {
  if (typeof text !== 'string') return null;
  const marker = '\\n\\n## Approved Plan (edited by user):\\n';
  const index = text.indexOf(marker);
  if (index < 0) return { intro: text.trim(), approved_plan: null };
  return {
    intro: text.slice(0, index).trim(),
    approved_plan: text.slice(index + 2).trim()
  };
}'''
new_normalize = '''function normalizeExitPlanResponse(text) {
  if (typeof text !== 'string') return null;
  const heading = text.match(/^#{0,6}\\s*Approved Plan(?::|\\s)/m);
  if (!heading || heading.index == null) return { intro: text.trim(), approved_plan: null };
  return {
    intro: text.slice(0, heading.index).trim(),
    approved_plan: text.slice(heading.index).trim()
  };
}'''
if old_normalize not in adapter:
  raise SystemExit('normalizeExitPlanResponse anchor not found')
adapter = adapter.replace(old_normalize, new_normalize, 1)
adapter_path.write_text(adapter, encoding='utf-8')

renderer_path = Path('src/projections/markdown.js')
renderer = renderer_path.read_text(encoding='utf-8')
anchor = '''/**
 * Builds the Markdown body for canonical reasoning-summary blocks in one event.
 *
 * @param {Object<string, *>} event - The canonical event being inspected, normalized, or rendered.
 * @returns {string} Visible reasoning-summary text joined from the event reasoning blocks.
 */
function reasoningBody(event) {
'''
helper = '''/**
 * Escapes bare HTML starts on Claude blockquoted thinking lines outside code fences.
 *
 * Claude thinking may itself contain Markdown blockquote lines. After the
 * renderer adds its outer blockquote, an unescaped `<tag>` on one of those
 * source lines can be interpreted as HTML rather than literal reasoning text.
 * Fenced code is left unchanged because the fence already protects its body.
 *
 * @param {string} text - Raw Claude thinking content.
 * @returns {string} Thinking content with `<` escaped only on source blockquote lines outside matching backtick fences.
 */
function escapeClaudeThinking(text) {
  const lines = String(text ?? '').split('\\n');
  let fence = null;
  return lines.map(line => {
    const marker = line.match(/^((?:> )*)(`{3,})(?!`)/);
    if (marker) {
      const key = `${marker[1]}${marker[2]}`;
      if (fence === null) fence = key;
      else if (key === fence) fence = null;
      return line;
    }
    if (fence === null && line.startsWith('>')) return line.replaceAll('<', '&lt;');
    return line;
  }).join('\\n');
}

'''
if helper.strip() not in renderer:
  if anchor not in renderer:
    raise SystemExit('reasoningBody anchor not found')
  renderer = renderer.replace(anchor, helper + anchor, 1)
old_content = "    if (block.content) parts.push(block.content);"
new_content = "    if (block.content) parts.push(event.provider === 'claude' ? escapeClaudeThinking(block.content) : block.content);"
if old_content not in renderer:
  raise SystemExit('reasoning content anchor not found')
renderer = renderer.replace(old_content, new_content, 1)
renderer_path.write_text(renderer, encoding='utf-8')
