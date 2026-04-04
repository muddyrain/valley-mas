---
name: encoding-guard
description: Prevent text encoding corruption and suspicious text-loss regressions during code edits.
---

# Encoding Guard

Use this skill before and after editing source files that contain Chinese, Japanese, Korean, or other non-ASCII text.

This skill now protects against two failure modes:

1. Mojibake
   Example: UTF-8 text decoded as GBK/GB18030.
2. Silent text loss
   Example: user-visible Chinese text being replaced with `?`, `??`, or `????`.

## Standard Workflow

Run this from the repo root before editing:

```bash
python .codex/skills/encoding-guard/scripts/check_mojibake.py
```

Run it again after editing:

```bash
python .codex/skills/encoding-guard/scripts/check_mojibake.py
```

You can also target specific files:

```bash
python .codex/skills/encoding-guard/scripts/check_mojibake.py path\to\file1.ts path\to\file2.tsx
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
