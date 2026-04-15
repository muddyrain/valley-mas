---
name: change-log-guard
description: 在 Valley MAS 中强制记录每次真实落地改动的结构化日志，保证后续可追溯。用于任何代码、配置、文档、skill 规则、任务清单的新增/修改/删除任务；若本轮无实际改动，明确说明并可不写日志。
category: general
---

# 变更日志护栏

这个 skill 关注“这次到底改了什么、为什么改、怎么验证、下一步是什么”的沉淀，而不是只在聊天里口头说明。

## 日志位置

- 统一日志文件：`.codex/logs/CHANGE-LOG.md`
- 若文件不存在，先创建再写入。

## 什么时候必须写日志

1. 本轮有任一真实文件改动（代码、配置、文档、skill、任务清单）。
2. 本轮新增了规则、护栏、校验门槛、工作流约定。
3. 本轮修复了线上/体验风险，或影响后续迭代决策。

## 可以不写日志的情况

1. 纯问答、纯方案讨论、没有任何文件改动。
2. 明确被用户要求“本轮不落日志”。
3. 由于环境限制无法落地改动，且在最终说明中已写明阻塞原因。

## 记录模板

每次追加时使用如下结构（追加到文件末尾）：

```md
## YYYY-MM-DD HH:mm (Asia/Shanghai)

- 任务：一句话描述本轮目标。
- 改动文件：
  - `绝对或仓库相对路径`
  - `绝对或仓库相对路径`
- 关键改动：
  - 要点 1
  - 要点 2
- 校验：
  - `命令`：通过/未通过/未执行（原因）
- 风险与后续：
  - 当前风险
  - 下一步动作
```

## 工作规则

1. 日志必须基于真实改动，禁止编造“已完成”内容。
2. 先完成改动，再写日志；日志时间用当前本地时区（Asia/Shanghai）。
3. 一次任务多轮追加时，每轮单独记录，不覆盖历史记录。
4. 如果同一文件被多次改动，日志里写“本轮变化点”，不要整段复制 diff。

## 与其他 skills 协作

1. 与 [$task-completion-guard](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/task-completion-guard/SKILL.md) 联动，防止“说完成但未落地”。
2. 与 [$skill-usage-disclosure](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/skill-usage-disclosure/SKILL.md) 联动，在最终说明里披露本 skill 使用情况。
3. 涉及中文日志时，联动 [$encoding-guard](/Users/bytedance/Desktop/study/valley-mas/.codex/skills/encoding-guard/SKILL.md) 防乱码。
