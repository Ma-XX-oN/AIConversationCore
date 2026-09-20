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

## Release contract

`package.json` is the single semantic-version authority for AIConversationCore.
The deterministic browser builder embeds that exact value in
`dist/aiconversationcore.chatgpt.browser.js`, and the release tag must identify the
same release commit.  A published release therefore has one required identity:

```text
package.json version
    == AIConversationCore.getVersion() in the committed browser bundle
    == release commit version
    == annotated vX.Y.Z tag
```

Release publication is performed only through:

```text
npm run release -- <version>
```

where `<version>` is a plain semantic version such as `1.2.3`; development
qualifiers and a leading `v` are rejected.  The release script requires a clean
working tree, confirms the version tag does not already exist locally or on
`origin`, writes the requested version to `package.json`, regenerates the browser
bundle, verifies the embedded bundle version, and runs the complete Node test
suite.

After verification, the script requires that the only release-time file changes
are:

```text
package.json
dist/aiconversationcore.chatgpt.browser.js
```

It stages only those files, creates the release commit, creates an annotated
`vX.Y.Z` tag on that exact commit, verifies the tag target, and publishes the
branch update and tag together with the equivalent of:

```text
git push --atomic origin HEAD:<current-branch> refs/tags/vX.Y.Z
```

The atomic push is a release invariant: the remote must not receive the release
commit without its tag, or the tag without its release commit.  If validation,
tests, commit creation, tag creation, or the atomic push fails, the script exits
non-zero and does not substitute another publication path.

Do not manually publish a Core browser artifact, release commit, or version tag
outside this script.  In particular, do not replace the scripted release with a
separate `git push` followed by a remembered/manual tag push; the scripted atomic
operation exists specifically to prevent missing or mismatched release tags.
