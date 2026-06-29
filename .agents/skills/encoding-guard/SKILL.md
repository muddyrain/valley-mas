---
name: encoding-guard
description: Prevent text encoding corruption and suspicious text-loss regressions during code edits.
---

# Encoding Guard

Use this skill only when an edit has real encoding risk:

- Editing CJK or other non-ASCII user-visible text
- Editing Markdown, skill files, or configuration examples that contain CJK or other non-ASCII text
- Running script-based rewrites, bulk replacements, formatters, or generators over files that may contain CJK or other non-ASCII text
- Doing a final pre-commit check when the current diff contains CJK or other non-ASCII text

Do not use it for read-only analysis, pure ASCII code changes, or files that are not being edited.

This skill now protects against two failure modes:

1. Mojibake
   Example: UTF-8 text decoded as GBK/GB18030.
2. Silent text loss
   Example: user-visible Chinese text being replaced with `?`, `??`, or `????`.

## Standard Workflow

Prefer targeted checks for the files you will edit.

Run this from the repo root before editing risky files:

```bash
python .agents/skills/encoding-guard/scripts/check_mojibake.py path/to/file1.ts path/to/file2.tsx
```

Run it again after editing the same files:

```bash
python .agents/skills/encoding-guard/scripts/check_mojibake.py path/to/file1.ts path/to/file2.tsx
```

When no paths are provided, the script scans changed files from git. Use this mainly as a pre-commit fallback:

```bash
python .agents/skills/encoding-guard/scripts/check_mojibake.py
```

## What The Script Checks

- Unicode replacement characters such as `U+FFFD`
- Likely GBK/UTF-8 mojibake recoveries
- Suspicious repeated `?` inside quoted strings or JSX text
- File-level regressions where CJK characters sharply drop while `?` count rises

## Repair Guidance

- Prefer precise line edits over rewriting the full file
- If the script reports a recovery suggestion, verify it against nearby UI copy or tests
- If it reports suspicious `?`, compare against `git diff` or the previous file version
- Re-run the checker until the result is clean

For extra context, see `references/encoding-playbook.md`.
