# ChatGPT Citation Evidence Provenance

This file records the evidence hierarchy and durable provenance for ChatGPT citation rendering in `AIConversationCore`.

It exists to prevent later work from treating downstream clipboard fixtures, GPTSpy, or whichever renderer happens to be newest as though they were the primary evidence for browser citation presentation.

## Evidence hierarchy

### 1. User-supplied ChatGPT citation/source-card HTML snapshots

The original browser evidence included saved ChatGPT citation/source-card HTML captures referred to in project history as `citation 1.html` / `citation 2.html` and related screenshots.

The raw snapshot files are not currently checked into this repository, but their analysed findings were preserved in the DownloadConversation project history before the GitHub migration. In particular, legacy DownloadConversation ISSUE 35, now GitHub `Ma-XX-oN/DownloadConversation#36`, records the verified browser facts and the implementation sequence derived from those snapshots.

Those browser captures established these UI facts:

- a collapsed ChatGPT citation pill may show one visible source label plus a `+N` count;
- the citation pill contains decorative favicon imagery which is not conversational image content;
- the expanded citation popup exposes an `n/n` position counter, navigation controls, and one detailed source card at each position;
- each detailed source card exposes the source destination URL, visible source name/label, and favicon;
- grouped citations therefore need every actual source represented rather than preserving only the collapsed `+N` label;
- source ordering follows the popup/source traversal order;
- source-card title/blurb information is presentation evidence distinct from the provider JSON citation structure;
- tooltip/source-card descriptive text must remain readable with vertical separation between title and blurb.

Historical DownloadConversation implementation records are useful corroboration of what the snapshots established:

- v0.5.34 excluded citation favicons from conversational-image extraction and serialized the citation anchor instead;
- v0.5.35 traversed grouped `1/n ... n/n` source cards and captured every distinct source;
- v0.5.36-v0.5.40 refined Radix popup interaction and favicon acquisition without changing the underlying source-card evidence;
- v0.5.41-v0.5.43 refined presentation and were live verified before legacy ISSUE 35 was closed.

The historical final DownloadConversation framing used `citation:` / `citations:` wording. That wording is historical evidence, not the current canonical label, because later user-reviewed `AI-transcript.py` work explicitly changed the compact source block to `**(cite: ...)**` and subsequently refined the favicon and tooltip presentation.

### 2. Later user-reviewed `AI-transcript.py` citation presentation

The later multi-provider transcript work supplied a newer explicit presentation decision while retaining the browser-derived semantics above.

The user specifically required the citation blurb visible in screenshots to appear in the tooltip. The resulting renderer was then refined to the current compact presentation:

- `**(cite: ...)**` for web citation groups;
- Google favicon service URLs derived from the source domain;
- 15 by 15 HTML image dimensions with the text-relative `0.97em` sizing used by the current golden;
- `display:inline-block;white-space:nowrap` for each source link;
- title and blurb separated by a blank line in the HTML tooltip (`&#10;&#10;`);
- same-record search-result metadata may enrich a thin citation reference by normalized URL so a visible source blurb is not lost;
- grouped source order and labels remain preserved.

This later user-reviewed presentation supersedes the older DownloadConversation `citation:` / `citations:` label choice while retaining the browser evidence about actual source membership, source-card ordering, labels, destination URLs, favicon presence, and tooltip/blurb semantics.

This is why the current canonical ChatGPT golden uses `**(cite: ...)**` rather than restoring the older literal `citation:` framing.

## Canonical implementation coverage

### Issue #25

`AIConversationCore#25` implements the evidence-backed canonical ChatGPT citation slice.

The current `tests/chatgpt-citations.test.js` verifies:

- distinct canonical citation kinds rather than one flattened schema;
- canonical source ranges and source provenance;
- grouped web sources and supporting sources;
- retrieved-file and memory citation metadata;
- renderer independence from ChatGPT-native `content_references`, `search_result_groups`, and conversation-context metadata;
- readable title-to-blurb tooltip separation through `&#10;&#10;` in the canonical golden.

The current ChatGPT canonical golden additionally fixes the current presentation contract for source labels, destination links, Google favicons, compact `cite` framing, icon sizing, no-wrap source anchors, and tooltip presentation.

### Issue #35 — `sources_footnote`

`AIConversationCore#35` is a separate citation semantic discovered from GPTSpy supplemental evidence.

It deliberately does not claim that GPTSpy replaces the browser citation/source-card snapshots. It normalizes only the fields GPTSpy directly establishes for `content_reference.type = "sources_footnote"`: source `title`, `url`, and `attribution`, with source provenance preserved and no invented inline range when none is evidenced.

`sources_footnote` remains distinct from grouped web/search-result citations.

## Saved Markdown HTML baselines supplied 2026-08-28

The later files:

- `chatgpt-markdown-baseline_files.zip`
- `claudeweb-markdown-baseline_files.zip`

are saved HTML snapshots of ordinary Markdown rendering. They are **not** the earlier ChatGPT citation/source-card captures and do not establish ChatGPT `content_reference` structure or citation-popup behaviour.

Their relevant evidence is ordinary Markdown footnote rendering:

- both products use a footnote reference with `data-footnote-ref` and `aria-describedby="footnote-label"`;
- definitions appear under `section[data-footnotes]` with `user-content-fn-*` identifiers;
- backlinks use `data-footnote-backref`;
- Claude's saved DOM also contains explicit reciprocal `href` anchors between reference and definition.

These saved-HTML baselines therefore corroborate ordinary Markdown footnote presentation only. Literal Markdown footnote preservation in ChatGPT source text is protected separately by `tests/chatgpt-provenance-footnote.test.js`.

## Supplemental evidence that is not primary browser-presentation authority

- **GPTSpy:** useful for concrete provider/API structures such as `sources_footnote` and streamed-event research. It does not replace the already-established ChatGPT browser source-card evidence.
- **AutoHotkey / clipboard-copy fixtures:** downstream serialization evidence. They can corroborate presentation but do not define raw ChatGPT API/DOM structure.
- **Current DownloadConversation host renderer:** useful consumer/integration evidence, but after migration its independent renderer is not an equal authority to the canonical core unless a separately tracked real mismatch is established.

## Audit conclusion — 2026-08-28

The evidence audit found no currently untracked citation renderer semantic requiring a code change.

The apparent historical mismatch between the old DownloadConversation `citation:` / `citations:` framing and the current core `cite:` framing is resolved by the later user-reviewed `AI-transcript.py` work, which explicitly adopted the compact `cite` form and the current favicon/tooltip styling. The current AIConversationCore golden matches that later decision.

The browser facts that still matter from the older citation HTML snapshots — source membership, ordering, labels, destination URLs, favicon presence, grouped-source expansion, and readable title/blurb presentation — are represented by the current canonical model/golden/tests.

No chronology, grouping, User/Assistant association, normalization, or renderer behaviour is changed by this documentation audit.
