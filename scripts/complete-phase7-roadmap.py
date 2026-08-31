#!/usr/bin/env python3
from pathlib import Path

path = Path('ROADMAP.md')
text = path.read_text(encoding='utf-8')

status_anchor = '''**Phase 6 is complete.** `AI-General-Memory/scripts/AI-transcript.py` now routes
ChatGPT, Claude, and Codex transcript presentation through a persistent Node.js
worker pinned to AIConversationCore while retaining Python-specific CLI, discovery,
JSONL I/O, filtering/search/session commands, and output routing.  The existing
`-N` debug flag now uses canonical `turn_id`/`record_index` provenance rather than
the superseded `<!-- record: N -->` format.  Historical parity, canonical provider
parity, portable direct-file regressions, core tests, and diff hygiene gate the
integration.  The production migration was committed in AI-General-Memory as
`5c299cdbf0265024994cd3601eb73df14e5ad623`.
'''
status_addition = status_anchor + '''
**Phase 7 is complete.** Permanent cross-consumer final-render CI now exercises
AIConversationCore direct rendering, the production `AI-transcript.py` entry point,
and DownloadConversation's production Markdown renderer against shared source
fixtures at the complete output boundary.  Exact comparisons cover the rich
ChatGPT canonical golden, a real multi-exchange Markdown-shape fixture, and an
adversarial fixture for nested/adaptive fences, literal heading text inside opaque
tool output, real `role=tool` records, tool-language/structured-input
normalization, generated sandbox paths containing parentheses, source heading
identity, and the explicitly declared DownloadConversation one-newline EOF
transport policy.  Phase 7 also separated enclosing-response heading projection
from commentary-heading projection so both retain the correct source identity.
AIConversationCore CI run `33354354535`, AI-General-Memory parity run
`33353774957`, and DownloadConversation CI run `33354379357` record the final
post-cleanup green gates.
'''
if '**Phase 7 is complete.**' not in text:
  if status_anchor not in text:
    raise SystemExit('Phase 6 current-status anchor not found')
  text = text.replace(status_anchor, status_addition, 1)

phase_anchor = '''## Phase 7 — Cross-consumer parity gate

Use the same source fixtures through all relevant entry points and compare
canonical outputs/projections.

At minimum, protect against regressions involving:

- code-fence language selection
- HTML/Markdown escaping
- citation formatting
- favicon/decorative markup differences
- sandbox URL conversion
- provider file-pointer resolution
- trailing-newline and blank-line policy
- hidden/commentary/tool/subagent handling
- turn ordering/identity

No migration slice is complete until parity and regression tests pass.
'''
phase_replacement = '''## Phase 7 — Cross-consumer parity gate

**Status: COMPLETE.**

Permanent CI compares complete final rendered output through all three migrated
consumer boundaries: direct AIConversationCore rendering, production
`AI-transcript.py`, and DownloadConversation's production Markdown renderer.  The
gate uses declared consumer projections only; it does not normalize arbitrary
whitespace or rewrite structure to force equality.

Verified coverage includes:

- adaptive code-fence sizing around nested/literal backtick payloads;
- HTML/Markdown structure including headings, blockquotes, tables, lists, code
  blocks, details/summary structures, and footnotes;
- citation formatting, favicon/decorative markup, and browser `URL` semantics;
- sandbox/generated-file conversion including paths containing parentheses;
- provider image/file-pointer resource rendering and browser recovery-state
  enrichment;
- exact trailing-newline/blank-line policy, including DownloadConversation's
  declared single-EOF-newline transport projection;
- hidden, commentary, thought, tool-call, and real `role=tool` source shapes;
- tool-call language/structured-payload normalization including flattened Python
  `-c` and JSON-shaped API-tool input;
- opaque literal `## ChatGPT` text inside tool output without structural leakage;
- response/commentary source heading identity and turn/source ordering; and
- existing Claude sub-agent/debug projection behaviour through the core and
  `AI-transcript.py` regression suites.

The permanent DownloadConversation cross-consumer job runs three independent
whole-output cases: the checked-in rich ChatGPT canonical golden, a real
multi-exchange Markdown-shape fixture, and an adversarial containment/normalization
fixture.  Relevant AIConversationCore, AI-transcript.py, and DownloadConversation
regression suites are green after removal of the temporary Phase 7 patch workflows.
'''
if '**Status: COMPLETE.**' not in text[text.find('## Phase 7 — Cross-consumer parity gate'):text.find('## Phase 8 — AgentPanelSpeaker integration')]:
  if phase_anchor not in text:
    raise SystemExit('Phase 7 roadmap section anchor not found')
  text = text.replace(phase_anchor, phase_replacement, 1)

path.write_text(text, encoding='utf-8')
