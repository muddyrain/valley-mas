#!/usr/bin/env bash

set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${AGENTS_CHECK_ROOT:-$SCRIPT_ROOT}"

AGENTS_CHECK_PYTHON="${AGENTS_CHECK_PYTHON:-}"
if [[ -z "$AGENTS_CHECK_PYTHON" ]]; then
    for candidate in python3 python; do
        if command -v "$candidate" >/dev/null 2>&1 && "$candidate" --version >/dev/null 2>&1; then
            AGENTS_CHECK_PYTHON="$candidate"
            break
        fi
    done
fi

if [[ -z "$AGENTS_CHECK_PYTHON" ]]; then
    echo "FAIL: Python 3 is required for the AGENTS context check" >&2
    exit 1
fi

AGENTS_CHECK_ROOT="$ROOT" PYTHONIOENCODING=utf-8 "$AGENTS_CHECK_PYTHON" <<'PY'
from pathlib import Path
import os
import re
import subprocess
import sys

root = Path(os.environ["AGENTS_CHECK_ROOT"]).resolve()
ignored_dirs = {".git", "node_modules"}


def walk_agents_files() -> list[Path]:
    files: list[Path] = []
    for current_root, dirnames, filenames in os.walk(root):
        dirnames[:] = [dirname for dirname in dirnames if dirname not in ignored_dirs]
        if "AGENTS.md" in filenames:
            files.append(Path(current_root) / "AGENTS.md")
    return sorted(files)


def find_agents_files() -> list[Path]:
    try:
        result = subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "ls-files",
                "--cached",
                "--others",
                "--exclude-standard",
                "-z",
                "--",
                "*AGENTS.md",
            ],
            check=True,
            capture_output=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return walk_agents_files()

    return sorted(
        path
        for relative_path in result.stdout.split(b"\0")
        if relative_path
        if (path := root / relative_path.decode("utf-8")).is_file()
    )


agents_files = find_agents_files()
errors: list[str] = []

for path in agents_files:
    rel = path.relative_to(root).as_posix()
    if rel == "AGENTS.md":
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append(f"{rel}: encoding error (must be UTF-8)")
        continue

    section = re.search(r"^## 按任务读取\s*$(.*?)(?=^## |\Z)", text, re.M | re.S)
    if section is None:
        errors.append(f"{rel}: missing section '按任务读取'")
        continue
    links = re.findall(r"\[[^\]]+\]\(([^)]+)\)", section.group(1))
    if not links:
        errors.append(f"{rel}: task section needs at least one linked entry")
    for reference in links:
        target = reference.split("#", 1)[0]
        if not target or "://" in target or Path(target).is_absolute():
            errors.append(f"{rel}: task entry must be a relative local path: {reference}")
        elif not (path.parent / target).exists():
            errors.append(f"{rel}: task entry target is missing: {reference}")

if len(agents_files) < 2:
    errors.append("no local AGENTS.md found under repository root")

if errors:
    print("FAIL: AGENTS context check", file=sys.stderr)
    for item in errors:
        print(f"- {item}", file=sys.stderr)
    raise SystemExit(1)

print(f"PASS: AGENTS context entry check ({len(agents_files)} files)")
PY
