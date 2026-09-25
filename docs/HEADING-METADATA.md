# Core-owned heading metadata

AIConversationCore owns transcript heading semantics. Consumers select visibility and presentation policy; they do not supply semantic heading values.

## Public policy

`renderCanonicalMarkdown(events, options)` accepts:

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

Core derives the values from canonical source provenance:

- timestamp from the canonical source timestamp/create/update fields;
- record number from the zero-based source record index plus one;
- Turn ID from the native provider/source turn identity when one exists;
- debug provenance from canonical `record_id` and zero-based `record_index`.

Caller-supplied `projection.heading_metadata` and `projection.debug_provenance` are not semantic authority on the public projection path.

## Serialization

Visible heading metadata is ordered as timestamp, record number, then Turn ID. The visible Turn ID is the bare provider/source ID; the semantic field remains `turn_id`. Debug provenance remains a separate Core-owned comment using `record_id` and `record_index`.

For a composite ChatGPT Assistant response, the enclosing `## ChatGPT` heading belongs to the final Assistant message when one exists. Commentary and independently headed structures retain their own source provenance.

When a provider has no suitable native Turn ID, Core omits the visible Turn ID rather than inventing one.

## Time zones

Heading timestamps support IANA time-zone identifiers and fixed numeric offsets such as `-04:00` and `+05:30`. Invalid fixed offsets are rejected rather than silently normalized.

## Reconstruction boundary

Issue #106 Group 2 integrates the lower heading/presentation contract from issues #86 and #89 into the current-main-based reconstruction. It intentionally does not import retained-session, revision-visibility, structured, HTML, or speech layers; those remain later dependency groups. The classic browser Markdown surface is kept in parity with the ESM Markdown surface because it is already an existing public projection path.
