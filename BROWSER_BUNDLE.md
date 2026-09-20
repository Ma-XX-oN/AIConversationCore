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

`package.json` is the semantic-version authority for AIConversationCore.
`package-lock.json` mirrors that version at both of its root package-version
locations.  The deterministic browser builder embeds the exact `package.json`
version in `dist/aiconversationcore.chatgpt.browser.js`.

A completed stable release therefore has one required identity:

```text
package.json version
    == package-lock.json root versions
    == AIConversationCore.getVersion() in the committed browser bundle
    == merged main commit contents
    == annotated vX.Y.Z tag target
```

The release order is mandatory:

1. prepare the stable version and generated artifact on the issue branch;
2. close the owning issue;
3. merge that prepared issue branch to `main`;
4. tag that exact merged `main` commit.

The stable tag must never be created on the issue branch.

### 1. Prepare the stable version and artifact

With implementation work committed and the issue branch clean, run:

```text
npm run release:prepare -- <version>
```

where `<version>` is a plain semantic version such as `1.2.3`. Development
qualifiers and a leading `v` are rejected.

The preparation script:

- requires an `issue-<number>-...` branch and a clean working tree;
- verifies the requested `vX.Y.Z` tag does not already exist locally or on
  `origin`;
- writes the requested stable version to `package.json` and both root version
  fields in `package-lock.json`;
- regenerates `dist/aiconversationcore.chatgpt.browser.js`;
- verifies the embedded bundle version and lock-file version mirrors;
- runs the complete Node test suite;
- requires the only changed/staged files to be `package.json`,
  `package-lock.json`, and the generated browser artifact;
- commits those three release-preparation files and pushes the issue branch;
- creates **no stable Git tag**.

After that preparation commit is verified, close the owning issue and merge the
issue branch to `main` according to the project release order.

### 2. Tag the merged main commit

Update the local checkout to the merged `main`, then run:

```text
npm run release -- <version>
```

The final release script is deliberately `main`-only. It requires a clean tree,
fetches `origin/main` and tags, and requires local `HEAD` to equal `origin/main`.
It then verifies all of the following before creating a tag:

- `package.json` equals the requested stable version;
- both root version fields in `package-lock.json` equal that version;
- the committed browser bundle reports the same version;
- the committed browser bundle is byte-for-byte identical to a fresh
  deterministic build;
- the complete Node test suite passes;
- the requested stable tag does not already exist on `origin`.

The script creates an annotated `vX.Y.Z` tag on that exact verified `main` commit.
If a prior atomic-push attempt created the same local tag but did not reach the
remote, rerunning the script is allowed only when that local tag already points
to the same verified `main` commit.

Publication uses the equivalent of:

```text
git push --atomic origin HEAD:main refs/tags/vX.Y.Z
```

The atomic push is a release invariant: publication of the version tag is coupled
to the already-verified `main` ref. The script provides no non-atomic release
mode.

Do not manually publish a Core browser artifact or stable release tag, and do not
substitute separate branch/tag pushes for these scripted stages. In particular,
do not tag an issue branch and do not rely on remembering a tag after the merge;
the post-merge release command exists specifically to verify and tag the merged
`main` commit.
