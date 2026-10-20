#!/usr/bin/env bash

set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${DOC_LINKS_REPO_ROOT:-$SCRIPT_ROOT}"
if [[ "${1:-}" == "--" ]]; then
    shift
fi
MODE="${1:---report}"

if [[ "$MODE" != "--report" && "$MODE" != "--strict" ]]; then
    echo "Usage: $0 [--report|--strict]" >&2
    exit 2
fi

DOC_LINKS_CHECK_PYTHON="${DOC_LINKS_CHECK_PYTHON:-}"
if [[ -z "$DOC_LINKS_CHECK_PYTHON" ]]; then
    for candidate in python3 python; do
        if command -v "$candidate" >/dev/null 2>&1 && "$candidate" --version >/dev/null 2>&1; then
            DOC_LINKS_CHECK_PYTHON="$candidate"
            break
        fi
    done
fi

if [[ -z "$DOC_LINKS_CHECK_PYTHON" ]]; then
    echo "FAIL: Python 3 is required for the documentation link check" >&2
    exit 1
fi

PYTHONIOENCODING=utf-8 "$DOC_LINKS_CHECK_PYTHON" - "$REPO_ROOT" "$MODE" <<'PY'
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

repo_root = Path(sys.argv[1]).resolve()
mode = sys.argv[2]
markdown_link_re = re.compile(r"!?\[[^\]]*\]\(([^\n)]*)\)")
generated_dirs = {"test-output", "build", "dist", "coverage", "output", ".tmp", ".godot"}
ignored_dirs = generated_dirs | {".git", "node_modules", ".next", ".turbo"}
violations = []
unresolved = []
artifacts = []
resolved_count = 0
ignored_count = 0


def scoped_markdown_files() -> list[Path]:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            check=True, capture_output=True,
        )
        candidates = [Path(os.fsdecode(p)) for p in result.stdout.split(b"\0") if p]
    except (FileNotFoundError, subprocess.CalledProcessError):
        candidates = []
        for current, dirs, files in os.walk(repo_root):
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            candidates.extend((Path(current) / name).relative_to(repo_root) for name in files)
    return sorted({
        repo_root / p for p in candidates
        if p.suffix == ".md" and (repo_root / p).is_file()
        and not any(part in ignored_dirs for part in p.parts)
        and (len(p.parts) == 1 or p.parts[0] in {"docs", "apps", "server", "packages"}
             or p.as_posix() in {".agents/AGENTS_TEMPLATE.md", ".agents/skills/INDEX.md", ".code-review/README.md"})
    })


def local_destination(raw_destination: str) -> str | None:
    destination = raw_destination.strip()
    if destination.startswith("<") and ">" in destination:
        destination = destination[1:destination.index(">")]
    else:
        destination = destination.split(maxsplit=1)[0] if destination else ""
    if not destination or destination.startswith(("#", "//")):
        return None
    destination = re.sub(r":\d+(?::\d+)?$", "", destination)
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", destination):
        return None
    return unquote(destination.split("#", 1)[0].split("?", 1)[0]) or None


files = scoped_markdown_files()
for md_path in files:
    try:
        lines = md_path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        violations.append((md_path, 0, "not UTF-8"))
        continue
    fence = None
    for line_no, line in enumerate(lines, start=1):
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            continue
        if fence:
            continue
        for match in markdown_link_re.finditer(line):
            raw = match.group(1).strip()
            destination = local_destination(raw)
            if raw.startswith("file://") or re.match(r"^[A-Za-z]:[\\/]", raw) or (destination and Path(destination).is_absolute()):
                violations.append((md_path, line_no, f"non-portable link -> {raw}"))
                continue
            if destination is None:
                ignored_count += 1
                continue
            target = (md_path.parent / destination).resolve()
            try:
                parts = target.relative_to(repo_root).parts
            except ValueError:
                unresolved.append((md_path, line_no, raw))
                continue
            if any(part in generated_dirs for part in parts):
                if not target.exists():
                    artifacts.append((md_path, line_no, raw))
                continue
            if target.exists():
                resolved_count += 1
            else:
                unresolved.append((md_path, line_no, raw))

print(f"REPORT: documentation links (checked {len(files)} Markdown files; {resolved_count} local links resolved; "
      f"{len(unresolved)} unresolved; {ignored_count} external or anchor-only links skipped)")
for path, line_no, destination in unresolved:
    print(f"- {path.relative_to(repo_root)}:{line_no}: unresolved local link -> {destination}")
print(f"ARTIFACTS: {len(artifacts)} generated-output links unavailable locally (not a documentation failure)")
for path, line_no, detail in violations:
    print(f"- {path.relative_to(repo_root)}:{line_no}: {detail}", file=sys.stderr)
if violations:
    print("FAIL: docs contain non-portable links or encoding errors", file=sys.stderr)
if mode == "--strict" and unresolved:
    print("FAIL: unresolved local Markdown links", file=sys.stderr)
if violations or (mode == "--strict" and unresolved):
    raise SystemExit(1)
PY
