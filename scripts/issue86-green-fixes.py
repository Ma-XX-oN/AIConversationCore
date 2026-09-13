from pathlib import Path


def replace_once(text, old, new, label):
  count = text.count(old)
  if count != 1:
    raise RuntimeError(f'{label}: expected exactly one match, found {count}')
  return text.replace(old, new, 1)


# ChatGPT's public adapter already owns turn_id/create_time/update_time provenance.
# Do not duplicate those values in the lower-level base adapter.
path = Path('src/adapters/chatgpt-base.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  """      source: {
        provider: 'chatgpt',
        record_id: sourceRecordId,
        record_index: sourceIndex,
        turn_id: sourceRecordId,
        timestamp: record?.create_time ?? record?.update_time ?? null
      }
""",
  """      source: {
        provider: 'chatgpt',
        record_id: sourceRecordId,
        record_index: sourceIndex
      }
""",
  'remove duplicate ChatGPT base heading provenance'
)
path.write_text(text, encoding='utf-8')

# Related source projections (notably Claude sub-agent invocation headings) also
# receive Core-derived semantic metadata. Consumers may keep generic decoration
# such as heading_suffix, but cannot inject semantic values or debug identities.
path = Path('src/projections/heading-metadata.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  """export function withCoreHeadingMetadata(event, options = {}) {
  const projection = { ...(event?.projection ?? {}) };
  delete projection.heading_metadata;
  delete projection.debug_provenance;
  projection.heading_metadata = deriveHeadingMetadata(event, options);
  return { ...event, projection };
}
""",
  """export function withCoreHeadingMetadata(event, options = {}) {
  const projection = { ...(event?.projection ?? {}) };
  delete projection.heading_metadata;
  delete projection.debug_provenance;
  projection.heading_metadata = deriveHeadingMetadata(event, options);

  const related = projection.related_sources &&
      typeof projection.related_sources === 'object'
    ? { ...projection.related_sources }
    : {};
  for (const [name, source] of Object.entries(event?.relationships ?? {})) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const relatedProjection = {
      ...(related[name] && typeof related[name] === 'object' ? related[name] : {})
    };
    delete relatedProjection.heading_metadata;
    delete relatedProjection.debug_provenance;
    relatedProjection.heading_metadata = deriveHeadingMetadata({
      provider: source.provider ?? event?.provider ?? null,
      source_record_id: source.record_id ?? null,
      source_index: Number.isInteger(source.record_index) ? source.record_index : null,
      source
    }, options);
    related[name] = relatedProjection;
  }
  if (Object.keys(related).length) projection.related_sources = related;
  return { ...event, projection };
}
""",
  'Core-owned related heading metadata'
)
path.write_text(text, encoding='utf-8')

# Replace obsolete caller-owned semantic projection tests with the public
# visibility-only contract.
Path('tests/heading-metadata-projection.test.js').write_text("""import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCanonicalMarkdown } from '../src/index.js';

function messageEvent(provider, sourceRecordId, projection = {}, source = {}) {
  return {
    id: `${provider}:fixture`,
    provider,
    source_record_id: sourceRecordId,
    source_index: 1,
    kind: 'message',
    role: provider === 'chatgpt' ? 'user' : 'assistant',
    channel: null,
    visibility: 'visible',
    content_type: 'text',
    blocks: [{ type: 'text', text: 'Body' }],
    citations: [],
    resources: [],
    relationships: {},
    source: {
      provider,
      record_id: sourceRecordId,
      record_index: 1,
      ...source
    },
    projection
  };
}

test('Core-derived heading metadata composes timestamp, record number, and source turn id', () => {
  const event = messageEvent('chatgpt', 'chatgpt-message-id', {}, {
    timestamp: '2026-08-31T15:00:00Z',
    turn_id: 'chatgpt-message-id'
  });
  assert.match(
    renderCanonicalMarkdown([event], {
      heading: {
        timestamp: true,
        recordNumber: true,
        turnId: true,
        timeZone: 'UTC'
      }
    }),
    /^## User \[2026-08-31 15:00:00\]: 2: turn_id=chatgpt-message-id$/m
  );
});

