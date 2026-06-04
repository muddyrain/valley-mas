# Encoding Playbook

## Goal

Keep user-visible text readable throughout code edits, especially in multilingual files.

## Failure Modes Covered

1. Mojibake
   UTF-8 text is decoded as GBK/GB18030 or another legacy encoding.
2. Silent text loss
   User-visible Chinese text is replaced with `?`, often during terminal or script-based rewrites.

## Safe Editing Practices

1. Default to UTF-8.
2. Prefer targeted line edits over full-file rewrites.
3. Avoid copy/paste paths that pass through a lossy terminal encoding layer.
4. Run `scripts/check_mojibake.py` before and after editing.

## Recovery Workflow

1. Inspect the reported line and nearby UI copy.
2. Compare with `git diff` or the previous file revision.
3. Restore the intended text exactly.
4. Re-run the checker until it is clean.

## Notes

- Heuristics are intentionally conservative.
- Repeated `?` inside quoted strings or JSX text should be treated as suspicious unless proven intentional.
