# Source Provenance Contract

`AIConversationCore` canonicalization must never sever a normalized event or derived
turn from the original provider JSONL record(s) that produced it.

Canonical identity is additional identity.  It does not replace provider/source
identity.

## Per-record provenance

For each normalized source record, preserve enough information to locate and
identify that exact record in the original JSONL database:

- the 0-based source record index used internally;
- the corresponding 1-based record number used by transcript projections;
- the provider/source record or message ID when present;
- the provider/source turn ID when present or, for the evidenced ChatGPT export
  where the stable message record ID is the source turn identity used by the
  consumer, that exact source identity without substituting a canonical ID;
- the raw source timestamp fields that exist on the provider record, including
  `create_time` and `update_time` for ChatGPT; and
- evidenced provider relationship identities such as ChatGPT
  `turn_exchange_id` / `working_turn_id` when those fields are available.

Do not replace a source value with a reformatted, synthesized, or canonical value.
A projection may format a timestamp for display, but the canonical provenance must
retain the original source value from which the display value is derived.

## Derived turns

When several normalized events contribute to one canonical turn, the turn must
retain the provenance of **every** contributing source record.  A canonical turn
ID is therefore not a substitute for the source-record list.

This is required so downstream consumers can still project original JSONL record
numbers, timestamps, and source turn/message IDs after normalization and turn
derivation.

## Projection rule

Renderers and other projections consume canonical data only.  If a projection
needs an original record number, timestamp, or source/provider identity, it must
obtain that value from canonical provenance rather than reopening or re-parsing
the provider JSONL record.

A projection may also expose canonical turn identity when requested.  Canonical
and source identities are separate namespaces and must not silently overwrite or
masquerade as one another.

## Scope discipline

Preserving provenance does not authorize chronology, grouping, association, or
User/Assistant pairing changes.  Those semantics change only when concrete source
evidence establishes a separate defect and that defect is tracked separately.
