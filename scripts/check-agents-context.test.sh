#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$FIXTURE_ROOT"' EXIT

mkdir -p "$FIXTURE_ROOT/apps/example" "$FIXTURE_ROOT/node_modules/dependency"
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

echo "PASS: AGENTS context fixtures"
