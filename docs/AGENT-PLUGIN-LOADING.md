# AICC Agent Plugin Loading and Distribution

## Scope

This document owns runtime loading, repository access, cache, artifact verification,
and browser/local deployment concerns for AICC agent plugins.  The provider-neutral
agent contract and Core/plugin responsibility boundary remain in
`AGENT-PLUGIN-ARCHITECTURE.md`.

## Ownership boundary

AIConversationCore owns plugin selection and identity.  A downstream consumer must
not contain provider-plugin repository, ref, implementation-version, artifact-path,
or integrity-hash metadata, and must not register provider modules itself.

The Core catalogue resolves an agent ID such as `chatgpt-web` to the selected
plugin artifact.  The Core `loadAgent()` operation then owns descriptor selection,
module registration, plugin-API validation, agent creation, canonical-session
association, and loaded-identity verification.

A host environment may still own transport mechanics that Core cannot perform
itself.  For example, a browser userscript may need to use the browser's existing
authenticated GitHub session to obtain a private artifact.  That host supplies a
generic `loadModule(artifact)` callback.  Core passes its selected artifact
descriptor to the callback; the callback retrieves/verifies/imports those supplied
bytes and returns the module namespace.  The host does not independently select or
pin the provider plugin.

The resulting dependency boundary is therefore:

```text
consumer -> AIConversationCore -> provider plugin
```

For DownloadConversation specifically:

```text
DownloadConversation -> AIConversationCore -> Chat-Gpt-Plugin-2
```

DownloadConversation may implement generic authenticated browser artifact
transport, but it must not know that the selected `chatgpt-web` implementation is
stored in Chat-Gpt-Plugin-2 except through the opaque artifact descriptor supplied
by AICC at runtime.

## Plugin repositories and artifacts

Each agent/provider implementation may live in a separate repository, for example:

```text
Chat-Gpt-Plugin-2
Claude-Web-Plugin
Claude-Code-Plugin
Codex-Plugin
```

A repository may be public or private.  Privacy is an access-control property and
does not change the plugin ABI.

A provider repository may use many source modules internally, but it should
produce one self-contained ESM runtime artifact, for example:

```text
dist/chatgpt-plugin.mjs
```

The artifact may itself be public or private.  A private artifact remains only in
the private repository and is fetched by authorized users at runtime.  It is not
copied into the AICC repository or public AICC build output.

The single-file ESM artifact avoids runtime relative-module graph rewriting while
still allowing the plugin source repository to use normal modular source code.

## Browser/Tampermonkey runtime loading

A normal Tampermonkey userscript is not treated as an ESM entry point, but a
classic userscript can use the `import()` expression to load a module from a
`blob:` URL.

This was verified in the target environment on 2026-09-30:

```text
Chrome 154 + Tampermonkey 5.5.0 + chatgpt.com

dynamic import(data:)                         FAIL
dynamic import(blob:)                         PASS
injected inline <script type="module">        FAIL
injected blob <script type="module">         PASS
```

The preferred browser loader therefore is:

```text
AICC-selected artifact descriptor
        |
        v
generic host transport/authentication
        |
        v
plugin source bytes
        |
        v
      Blob
        |
        v
URL.createObjectURL()
        |
        v
 import(blobUrl)
        |
        v
provider module returned to AICC
```

The preferred path does not insert plugin source into the DOM.

The `Blob`/module instance is local to the page/JavaScript realm.  What is shared
between pages is the verified plugin source/cache and authorization state, not the
live JavaScript object.

## Shared browser cache and cross-tab/domain use

For Tampermonkey-hosted AICC use, userscript storage is the preferred shared
storage boundary because it can be shared by instances of the same userscript
across tabs and supported AI-agent domains.

The shared record should include at least:

```text
plugin ID
symbolic ref
plugin version/API metadata
verified artifact source/bytes
integrity metadata
retrieval/update metadata
authorization state/metadata as appropriate
```

The first page needing a missing artifact may authenticate, fetch, verify, and
store it.  Other pages retrieve the verified source and create/import their own
local Blob/module instance.

Do not attempt to serialize or pass the live imported plugin object between tabs.
Functions and closures are realm-local and are not a suitable Tampermonkey storage
payload.  A permanent broker-tab RPC design is intentionally avoided because tab
closure/reload and callback routing would create unnecessary fragility.

Concurrent first-use tabs must coordinate so that only one performs the initial
authorization/download.  A shared lock/state plus Tampermonkey value-change
notification is sufficient; `BroadcastChannel` or Web Locks may be used where
appropriate but are not required as the cross-domain storage authority.

## Local runtime

Local AICC use, including plugins for Claude Code or Codex, uses the same plugin
ABI and artifact format but has its own local authorization/cache implementation.
The local loader must not require browser/Tampermonkey APIs.

