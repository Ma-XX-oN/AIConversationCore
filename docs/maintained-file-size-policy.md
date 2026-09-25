# Maintained file-size policy

Repository-owned maintained files target at most 500 logical lines.  The permanent
check is `scripts/check-maintained-file-size.mjs`, configured by
`.github/file-size-policy.json` and invoked by the repository CI matrix.

`legacy_max_lines` is not permission for an oversized file to grow.  It records a
pre-existing ceiling so adoption of the invariant can fail on new growth without
rewriting unrelated historical material.  A legacy ceiling may only decrease or
be removed after the file is deliberately split by responsibility.

`EXISTING_IMPLEMENTATIONS.md` is recorded at 518 lines because the exact same Git
blob (`005fb502f1a2498b54bb0bc503aec834cd1f6faf`) already exists on the clean
pre-reconstruction `main` base (`90de728e042a4fa4d042a518bf2e5a93d323b85c`).
Issue #106 did not add those lines.  Its 518-line ceiling therefore freezes the
existing design-input document rather than weakening the 500-line rule for new
or growing files.
