#!/usr/bin/env python3
"""Validate canonical golden files and their recorded provenance/decisions."""

import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "tests" / "canonical-golden-manifest.json"


def fail(message):
  print(f"FAIL: {message}", file=sys.stderr)
  raise SystemExit(1)


def sha256(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
  try:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
  except Exception as exc:
    fail(f"could not parse canonical golden manifest: {exc}")

  if manifest.get("status") != "established":
    fail(f"canonical golden manifest status is not established: {manifest.get('status')!r}")

  goldens = manifest.get("goldens")
  if not isinstance(goldens, list) or not goldens:
    fail("canonical golden manifest has no goldens")

  required_decisions = {
    "session_header",
    "heading_metadata",
    "container_exec_code_language",
    "eof_whitespace",
    "chatgpt_citations",
    "chatgpt_image_fallback",
  }

  for entry in goldens:
    fixture = ROOT / entry["fixture"]
    golden = ROOT / entry["golden"]
    if not fixture.is_file():
      fail(f"missing fixture: {entry['fixture']}")
    if not golden.is_file():
      fail(f"missing golden: {entry['golden']}")
    if sha256(fixture) != entry.get("fixture_sha256"):
      fail(f"fixture hash mismatch: {entry['fixture']}")
    if sha256(golden) != entry.get("golden_sha256"):
      fail(f"golden hash mismatch: {entry['golden']}")

    decisions = entry.get("decisions")
    if not isinstance(decisions, list):
      fail(f"golden has no decision provenance: {entry['golden']}")
    semantics = {item.get("semantic") for item in decisions}
    missing = required_decisions - semantics
    if missing:
      fail(f"golden is missing required decisions {sorted(missing)}: {entry['golden']}")
    for item in decisions:
      if not item.get("choice") or not item.get("authority"):
        fail(f"incomplete decision provenance: {item}")

    text = golden.read_text(encoding="utf-8")
    if not text.startswith("## User\n"):
      fail("base canonical ChatGPT golden unexpectedly contains outer/session metadata")
    if "<!-- turn_id=" in text:
      fail("base canonical ChatGPT golden unexpectedly enables optional turn_id metadata")
    if "```bash\nbash -lc " not in text:
      fail("canonical ChatGPT golden lost Python container.exec language inference")
    if "```unknown\nbash -lc " in text:
      fail("canonical ChatGPT golden preserved literal unknown instead of inferred bash")
    if not text.endswith("\n\n"):
      fail("canonical ChatGPT golden does not preserve Python EOF blank-line policy")
    if "domain=file://my_files&amp;sz=32" not in text:
      fail("canonical ChatGPT golden does not contain the selected DownloadConversation memory-file citation favicon")
    image_available = "[image not available](sediment://fixture-image-1)"
    image_missing = "[image missing]"
    user_text = "Find the screenshot-backed tool output and final answer."
    if not (text.index(image_available) < text.index(image_missing) < text.index(user_text)):
      fail("canonical ChatGPT golden does not preserve image-pointer source order")

  print(f"PASS: {len(goldens)} canonical golden(s) validated with provenance and user decisions")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
