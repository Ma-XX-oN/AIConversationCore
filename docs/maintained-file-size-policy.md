# Maintained file-size policy

Repository-owned maintained files target at most 500 logical lines.  The permanent
check is `scripts/check-maintained-file-size.mjs`, configured by
`.github/file-size-policy.json` and invoked by the repository CI matrix.

`legacy_max_lines` is not permission for an oversized file to grow.  It records a
pre-existing ceiling so adoption of the invariant can fail on new growth without
rewriting unrelated historical material.  A legacy ceiling may only decrease or
be removed after the file is deliberately split by responsibility.

Issue #106 removed the temporary 518-line exception for
`EXISTING_IMPLEMENTATIONS.md` by splitting that design input into
`docs/EXISTING-IMPLEMENTATIONS-BASELINES.md` and
`docs/EXISTING-IMPLEMENTATIONS-IMPLICATIONS.md`, leaving the top-level file as a
short index.  This demonstrates the preferred resolution for an oversized
maintained file: split responsibilities and remove the legacy ceiling rather than
normalizing continued growth.