test('caller semantic heading metadata cannot override Core source provenance', () => {
  const event = messageEvent('chatgpt', 'activity-record-id', {
    heading_metadata: {
      timestamp: 'WRONG',
      record_number: 999,
      turn_id: 'caller-turn-id',
      debug: { record_id: 'caller-record', record_index: 999 }
    }
  }, {
    turn_id: 'source-turn-id'
  });
  const markdown = renderCanonicalMarkdown([event], {
    heading: { recordNumber: true, turnId: true, debugProvenance: true }
  });
  assert.match(
    markdown,
    /^## User 2: turn_id=source-turn-id <!-- record_id=activity-record-id record_index=1 -->$/m
  );
  assert.doesNotMatch(markdown, /caller-turn-id|caller-record|999/);
});

test('Core-derived timestamp and record number preserve consumer ANSI colours', () => {
  const event = messageEvent('chatgpt', 'chatgpt-message-id', {
    colors: {
      user: '\\u001b[33m',
      timestamp: '\\u001b[36m',
      record_number: '\\u001b[2m',
      reset: '\\u001b[0m'
    }
  }, {
    timestamp: '2026-08-31T15:00:00Z'
  });
  const markdown = renderCanonicalMarkdown([event], {
    heading: { timestamp: true, recordNumber: true, timeZone: 'UTC' }
  });
  assert.match(
    markdown,
    /^\\u001b\[33m## User\\u001b\[0m \\u001b\[36m\[2026-08-31 15:00:00\]:\\u001b\[0m \\u001b\[2m2:\\u001b\[0m$/m
  );
});

test('turn id is omitted when Core source provenance has no suitable turn id', () => {
  const event = messageEvent('codex', null, {}, { turn_id: null });
  const markdown = renderCanonicalMarkdown([event], { heading: { turnId: true } });
  assert.match(markdown, /^## Codex$/m);
  assert.doesNotMatch(markdown, /turn_id=/);
});

test('generic heading_suffix remains supported after Core-derived metadata', () => {
  const event = messageEvent('claude', 'claude-uuid', {
    heading_suffix: ' LEGACY'
  }, {
    turn_id: 'claude-uuid'
  });
  assert.match(
    renderCanonicalMarkdown([event], { heading: { recordNumber: true } }),
    /^## Claude 2: LEGACY$/m
  );
});
""", encoding='utf-8')

# The enclosing ChatGPT response now deliberately belongs to the final Assistant
# source record, not the first reasoning record.
path = Path('tests/phase6-rendering-contract.test.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  "assert.match(markdown, /^## ChatGPT <!-- record_id=turn-17 record_index=17 -->/m);",
  "assert.match(markdown, /^## ChatGPT <!-- record_id=turn-21 record_index=21 -->/m);",
  'final ChatGPT debug heading owner expectation'
)
path.write_text(text, encoding='utf-8')

# Sub-agent debug provenance uses the public Core visibility option. Generic
# invocation/completion suffixes remain non-semantic caller decoration.
path = Path('tests/phase6-subagent-provenance.test.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
  text,
  """    projection: {
      heading_suffix: ' [completion]',
      debug_provenance: true,
      related_sources: {
        invocation_source: {
          heading_suffix: ' [invocation]',
          debug_provenance: true
        }
      }
    }
  };
  const markdown = renderCanonicalMarkdown([event]);
""",
  """    projection: {
      heading_suffix: ' [completion]',
      related_sources: {
        invocation_source: {
          heading_suffix: ' [invocation]'
        }
      }
    }
  };
  const markdown = renderCanonicalMarkdown([event], {
    heading: { debugProvenance: true }
  });
""",
  'subagent Core debug visibility option'
)
path.write_text(text, encoding='utf-8')

# Browser and ESM public APIs must render identical Core-owned heading metadata.
path = Path('tests/browser-bundle.test.js')
text = path.read_text(encoding='utf-8')
append = """