## Repository authentication

Public plugin artifacts require no repository authentication.

Private plugin artifacts should use a GitHub OAuth/GitHub App authorization flow
rather than requesting a password or asking every AICC instance for a personal
access token.

Authorization is owned by the shared loader/cache environment, not by individual
AICC instances.  In the Tampermonkey case, supported browser pages should reuse
that shared authorization/cache state.  Local AICC has one corresponding local
authorization/cache.

The plugin itself does not receive or own repository credentials merely because
it was fetched from a private repository.

## Plugin selection and updates

AICC selects a plugin through a readable symbolic ref, not an opaque commit SHA.
Examples include:

```text
main
develop
release/0.4
test/current
issue-104-agent-plugin-architecture
```

The ref may intentionally be mutable.  The loader must therefore revalidate the
ref/cache according to update policy rather than assuming that a previously seen
ref is immutable.

AICC's plugin descriptor should identify at least:

```text
plugin ID
repository
symbolic ref
artifact path
required plugin API version
```

Optional resolved commit/integrity/version fields may also be present for exact
build reproducibility.  Those resolved fields are Core-owned implementation
metadata and do not make the opaque commit the human-facing selection mechanism.

Testing can deliberately attach an AICC build to a named plugin branch/channel.
This is preferred over forcing a test to update an opaque SHA after every plugin
commit.

A plugin exposes its own version information through the public `version()` PI so
tests and logs can confirm what implementation was actually loaded.

## Artifact verification

Before execution, the host transport must validate bytes against the artifact
identity selected by AICC, and AICC must validate the loaded module/agent against
the plugin ABI and selected identity.  Validation should include the applicable
subset of:

- plugin ID;
- repository/ref/artifact path;
- plugin API version;
- plugin implementation version;
- integrity hash or equivalent artifact-integrity metadata when configured.

A plugin artifact may carry a manifest, but an artifact must not be allowed to
silently redefine what plugin/ref AICC requested.

If integrity or compatibility validation fails, the artifact must not execute or
register.

## Plugin availability and loader failures

Plugin loading is an explicit state machine rather than an unstructured fetch
exception.  Representative states include:

```text
UNINITIALIZED
AUTH_REQUIRED
AUTHENTICATING
FETCHING
VERIFYING
READY
UNAVAILABLE
```

Representative failure reasons include:

```text
AUTH_DENIED
AUTH_FAILED
ACCESS_DENIED
NETWORK_ERROR
NOT_FOUND
ARTIFACT_INVALID
API_INCOMPATIBLE
```

Required behaviour:

- authentication cancellation/denial leaves the plugin unavailable and must not
  cause a repeated login loop;
- access denial is reported explicitly;
- network failure must not cause a tight retry loop;
- invalid/incompatible artifacts are refused before execution;
- AICC may continue to exist while a specific provider plugin is unavailable;
- use of a previously verified cached artifact while the repository is
  temporarily unreachable is a policy decision and must not become an implicit
  fallback.

## Module instance and cache lifetime

Authorization and verified artifact source may be shared across tabs/pages, but
each page imports its own module instance from a local Blob URL.

Within one page, repeated AICC instances should avoid redundant downloads/imports.
A page-level module Promise/cache may be shared.  Mutable provider/session state
should normally be created per Core/agent instance rather than stored in a single
module-global singleton.

The cache is keyed by plugin identity plus the selected symbolic ref and enough
resolved metadata to determine freshness.  Because refs may move, the loader
revalidates a cached ref according to policy.  If the selected ref resolves to
unchanged artifact metadata, the verified cache is reused.  If it changed, the
new artifact is fetched and verified before use.

Older cached revisions may coexist temporarily so different AICC versions/test
branches do not overwrite each other's selected plugin source.  Do not rely solely
on ordinary browser HTTP caching for correctness.

## Loading verification requirements

Loading implementation is not complete until tests cover at least:

- Core owns provider-plugin selection metadata and downstream consumers do not;
- Core passes the selected descriptor to a generic host transport callback;
- Core performs module registration, agent creation, session association, and
  loaded identity verification;
- first authorization and authorization cancellation/denial;
- public artifact loading without authorization;
- private repository access denied;
- first artifact download;
- simultaneous pages causing only one initial authorization/download;
- another tab/domain obtaining the shared verified artifact source;
- verified cache reuse;
- mutable symbolic-ref revalidation/update;
- invalid artifact/integrity rejection;
- wrong plugin identity rejection;
- incompatible plugin API version rejection;
- Blob ESM import in the target Tampermonkey/browser environment;
- multiple AICC instances in one page without redundant artifact downloads;
- separate per-instance mutable provider state;
- local loader use of the same plugin ABI.
