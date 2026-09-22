# Issue #106 lineage reconciliation map

This document records the evidence map used to repair AIConversationCore branch topology. It is historical/reconciliation documentation; stable branching rules live in `BRANCHING.md`.

## Authoritative integration target

`main` is the intended authoritative production integration line.

Issue #106 branch: `issue-106-reconcile-core-lineages`

Issue #106 parent: `main`

## Shared verified semantic foundation

Commit `134d5735b44b8d131d30d5b98a6e3a06320a113f` (`issue-85-navigation-boundaries`) is the last common verified semantic ancestor of the later AgentPanelSpeaker and DownloadConversation Core lines.

Relative to current `main`, this shared line contains a large body of already-completed canonical/session/presentation work that never returned to `main`. The repair therefore cannot treat current `main` as semantically newer merely because it is the default branch.

## DownloadConversation continuation

Verified presentation line:

- #86 final dependency head: `b7961cb8dab11611a5af8f4304ae783295998cf2`
- #89 final clean head: `d6d76b54db3d48baf3f5e3a76099be1732d32785`
- #98 version/browser API final head: `cf34d9374f51ac525acfb90cfd6b247006a7bf6e`

Unique responsibilities after the shared foundation include:

- Core-owned transcript heading metadata;
- fixed-offset/IANA timezone heading formatting;
- bare visible provider/source Turn ID serialization;
- browser-bundle parity for those projection changes;
- ESM/browser `getVersion()` contract on the DownloadConversation-pinned line.

#98 is a compatibility/version port on that line; its semantic value is the unified public version/browser contract, not a separate provider model.

## AgentPanelSpeaker continuation

Version port from shared foundation:

- #94/#96 final head: `74a96db899acacf2be7eec42a1175b733b6e7cfb`

This adds the same public `getVersion()` contract and removes obsolete issue-79 one-shot workflow inheritance without changing renderer/session/speech semantics.

Unique later semantic work:

- #100 final head: `fe2914613fd9defca1af1fd4724de61f316c0853`
- isolated #100 delta from `74a96db8...` touches retained-session documentation, Claude normalization/adaptation, canonical retained-session append handling, and `tests/claude-retained-session.test.js`.

#100 adds verified incremental Claude retained-session append semantics and is not superseded by the DownloadConversation line.

## AI-transcript compatibility line

Final version-port head: `4b1bebe6fd7d82d8bbb15f4ad5c1a59cfd03132a`.

Its delta from historical pinned base `54a70c2989de0c02f03b28a2f8d8c6986b974141` is only the public version API/CI contract. It contains no unique newer canonical semantics that require wholesale lineage integration.

Preserve the version API contract once on the unified line; do not merge the historical AI-transcript lineage.

## Current main-only changes

Current `main` head before #106: `75e3be777754e82a54cf92d6b914047c0b2386d9`.

Relative to the shared semantic foundation, current `main` contains a small set of unique changes including the Claude leading-system-context regression/normalization support and the public version contract/documentation. These must be checked semantically against the richer line and preserved where not already present/superseded.

## Planned unified semantic composition

The candidate must contain exactly one authoritative implementation of each responsibility:

1. shared verified semantic foundation through #85;
2. #86/#89 Core-owned heading/presentation semantics from the DownloadConversation continuation;
3. #100 Claude retained-session append semantics from the AgentPanel continuation;
4. one public ESM/browser version authority/API and deterministic browser build contract;
5. current-main-only fixes that remain semantically unique after comparison;
6. #106 branch-policy/repository-process enforcement and documentation.

Do not bulk-merge #102, #98, #100, or the long-lived feature lines. Preserve focused verified deltas instead.

## Required verification before merge to main

Core:

- JSDoc gate;
- deterministic/current browser artifact;
- full Node suite;
- Phase 2 integrity;
- canonical ChatGPT/Claude/Codex goldens;
- provider example regressions;
- branch/repository policy checks;
- diff/whitespace integrity.

Dependents against the exact candidate Core SHA:

- DownloadConversation;
- AgentPanelSpeaker.NET;
- AI-General-Memory / AI-transcript.py;
- Multi-AI.

Record each dependent branch/head, exact Core SHA/pin, workflow/test run, and any intentional compatibility change on issue #106 before merge.

## Cleanup boundary

Do not delete historical/divergent branches until every unique commit/responsibility has been accounted for and downstream acceptance is complete. Branch deletion is cleanup after reconciliation, not a reconciliation mechanism.
