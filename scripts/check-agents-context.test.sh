#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$FIXTURE_ROOT"' EXIT
mkdir -p "$FIXTURE_ROOT/apps/example/src" "$FIXTURE_ROOT/node_modules/dependency"
printf '# Root rules\n' > "$FIXTURE_ROOT/AGENTS.md"
printf '// Application\n' > "$FIXTURE_ROOT/apps/example/src/App.tsx"
cp "$REPO_ROOT/scripts/fixtures/agents-context/valid.md.fixture" "$FIXTURE_ROOT/apps/example/AGENTS.md"
cp "$REPO_ROOT/scripts/fixtures/agents-context/invalid.md.fixture" "$FIXTURE_ROOT/node_modules/dependency/AGENTS.md"
AGENTS_CHECK_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-agents-context.sh"
mkdir -p "$FIXTURE_ROOT/apps/broken"
cp "$REPO_ROOT/scripts/fixtures/agents-context/invalid.md.fixture" "$FIXTURE_ROOT/apps/broken/AGENTS.md"
if AGENTS_CHECK_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-agents-context.sh" >"$FIXTURE_ROOT/fail.out" 2>&1; then
  echo "FAIL: missing task section passed" >&2
  exit 1
fi
grep -Fq "apps/broken/AGENTS.md: missing section '按任务读取'" "$FIXTURE_ROOT/fail.out"
cat > "$FIXTURE_ROOT/apps/broken/AGENTS.md" <<'EOF'
# Broken entry

## 按任务读取

| 任务 | 入口 |
|---|---|
| 页面 | [Missing](src/DoesNotExist.tsx) |
EOF
if AGENTS_CHECK_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-agents-context.sh" >"$FIXTURE_ROOT/missing.out" 2>&1; then
  echo "FAIL: missing task target passed" >&2
  exit 1
fi
grep -Fq 'apps/broken/AGENTS.md: task entry target is missing: src/DoesNotExist.tsx' "$FIXTURE_ROOT/missing.out"
printf '# Empty\n\n## 按任务读取\n\nNo entries.\n' > "$FIXTURE_ROOT/apps/broken/AGENTS.md"
if AGENTS_CHECK_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-agents-context.sh" >"$FIXTURE_ROOT/empty.out" 2>&1; then
  echo "FAIL: empty task section passed" >&2
  exit 1
fi
grep -Fq 'task section needs at least one linked entry' "$FIXTURE_ROOT/empty.out"
echo "PASS: AGENTS context fixtures"
