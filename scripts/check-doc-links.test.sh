#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$FIXTURE_ROOT"' EXIT

mkdir -p "$FIXTURE_ROOT/docs" "$FIXTURE_ROOT/apps/example"
printf '# Root rules\n\n[Guide](./docs/guide.md)\n' > "$FIXTURE_ROOT/AGENTS.md"
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

# Broader app docs and CONTEXT must be checked; generated evidence remains informational.
mkdir -p "$FIXTURE_ROOT/apps/example/docs" "$FIXTURE_ROOT/node_modules/dependency"
printf '# Ignored\n[Missing](missing.md)\n' > "$FIXTURE_ROOT/node_modules/dependency/README.md"
printf '# Context\n[Missing](docs/context-missing.md)\n' > "$FIXTURE_ROOT/apps/example/CONTEXT.md"
printf '# App docs\n[Missing](app-missing.md)\n' > "$FIXTURE_ROOT/apps/example/docs/topic.md"
DOC_LINKS_REPO_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-doc-links.sh" >"$FIXTURE_ROOT/app.out"
grep -Fq 'apps/example/CONTEXT.md:2: unresolved local link' "$FIXTURE_ROOT/app.out"
grep -Fq 'apps/example/docs/topic.md:2: unresolved local link' "$FIXTURE_ROOT/app.out"
if grep -Fq 'dependency/README.md' "$FIXTURE_ROOT/app.out"; then
  echo "FAIL: dependency docs were scanned" >&2
  exit 1
fi
printf '# Context\n' > "$FIXTURE_ROOT/apps/example/CONTEXT.md"
printf '# App docs\n[Evidence](../test-output/report.md)\n' > "$FIXTURE_ROOT/apps/example/docs/topic.md"
printf '# Docs index\n[Guide](./guide.md)\n' > "$FIXTURE_ROOT/docs/README.md"
DOC_LINKS_REPO_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-doc-links.sh" --strict >"$FIXTURE_ROOT/artifact.out"
grep -Fq 'ARTIFACTS: 1 generated-output links unavailable locally' "$FIXTURE_ROOT/artifact.out"
# Source links with line suffixes resolve to real files.
printf '\n[Source](./guide.md:12)\n' >> "$FIXTURE_ROOT/docs/README.md"
# The Git-backed inventory also covers untracked docs.
git -C "$FIXTURE_ROOT" init -q
git -C "$FIXTURE_ROOT" add docs/guide.md
rm "$FIXTURE_ROOT/docs/guide.md"
printf '# Replacement\n' > "$FIXTURE_ROOT/docs/guide.md"
DOC_LINKS_REPO_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-doc-links.sh" --strict >"$FIXTURE_ROOT/git.out"
grep -Fq '0 unresolved' "$FIXTURE_ROOT/git.out"
printf '\n[Bad](file:///tmp/private.md)\n' >> "$FIXTURE_ROOT/apps/example/CONTEXT.md"
if DOC_LINKS_REPO_ROOT="$FIXTURE_ROOT" bash "$REPO_ROOT/scripts/check-doc-links.sh" >"$FIXTURE_ROOT/portable.out" 2>&1; then
  echo "FAIL: non-portable link passed" >&2
  exit 1
fi
grep -Fq 'non-portable link' "$FIXTURE_ROOT/portable.out"
echo "PASS: docs links fixtures"
