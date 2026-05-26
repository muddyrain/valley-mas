# WorldSim Planning Rules

本文件约束 WorldSim 后续计划文档的写法。目标是让计划能指导下一步开发，
而不是变成越来越长的历史堆积。

## Document Roles

| File | Role | Must Not Contain |
|---|---|---|
| `VISION.md` | 产品北极星和永久玩法原则。 | 每个 PR 的实现流水账。 |
| `ARCHITECTURE.md` | 模拟真源、Phaser 边界、projection、性能升级顺序。 | 玩法愿望清单。 |
| `MECHANICS.md` | 当前真实机制和关键参数。 | 未实现功能的长篇计划。 |
| `ROADMAP.md` | 当前阶段、下一步、验收点、延后队列。 | 细粒度提交历史和重复 Done 列表。 |
| `AGENTS.md` | 子项目协作入口和红线。 | 超长当前状态快照。 |

## Status Vocabulary

只使用这些状态：

- `Done`：验收点已满足，后续只做增强，不影响该阶段成立。
- `Foundation slice`：基础能力已进入代码，但仍缺可读性、调参、工具化或完整验收。
- `Active`：当前正在推进的唯一主焦点。
- `Queued`：近期会做，但不是当前焦点。
- `Backlog`：有价值，但暂不排期。
- `Deferred`：明确延后，除非用户改优先级或指标要求。

约束：

- 同一时间只能有一个 `Active`。
- `Foundation slice` 不能被当作 `Done` 汇报。
- 如果一个阶段超过 5 个 follow-up，必须拆成新的切片或降级进 backlog。

## Roadmap Entry Template

新增计划项时用这个结构：

```md
### PR-xxY: Short Name

Status: `Queued`

Why now:
- 一句话说明为什么现在做，而不是以后做。

WorldBox alignment:
- 它如何强化“玩家是神、世界自治、因果可读、干预有后果”。

Exit criteria:
- 可测试或可观察的完成条件。

Non-goals:
- 本切片明确不做什么。
```

没有 `Why now` 和 `Exit criteria` 的功能不得进入近期队列。

## Completion Rules

计划项从 `Active` 移出前必须满足：

- 代码或文档改动已经落地。
- 对应测试、观察 harness 或手动验收标准已经明确。
- `ROADMAP.md` 更新为新的当前焦点。
- 如果改了玩法、数值、架构或 UI 红线，同步更新 `VISION.md`、`MECHANICS.md`、
  `ARCHITECTURE.md` 或 `AGENTS.md` 中的对应内容。

## Anti-Bloat Rules

这些内容不要写进 `ROADMAP.md`：

- 每一次小修小补的完整历史。
- 已完成阶段的长篇实现细节。
- 同一句话在 `AGENTS.md`、`ROADMAP.md` 和 `MECHANICS.md` 中重复三遍。
- 临时调参过程、一次性观察输出、未稳定的实验猜测。
- “以后可以做很多东西”的开放式段落。

允许写进 `ROADMAP.md` 的内容：

- 当前做到了哪里。
- 下一步先做什么。
- 为什么现在做。
- 怎么判断完成。
- 哪些明确延后。

## WorldBox Alignment Gate

任何玩法、数值、文明、战争、叛乱、神力或可读性 UI 计划进入近期队列前，
必须先写清楚：

- `WorldBox 行为`：对应体验如何触发、演进、被玩家观察或干预。
- `本项目取舍`：镜像、简化、延后或有意识偏离什么。
- `验收点`：测试、观察报告或手玩标准要证明什么。

如果只是技术债、性能或文档整理，也要说明它如何保护后续 WorldBox 式体验。

## Backlog Hygiene

Backlog 只保留方向，不写细实现：

- 一项 backlog 最多一行。
- 超过 15 项时，必须合并同类项。
- Backlog 升级为近期队列时，才补齐 template。
- 如果某项连续三次整理都没有进入近期队列，标记为 `Deferred` 或删除。
