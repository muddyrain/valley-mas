#!/usr/bin/env bash

set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${HARNESS_ROOT:-$SCRIPT_ROOT}"

HARNESS_CHECK_PYTHON="${HARNESS_CHECK_PYTHON:-}"
if [[ -z "$HARNESS_CHECK_PYTHON" ]]; then
    for candidate in python3 python; do
        if command -v "$candidate" >/dev/null 2>&1 && "$candidate" --version >/dev/null 2>&1; then
            HARNESS_CHECK_PYTHON="$candidate"
            break
        fi
    done
fi

if [[ -z "$HARNESS_CHECK_PYTHON" ]]; then
    echo "FAIL: Python 3 is required for the agent harness check" >&2
    exit 1
fi

HARNESS_ROOT="$ROOT" PYTHONIOENCODING=utf-8 "$HARNESS_CHECK_PYTHON" <<'PY'
import json
import os
import re
import sys
from pathlib import Path

root = Path(os.environ["HARNESS_ROOT"]).resolve()
errors: list[str] = []


def require_file(relative_path: str) -> None:
    if not (root / relative_path).is_file():
        errors.append(f"{relative_path}: required file is missing")


gitnexus_path = root / ".gitnexusrc"
require_file(".gitnexusrc")
if gitnexus_path.is_file():
    try:
        gitnexus_config = json.loads(gitnexus_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        errors.append(f".gitnexusrc: cannot be parsed: {exc}")
    else:
        analyze_config = gitnexus_config.get("analyze") if isinstance(gitnexus_config, dict) else None
        if not isinstance(analyze_config, dict) or analyze_config.get("indexOnly") is not True:
            errors.append(".gitnexusrc: analyze.indexOnly must be true to protect rules and skills")


index_path = root / ".agents/skills/INDEX.md"
require_file(".agents/skills/INDEX.md")

actual_skills = {
    path.parent.relative_to(root / ".agents/skills").as_posix()
    for path in (root / ".agents/skills").rglob("SKILL.md")
    if path.is_file()
}

indexed_skills: set[str] = set()
if index_path.is_file():
    index_text = index_path.read_text(encoding="utf-8")
    indexed_skills = set(re.findall(r"^\|\s*`([^`]+)`\s*\|", index_text, re.MULTILINE))

for skill in sorted(actual_skills - indexed_skills):
    errors.append(f"{skill}: SKILL.md exists but is not listed in INDEX.md")

for skill in sorted(indexed_skills - actual_skills):
    errors.append(f"{skill}: listed in INDEX.md but SKILL.md is missing")

for tool_dir in (".claude", ".codex", ".codebase", ".trae"):
    link = root / tool_dir / "skills"
    if not link.is_symlink():
        errors.append(f"{tool_dir}/skills: expected a symlink to ../.agents/skills")
        continue
    if os.readlink(link) != "../.agents/skills":
        errors.append(
            f"{tool_dir}/skills: points to {os.readlink(link)!r}, expected '../.agents/skills'"
        )

for relative_path in (
    "CLAUDE.md",
    "AGENTS.md",
    "docs/README.md",
    "docs/PROJECT_GUIDE.md",
    "docs/HARNESS_ENGINEERING.md",
):
    require_file(relative_path)

agents_path = root / "AGENTS.md"
if agents_path.is_symlink() or (agents_path.is_file() and not agents_path.read_text(encoding="utf-8").startswith("# ")):
    errors.append("AGENTS.md: must be the canonical regular Markdown file")

claude_path = root / "CLAUDE.md"
if claude_path.is_symlink() or (claude_path.is_file() and claude_path.read_text(encoding="utf-8").strip() != "@AGENTS.md"):
    errors.append("CLAUDE.md: must contain only @AGENTS.md")

if agents_path.is_file():
    agents_text = agents_path.read_text(encoding="utf-8")
    referenced_agents = set(re.findall(r"\]\(([^)\n]*AGENTS\.md)\)", agents_text))
    for relative_path in sorted(referenced_agents):
        require_file(relative_path)
    local_agents = {
        path.relative_to(root).as_posix()
        for parent in (root / "apps", root / "server")
        for path in parent.glob("**/AGENTS.md")
        if not any(part in {"node_modules", ".godot", "build", "dist"} for part in path.relative_to(root).parts)
    }
    for relative_path in sorted(local_agents - referenced_agents):
        errors.append(f"{relative_path}: local entry is missing from root AGENTS.md")

package_path = root / "package.json"
require_file("package.json")
if package_path.is_file():
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        errors.append(f"package.json: cannot be parsed: {exc}")
    else:
        scripts = package.get("scripts", {})
        for script_name in ("build", "check", "check:harness", "check:harness:test"):
            if not isinstance(scripts.get(script_name), str) or not scripts[script_name].strip():
                errors.append(f"package.json: scripts.{script_name} is missing")

if errors:
    print("FAIL: agent harness is inconsistent", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print(
    "PASS: agent harness is consistent "
    f"({len(actual_skills)} skills, 4 skill links, canonical AGENTS + CLAUDE reference)"
)
PY
