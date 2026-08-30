#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')


def replace_function(name, replacement):
  global text
  marker = f'function {name}('
  start = text.find(marker)
  if start < 0:
    raise SystemExit(f'{name}: function not found')
  doc_start = text.rfind('/**', 0, start)
  if doc_start < 0:
    raise SystemExit(f'{name}: JSDoc not found')
  depth = 0
  brace = text.find('{', start)
  if brace < 0:
    raise SystemExit(f'{name}: opening brace not found')
  end = None
  in_string = None
  escaped = False
  template_depth = 0
  i = brace
  while i < len(text):
    ch = text[i]
    if in_string:
      if escaped:
        escaped = False
      elif ch == '\\':
        escaped = True
      elif ch == in_string:
        in_string = None
      i += 1
      continue
    if ch in "'\"`":
      in_string = ch
      i += 1
      continue
    if ch == '{':
      depth += 1
    elif ch == '}':
      depth -= 1
      if depth == 0:
        end = i + 1
        break
    i += 1
  if end is None:
    raise SystemExit(f'{name}: closing brace not found')
  text = text[:doc_start] + replacement.rstrip() + text[end:]


replace_function('projectedComment', r'''/**
 * Returns the optional source-record debug provenance comment for an event.
 *
 * Debug provenance is formatted centrally so every renderer uses the same
 * DownloadConversation-compatible `turn_id` and `record_index` field names.
 * `turn_id` is the provider/source record identity retained as
 * `source_record_id`; it is not the separately derived canonical turn ID.
 *
 * @param {Object<string, *>} event - The canonical event whose source provenance is being rendered.
 * @param {boolean} quoted - Whether the comment must remain inside an existing Markdown blockquote.
 * @returns {string} The provenance comment in plain or blockquoted form, or an empty string when debugging is disabled.
 */
function projectedComment(event, quoted = false) {
  const projection = event?.projection ?? {};
  if (!projection.debug_provenance) return '';
  const fields = [];
  if (event?.source_record_id != null) fields.push(`turn_id=${event.source_record_id}`);
  if (Number.isInteger(event?.source_index)) fields.push(`record_index=${event.source_index}`);
  if (!fields.length) return '';
  const comment = `<!-- ${fields.join(' ')} -->`;
  return quoted ? quoteMarkdown(comment) : comment;
}''')

replace_function('projectedSection', r'''/**
 * Appends source debug provenance to the first renderer-generated structural line.
 *
 * @param {Object<string, *>} event - The canonical event whose provenance identifies the generated structure.
 * @param {string} section - The already-rendered Markdown section whose first line is renderer-generated structure.
 * @returns {string} The section with optional provenance appended to its first structural line.
 */
function projectedSection(event, section) {
  const comment = projectedComment(event);
  if (!comment) return section;
  const newline = section.indexOf('\n');
  if (newline < 0) return `${section} ${comment}`;
  return `${section.slice(0, newline)} ${comment}${section.slice(newline)}`;
}''')

# A details element can represent one or many source events.  The first source is
# attached to the summary line; later grouped sources get their own comment lines.
anchor = "function details(summary, body) {\n  return `<details>\\n<summary>${summary}</summary>\\n\\n${body}\\n\\n</details>`;\n}"
replacement = r'''function details(summary, body) {
  return `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

/**
 * Renders a details group with source debug provenance for every grouped event.
 *
 * @param {string} summary - The visible summary label for the details group.
 * @param {string} body - The Markdown body inside the details group.
 * @param {Array<Object<string, *>>} sourceEvents - Ordered canonical events represented by the generated group.
 * @param {boolean} quoted - Whether provenance lines must be Markdown-blockquoted.
 * @returns {string} The details group with optional per-source provenance on the summary and following lines.
 */
function projectedDetails(summary, body, sourceEvents, quoted = false) {
  const events = Array.isArray(sourceEvents) ? sourceEvents : [];
  const comments = events.map(event => projectedComment(event, quoted)).filter(Boolean);
  const first = comments.shift() ?? '';
  const opening = `<details>\n<summary>${summary}</summary>${first ? ` ${first.replace(/^> /, '')}` : ''}`;
  const extra = comments.length ? `\n${comments.join('\n')}` : '';
  return `${opening}${extra}\n\n${body}\n\n</details>`;
}'''
if anchor not in text:
  raise SystemExit('details anchor not found')
text = text.replace(anchor, replacement, 1)

