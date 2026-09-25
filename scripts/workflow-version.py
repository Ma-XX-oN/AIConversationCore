#!/usr/bin/env python3
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "package.json"
STABLE_VERSION = re.compile(r"^\d+\.\d+\.\d+$")
DEVELOPMENT_VERSION = re.compile(r"^\d+\.\d+\.\d+-issue\.\d+\.\d+$")


def main() -> int:
  try:
    package = json.loads(PACKAGE.read_text(encoding="utf-8"))
  except (OSError, json.JSONDecodeError) as exc:
    print(f"cannot read package version: {exc}", file=sys.stderr)
    return 1
  version = package.get("version")
  if not isinstance(version, str):
    print("package version must be a string", file=sys.stderr)
    return 1
  if (
    STABLE_VERSION.fullmatch(version) is None
    and DEVELOPMENT_VERSION.fullmatch(version) is None
  ):
    print(f"invalid workflow version: {version}", file=sys.stderr)
    return 1
  print(version)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
