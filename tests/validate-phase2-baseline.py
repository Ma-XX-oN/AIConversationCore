#!/usr/bin/env python3
"""Validate the Phase 2 fixture/baseline inventory without implementing core semantics."""

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "tests" / "phase2-baseline-manifest.json"


def fail(message):
  print(f"FAIL: {message}", file=sys.stderr)
  raise SystemExit(1)


def load_json(path):
  try:
    return json.loads(path.read_text(encoding="utf-8"))
  except Exception as exc:
    fail(f"could not parse {path.relative_to(ROOT)}: {exc}")


def validate_jsonl(path):
  count = 0
  for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
    if not raw.strip():
      continue
    try:
      value = json.loads(raw)
    except Exception as exc:
      fail(f"invalid JSONL {path.relative_to(ROOT)}:{number}: {exc}")
    if not isinstance(value, dict):
      fail(f"JSONL record is not an object: {path.relative_to(ROOT)}:{number}")
    count += 1
  if count == 0:
    fail(f"fixture has no records: {path.relative_to(ROOT)}")


def main():
  manifest = load_json(MANIFEST)
  if manifest.get("phase") != 2:
    fail("manifest phase is not 2")

  providers = set()
  for fixture in manifest.get("fixtures", []):
    path = ROOT / fixture["path"]
    if not path.is_file():
      fail(f"missing fixture: {fixture['path']}")
    validate_jsonl(path)
    providers.add(fixture.get("provider"))

  missing_providers = {"chatgpt", "claude", "codex"} - providers
  if missing_providers:
    fail(f"fixture coverage missing providers: {sorted(missing_providers)}")

  for baseline in manifest.get("baselines", []):
    path = ROOT / baseline["path"]
    if not path.is_file() or not path.read_text(encoding="utf-8").strip():
      fail(f"missing/empty baseline: {baseline['path']}")

  differences_path = ROOT / manifest["known_differences_file"]
  differences = load_json(differences_path).get("differences", [])
  if not differences:
    fail("known-differences manifest is empty")
  for item in differences:
    for key in ("id", "area", "classification", "migration_rule"):
      if not item.get(key):
        fail(f"known difference missing {key}: {item}")

  pending = [entry for entry in manifest.get("required_runners", []) if entry.get("status") != "complete"]
  print(f"PASS: {len(manifest['fixtures'])} fixtures; {len(manifest['baselines'])} baselines; {len(differences)} known differences")
  if pending:
    print("INCOMPLETE: executable production baselines still pending: " + ", ".join(f"#{entry['issue']} {entry['consumer']}" for entry in pending))
    return 2
  print("PASS: Phase 2 executable baseline gate complete")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
