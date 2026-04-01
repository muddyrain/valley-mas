#!/usr/bin/env python3
"""检测代码改动中的疑似乱码（mojibake）。"""

from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys
from dataclasses import dataclass

@dataclass
class Finding:
    file: pathlib.Path
    line_no: int
    text: str
    recovered: str | None


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
    # Heuristic: recovered text should contain clearly more CJK characters.
    return cjk_count(recovered) >= max(4, cjk_count(line) + 2)


def is_text_file(path: pathlib.Path) -> bool:
    try:
        data = path.read_bytes()
    except OSError:
        return False
    if not data:
        return True
    if b"\x00" in data:
        return False
    return True


def scan_file(path: pathlib.Path) -> list[Finding]:
    findings: list[Finding] = []
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return findings

    for i, line in enumerate(content.splitlines(), start=1):
        recovered = try_recover_gbk_mojibake(line)
        if not is_likely_mojibake(line, recovered):
            continue
        findings.append(
            Finding(file=path, line_no=i, text=line.strip(), recovered=recovered)
        )
    return findings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="检测 UTF-8 源码中的疑似乱码")
    parser.add_argument(
        "paths",
        nargs="*",
        help="要扫描的文件。若省略则扫描 git 改动文件。",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    paths = [pathlib.Path(p) for p in args.paths] if args.paths else changed_files_from_git()
    paths = [p for p in paths if p.exists() and p.is_file() and is_text_file(p)]

    findings: list[Finding] = []
    for path in paths:
        findings.extend(scan_file(path))

    if not findings:
        print("通过：未检测到疑似乱码。")
        return 0

    print("错误：检测到疑似乱码：")
    for item in findings:
        print(f"- {item.file}:{item.line_no}")
        print(f"  当前内容: {item.text}")
        if item.recovered:
            print(f"  恢复建议: {item.recovered.strip()}")

    return 2


if __name__ == "__main__":
    sys.exit(main())
