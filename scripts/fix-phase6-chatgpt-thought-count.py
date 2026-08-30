#!/usr/bin/env python3

from pathlib import Path

path = Path('src/projections/markdown.js')
text = path.read_text(encoding='utf-8')

start = text.find('/**\n * Renders the ChatGPT activity inside one response while preserving source order.')
if start < 0:
  raise SystemExit('ChatGPT commentary renderer JSDoc not found')
fn = text.find('function renderChatGPTCommentarySegment(', start)
brace = text.find('{', fn)
depth = 0
end = None
in_string = None
escaped = False
for i in range(brace, len(text)):
  ch = text[i]
  if in_string:
    if escaped:
      escaped = False
    elif ch == '\\':
      escaped = True
    elif ch == in_string:
      in_string = None
    continue
  if ch in "'\"`":
    in_string = ch
    continue
  if ch == '{':
    depth += 1
  elif ch == '}':
    depth -= 1
    if depth == 0:
      end = i + 1
      break
if end is None:
  raise SystemExit('ChatGPT commentary renderer closing brace not found')

replacement = r'''/**
 * Renders the ChatGPT activity inside one response while preserving source order.
 *
 * Consecutive reasoning records define the thought count. Tool call/result
 * structures may occur within the same thought run but do not increment `N`.
 * Commentary flushes the current run, receives its own
 * `### ChatGPT Commentary` heading, and breaks thought consecutiveness.
 *
 * @param {Array<Object<string, *>>} segment - Ordered canonical events in one ChatGPT response.
 * @param {Array<Object<string, *>>} events - Full ordered canonical event sequence for resource resolution.
 * @returns {Array<string>} Ordered thought/tool/commentary structures rendered inside the enclosing ChatGPT response.
 */
function renderChatGPTCommentarySegment(segment, events) {
  const body = [];
  let run = [];
  let thoughtEvents = [];

  /**
   * Flushes the current ChatGPT reasoning/tool run without counting tools as thoughts.
   *
   * @returns {void} No value is returned.
   */
  const flushRun = () => {
    if (!run.length) return;
    if (thoughtEvents.length) {
      const rendered = run.map(item => item.text).join('\n\n');
      body.push(projectedDetails(
        thoughtSummary(thoughtEvents.length),
        rendered,
        thoughtEvents,
        false,
        true
      ));
    } else {
      body.push(...run.map(item => item.text));
    }
    run = [];
    thoughtEvents = [];
  };

  for (const event of segment) {
    if (event.kind === 'reasoning_summary') {
      const text = reasoningBody(event);
      if (text) {
        run.push({ event, text });
        thoughtEvents.push(event);
      }
      continue;
    }
    if (event.kind === 'tool_call' || event.kind === 'tool_result') {
      const text = renderChatGPTToolEvent(event, events);
      if (text) run.push({ event, text });
      continue;
    }
    if (event.kind === 'commentary') {
      flushRun();
      const text = renderMessageBlocks(event);
      if (text) body.push(projectedSection(event, `### ChatGPT Commentary\n\n${quoteMarkdown(text)}`));
    }
  }
  flushRun();
  return body;
}'''

text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')
