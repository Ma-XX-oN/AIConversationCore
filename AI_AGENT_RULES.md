# AI Agent Rules

These rules are mandatory for AI-assisted work in this repository.

## Repository is authoritative

Read `README.md`, `DESIGN.md`, `TESTING.md`, `ROADMAP.md`, and `DECISIONS.md` before making architectural or behavioural changes.  Do not rely on chat history or memory when the repository documents the decision.

## Preserve proven behaviour

Do not change working behaviour unless the requested task requires it or real evidence demonstrates a defect.

Do not replace algorithms merely because another approach appears cleaner.  Existing behaviour that has worked on real data must be treated as intentional until evidence shows otherwise.

If an unrelated real issue is discovered, record it separately and fix it separately.  Do not bundle unrelated changes into the current commit.

## Small migration steps

AIConversationCore is a staged extraction from existing consumers, not a rewrite.  Move one coherent vertical slice at a time, preserve behaviour with tests, and verify parity before moving on.

## Testing is mandatory

Follow `TESTING.md`.

Every behavioural change must test both the requested/new behaviour and relevant previously-correct behaviour.  Run the applicable unit, fixture, golden-output, parity, and integration tests before declaring work complete.

Never update golden outputs merely to silence a failing test without first proving the output change is intentional.

If complete verification cannot be performed, state exactly what was not verified and why.  Do not describe partially verified work as complete.

## Truthfulness

Distinguish facts established by tests or source inspection from assumptions, hypotheses, heuristics, and incomplete analysis.  Do not present an assumption as a proven conclusion.

## Documentation

Architectural decisions and reversals belong in `DECISIONS.md`.  Stable design and invariants belong in `DESIGN.md`.  Current migration sequencing/state belongs in `ROADMAP.md`.  Test contracts belong in `TESTING.md`.

When a change alters one of those contracts, update the corresponding document in the same logical change.
