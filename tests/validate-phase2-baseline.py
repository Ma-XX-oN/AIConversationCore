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


def validate_baseline(path):
  if not path.is_file():
    fail(f"missing baseline: {path.relative_to(ROOT)}")
  if not path.read_text(encoding="utf-8").strip():
    fail(f"empty baseline: {path.relative_to(ROOT)}")
  if path.suffix == ".json":
    load_json(path)


def main():
  manifest = load_json(MANIFEST)
  if manifest.get("phase") != 2:
    fail("manifest phase is not 2")
  if manifest.get("status") not in {"complete", "incomplete"}:
    fail(f"invalid manifest status: {manifest.get('status')!r}")

  providers = set()
  fixture_paths = set()
  for fixture in manifest.get("fixtures", []):
    path = ROOT / fixture["path"]
    if not path.is_file():
      fail(f"missing fixture: {fixture['path']}")
    validate_jsonl(path)
    providers.add(fixture.get("provider"))
    fixture_paths.add(fixture["path"])

  missing_providers = {"chatgpt", "claude", "codex"} - providers
  if missing_providers:
    fail(f"fixture coverage missing providers: {sorted(missing_providers)}")

  baseline_paths = set()
  for baseline in manifest.get("baselines", []):
    baseline_path = baseline.get("path")
    if not baseline_path:
      fail(f"baseline entry has no path: {baseline}")
    if baseline_path in baseline_paths:
      fail(f"duplicate baseline path in manifest: {baseline_path}")
    baseline_paths.add(baseline_path)
    validate_baseline(ROOT / baseline_path)
    fixture_path = baseline.get("fixture")
    if fixture_path and fixture_path not in fixture_paths:
      fail(f"baseline references fixture not in manifest: {fixture_path}")

  differences_path = ROOT / manifest["known_differences_file"]
  differences = load_json(differences_path).get("differences", [])
  if not differences:
    fail("known-differences manifest is empty")
  for item in differences:
    for key in ("id", "area", "classification", "migration_rule"):
      if not item.get(key):
        fail(f"known difference missing {key}: {item}")

  runners = manifest.get("required_runners", [])
  if not runners:
    fail("required_runners is empty")
  seen_issues = set()
  for entry in runners:
    issue = entry.get("issue")
    if not isinstance(issue, int) or issue <= 0:
      fail(f"runner has invalid issue number: {entry}")
    if issue in seen_issues:
      fail(f"duplicate required runner issue: #{issue}")
    seen_issues.add(issue)
    if entry.get("status") not in {"complete", "pending"}:
      fail(f"runner #{issue} has invalid status: {entry.get('status')!r}")

  pending = [entry for entry in runners if entry.get("status") != "complete"]
  if manifest.get("status") == "complete" and pending:
    fail("manifest is complete while required production runners remain pending")
  if manifest.get("status") != "complete" and not pending:
    fail("all required production runners are complete but manifest is not marked complete")

  print(f"PASS: {len(manifest['fixtures'])} fixtures; {len(manifest['baselines'])} baselines; {len(differences)} known differences")
  if pending:
    print("INCOMPLETE: executable production baselines still pending: " + ", ".join(f"#{entry['issue']} {entry['consumer']}" for entry in pending))
    return 2
  print("PASS: Phase 2 executable baseline gate complete")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