replace_function('renderChatGPTToolBlock', r'''/**
 * Renders a canonical ChatGPT tool block into the Markdown details/fence representation.
 *
 * The renderer consumes canonical `input`, `language`, `output`, and
 * `output_format`; provider-native presentation is not reinterpreted here.
 *
 * @param {Object<string, *>} event - The canonical event represented by the tool structure.
 * @param {Object<string, *>} block - The canonical tool call/result block being rendered.
 * @param {Array<Object<string, *>>} events - The ordered canonical events used for related-resource resolution.
 * @returns {string} Rendered Markdown details block for one ChatGPT tool call or result block.
 */
function renderChatGPTToolBlock(event, block, events) {
  if (block.type === 'tool_call') {
    const language = inferredToolLanguage(block);
    return projectedDetails(`${block.name ?? 'tool'} code`, fencedCode(block.input ?? '', language), [event]);
  }
  if (block.type === 'tool_result') {
    let output = block.output ?? '';
    if (block.output_format === 'multimodal_text') output = renderMultimodalToolOutput(event, block, events);
    else if (block.output_format === 'tether_browsing_display') output = [block.output?.summary, block.output?.result].filter(Boolean).join('\n\n');
    return projectedDetails(`${block.name ?? 'tool'} output`, fencedCode(output), [event]);
  }
  return '';
}''')

replace_function('renderChatGPTCommentarySegment', r'''/**
 * Renders the ChatGPT activity inside one response while preserving source order.
 *
 * Consecutive reasoning/tool events form one thought group. Commentary flushes
 * the current thought group, receives its own `### ChatGPT Commentary` heading,
 * and therefore breaks thought consecutiveness.
 *
 * @param {Array<Object<string, *>>} segment - Ordered canonical events in one ChatGPT response.
 * @param {Array<Object<string, *>>} events - Full ordered canonical event sequence for resource resolution.
 * @returns {Array<string>} Ordered thought/commentary structures rendered inside the enclosing ChatGPT response.
 */
function renderChatGPTCommentarySegment(segment, events) {
  const body = [];
  let thoughts = [];

  /**
   * Flushes the current consecutive ChatGPT thought run into one details group.
   *
   * @returns {void} No value is returned.
   */
  const flushThoughts = () => {
    if (!thoughts.length) return;
    const rendered = thoughts.map(item => item.text).join('\n\n');
    body.push(projectedDetails(thoughtSummary(thoughts.length), rendered, thoughts.map(item => item.event)));
    thoughts = [];
  };

  for (const event of segment) {
    if (event.kind === 'reasoning_summary') {
      const text = reasoningBody(event);
      if (text) thoughts.push({ event, text });
      continue;
    }
    if (event.kind === 'tool_call' || event.kind === 'tool_result') {
      const text = renderChatGPTToolEvent(event, events);
      if (text) thoughts.push({ event, text });
      continue;
    }
    if (event.kind === 'commentary') {
      flushThoughts();
      const text = renderMessageBlocks(event);
      if (text) body.push(projectedSection(event, `### ChatGPT Commentary\n\n${quoteMarkdown(text)}`));
    }
  }
  flushThoughts();
  return body;
}''')

replace_function('renderChatGPTAssistantSegment', r'''/**
 * Renders one canonical ChatGPT response with exactly one leading `## ChatGPT` heading.
 *
 * Reasoning/tool activity is grouped into consecutive thought groups; commentary
 * is rendered at level three and breaks thought-group consecutiveness. Final
 * Assistant messages remain inside the same response section.
 *
 * @param {Array<Object<string, *>>} segment - Ordered canonical events forming one ChatGPT response.
 * @param {Array<Object<string, *>>} events - Full ordered canonical event sequence for resource resolution.
 * @returns {Array<string>} Zero or one complete ChatGPT Markdown response sections.
 */
function renderChatGPTAssistantSegment(segment, events) {
  const body = renderChatGPTCommentarySegment(segment, events);
  const messages = segment.filter(event => event.kind === 'message' && event.role === 'assistant');
  for (const event of messages) {
    const text = renderMessageBlocks(event);
    if (text) body.push(quoteMarkdown(text));
  }
  if (!body.length) return [];
  const headingEvent = segment[0];
  return [projectedSection(headingEvent, `${projectedHeading(headingEvent, '## ChatGPT')}\n\n${body.join('\n\n')}`)];
}''')

replace_function('renderClaudeQuestionBlock', r'''/**
 * Renders Claude AskUserQuestion headings/options with source debug provenance.
 *
 * @param {Object<string, *>} event - The canonical tool-call event represented by the generated question headings.
 * @param {Object<string, *>} block - The normalized Claude AskUserQuestion block.
 * @returns {string} Markdown question/options blocks in provider order.
 */
function renderClaudeQuestionBlock(event, block) {
  const questions = block?.ask_user_question?.questions ?? [];
  const chunks = [];
  questions.forEach((question, index) => {
    const lines = [];
    if (question.question) lines.push(`**${question.question}**`);
    for (const option of question.options ?? []) {
      if (!option?.label) continue;
      lines.push(`- ${option.label}${option.description ? ` - ${option.description}` : ''}`);
    }
    chunks.push(projectedSection(event, `### Question ${index + 1}\n\n${quoteMarkdown(lines.join('\n'))}`));
  });
  return chunks.join('\n\n');
}''')
text = text.replace('const rendered = renderClaudeQuestionBlock(block);', 'const rendered = renderClaudeQuestionBlock(event, block);')

