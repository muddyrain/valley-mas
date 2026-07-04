---
description: 基于当前改动生成一条符合仓库风格的 Emoji + Conventional Commit 提交信息。
---

# /commit-msg

为当前工作区生成 **1 条** 最合适的提交信息。

## 目标

输出一条符合 Valley MAS 仓库风格的 Emoji + Conventional Commit：

```text
<emoji> <type>(scope): summary
```

或：

```text
<emoji> <type>: summary
```

## Workflow

1. 使用 `$conventional-commit-guard`。
2. 查看最近 `5` 条提交，确认当前仓库风格。
3. 查看当前 `git status`。
4. 优先读取 `git diff --cached`；如果暂存区为空，再读取当前 `git diff`。
5. 基于真实改动生成 **1 条** 带 emoji 的中文短提交信息。

## Rules

* 默认只输出 **一行**，不要附带解释、备选、代码块或正文。
* 首行格式：`<emoji> <type>: summary`，emoji 与 type 之间用空格分隔。
* `summary` 使用中文，短、准、直接。
* 如果改动核心是文档，优先使用 `📝 docs(...)`。
* 如果改动核心是工具、命令、脚本或提示词，优先使用 `🔧 chore(...)`。
* 如果当前没有任何改动，输出：

```text
🔧 chore: 无改动可提交
```

## Examples

```text
📝 docs(scratch-legend): 收紧后期玩法规格
```

```text
🔧 chore(commands): 增加提交信息命令
```

```text
✨ feat(blog): 支持 AI 选图封面
```

```text
🐛 fix(resource): 修复详情页返回上下文
```
