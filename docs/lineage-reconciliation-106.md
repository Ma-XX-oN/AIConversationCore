# Issue #106 lineage reconciliation map

This document records the evidence used to reconstruct AIConversationCore from
divergent verified lines.  Stable branch rules live in `BRANCHING.md`; this file
is the issue-specific ledger showing what was recovered, what was deliberately
excluded, and which exact checkpoints proved each responsibility.

## Authoritative integration target

`main` is the authoritative production integration line.

Issue #106 durable umbrella branch: `issue-106-reconcile-core-lineages`.

Dependency reconstruction staging branch:
`tmp/issue-106-dependency-reconstruction`.

The staging branch exists to rebuild the candidate from a clean `main` parent
without preserving unrelated merge ancestry.  It is not a new parent policy.

The clean current-main base used by the reconstruction is
`90de728e042a4fa4d042a518bf2e5a93d323b85c`.

## Historical semantic sources

The last shared verified semantic foundation of the older consumer lines is
`134d5735b44b8d131d30d5b98a6e3a06320a113f` (#85 navigation boundaries).

The verified DownloadConversation continuation is represented by:

- #86 dependency head `b7961cb8dab11611a5af8f4304ae783295998cf2`;
- #89 clean head `d6d76b54db3d48baf3f5e3a76099be1732d32785`;
- #98 version/browser head `cf34d9374f51ac525acfb90cfd6b247006a7bf6e`.

Its unique responsibilities are Core-owned heading metadata, timezone formatting,
bare visible provider/source Turn IDs, matching Markdown/HTML/browser projection,
and the public ESM/browser version contract.

The verified AgentPanel continuation contributes one later unique semantic delta:

- #94/#96 base `74a96db899acacf2be7eec42a1175b733b6e7cfb`;
- #100 final `fe2914613fd9defca1af1fd4724de61f316c0853`.

#100 adds incremental Claude retained-session append semantics.  The older
monolithic Claude adapter itself is not imported because the reconstructed
current-main adapter is newer and already owns the required retained state seam.

The AI-transcript compatibility line contributes no unique later canonical
semantics beyond the shared public version contract, so its historical ancestry
is not merged wholesale.

The clean #102 release-tooling responsibility ends at
`d0cb2183e3cc85ebd96eaa75a7d63c7c9e4fd177`.  The later #102 merge
`1632031c8ac28269882ba01585bdf97d56a170ac` imported unrelated lineage and is
not an implementation source.  #106 reconstructs only the clean #102-owned
stable-release contract.

## Reconstructed dependency checkpoints

### Group 1 — current-main foundation compatibility

GREEN candidate:
`889ab9d9a622d2c39a71753f41a4fdc5bc10bc60`
(`1.0.0-issue.106.5`).

This preserved current-main Claude normalisation and #110/#112 repository-policy
behaviour while establishing a deterministic, current browser artifact.

### Shared #79–#85 foundation plus #86/#89 presentation

RED:
`38011258fa17a1335c47a6256b45d519d86c4b34`
(`1.0.0-issue.106.9`, immutable CI-FAIL result).

GREEN:
`0d858ea6210265bf9185b11b31bb1e56318263fa`
(`1.0.0-issue.106.10`).

This restores canonical HTML units, word identity/lookup/provenance/separators,
navigation boundaries, retained canonical session/source APIs, structured and
speech/interactive projection, and propagates the verified heading semantics
through that restored stack.  Codex timestamp/Turn-ID provenance and IDE/user
context are both retained.

### #100 Claude retained-session append

RED:
`49ecdc16c695abc17f0b1e8a80c28a9b5c320591`
(`1.0.0-issue.106.11`, immutable CI-FAIL result).

All five introduced retained-Claude-session contracts failed at the same missing
integration point: retained session append rejected provider `claude`.

GREEN:
`399d80ed6aa50581f916ea6425ad91ba87a4a8ae`
(`1.0.0-issue.106.12`).

The correction wires the already-reconstructed incremental Claude adapter into
`CanonicalConversationSession` and preserves the newer current-main Claude
normalisation rather than replacing it with #100's older monolith.

### Repository lineage, maintained-size, and release policy

RED:
`f9fe4691c8b43437277cc473efb67577f48c90ab`
(`1.0.0-issue.106.13`, immutable CI-FAIL result).

The complete existing semantic baseline remained GREEN while exactly the three
introduced policy suites failed because their owned modules were absent:
`branch-policy-lib.mjs`, `file-size-policy-lib.mjs`, and `release-lib.mjs`.

The production correction is the `.106.14` iteration.  Its exact final candidate,
CI run, and immutable PASS tag are recorded on issue #106 after verification;
the document intentionally does not self-reference a commit SHA that contains
itself.

## Permanent repository invariants restored by #106

The unified line must enforce, in repository-owned tooling rather than memory:

1. issue branches have a declared/default parent and cannot import unrelated
   ancestry;
2. umbrella branches may import only explicitly declared dependencies;
3. pull-request bases must match the branch parent contract;
4. maintained source/document files target at most 500 logical lines, with
   explicit no-growth ceilings for pre-existing oversized files;
5. development CI acceptance tags identify exact qualified issue versions;
6. stable releases use plain semantic versions only, are prepared on an issue
   branch, merged to `main`, then tagged on that exact verified `main` commit;
7. the generated browser artifact remains deterministic and is the only
   repository file that the guarded artifact workflow may commit automatically.

## Required verification before merge to main

Core verification includes the full repository-owned matrix: Actions policy,
CI-contract tests, maintained-file scan, JSDoc, complete Node tests, deterministic
browser artifact, Phase 2 integrity, ChatGPT/Claude/Codex goldens, provider
examples, branch-policy tests/workflow, and diff hygiene.

The exact final Core SHA must then be accepted by the actual downstream surfaces:

- DownloadConversation;
- AgentPanelSpeaker.NET;
- AI-General-Memory / AI-transcript.py;
- Multi-AI, or an explicit evidence record that it has no Core integration
  surface requiring execution.

Record the downstream branch/head, exact Core SHA or pin, run/test evidence, and
any intentional compatibility change on issue #106 before merging to `main`.

## Cleanup boundary

Do not delete divergent historical branches until every unique responsibility is
accounted for and downstream acceptance is complete.  Branch deletion/recreation,
including repair of the polluted #102 line and dependent active branches such as
#34, is cleanup after verified integration rather than a reconstruction method.
