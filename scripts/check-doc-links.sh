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
import re
import sys
from pathlib import Path
from urllib.parse import unquote

repo_root = Path(sys.argv[1]).resolve()
mode = sys.argv[2]
docs_root = repo_root / "docs"
absolute_prefix = "/Users/bytedance/Desktop/study/valley-mas/"
patterns = {
    "file://": re.compile(r"\(file://"),
    "repo-absolute-path": re.compile(r"\(" + re.escape(absolute_prefix)),
}
markdown_link_re = re.compile(r"!?\[[^\]]*\]\(([^\n)]*)\)")

violations = []
unresolved = []
resolved_count = 0
ignored_count = 0


def scoped_markdown_files() -> list[Path]:
    files: set[Path] = set()
    claude_path = repo_root / "CLAUDE.md"
    if claude_path.is_file():
        files.add(claude_path)

    if docs_root.is_dir():
        files.update(path for path in docs_root.rglob("*.md") if path.is_file())

    ignored_dirs = {".git", "node_modules"}
    for path in repo_root.rglob("AGENTS.md"):
        if any(part in ignored_dirs for part in path.parts):
            continue
        if path.is_file() and path.relative_to(repo_root).as_posix() != "AGENTS.md":
            files.add(path)

    return sorted(files)


def local_destination(raw_destination: str) -> str | None:
    destination = raw_destination.strip()
    if destination.startswith("<") and ">" in destination:
        destination = destination[1 : destination.index(">")]
    else:
        destination = destination.split(maxsplit=1)[0] if destination else ""

    if not destination or destination.startswith("#"):
        return None
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", destination) or destination.startswith("//"):
        return None
    return destination


for md_path in scoped_markdown_files():
    try:
        lines = md_path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        # 跳过编码异常文件，避免把文本格式问题与链接规则混淆，便于后续单独排查。
        continue

    in_fence = False
    for line_no, line in enumerate(lines, start=1):
        if line.lstrip().startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue

        for label, pattern in patterns.items():
            for match in pattern.finditer(line):
                violations.append((md_path, line_no, label, match.group(0)))

        for match in markdown_link_re.finditer(line):
            destination = local_destination(match.group(1))
            if destination is None:
                ignored_count += 1
                continue
            target_path = unquote(destination.split("#", 1)[0].split("?", 1)[0])
            if not target_path:
                ignored_count += 1
                continue
            if (md_path.parent / target_path).exists():
                resolved_count += 1
                continue
            unresolved.append((md_path, line_no, destination))

scope_count = len(scoped_markdown_files())
print(
    "REPORT: documentation links "
    f"(checked {scope_count} Markdown files; {resolved_count} local links resolved; "
    f"{len(unresolved)} unresolved; {ignored_count} external or anchor-only links skipped)"
)
for path, line_no, destination in unresolved:
    print(f"- {path.relative_to(repo_root)}:{line_no}: unresolved local link -> {destination}")

if violations:
    print("FAIL: docs contain non-portable links", file=sys.stderr)
    print(f"TOTAL: {len(violations)}", file=sys.stderr)
    for path, line_no, label, value in violations:
        print(f"- {path.relative_to(repo_root)}:{line_no}: {label} -> {value}", file=sys.stderr)

if mode == "--strict" and unresolved:
    print("FAIL: unresolved local Markdown links", file=sys.stderr)

if violations or (mode == "--strict" and unresolved):
    raise SystemExit(1)
PY
