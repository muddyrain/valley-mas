---
name: skill-sync-guard
description: 在 Valley MAS 改功能时同步检查本地 skills 是否过期。适用于功能定位、交互规则、发布方式、卡片系统或产品文案发生变化，导致已有 skill 不再准确的任务。
---

# 技能同步护栏

当任务改变了产品事实、交互规则或工程约定时，使用这个技能。

## 目的

避免代码已经变了，但本地 skill 还停留在旧规则里，导致后续 AI 继续按过期心智开发。

## 什么时候必须检查 skill

- 功能定位变了
- 页面交互规则变了
- 组件职责变了
- 卡片展示逻辑变了
- 发布方式、部署方式、路由方式变了
- 文案策略或产品语气变了
- 某个已有 skill 在这次改动后已经不再准确

## 工作规则

1. 改功能时，先判断这次变动是否影响已有 skill 的前提描述。
2. 如果影响了，就同步更新对应 skill 的 `SKILL.md` 和 `agents/openai.yaml`。
3. 如果没有现成 skill 能承接新的产品规则，就补一个新的 skill。
4. 不要只改代码不改 skill，也不要只改 skill 不落到真实功能上。
5. 最终说明里明确写出：这次有没有同步更新 skill，更新了哪些。

## 建议检查范围

- `.codex/skills/image-text-studio/`
- `.codex/skills/creator-space-ux/`
- `.codex/skills/card-system-consistency/`
- `.codex/skills/blog-resource-access-guard/`
- `.codex/skills/vercel-go-release/`
- `.codex/skills/product-copy-cn/`
- 以及任何和当前任务直接相关的 skill

## 校验

- 改了中文 skill 文案后运行 [$encoding-guard](/D:/my-code/valley-mas/.codex/skills/encoding-guard/SKILL.md)。
- 至少抽样检查一个被更新的 skill，确认描述、展示名和默认提示词没有脱节。
