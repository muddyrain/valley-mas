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
heading_re = re.compile(r"^##\s*AI 任务最小上下文入口", re.M)
reference_re = re.compile(r"^\s*`([^`\n]+)`\s*[。.]?\s*$")


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


def resolve_context_reference(agents_path: Path, reference: str) -> bool:
    """Accept a local path relative to the AGENTS file or the repository root."""
    if "#" in reference or "://" in reference:
        return False

    candidate_path = Path(reference)
    candidates = [agents_path.parent / candidate_path, root / candidate_path]
    return any(candidate.is_file() for candidate in candidates)


for path in agents_files:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append(f"{path}: encoding error (must be UTF-8)")
        continue

    relative_path = path.relative_to(root)
    rel = relative_path.as_posix()

    if rel == "AGENTS.md":
        continue

    if not heading_re.search(text):
        errors.append(f"{rel}: missing section 'AI 任务最小上下文入口'")
        continue

    section = section_lines(text, "AI 任务最小上下文入口")
    bullets = [line.strip() for line in section if line.startswith("- ")]
    chain_lines = [line for line in bullets if "->" in line]
    if len(chain_lines) < 1:
        errors.append(f"{rel}: missing route chain under context section (need at least 1 line with `->`)")
        continue

    for chain_index, chain_line in enumerate(chain_lines, start=1):
        items = [item.strip() for item in chain_line[2:].split("->")]
        references: list[str] = []
        for item_index, item in enumerate(items, start=1):
            match = reference_re.fullmatch(item)
            if not match:
                errors.append(
                    f"{rel}: route chain {chain_index} item {item_index} must be one backticked file path"
                )
                continue
            references.append(match.group(1))

        if not references:
            continue

        if references[0] != "CLAUDE.md":
            errors.append(f"{rel}: route chain {chain_index} must start with `CLAUDE.md`")
        elif not (root / "CLAUDE.md").is_file():
            errors.append(f"{rel}: route chain {chain_index} first item `CLAUDE.md` is missing")

        expected_self_reference = rel
        if len(references) < 2 or references[1] != expected_self_reference:
            errors.append(
                f"{rel}: route chain {chain_index} second item must be `{expected_self_reference}`"
            )

        for item_index, reference in enumerate(references, start=1):
            if not resolve_context_reference(path, reference):
                errors.append(
                    f"{rel}: route chain {chain_index} item {item_index} target is missing: `{reference}`"
                )

if not any(path.relative_to(root).as_posix() != "AGENTS.md" for path in agents_files):
    errors.append("no local AGENTS.md found under repository root")

if errors:
    print("FAIL: AGENTS context check", file=sys.stderr)
    for item in errors:
        print(f"- {item}", file=sys.stderr)
    raise SystemExit(1)

print(f"PASS: AGENTS context entry check ({len(agents_files)} files)")
PY
