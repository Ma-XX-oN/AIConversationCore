#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> int:
  try:
    return subprocess.run(command, cwd=ROOT, check=False).returncode
  except OSError as exc:
    print(f"infrastructure error running {command[0]}: {exc}", file=sys.stderr)
    return 2


def main() -> int:
  install = run([
    "npm",
    "ci",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ])
  if install != 0:
    return install
  return run(["node", "scripts/build-browser-bundle.mjs"])


if __name__ == "__main__":
  raise SystemExit(main())
