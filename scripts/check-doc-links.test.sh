#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$FIXTURE_ROOT"' EXIT

mkdir -p "$FIXTURE_ROOT/docs" "$FIXTURE_ROOT/apps/example"
printf '# Root rules\n\n[Guide](./docs/guide.md)\n' > "$FIXTURE_ROOT/CLAUDE.md"
printf '# Guide\n' > "$FIXTURE_ROOT/docs/guide.md"
printf '# Local rules\n\n[Guide](../../docs/guide.md)\n' > "$FIXTURE_ROOT/apps/example/AGENTS.md"
printf '# Docs index\n\n[Guide](./guide.md)\n' > "$FIXTURE_ROOT/docs/README.md"

report_output="$(DOC_LINKS_REPO_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-doc-links.sh")"
[[ "$report_output" == *"3 local links resolved; 0 unresolved"* ]] || {
  echo "FAIL: report mode did not resolve scoped local links" >&2
  echo "$report_output" >&2
  exit 1
}

printf '\n[Missing](./missing.md)\n' >> "$FIXTURE_ROOT/docs/README.md"
if ! DOC_LINKS_REPO_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-doc-links.sh" >"$FIXTURE_ROOT/report.out" 2>&1; then
  echo "FAIL: report mode should not fail on unresolved local links" >&2
  exit 1
fi

if ! grep -Fq 'docs/README.md:5: unresolved local link -> ./missing.md' "$FIXTURE_ROOT/report.out"; then
  echo "FAIL: report mode did not print an actionable unresolved link" >&2
  sed -n '1,120p' "$FIXTURE_ROOT/report.out"
  exit 1
fi

if DOC_LINKS_REPO_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-doc-links.sh" --strict >"$FIXTURE_ROOT/strict.out" 2>&1; then
  echo "FAIL: strict mode should fail on unresolved local links" >&2
  exit 1
fi

grep -Fq 'FAIL: unresolved local Markdown links' "$FIXTURE_ROOT/strict.out" || {
  echo "FAIL: strict mode error was not actionable" >&2
  sed -n '1,120p' "$FIXTURE_ROOT/strict.out"
  exit 1
}

echo "PASS: docs links fixtures"
