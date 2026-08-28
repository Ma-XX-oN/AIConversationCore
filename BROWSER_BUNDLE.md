# Browser bundle

`dist/aiconversationcore.chatgpt.browser.js` is the generated classic-script
browser artifact used by hosts that cannot load the core's ESM modules directly.

The artifact is generated from the authoritative ESM sources by:

```text
npm run build:browser
```

Do not edit the generated file directly.  `tests/browser-bundle.test.js` verifies
that the committed artifact is byte-for-byte identical to the deterministic
builder output and that its ChatGPT normalization and Markdown rendering match
the ESM implementation.

The current browser artifact intentionally exposes only the API required by the
first DownloadConversation integration slice:

```js
AIConversationCore.adaptChatGPTRecords(records)
AIConversationCore.renderCanonicalMarkdown(events)
```

A Tampermonkey host should load the generated classic script with `@require` (or
an equivalent host mechanism) and pin the URL to an exact AIConversationCore Git
commit rather than `main`.  Pinning prevents an unrelated future core change from
altering an installed userscript without a corresponding DownloadConversation
revision and regression review.

Browser acquisition, authenticated file/image resolution, storage, lifecycle,
and DOM fallback behaviour remain host responsibilities.  The bundle performs
only the canonical interpretation/rendering implemented by the shared core.