replace_function('renderClaudePlanBlock', r'''/**
 * Renders a Claude ExitPlanMode plan heading with source debug provenance.
 *
 * @param {Object<string, *>} event - The canonical tool-call event represented by the generated plan heading.
 * @param {Object<string, *>} block - The normalized Claude ExitPlanMode block.
 * @returns {string} Blockquoted Markdown plan section, or an empty string when no plan is present.
 */
function renderClaudePlanBlock(event, block) {
  const plan = block?.exit_plan?.plan;
  if (typeof plan !== 'string' || !plan.trim()) return '';
  const comment = projectedComment(event);
  const heading = `### Plan${comment ? ` ${comment}` : ''}`;
  return quoteMarkdown(`${heading}\n\n${quoteMarkdown(plan.trim())}`);
}''')
text = text.replace('const rendered = renderClaudePlanBlock(block);', 'const rendered = renderClaudePlanBlock(event, block);')

# Claude thought group: use per-source provenance and avoid double quoting -T content.
old = "    body.push(quoteMarkdown(details(thoughtSummary(thoughts.length), renderedThoughts)));"
new = "    body.push(quoteMarkdown(projectedDetails(thoughtSummary(thoughts.length), renderedThoughts, thoughts.map(item => item.event))));"
if old not in text:
  raise SystemExit('Claude thought group anchor not found')
text = text.replace(old, new, 1)
old = "? thoughts.map((item, index) => `${quoteMarkdown(projectedThoughtHeading(item.event, index + 1))}\\n>\\n${quoteMarkdown(item.text)}`).join('\\n>\\n> ***\\n>\\n')"
new = "? thoughts.map((item, index) => `${projectedThoughtHeading(item.event, index + 1)}\\n\\n${item.text}`).join('\\n\\n***\\n\\n')"
if old not in text:
  raise SystemExit('Claude separate thoughts anchor not found')
text = text.replace(old, new, 1)

# Codex Question N headings are renderer-generated structures and receive provenance.
old = "questionParts.push(`### Question ${state.codexQuestionNumber}\\n\\n${quoteMarkdown(lines.join('\\n'))}`);"
new = "questionParts.push(projectedSection(callEvent, `### Question ${state.codexQuestionNumber}\\n\\n${quoteMarkdown(lines.join('\\n'))}`));"
if old not in text:
  raise SystemExit('Codex question anchor not found')
text = text.replace(old, new, 1)

# Codex thought group carries each contributing source event's provenance.
replace_function('renderCodexMainResponse', r'''/**
 * Renders the main Codex response with provenance on generated response/thought structures.
 *
 * @param {Array<Object<string, *>>} segment - Ordered canonical events forming the Codex response.
 * @returns {string|null} The main Codex transcript section, or null when no visible response exists.
 */
function renderCodexMainResponse(segment) {
  const thoughts = [];
  const finals = [];
  for (const event of segment) {
    if (event.kind === 'reasoning_summary') {
      const text = reasoningBody(event);
      if (text) thoughts.push({ event, text });
    } else if (event.kind === 'commentary') {
      const text = renderMessageBlocks(event);
      if (text) thoughts.push({ event, text });
    } else if (event.kind === 'message' && event.role === 'assistant') {
      const text = renderMessageBlocks(event);
      if (text) finals.push({ event, text });
    }
  }
  if (!thoughts.length && !finals.length) return null;
  const body = [];
  if (thoughts.length) {
    const thoughtBody = thoughts.map(item => item.text).join('\n\n***\n\n');
    body.push(quoteMarkdown(projectedDetails(thoughtSummary(thoughts.length), thoughtBody, thoughts.map(item => item.event))));
  }
  for (const item of finals) body.push(quoteMarkdown(item.text));
  const headingEvent = segment[0];
  return projectedSection(headingEvent, `${projectedHeading(headingEvent, '## Codex')}\n\n${body.join('\n\n')}`);
}''')

# File-change grouping is renderer-generated too. Attribute the group to all patch events.
replace_function('renderCodexFileChanges', r'''/**
 * Renders Codex apply_patch changes as one provenance-traceable details group.
 *
 * @param {Array<Object<string, *>>} segment - Ordered canonical events forming the Codex response.
 * @returns {string|null} Collapsed Codex file-change details section, or null when no apply_patch changes exist.
 */
function renderCodexFileChanges(segment) {
  const patches = [];
  for (const event of segment) {
    if (event.kind !== 'tool_call') continue;
    const block = event.blocks?.find(item => item.type === 'tool_call' && item.name === 'apply_patch' && item.file_change?.patch);
    if (block) patches.push({ event, patch: block.file_change.patch });
  }
  if (!patches.length) return null;
  const fileCount = patches.reduce((count, item) => count + (item.patch.match(/^\*\*\* (?:Update|Add|Delete) File:/gm)?.length ?? 0), 0);
  const n = fileCount || patches.length;
  const body = patches.map(item => quoteMarkdown(`\`\`\`diff\n${item.patch}\n\`\`\``)).join('\n\n');
  return projectedDetails(`${n} file change${n === 1 ? '' : 's'}`, body, patches.map(item => item.event));
}''')

path.write_text(text, encoding='utf-8')
