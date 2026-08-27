# Normalization and Rendering Rules

This document records durable normalization/rendering rules that must survive across conversations and implementation sessions.  These rules apply to all provider adapters and shared renderers unless a provider-specific evidence-backed exception is documented elsewhere.

## Evidence before generalization

Do not generalize provider record shapes beyond the evidence actually observed.

If the checked-in fixtures or verified source material show multiple concrete forms, describe those forms precisely.  Do not replace that with a broader claim such as "the exact raw shape can vary" unless the evidence really establishes that broader rule.

When a cheap factual claim can be verified from source data, fixtures, or repository code, verify it before using it as a design premise.

## Normalize equivalent semantics, preserve real differences

Prefer a common canonical shape when different provider/source structures genuinely represent the same useful semantic.

Do not force distinct concepts into one rigid structure merely for uniformity.  In particular, citation/reference types may share a useful common base while retaining type-specific fields when their information or behaviour differs.

The rule is:

> Normalize equivalent semantics; preserve real differences.

Similarity is useful only while it simplifies downstream consumers without obscuring information, manufacturing equivalence, or filling fields with meaningless placeholders.

Provider-specific information required for current or future interpretation must remain available through canonical fields, type-specific substructures, or provenance/raw-source references as appropriate.

## Citation normalization

ChatGPT citation work must be based on the concrete citation/reference structures established by verified evidence.  Do not assume all citation/reference types contain identical information.

Where useful, citations may expose a shared base such as canonical identity, citation kind, visible title/label when one exists, source/target reference when applicable, association with cited content, and provenance/source position.

Type-specific citation information should remain type-specific when forcing it into the common base would be artificial.  Web citations, file citations, hidden/memory references, or other proven citation kinds do not need to expose identical fields merely to fit one schema.

ChatGPT citation rendering remains governed by the verified DownloadConversation behaviour documented in `DECISIONS.md` and `DESIGN.md`.

## Citation tooltip readability

Citation tooltip/popup rendering is a presentation contract, not merely a data-presence requirement.

If the verified citation behaviour includes title/source/blurb/snippet or similar sections, the renderer must preserve meaningful vertical whitespace so the tooltip remains readable.  Do not collapse distinct sections or paragraphs into a dense single block merely because all information is technically present.

Tests/goldens for citation rendering must protect meaningful paragraph/section separation and vertical whitespace in tooltips, in addition to protecting the actual text and links.

## Binary state representation

Use booleans for genuinely binary states.

Prefer:

```js
{ available: true }
```

or:

```js
{ available: false }
```

Do not encode a binary state as strings such as `"available"` / `"unavailable"` without a real need.

Use a string/enum state only when the domain is genuinely ternary or larger, such as when distinct `unknown`, `available`, and `missing` states are all required by verified semantics.  Do not invent additional states merely to justify an enum.

Do not add an availability field at all merely because a resource identity or pointer exists.  If the evidence does not establish availability, preserve the identity and omit the unproven state.

## Resource identity versus host resolution

Canonical file/image/artifact data must distinguish provider/source identity from host-specific resource resolution.

Provider adapters may normalize source pointers, IDs, filenames, media types, source positions, and other provider evidence.  Browser-credential-dependent resource resolution remains outside the core and may enrich canonical data through an explicit host boundary.

The core must not pretend that a provider pointer and a resolved URL are the same concept.

For an evidenced ChatGPT `sandbox:/...` generated-file link, canonical data preserves **both** the original source pointer/local sandbox path and the deterministic ChatGPT HTTPS download URL whenever the conversation ID and Assistant message ID required to derive that URL are present.  The source pointer remains provenance/identity; the HTTPS URL is the core-derived transport location.  Consumers must not have to call back into provider-native JSON or independently reconstruct the mapping.

Constructing that deterministic HTTPS URL belongs in the core because it is shared provider interpretation and does not require browser credentials.  Actually fetching the URL when authentication/session context is required remains a host responsibility.

Markdown destinations containing balanced parentheses must preserve the complete destination.  A filename such as `fixture(phase2).txt` is one source path, not a path truncated at its first closing parenthesis.  The deterministic HTTPS URL must apply the established strict query-value percent-encoding used by the Python reference, including encoding such parentheses in `sandbox_path`.

Uploaded file references and retrieved/cited files may share `type: "file"` while retaining different `resource_kind` values and kind-specific fields when their evidence differs.  Do not force an uploaded attachment and a retrieved tool/file citation into an identical field set merely because both are files.

Image normalization must preserve source/block position.  Images are ordered content, not merely entries in an attachment collection.

## Renderer independence from provider-native records

Shared renderers and other downstream projections must consume canonical data, not inspect provider-native AI JSON DB records.

The current implementation sequence may focus on one provider at a time, but the architectural requirement is provider-wide:

```text
ChatGPT records ┐
Claude records  ├─> provider adapters -> canonical model -> shared projections
Codex records   ┘
```

Once a provider semantic has been normalized, the shared Markdown, HTML/display, speech/highlight, navigation, and other projections must not need knowledge of provider-native field names such as `content_references`, `tool_use`, `response_item`, `image_asset_pointer`, or analogous source-specific structures.

If a renderer needs to inspect raw provider records to reproduce established behaviour, normalization for that semantic is incomplete and must be extended rather than teaching the renderer provider-specific JSON.

## Scope discipline

Do not change chronology, grouping, association, or other unrelated semantics while implementing citation/file/image normalization unless real evidence demonstrates a separate defect.  Any such defect must be tracked and changed separately.
