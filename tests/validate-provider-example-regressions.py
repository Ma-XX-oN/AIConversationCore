#!/usr/bin/env python3
"""Validate provider example regression fixtures, goldens, and provenance."""

import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "tests" / "provider-example-regression-manifest.json"


def fail(message):
  print(f"FAIL: {message}", file=sys.stderr)
  raise SystemExit(1)


def sha256(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
  manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

  claude = manifest["claude_questions"]
  fixture = ROOT / claude["fixture"]
  if not fixture.is_file():
    fail("missing Claude question fixture")
  records = [json.loads(line) for line in fixture.read_text(encoding="utf-8").splitlines() if line.strip()]
  ask_blocks = [
    block
    for record in records
    if record.get("type") == "assistant"
    for block in record.get("message", {}).get("content", [])
    if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("name") == "AskUserQuestion"
  ]
  if len(ask_blocks) != 2:
    fail(f"expected 2 Claude AskUserQuestion calls, found {len(ask_blocks)}")
  if [len(block.get("input", {}).get("questions", [])) for block in ask_blocks] != [1, 2]:
    fail("Claude question fixture lost one-question/two-question coverage")
  answer_ids = {
    block.get("tool_use_id")
    for record in records
    if record.get("type") == "user"
    for block in record.get("message", {}).get("content", [])
    if isinstance(block, dict) and block.get("type") == "tool_result"
  }
  if any(block.get("id") not in answer_ids for block in ask_blocks):
    fail("Claude question fixture lost correlated tool_result answer")

  for entry in claude["goldens"]:
    path = ROOT / entry["path"]
    if not path.is_file() or sha256(path) != entry["sha256"]:
      fail(f"Claude question golden mismatch: {entry['path']}")
  plain = (ROOT / claude["goldens"][0]["path"]).read_text(encoding="utf-8")
  for marker in (
    "### Question 1",
    "### Question 2",
    "**Which file should I update?**",
    '"Which file should I update?"="Both"',
    '"Which branch should I target?"="dev"',
  ):
    if marker not in plain:
      fail(f"Claude question golden missing {marker!r}")

  plan = manifest["claude_exit_plan"]
  plan_fixture = ROOT / plan["fixture"]
  if not plan_fixture.is_file() or sha256(plan_fixture) != plan["fixture_sha256"]:
    fail("Claude ExitPlanMode fixture hash mismatch")
  plan_records = [json.loads(line) for line in plan_fixture.read_text(encoding="utf-8").splitlines() if line.strip()]
  exit_blocks = [
    block
    for record in plan_records
    if record.get("type") == "assistant"
    for block in record.get("message", {}).get("content", [])
    if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("name") == "ExitPlanMode"
  ]
  if len(exit_blocks) != 1:
    fail(f"expected 1 Claude ExitPlanMode call, found {len(exit_blocks)}")
  exit_id = exit_blocks[0].get("id")
  approval_results = [
    block
    for record in plan_records
    if record.get("type") == "user"
    for block in record.get("message", {}).get("content", [])
    if isinstance(block, dict) and block.get("type") == "tool_result" and block.get("tool_use_id") == exit_id
  ]
  if len(approval_results) != 1 or "approved your plan" not in str(approval_results[0].get("content", "")):
    fail("Claude ExitPlanMode fixture lost correlated approval tool_result")
  for entry in plan["goldens"]:
    path = ROOT / entry["path"]
    if not path.is_file() or sha256(path) != entry["sha256"]:
      fail(f"Claude ExitPlanMode golden mismatch: {entry['path']}")
  plan_plain = (ROOT / plan["goldens"][0]["path"]).read_text(encoding="utf-8")
  for marker in (
    "### Plan",
    "Demonstration plan.",
    "## User",
    "User has approved your plan.",
    "<summary>Approved Plan</summary>",
    "Proceeding with the approved plan.",
  ):
    if marker not in plan_plain:
      fail(f"Claude ExitPlanMode golden missing {marker!r}")

  notice = manifest["claude_synthetic_notice"]
  if notice.get("repository") != "Ma-XX-oN/AI-General-Memory":
    fail("Claude synthetic notice lost upstream repository provenance")
  if notice.get("path") != "scripts/fixtures/notice.jsonl":
    fail("Claude synthetic notice lost upstream fixture path")
  if notice.get("git_blob") != "40f331fa27d3ed14aad882e6d13ab8f260278986":
    fail("Claude synthetic notice upstream blob changed unexpectedly")
  if notice.get("model_marker") != "<synthetic>" or notice.get("example_text") != "Context limit reached.":
    fail("Claude synthetic notice semantics changed unexpectedly")

  chatgpt = manifest["chatgpt_decorated"]
  decorated_path = ROOT / chatgpt["golden"]
  if not decorated_path.is_file() or sha256(decorated_path) != chatgpt["sha256"]:
    fail("ChatGPT decorated golden hash mismatch")
  decorated = decorated_path.read_text(encoding="utf-8")
  for marker in (
    "\x1b[33m## User\x1b[0m",
    "\x1b[32m## ChatGPT Commentary\x1b[0m",
    "\x1b[32m## ChatGPT\x1b[0m",
    "[2026-07-07 17:56:41]:",
    " 2:\x1b[0m",
    "10:\x1b[0m",
  ):
    if marker not in decorated:
      fail(f"ChatGPT decorated golden missing {marker!r}")

  codex_manifest = json.loads((ROOT / manifest["codex_questions"]["manifest"]).read_text(encoding="utf-8"))
  questions = codex_manifest.get("real_private_evidence", {}).get("question_rollout", {})
  if questions.get("request_user_input_call_count") != 10:
    fail("Codex real question call count is not pinned at 10")
  if questions.get("matched_function_call_output_count") != 10:
    fail("Codex real question answer count is not pinned at 10")
  if questions.get("rendered_question_heading_count") != 18:
    fail("Codex rendered Question heading count is not pinned at 18")

  print("PASS: provider example regressions validated")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
