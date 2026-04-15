---
name: skill-category-guard
description: 在 Valley MAS 新增或修改 skill 时，强制完成分类归档与索引同步。适用于创建新 skill、迁移 skill 职责边界、或修复技能分类混乱的场景。
category: general
---

# 技能分类护栏

当任务涉及“新增 skill / 调整 skill 职责 / 重构 skill 目录”时，使用这个技能。

## 目的

避免出现这些协作问题：

- 新 skill 被创建但没有归类，后续难以检索
- `SKILL.md`、`agents/openai.yaml`、`INDEX.md` 的分类信息不一致
- Web / Climber / Unity / 通用 skill 边界再次混用

## 分类规则

1. 每个 skill 必须有一个主分类：
   - `general`：通用协作与工程护栏
   - `web`：`apps/web` 产品与体验相关
   - `climber`：`packages/climber-game` 相关
   - `unity`：`apps/unity-climber` 相关
2. 跨域 skill 也必须先选一个主分类，并在正文写清“次分类适用边界”。
3. 分类优先依据“主要落地目录与职责”判断，而不是命名偏好。

## 落地步骤

1. 新建或修改 skill 时，先在 `SKILL.md` 里增加一行 `category: <分类>`。
2. 确认 `agents/openai.yaml` 的 `default_prompt` 与分类边界一致。
3. 在 `.codex/skills/INDEX.md` 对应分区补充或更新该 skill。
4. 若分类变更影响项目协作约定，同步更新 `AGENTS.md`。
5. 最终说明明确写出：本次 skill 归类结果、是否更新索引、是否有遗留待处理项。

## 最低校验

1. 检查 `SKILL.md` 是否包含 `category:` 且与实际职责一致。
2. 抽样核对 `agents/openai.yaml` 的描述没有跨分类漂移。
3. 修改中文内容后运行：
   - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`

## 与其他 skills 的协作

1. 发现已有 skill 描述过期时，联动 `skill-sync-guard`。
2. 发现某类规则已稳定可沉淀时，联动 `skill-opportunity-scout`。
3. 本回合使用了本 skill，按 `skill-usage-disclosure` 说明使用原因。
