---
name: git-publish-guard
description: 在 Valley MAS 中约束 Git 发布动作，要求 push 时显式指定 remote，默认推送到 origin。适用于需要 push 分支、设置 upstream、发布提交或配合 yeet/github:yeet 执行发布动作的场景。
category: general
---

# Git 发布护栏

当任务涉及 `git push`、发布分支、设置 upstream 或准备通过 GitHub 流程提交远端改动时，使用这个技能。

## 目标

- 避免把分支推错远端。
- 让发布动作可审计、可复现，而不是依赖隐式 upstream。
- 和提交信息、PR 流程解耦，只约束 push 行为本身。

## 核心规则

1. push 时必须显式写出 remote，默认使用 `origin`。
2. 除非用户明确要求其他 remote，否则不要推送到 `upstream`、个人 fork 或其他自定义 remote。
3. 首次推送新分支时，优先使用：
   - `git push --set-upstream origin <branch>`
4. 后续普通推送时，优先使用：
   - `git push origin <branch>`
5. 如果仓库没有 `origin` remote，先检查 `git remote -v`，确认现状后再向用户报告，不要擅自改 remote 配置。
6. 如果用户明确要求推送到非 `origin` remote，以用户要求为准，并在最终说明里点明这次用了哪个 remote。

## 职责边界

- 这个 skill 负责 `push / publish` 目标约束。
- 不负责 commit message 规范；提交信息仍交给 `conventional-commit-guard`。
- 不负责完整 PR 发布编排；需要整套发布流时，与 `yeet` 或 `github:yeet` 配合使用。

## 推荐执行顺序

1. 确认当前分支名。
2. 如果要 push，先确认 remote 列表里是否存在 `origin`。
3. 选择显式命令：
   - 新分支：`git push --set-upstream origin <branch>`
   - 已有上游：`git push origin <branch>`
4. 在最终说明里明确写出是否已推送，以及推送目标 remote。

## 不推荐做法

- 直接执行 `git push`
- 依赖隐式 upstream 而不写 remote
- 在未确认 remote 的情况下推到非 `origin`

## 最终说明

如果本轮发生了远端推送，最终回复里至少说明：

- 推送到了哪个 remote
- 推送了哪个 branch
- 是否使用了 `--set-upstream`
