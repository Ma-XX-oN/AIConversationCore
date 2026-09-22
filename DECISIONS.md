# AIConversationCore decisions

Durable architectural decisions are split into focused files so maintained documents remain below the repository size limit.

Do not silently rewrite history when a decision changes. Add a new numbered decision that explicitly supersedes/refines the earlier one and update this index.

## Decision files

- `decisions/FOUNDATION-DECISIONS.md` — D001-D016: implementation language, canonical model, migration authority, rendering separation, testing, interactive use, provider/tool/style/provenance foundations.
- `decisions/PRESENTATION-DECISIONS.md` — D017-D027: presentation tree, canonical HTML units, word identity/provenance/navigation, raw HTML, heading semantics, visible Turn IDs.

## Index

| ID | Topic | Status/file |
| --- | --- | --- |
| D001 | JavaScript is the canonical implementation language | Foundation |
| D002 | Canonical primitives are events; turns are derived | Foundation |
| D003 | Normalize provider differences without erasing them | Foundation |
| D004 | Rendering is downstream of normalization | Foundation |
| D005 | One canonical Markdown renderer | Foundation |
| D006 | Preserve working behaviour during migration | Foundation |
| D007 | Testing is part of the architecture | Foundation |
| D008 | Keep DownloadConversation as Tampermonkey during migration | Foundation |
| D009 | Interactive turn consumption is a Core use case | Foundation |
| D010 | Repository documentation carries project context | Foundation |
| D011 | AI-transcript.py is default multi-provider migration authority | Foundation |
| D012 | ChatGPT citation/image exceptions require explicit provenance | Foundation |
| D013 | Tool correlation requires explicit source identity | Foundation |
| D014 | Projection styling uses Core semantic roles | Foundation |
| D015 | Renderer debug provenance uses source identity | Foundation; refined by D026 |
| D016 | ChatGPT response/thought grammar | Foundation; generalized by D017 |
| D017 | Provider-independent presentation tree/rendering grammar | Presentation |
| D018 | Core-owned complete HTML virtualization units | Presentation |
| D019 | Canonical word identity is one Core-owned DOM element | Presentation |
| D020 | Word-handle lookup is a high-level Core operation | Presentation |
| D021 | Canonical words carry Core-owned source provenance | Presentation |
| D022 | Canonical word streams retain separators | Presentation |
| D023 | Structural speech prefixes are not word identities | Presentation; superseded for ordinals by D024 |
| D024 | Ordered-list ordinals are canonical word identities | Presentation |
| D025 | Raw Markdown HTML is content, not Core structure | Presentation |
| D026 | Heading semantics/debug provenance are Core-owned | Presentation; refines D015 |
| D027 | Visible Turn IDs are unlabeled values | Presentation; refines D026 |

For responsibility/file ownership, see `DESIGN.md`; for interactive projection details, see `INTERACTIVE_PROJECTIONS.md`; for retained-session design, see `RETAINED_SESSIONS.md`.
