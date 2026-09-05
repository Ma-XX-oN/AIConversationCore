# Browser bundle

`dist/aiconversationcore.chatgpt.browser.js` is the generated classic-script
browser artifact used by hosts that cannot load the core's ESM modules directly.

The artifact is generated from the authoritative ESM sources by:

```text
npm run build:browser
```

Do not edit the generated file directly.  `tests/browser-bundle.test.js` verifies
that the committed artifact is byte-for-byte identical to the deterministic
builder output and that its ChatGPT normalization, structural presentation,
Markdown rendering, HTML rendering, theme handling, and high-level rendering
match the ESM implementation.

## Browser API

The ChatGPT browser artifact exposes the same rendering contract used by ESM
consumers:

```js
AIConversationCore.adaptChatGPTRecords(records)
AIConversationCore.renderCanonicalMarkdown(events)
AIConversationCore.buildCanonicalPresentation(events, options)
AIConversationCore.markdownToHtml(markdown)
AIConversationCore.renderCanonicalHtml(events, options)
AIConversationCore.renderCanonicalStylesheet(theme)
AIConversationCore.renderConversation(input, options)
```

It also exposes the stable style/theme and rendering constants/helpers:

```js
AIConversationCore.STYLE_ROLES
AIConversationCore.configureProjectionTheme(overrides)
AIConversationCore.getDefaultProjectionTheme()
AIConversationCore.resetProjectionTheme()
AIConversationCore.resolveProjectionTheme(overrides)
AIConversationCore.PRESENTATION_SCHEMA_VERSION
AIConversationCore.RENDER_FORMATS
AIConversationCore.RENDER_INPUT_KINDS
```

The artifact remains ChatGPT-specific for **provider-native input adaptation**.
`renderConversation(..., { input_kind: 'provider_records' })` therefore supports
`provider: 'chatgpt'` in this artifact and rejects other provider-record input
explicitly.  Canonical events obtained elsewhere can still be passed to the
presentation, Markdown, HTML, stylesheet, and high-level rendering APIs.

A Tampermonkey host should load the generated classic script with `@require` (or
an equivalent host mechanism) and pin the URL to an exact AIConversationCore Git
commit rather than `main`.  Pinning prevents an unrelated future core change from
altering an installed userscript without a corresponding DownloadConversation
revision and regression review.

Browser acquisition, authenticated file/image resolution, storage, lifecycle,
and DOM fallback behaviour remain host responsibilities.  Canonical conversation
semantics, structural presentation boundaries, Markdown/HTML rendering, and
default styling belong to AIConversationCore so browser hosts do not independently
reimplement them.
