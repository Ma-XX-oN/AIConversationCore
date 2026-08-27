#!/usr/bin/env python3
"""Validate canonical rich Codex goldens and their provenance."""

import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "tests" / "codex-canonical-golden-manifest.json"


def fail(message):
  print(f"FAIL: {message}", file=sys.stderr)
  raise SystemExit(1)


def sha256(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
  try:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
  except Exception as exc:
    fail(f"could not parse Codex canonical golden manifest: {exc}")

  fixture = ROOT / manifest["fixture"]["path"]
  if not fixture.is_file():
    fail(f"missing fixture: {fixture.relative_to(ROOT)}")
  if sha256(fixture) != manifest["fixture"]["sha256"]:
    fail("Codex rich fixture hash mismatch")

  goldens = manifest.get("goldens")
  if not isinstance(goldens, list) or len(goldens) != 2:
    fail("expected exactly plain and decorated Codex goldens")

  by_purpose = {entry["purpose"]: entry for entry in goldens}
  plain_entry = by_purpose.get("base semantic rendering")
  decorated_entry = by_purpose.get("colour, timestamp, and record-number projection")
  if not plain_entry or not decorated_entry:
    fail("missing required Codex golden purposes")

  for entry in goldens:
    path = ROOT / entry["path"]
    if not path.is_file():
      fail(f"missing golden: {entry['path']}")
    if sha256(path) != entry["sha256"]:
      fail(f"golden hash mismatch: {entry['path']}")

  plain = (ROOT / plain_entry["path"]).read_text(encoding="utf-8")
  decorated = (ROOT / decorated_entry["path"]).read_text(encoding="utf-8")

  required_plain = [
    "## User",
    "## Codex",
    "<summary>Having 2 thoughts</summary>",
    "I will inspect the relevant file first.",
    "I found the relevant section and I am applying a small patch.",
    "The example now uses the new value.",
    "<summary>1 file change</summary>",
    "*** Update File: example.txt",
    "### Question 1",
    "**Choose verification mode** → \"Focused\"",
    "<summary>Having a thought</summary>",
    "Focused verification is selected.",
  ]
  for marker in required_plain:
    if marker not in plain:
      fail(f"plain Codex golden missing {marker!r}")
  if not plain.endswith("\n\n"):
    fail("plain Codex golden lost renderer EOF whitespace")

  if "\x1b[33m## User\x1b[0m" not in decorated:
    fail("decorated Codex golden lost User heading colour")
  if "\x1b[32m## Codex\x1b[0m" not in decorated:
    fail("decorated Codex golden lost Codex heading colour")
  for marker in (
    "[2026-01-02 00:00:01]:",
    " 1:\x1b[0m",
    "[2026-01-02 00:00:07]:",
    " 7:\x1b[0m",
    "[2026-01-02 00:00:10]:",
    "10:\x1b[0m",
  ):
    if marker not in decorated:
      fail(f"decorated Codex golden missing option projection {marker!r}")

  real = manifest.get("real_private_evidence", {})
  if real.get("raw_record_count") != 2628:
    fail("real Codex record count changed unexpectedly")
  if real.get("rendered_user_heading_count") != 29:
    fail("real Codex User-heading count changed unexpectedly")
  if real.get("rendered_codex_heading_count") != 29:
    fail("real Codex heading count changed unexpectedly")
  if manifest.get("unresolved_differences") != []:
    fail("Codex canonical manifest contains unresolved differences")

  print("PASS: canonical rich Codex plain/decorated goldens validated")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
