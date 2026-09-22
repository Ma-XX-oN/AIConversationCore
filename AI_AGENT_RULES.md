# AI Agent Rules

These rules are mandatory for AI-assisted work in this repository.

## Repository is authoritative

Read `README.md`, `DESIGN.md`, `TESTING.md`, `ROADMAP.md`, `DECISIONS.md`, `NORMALIZATION_RULES.md`, and `BRANCHING.md` before making architectural or behavioural changes. Do not rely on chat history or memory when the repository documents the decision.

## Preserve proven behaviour

Do not change working behaviour unless the requested task requires it or real evidence demonstrates a defect.

Do not replace algorithms merely because another approach appears cleaner. Existing behaviour that has worked on real data must be treated as intentional until evidence shows otherwise.

If an unrelated real issue is discovered, record it separately and fix it separately. Do not bundle unrelated changes into the current commit.

## Issue and branch ownership

Every substantive change must be owned by an issue before production changes begin.

Every issue branch has one explicit parent branch. Unless an approved exception is recorded in `.github/branch-policy.json`, the parent is `main`. Branch from that parent, implement only issue-owned work plus explicitly declared dependencies, verify the work, and merge the completed issue back into that same parent.

Do not turn ordinary issue branches into integration trunks. An umbrella/integration branch is an explicit exception: its issue and `.github/branch-policy.json` entry must identify its parent/integration target and its allowed dependency branches before those histories are imported.

Do not merge or stack unrelated issue histories merely because one consumer currently pins them. Use `scripts/check-branch-policy.mjs` and the permanent Branch policy workflow as repository enforcement. See `BRANCHING.md`.

## Small migration steps

AIConversationCore is a staged extraction from existing consumers, not a rewrite. Move one coherent vertical slice at a time, preserve behaviour with tests, and verify parity before moving on.

## Testing is mandatory

Follow `TESTING.md`.

Every behavioural change must test both the requested/new behaviour and relevant previously-correct behaviour. Run the applicable unit, fixture, golden-output, parity, integration, and dependent-repository tests before declaring work complete.

Never update golden outputs merely to silence a failing test without first proving the output change is intentional.

If complete verification cannot be performed, state exactly what was not verified and why. Do not describe partially verified work as complete.

## GitHub Actions mutation boundary

GitHub Actions is for CI, tests, builds, integration validation, and deterministic generated-artifact materialization. Do not use Actions as a remote editor for authoritative source code or documentation.

The only repository-write exception is a workflow whose purpose is to build/materialize a deterministic generated artifact. That workflow must stage and commit only the generated artifact path(s), must fail if any other path changes, and must not contain source/document editing logic. The maintained browser-artifact workflow is the reference implementation of this exception.

Batch related direct repository edits into as few meaningful commits as practical so CI quota is spent on validation rather than editing mechanics.

## Source and documentation size

Authoritative production source modules and maintained documentation files should remain below approximately 500 lines. Treat approximately 500 lines as the hard upper boundary for new files and newly split files, not as a target.

Split earlier when another responsibility is being added. Split by responsibility and keep explicit cross-references; do not evade the limit by compressing formatting, removing documentation, or moving unrelated material into a catch-all file.

Generated artifacts, fixed fixtures, and golden outputs are separate and may exceed the limit when their generated/evidence role requires it.

Existing authoritative files already above the boundary are legacy debt: do not add substantive responsibility to them. Split the affected responsibility before extending that code/document. Repository policy should reject new oversized authoritative files and prevent legacy oversized files from growing or receiving unrelated responsibility.

## Design/documentation map

Stable architecture documentation must make the implementation navigable without rereading the repository. For each subsystem it covers, document:

- what responsibility the subsystem owns;
- what it explicitly does not own;
- inputs, outputs, and important state/lifetime;
- data/control flow to adjacent subsystems;
- the concrete source files/modules implementing each responsibility;
- relevant tests/fixtures and related focused design documents.

When responsibilities move or modules split, update the map in the same logical change. If a design document approaches the size boundary, split it into focused documents and keep the parent/index document as a cross-reference map.

## Truthfulness

Distinguish facts established by tests or source inspection from assumptions, hypotheses, heuristics, and incomplete analysis. Do not present an assumption as a proven conclusion.

## Code documentation standard

Every named production JavaScript function, method, and function-valued constant must have an immediately preceding JSDoc documentation block using `/** ... */`. The comment must state the function purpose. Every declared parameter must have an `@param` tag with the expected JSDoc type and a description of what the parameter represents. Every function must have a typed `@returns` tag whose description states what the return value represents; functions with no meaningful return value use `@returns {void}`. Transformation/normalization functions must additionally state the actual source representation and the canonical/output representation when those differ.

JSDoc indentation is part of the code style contract. The opening `/**` and closing `*/` must use the same indentation as the declaration they document. Every interior JSDoc line must use that same indentation followed by exactly one space and `*`; tags and blank `*` lines follow the same alignment. Do not emit partially de-indented generated blocks.

Types must describe what the implementation actually accepts and returns. Do not use broad placeholder unions or guessed types merely to satisfy the audit.

Every top-level production `const`, `let`, and `var` declaration that is not itself a documented function-valued declaration must have an immediately associated explanatory comment stating what the value represents, controls, or preserves. Local variables also require explanatory comments when their meaning is not self-evident from the identifier and immediate expression, especially state/lifecycle variables, caches and lookup maps, cursor/index/ordinal state, source-record correlation, grouping/classification state, resource/citation maps, pending buffers, and ordering invariants. Trivial loop counters and direct one-use derived values need not be commented merely to add noise. Variable comments must describe semantics or invariants rather than restating the identifier name, and must preserve the surrounding indentation.

Do not rely on ordinary `//` comments as the function-level documentation marker. Inline comments remain appropriate for local algorithm details and evidence/rationale inside a documented function. Anonymous inline callbacks do not require a separate JSDoc block unless they are promoted to a named reusable function.

## Documentation

Architectural decisions and reversals belong in `DECISIONS.md`. Stable design and invariants belong in `DESIGN.md` and its focused cross-referenced design documents. Current migration sequencing/state belongs in `ROADMAP.md`. Test contracts belong in `TESTING.md`. Durable normalization/rendering-shape rules belong in `NORMALIZATION_RULES.md`. Branch/integration/release-lineage rules belong in `BRANCHING.md`.

When a change alters one of those contracts, update the corresponding document in the same logical change.
