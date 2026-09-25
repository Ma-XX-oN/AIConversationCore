#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> int:
  environment = os.environ.copy()
  environment["PYTHONDONTWRITEBYTECODE"] = "1"
  try:
    return subprocess.run(
      command,
      cwd=ROOT,
      env=environment,
      check=False,
    ).returncode
  except OSError as exc:
    print(f"infrastructure error running {command[0]}: {exc}", file=sys.stderr)
    return 2


def main() -> int:
  commands = [
    ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"],
    [sys.executable, "-m", "unittest", "tests/test_ci_contract.py"],
    ["node", "scripts/check-maintained-file-size.mjs"],
    ["node", "scripts/check-jsdoc.mjs"],
    ["npm", "test"],
    [sys.executable, "tests/validate-phase2-baseline.py"],
    [sys.executable, "tests/validate-canonical-golden.py"],
    [sys.executable, "tests/validate-claude-canonical-golden.py"],
    [sys.executable, "tests/validate-codex-canonical-golden.py"],
    [sys.executable, "tests/validate-provider-example-regressions.py"],
    ["git", "diff", "--check"],
  ]
  results = [run(command) for command in commands]
  if 2 in results:
    return 2
  if any(result != 0 for result in results):
    return 1
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
