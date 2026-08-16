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
docs_required = ("docs/README.md", "docs/PROJECT_GUIDE.md", "docs/HARNESS_ENGINEERING.md")
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
        root / relative_path.decode("utf-8")
        for relative_path in result.stdout.split(b"\0")
        if relative_path
    )


agents_files = find_agents_files()

errors: list[str] = []
heading_re = re.compile(r"^##\s*AI 任务最小上下文入口", re.M)


def section_lines(text: str, heading_name: str) -> list[str]:
    lines = text.splitlines()
    start = None
    for idx, line in enumerate(lines):
        if line.startswith("## ") and heading_name in line:
            start = idx + 1
            break
    if start is None:
        return []
    section: list[str] = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        section.append(line)
    return section


for path in agents_files:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append(f"{path}: encoding error (must be UTF-8)")
        continue

    relative_path = path.relative_to(root)
    rel = relative_path.as_posix()

    if not heading_re.search(text):
        errors.append(f"{rel}: missing section 'AI 任务最小上下文入口'")
        continue

    section = section_lines(text, "AI 任务最小上下文入口")
    bullets = [line.strip() for line in section if line.startswith("- ")]
    chain_lines = [line for line in bullets if "->" in line]
    doc_lines = [line for line in section if "文档治理/约束变更任务" in line]

    if len(chain_lines) < 1:
        errors.append(f"{rel}: missing route chain under context section (need at least 1 line with `->`)")

    if "AGENTS.md" not in text:
        errors.append(f"{rel}: missing AGENTS.md reference in context content")

    for required in docs_required:
        if required not in text:
            errors.append(f"{rel}: missing required doc reference {required}")

    if not doc_lines and relative_path.name != "AGENTS.md":
        errors.append(f"{rel}: missing 文档治理/约束变更提示 line in context section")

    # 至少提供 2 条信息链路（1 条本地上下文链 + 1 条治理提示）
    if len(chain_lines) + len(doc_lines) < 2:
        errors.append(f"{rel}: context section needs at least 2 route lines, currently {len(chain_lines) + len(doc_lines)}")

if not agents_files:
    errors.append("no AGENTS.md found under repository root")

if errors:
    print("FAIL: AGENTS context check", file=sys.stderr)
    for item in errors:
        print(f"- {item}", file=sys.stderr)
    raise SystemExit(1)

print(f"PASS: AGENTS context entry check ({len(agents_files)} files)")
PY
