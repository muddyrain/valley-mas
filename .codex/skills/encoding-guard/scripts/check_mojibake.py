#!/usr/bin/env python3
"""Detect mojibake and suspicious text-loss regressions in source files."""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys
from dataclasses import dataclass

TEXT_EXTENSIONS = {
    ".c",
    ".cc",
    ".cpp",
    ".css",
    ".go",
    ".h",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".less",
    ".md",
    ".py",
    ".rb",
    ".rs",
    ".scss",
    ".sh",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
}

QUESTION_LOSS_EXTENSIONS = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".less",
    ".scss",
    ".ts",
    ".tsx",
    ".vue",
    ".xml",
}

QUOTED_SEGMENT_RE = re.compile(r"""(['"`])(?P<body>(?:\\.|(?!\1).)*)\1""")
QUESTION_RUN_RE = re.compile(r"\?{2,}")
URLISH_RE = re.compile(r"https?://|[A-Za-z]:\\\\")


@dataclass
class Finding:
    file: pathlib.Path
    line_no: int
    kind: str
    text: str
    suggestion: str | None = None


def run_git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        return ""
    return result.stdout


def changed_files_from_git() -> list[pathlib.Path]:
    unstaged = run_git(["diff", "--name-only"])
    staged = run_git(["diff", "--cached", "--name-only"])
    files = set()
    for blob in (unstaged, staged):
        for line in blob.splitlines():
            line = line.strip()
            if line:
                files.add(pathlib.Path(line))
    return sorted(files)


def cjk_count(text: str) -> int:
    total = 0
    for ch in text:
        code = ord(ch)
        if (
            0x4E00 <= code <= 0x9FFF
            or 0x3400 <= code <= 0x4DBF
            or 0xF900 <= code <= 0xFAFF
        ):
            total += 1
    return total


def ascii_word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z]{2,}", text))


def try_recover_gbk_mojibake(text: str) -> str | None:
    try:
        recovered = text.encode("gb18030").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return None
    if recovered == text:
        return None
    if cjk_count(recovered) <= cjk_count(text):
        return None
    return recovered


def is_likely_mojibake(line: str, recovered: str | None) -> bool:
    if "\ufffd" in line:
        return True
    if recovered is None:
        return False
    return cjk_count(recovered) >= max(4, cjk_count(line) + 2)


def is_text_file(path: pathlib.Path) -> bool:
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    try:
        data = path.read_bytes()
    except OSError:
        return False
    if not data:
        return True
    return b"\x00" not in data


def supports_question_loss_checks(path: pathlib.Path) -> bool:
    return path.suffix.lower() in QUESTION_LOSS_EXTENSIONS


def git_head_content(path: pathlib.Path) -> str | None:
    result = subprocess.run(
        ["git", "show", f"HEAD:{path.as_posix()}"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        return None
    return result.stdout


def suspicious_question_segments(line: str) -> list[str]:
    candidates: list[str] = []

    for match in QUOTED_SEGMENT_RE.finditer(line):
        body = match.group("body")
        if QUESTION_RUN_RE.search(body):
            candidates.append(body)

    stripped = line.strip()
    if ">" in stripped and "<" in stripped and QUESTION_RUN_RE.search(stripped):
        candidates.append(stripped)

    return candidates


def is_suspicious_question_segment(segment: str) -> bool:
    if URLISH_RE.search(segment):
        return False
    if segment.count("?") < 2:
        return False
    if ascii_word_count(segment) >= 3 and cjk_count(segment) == 0:
        return False
    compact = re.sub(r"\s+", "", segment)
    if compact and set(compact) <= {"?", ".", "!", ",", ":", ";", "-", "_", "/", "\\"}:
        return True
    return compact.count("?") >= 2


def file_level_question_loss(path: pathlib.Path, current_text: str) -> Finding | None:
    if not supports_question_loss_checks(path):
        return None
    previous_text = git_head_content(path)
    if previous_text is None:
        return None

    old_cjk = cjk_count(previous_text)
    new_cjk = cjk_count(current_text)
    old_q = previous_text.count("?")
    new_q = current_text.count("?")

    cjk_drop = old_cjk - new_cjk
    q_gain = new_q - old_q

    if old_cjk < 8:
        return None
    if cjk_drop < 6 or q_gain < 2:
        return None

    return Finding(
        file=path,
        line_no=0,
        kind="text-loss",
        text=(
            f"CJK chars dropped from {old_cjk} to {new_cjk}; "
            f"question marks increased from {old_q} to {new_q}"
        ),
        suggestion="Check recent edits for Chinese text that was silently replaced with '?'",
    )


def scan_file(path: pathlib.Path) -> list[Finding]:
    findings: list[Finding] = []
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return findings

    summary = file_level_question_loss(path, content)
    if summary is not None:
        findings.append(summary)

    for i, line in enumerate(content.splitlines(), start=1):
        stripped = line.strip()

        recovered = try_recover_gbk_mojibake(line)
        if is_likely_mojibake(line, recovered):
            findings.append(
                Finding(
                    file=path,
                    line_no=i,
                    kind="mojibake",
                    text=stripped,
                    suggestion=recovered.strip() if recovered else None,
                )
            )
            continue

        if supports_question_loss_checks(path):
            for segment in suspicious_question_segments(line):
                if not is_suspicious_question_segment(segment):
                    continue
                findings.append(
                    Finding(
                        file=path,
                        line_no=i,
                        kind="question-loss",
                        text=stripped,
                        suggestion="Suspicious repeated '?' in a user-visible string or JSX text",
                    )
                )
                break

    return findings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Detect mojibake and suspicious text-loss regressions in UTF-8 source files."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Files to scan. If omitted, scan git-changed files.",
    )
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(errors="backslashreplace")

    args = parse_args()
    paths = [pathlib.Path(p) for p in args.paths] if args.paths else changed_files_from_git()
    paths = [p for p in paths if p.exists() and p.is_file() and is_text_file(p)]

    findings: list[Finding] = []
    for path in paths:
        findings.extend(scan_file(path))

    if not findings:
        print("PASS: no suspicious encoding or text-loss issues detected.")
        return 0

    print("FAIL: suspicious encoding/text issues detected:")
    for item in findings:
        location = f"{item.file}:{item.line_no}" if item.line_no > 0 else f"{item.file}"
        print(f"- [{item.kind}] {location}")
        print(f"  current: {item.text}")
        if item.suggestion:
            print(f"  note: {item.suggestion}")

    return 2


if __name__ == "__main__":
    sys.exit(main())
