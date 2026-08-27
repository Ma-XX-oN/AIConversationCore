# Testing

Testing is a first-class requirement of AIConversationCore.  A change is not complete merely because the new behaviour works.  It must also demonstrate that previously-correct behaviour remains correct.

## Core rule

Every behavioural change must have tests that cover:

1. the new or corrected behaviour;
2. the previously-correct behaviour most likely to regress;
3. parity between consumers when they are expected to produce the same result.

No migration step is accepted on visual inspection alone.

## Permanent CI gate

The repository keeps a permanent GitHub Actions workflow at
`.github/workflows/ci.yml`.  It runs on pushes to `main` and pull requests targeting
`main` and is the standard clean-checkout regression gate for repository changes.

The CI workflow runs:

- `npm test`;
- `python tests/validate-phase2-baseline.py`;
- `python tests/validate-canonical-golden.py`;
- `python tests/validate-claude-canonical-golden.py`;
- `python tests/validate-codex-canonical-golden.py`; and
- `python tests/validate-provider-example-regressions.py`.

Do not replace this maintained workflow with per-change self-deleting verification
workflows.  When a new mandatory repository-wide regression validator is added,
update both this section and `.github/workflows/ci.yml` in the same change.

A successful CI run is evidence that the checked-in repository passes this common
gate on a clean GitHub-hosted environment.  It does not replace consumer-specific
integration tests that require environments or capabilities unavailable in CI.

## Test layers

### Unit tests

Test provider adapters, normalization, derivation, escaping, code-fence selection, citation rendering, file/artifact URL handling, visibility rules, and other deterministic transformations in isolation.

### Fixture tests

Keep representative raw provider records as fixtures.  Fixtures must include unusual and previously-broken cases, not only clean happy paths.

For ChatGPT, fixtures must include at least:

- ordinary User and Assistant final turns;
- commentary/intermediate messages;
- tool calls and tool results;
- reasoning/thought summaries when exposed;
- subagent/delegated-agent activity when available;
- citations and memory citations;
- attachments and images;
- generated artifact links, including filenames containing parentheses and other characters requiring URL encoding;
- `sandbox:/mnt/data/...` artifact references;
- provider file pointers such as `sediment://...`;
- hidden/system/model-editable records;
- incomplete or half-turn situations;
- branch/parent relationships;
- code blocks whose language can be inferred from tool context.

Every real regression that reaches a consumer should produce a fixture before or as part of the fix so the same defect cannot silently return.

### Golden-output tests

Canonical Markdown rendering must be tested against checked-in expected output.  Golden files are intentional contracts and should only change when the rendering contract intentionally changes.

A golden-output change must be reviewed as a behaviour change, not refreshed automatically just to make a test pass.

### Cross-consumer parity tests

Where consumer-specific outer metadata is intentionally different, normalize/remove only those explicitly documented fields before comparison.

The transcript body produced from the same source records by DownloadConversation and `AI-transcript.py` must otherwise be byte-equivalent.

Known classes that parity tests must protect include:

- HTML attribute escaping;
- code-fence language selection;
- code/tool-output newline handling;
- citation and memory-citation HTML;
- favicon/decorative HTML policy;
- whitespace normalization;
- generated artifact URL construction;
- `sandbox:` conversion;
- provider file-pointer resolution such as `sediment://`.

Parity mismatches are defects unless the difference is explicitly documented as intentional.

### Integration tests

Each consuming application must test the integration boundary with AIConversationCore:

- DownloadConversation: browser/API records -> core -> canonical model/Markdown;
- AI-transcript.py: JSONL -> core worker -> canonical model/Markdown;
- AgentPanelSpeaker: records -> core -> canonical content/speech projection.

Application-specific acquisition, storage, UI, playback, and recovery remain tested in their own repositories.

## Regression discipline

Before changing existing behaviour:

1. identify the current behaviour;
2. determine whether it is already proven correct by tests or real data;
3. add/retain a regression test for it;
4. make the smallest required change;
5. run the relevant unit, fixture, golden, parity, and integration tests;
6. inspect the diff of generated/golden output;
7. do not accept unrelated output changes.

If an unrelated real defect is discovered, track it separately and fix it in a separate commit/change.  Do not bundle speculative cleanup or algorithm changes into the current fix.

## Migration safety

The initial migration from existing consumers must be incremental.  Do not replace large working sections at once.

For each extracted vertical slice:

1. capture current expected behaviour in tests;
2. move only that behaviour into AIConversationCore;
3. switch one consumer to the shared implementation;
4. verify no unexpected output change;
5. switch the next consumer;
6. verify cross-consumer parity;
7. only then continue to the next slice.

The purpose of this sequence is to make any regression attributable to a small change rather than to a broad rewrite.

## Completion gate

A code task affecting behaviour is incomplete if the relevant tests were not run successfully.  If a required test cannot be run, that limitation must be stated explicitly and the task must not be described as fully verified.
