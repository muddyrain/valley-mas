#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${PLAN_INDEX_ROOT:-$SCRIPT_ROOT}"

PLAN_INDEX_ROOT="$ROOT" python3 <<'PY'
from pathlib import Path
import os
import re
import sys

root = Path(os.environ["PLAN_INDEX_ROOT"]).resolve()
plans_dir = root / "docs" / "plans"
index_path = plans_dir / "README.md"

errors: list[str] = []

def normalize_link_target(raw: str) -> str:
    target = raw.strip()
    if target.startswith("./"):
        target = target[2:]
    return target.replace("\\", "/")


def parse_links(section_title: str) -> list[str]:
    lines = index_text.splitlines()
    collecting = False
    links: list[str] = []

    for line in lines:
        if line.startswith("## "):
            title = line.removeprefix("## ").strip()
            collecting = title == section_title
            continue
        if collecting:
            if not line.strip():
                continue
            if line.startswith("## "):
                break
            match = re.match(r"- \[[^\]]+\]\(([^)]+)\)", line)
            if match:
                links.append(normalize_link_target(match.group(1)))
    return links


if not index_path.is_file():
    errors.append(f"{index_path}: missing")
    print("FAIL: plans index check")
    print("- " + "\n- ".join(errors))
    raise SystemExit(1)

index_text = index_path.read_text(encoding="utf-8")

active_links = parse_links("当前活跃计划")
archived_links = []

# collect all archived sections by matching heading prefix
current_section: str | None = None
for line in index_text.splitlines():
    if line.startswith("## "):
        current_section = line.removeprefix("## ").strip()
        continue
    if current_section and current_section.startswith("已归档"):
        if not line.strip():
            continue
        if line.startswith("## "):
            current_section = None
            continue
        match = re.match(r"- \[[^\]]+\]\(([^)]+)\)", line)
        if match:
            archived_links.append(normalize_link_target(match.group(1)))

active_expected = {
    p.name
    for p in plans_dir.glob("*.md")
    if p.name != "README.md"
}

archive_expected = {
    f"archive/{p.parent.name}/{p.name}"
    for p in plans_dir.glob("archive/*/*.md")
}

active_listed = {Path(p).name for p in active_links}
archived_listed = set(archived_links)

missing_active = sorted(active_expected - active_listed)
extra_active = sorted(active_listed - active_expected)
missing_archived = sorted(archive_expected - archived_listed)
extra_archived = sorted(archived_listed - archive_expected)

if missing_active:
    for item in missing_active:
        errors.append(f"Active plan missing from README: {item}")

if extra_active:
    for item in extra_active:
        errors.append(f"README has non-active plan entry: {item}")

if missing_archived:
    for item in missing_archived:
        errors.append(f"Archived plan missing from README: {item}")

if extra_archived:
    for item in extra_archived:
        errors.append(f"README has non-archived entry: {item}")

if errors:
    print("FAIL: docs/plans/README index inconsistent")
    for item in errors:
        print(f"- {item}")
    raise SystemExit(1)

print(
    f"PASS: plans index consistent (active={len(active_expected)}, archived={len(archive_expected)})"
)
PY