test('generated browser bundle matches ESM Core-owned heading metadata', async () => {
  const records = await loadJsonl(fixtureUrl);
  const bundle = await buildBrowserBundle();
  const context = vm.createContext({ URL });
  vm.runInContext(bundle, context, { filename: 'aiconversationcore.chatgpt.browser.js' });

  const options = {
    heading: {
      timestamp: true,
      recordNumber: true,
      turnId: true,
      debugProvenance: true,
      timeZone: 'UTC'
    }
  };
  const esmEvents = adaptChatGPTRecords(records);
  const browserEvents = context.AIConversationCore.adaptChatGPTRecords(plain(records));
  const expectedMarkdown = renderCanonicalMarkdown(esmEvents, options);
  const actualMarkdown = context.AIConversationCore.renderCanonicalMarkdown(
    browserEvents,
    plain(options)
  );
  const expectedHtml = renderCanonicalHtml(esmEvents, options);
  const actualHtml = context.AIConversationCore.renderCanonicalHtml(
    browserEvents,
    plain(options)
  );

  assert.equal(actualMarkdown, expectedMarkdown);
  assert.equal(actualHtml, expectedHtml);
  assert.match(expectedMarkdown, /turn_id=/);
  assert.match(expectedMarkdown, /record_index=/);
  assert.match(expectedHtml, /heading-turn-id/);
});
"""
if "generated browser bundle matches ESM Core-owned heading metadata" not in text:
  text += append
path.write_text(text, encoding='utf-8')

# Record the durable architecture boundary.
path = Path('DECISIONS.md')
text = path.read_text(encoding='utf-8')
if '## D026 — Heading semantics and debug provenance are Core-owned' not in text:
  text += """

## D026 — Heading semantics and debug provenance are Core-owned

**Status:** Accepted; supersedes D015 wherever D015 allows consumers to supply semantic heading/debug values.

**Decision:** AIConversationCore derives transcript-heading semantics from canonical source provenance and owns their serialization. Public consumers may select presentation policy only: whether timestamp, one-based source record number, source/provider turn ID, and debug provenance are shown, plus presentation settings such as timezone or styling. Consumers do not supply the semantic values themselves and do not construct `turn_id=...`, record-number, timestamp, or debug-comment text.

For composite Assistant turns, the enclosing Assistant heading is owned by the final Assistant message source when one exists. Commentary and other independently headed structures retain their own source provenance. Related-source structures, including Claude sub-agent invocation headings, receive the same Core-derived metadata treatment. Debug comments use Core's canonical `record_id` and zero-based `record_index` fields and are rendered by Core.

The structured presentation tree carries the same derived heading metadata used by Markdown and HTML so virtualization can mount Core-owned units without reconstructing presentation semantics. Classic-browser and ESM entry points use the same projection policy and rendering contract.

**Reason:** Presentation meaning must not diverge between DownloadConversation, AI-transcript, AgentPanelSpeaker, or future consumers. Keeping semantic values and formatting in Core prevents duplicate/mismatched metadata when one visible response spans multiple provider records and preserves one authoritative representation for virtualization.
"""
path.write_text(text, encoding='utf-8')

# Document the public rendering contract alongside the serializer API.
path = Path('RENDERING.md')
text = path.read_text(encoding='utf-8')
if '## Core-owned heading metadata' not in text:
  text += """

## Core-owned heading metadata

Public Markdown/HTML projection options expose heading **visibility policy**, not semantic values:

```js
{
  heading: {
    timestamp: true,
    recordNumber: true,
    turnId: true,
    debugProvenance: false,
    timeZone: 'America/Toronto'
  }
}
```

Core derives timestamp, one-based record number, native source/provider turn ID, and debug `record_id` / zero-based `record_index` from canonical source provenance. Callers must not build those fields or comments themselves. Core also places the same derived metadata on presentation-tree headings so virtualized consumers do not have to recreate heading semantics.

Visible metadata order is timestamp, record number, then turn ID. Debug provenance is a separate Core-owned comment. When a provider has no suitable native turn ID (for example Codex records), requesting Turn ID emits no invented value.
"""
path.write_text(text, encoding='utf-8')
