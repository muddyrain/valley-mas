#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$FIXTURE_ROOT"' EXIT

mkdir -p "$FIXTURE_ROOT/apps/example/src" "$FIXTURE_ROOT/node_modules/dependency"
printf '# Fixture root rules\n' > "$FIXTURE_ROOT/CLAUDE.md"
printf '// Fixture application entry\n' > "$FIXTURE_ROOT/apps/example/src/App.tsx"
cp "$REPO_ROOT/scripts/fixtures/agents-context/valid.md.fixture" "$FIXTURE_ROOT/apps/example/AGENTS.md"
cp "$REPO_ROOT/scripts/fixtures/agents-context/invalid.md.fixture" "$FIXTURE_ROOT/node_modules/dependency/AGENTS.md"

if ! AGENTS_CHECK_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-agents-context.sh" >"$FIXTURE_ROOT/pass.out" 2>&1; then
  echo "FAIL: dependency AGENTS.md files should be ignored"
  sed -n '1,120p' "$FIXTURE_ROOT/pass.out"
  exit 1
fi

mkdir -p "$FIXTURE_ROOT/apps/broken"
cp "$REPO_ROOT/scripts/fixtures/agents-context/invalid.md.fixture" "$FIXTURE_ROOT/apps/broken/AGENTS.md"

if AGENTS_CHECK_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-agents-context.sh" >"$FIXTURE_ROOT/fail.out" 2>&1; then
  echo "FAIL: invalid project AGENTS.md should fail the context check"
  exit 1
fi

if ! grep -Fq "apps/broken/AGENTS.md: missing section 'AI 任务最小上下文入口'" "$FIXTURE_ROOT/fail.out"; then
  echo "FAIL: invalid project error was not actionable"
  sed -n '1,120p' "$FIXTURE_ROOT/fail.out"
  exit 1
fi

mkdir -p "$FIXTURE_ROOT/apps/wrong-first/src"
printf '// Fixture application entry\n' > "$FIXTURE_ROOT/apps/wrong-first/src/App.tsx"
cat > "$FIXTURE_ROOT/apps/wrong-first/AGENTS.md" <<'EOF'
# Wrong first item

## AI 任务最小上下文入口

- `README.md` -> `apps/wrong-first/AGENTS.md` -> `src/App.tsx`。
EOF

if AGENTS_CHECK_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-agents-context.sh" >"$FIXTURE_ROOT/wrong-first.out" 2>&1; then
  echo "FAIL: route chain with an invalid first item should fail the context check"
  exit 1
fi

if ! grep -Fq 'apps/wrong-first/AGENTS.md: route chain 1 must start with `CLAUDE.md`' "$FIXTURE_ROOT/wrong-first.out"; then
  echo "FAIL: invalid first route item was not actionable"
  sed -n '1,120p' "$FIXTURE_ROOT/wrong-first.out"
  exit 1
fi

mkdir -p "$FIXTURE_ROOT/apps/missing-target"
cat > "$FIXTURE_ROOT/apps/missing-target/AGENTS.md" <<'EOF'
# Missing target

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/missing-target/AGENTS.md` -> `src/DoesNotExist.tsx`。
EOF

if AGENTS_CHECK_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-agents-context.sh" >"$FIXTURE_ROOT/missing-target.out" 2>&1; then
  echo "FAIL: route chain with a missing target should fail the context check"
  exit 1
fi

if ! grep -Fq 'apps/missing-target/AGENTS.md: route chain 1 item 3 target is missing: `src/DoesNotExist.tsx`' "$FIXTURE_ROOT/missing-target.out"; then
  echo "FAIL: missing route target was not actionable"
  sed -n '1,120p' "$FIXTURE_ROOT/missing-target.out"
  exit 1
fi

echo "PASS: AGENTS context fixtures"
