#!/usr/bin/env python3
"""Validate canonical rich Claude goldens and their provenance."""

import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "tests" / "claude-canonical-golden-manifest.json"


def fail(message):
  print(f"FAIL: {message}", file=sys.stderr)
  raise SystemExit(1)


def sha256(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
  try:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
  except Exception as exc:
    fail(f"could not parse Claude canonical golden manifest: {exc}")

  fixture = ROOT / manifest["fixture"]["path"]
  if not fixture.is_file():
    fail(f"missing fixture: {fixture.relative_to(ROOT)}")
  if sha256(fixture) != manifest["fixture"]["sha256"]:
    fail("Claude rich fixture hash mismatch")

  goldens = manifest.get("goldens")
  if not isinstance(goldens, list) or len(goldens) != 2:
    fail("expected exactly plain and decorated Claude goldens")

  by_purpose = {entry["purpose"]: entry for entry in goldens}
  plain_entry = by_purpose.get("base semantic rendering")
  decorated_entry = by_purpose.get("colour, timestamp, and record-number projection")
  if not plain_entry or not decorated_entry:
    fail("missing required Claude golden purposes")

  for entry in goldens:
    path = ROOT / entry["path"]
    if not path.is_file():
      fail(f"missing golden: {entry['path']}")
    if sha256(path) != entry["sha256"]:
      fail(f"golden hash mismatch: {entry['path']}")

  plain = (ROOT / plain_entry["path"]).read_text(encoding="utf-8")
  decorated = (ROOT / decorated_entry["path"]).read_text(encoding="utf-8")

  required_plain = [
    "## Claude Sub-agent agent-safe-1",
    "## Claude Sub-agent toolu_agent_fail",
    "## Claude Sub-agent child-safe-2",
    "**Review selected files**",
    "**Redirect review agent**",
    "**Inspect child output**",
    "<summary>Having 2 thoughts</summary>",
    "<summary>Verify result</summary>",
  ]
  for marker in required_plain:
    if marker not in plain:
      fail(f"plain Claude golden missing {marker!r}")
  if "agentId: agent-safe-1" in plain:
    fail("plain Claude golden leaked internal Agent transport metadata")
  if not plain.endswith("\n\n"):
    fail("plain Claude golden lost renderer EOF whitespace")

  if "\x1b[33m## User\x1b[0m" not in decorated:
    fail("decorated Claude golden lost User heading colour")
  if "\x1b[32m## Claude\x1b[0m" not in decorated:
    fail("decorated Claude golden lost Claude heading colour")
  for marker in (
    "[2026-01-02 12:00:01]:",
    " 1:\x1b[0m",
    "[2026-01-02 12:00:07]:",
    " 7:\x1b[0m",
  ):
    if marker not in decorated:
      fail(f"decorated Claude golden missing option projection {marker!r}")

  real = manifest.get("real_private_evidence", {})
  if real.get("raw_record_count") != 6201 or real.get("rendered_subagent_section_count") != 18:
    fail("real Claude evidence counts changed unexpectedly")
  if manifest.get("unresolved_differences") != []:
    fail("Claude canonical manifest contains unresolved differences")

  print("PASS: canonical rich Claude plain/decorated goldens validated")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
