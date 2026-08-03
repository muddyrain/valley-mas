#!/usr/bin/env bash

set -euo pipefail

DOCS_ROOT="${DOC_LINKS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docs}"

python3 - "$DOCS_ROOT" <<'PY'
import re
import sys
from pathlib import Path

docs_root = Path(sys.argv[1]).resolve()
absolute_prefix = "/Users/bytedance/Desktop/study/valley-mas/"
patterns = {
    "file://": re.compile(r"\(file://"),
    "repo-absolute-path": re.compile(r"\(" + re.escape(absolute_prefix)),
}

violations = []
for md_path in docs_root.rglob("*.md"):
    try:
        lines = md_path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        # 跳过编码异常文件，避免把文本格式问题与链接规则混淆，便于后续单独排查。
        continue

    for line_no, line in enumerate(lines, start=1):
        for label, pattern in patterns.items():
            for match in pattern.finditer(line):
                violations.append((md_path, line_no, label, match.group(0)))

if not violations:
    md_count = sum(1 for _ in docs_root.rglob("*.md"))
    print(f"PASS: doc links clean (no file:// or repo-absolute links; checked {md_count} md files)")
    raise SystemExit(0)

print("FAIL: docs contain non-portable links", file=sys.stderr)
print(f"TOTAL: {len(violations)}", file=sys.stderr)
for path, line_no, label, value in violations:
    rel_path = path.relative_to(docs_root.parent)
    print(f"- {rel_path}:{line_no}: {label} -> {value}", file=sys.stderr)
raise SystemExit(1)
PY
