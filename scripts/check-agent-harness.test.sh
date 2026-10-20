#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKER="$REPO_ROOT/scripts/check-agent-harness.sh"

if [[ ! -f "$CHECKER" ]]; then
  echo "FAIL: checker does not exist: $CHECKER" >&2
  exit 1
fi

FIXTURE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/valley-harness-test.XXXXXX")"
trap 'rm -rf "$FIXTURE_ROOT"' EXIT

mkdir -p \
  "$FIXTURE_ROOT/.agents/skills/example-skill" \
  "$FIXTURE_ROOT/.claude" \
  "$FIXTURE_ROOT/.codex" \
  "$FIXTURE_ROOT/.codebase" \
  "$FIXTURE_ROOT/.trae" \
  "$FIXTURE_ROOT/apps/example" \
  "$FIXTURE_ROOT/docs"

cat > "$FIXTURE_ROOT/.agents/skills/example-skill/SKILL.md" <<'EOF'
---
name: example-skill
description: Fixture skill.
---
EOF

cat > "$FIXTURE_ROOT/.agents/skills/INDEX.md" <<'EOF'
# Fixture skill index

| Skill | Status |
|---|---|
| `example-skill` | required |
EOF

for tool_dir in .claude .codex .codebase .trae; do
  ln -s ../.agents/skills "$FIXTURE_ROOT/$tool_dir/skills"
done

cat > "$FIXTURE_ROOT/AGENTS.md" <<'EOF'
# Fixture AGENTS

| Project | Entry |
|---|---|
| Example | [Entry](apps/example/AGENTS.md) |
EOF
printf '@AGENTS.md\n' > "$FIXTURE_ROOT/CLAUDE.md"
printf '{"analyze":{"indexOnly":true}}\n' > "$FIXTURE_ROOT/.gitnexusrc"

printf '# Child AGENTS\n' > "$FIXTURE_ROOT/apps/example/AGENTS.md"
printf '# Docs index\n' > "$FIXTURE_ROOT/docs/README.md"
printf '# Project guide\n' > "$FIXTURE_ROOT/docs/PROJECT_GUIDE.md"
printf '# Harness\n' > "$FIXTURE_ROOT/docs/HARNESS_ENGINEERING.md"

cat > "$FIXTURE_ROOT/package.json" <<'EOF'
{
  "scripts": {
    "build": "turbo build",
    "check": "turbo check",
    "check:harness": "bash scripts/check-agent-harness.sh",
    "check:harness:test": "bash scripts/check-agent-harness.test.sh"
  }
}
EOF

healthy_output="$(HARNESS_ROOT="$FIXTURE_ROOT" bash "$CHECKER")"
[[ "$healthy_output" == *"PASS: agent harness is consistent"* ]] || {
  echo "FAIL: healthy fixture did not pass" >&2
  echo "$healthy_output" >&2
  exit 1
}

for config_case in missing disabled malformed; do
  case "$config_case" in
    missing) rm "$FIXTURE_ROOT/.gitnexusrc" ;;
    disabled) printf '{"analyze":{"indexOnly":false}}\n' > "$FIXTURE_ROOT/.gitnexusrc" ;;
    malformed) printf '{broken json\n' > "$FIXTURE_ROOT/.gitnexusrc" ;;
  esac
  if HARNESS_ROOT="$FIXTURE_ROOT" bash "$CHECKER" >"$FIXTURE_ROOT/gitnexus.out" 2>&1; then
    echo "FAIL: $config_case GitNexus protection unexpectedly passed" >&2
    exit 1
  fi
  grep -Fq '.gitnexusrc:' "$FIXTURE_ROOT/gitnexus.out"
done
printf '{"analyze":{"indexOnly":true}}\n' > "$FIXTURE_ROOT/.gitnexusrc"

mkdir -p "$FIXTURE_ROOT/.agents/skills/unlisted-skill"
cat > "$FIXTURE_ROOT/.agents/skills/unlisted-skill/SKILL.md" <<'EOF'
---
name: unlisted-skill
description: Unlisted fixture skill.
---
EOF

set +e
unhealthy_output="$(HARNESS_ROOT="$FIXTURE_ROOT" bash "$CHECKER" 2>&1)"
unhealthy_status=$?
set -e

if [[ $unhealthy_status -eq 0 ]]; then
  echo "FAIL: unlisted skill fixture unexpectedly passed" >&2
  exit 1
fi

[[ "$unhealthy_output" == *"unlisted-skill: SKILL.md exists but is not listed in INDEX.md"* ]] || {
  echo "FAIL: unlisted skill error was not actionable" >&2
  echo "$unhealthy_output" >&2
  exit 1
}

rm -rf -- "$FIXTURE_ROOT/.agents/skills/unlisted-skill"

mkdir -p "$FIXTURE_ROOT/.agents/skills/tools/nested"
printf '# Nested skill\n' > "$FIXTURE_ROOT/.agents/skills/tools/nested/SKILL.md"
if HARNESS_ROOT="$FIXTURE_ROOT" bash "$CHECKER" >"$FIXTURE_ROOT/nested.out" 2>&1; then
  echo "FAIL: unlisted nested skill unexpectedly passed" >&2
  exit 1
fi
grep -Fq 'tools/nested: SKILL.md exists but is not listed in INDEX.md' "$FIXTURE_ROOT/nested.out"
printf '| `tools/nested` | required |\n' >> "$FIXTURE_ROOT/.agents/skills/INDEX.md"
HARNESS_ROOT="$FIXTURE_ROOT" bash "$CHECKER" >"$FIXTURE_ROOT/nested-pass.out"


printf '\n# Duplicate rules\n' >> "$FIXTURE_ROOT/CLAUDE.md"
if HARNESS_ROOT="$FIXTURE_ROOT" bash "$CHECKER" >"$FIXTURE_ROOT/compat.out" 2>&1; then
  echo "FAIL: duplicated compatibility rules unexpectedly passed" >&2
  exit 1
fi
grep -Fq 'CLAUDE.md: must contain only @AGENTS.md' "$FIXTURE_ROOT/compat.out"
printf '@AGENTS.md\n' > "$FIXTURE_ROOT/CLAUDE.md"
printf '\n' > "$FIXTURE_ROOT/AGENTS.md"
if HARNESS_ROOT="$FIXTURE_ROOT" bash "$CHECKER" >"$FIXTURE_ROOT/root.out" 2>&1; then
  echo "FAIL: missing root entry unexpectedly passed" >&2
  exit 1
fi
grep -Fq 'apps/example/AGENTS.md: local entry is missing from root AGENTS.md' "$FIXTURE_ROOT/root.out"

echo "PASS: check-agent-harness fixtures"
