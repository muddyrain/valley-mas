---
name: worldbox-alignment-guard
description: Use when working in apps/world-sim on gameplay, balance, simulation rules, god powers, villages, kingdoms, diplomacy, war, rebellion, UI readability, roadmap, or design docs where WorldSim should align with WorldBox-style behavior.
---

# WorldBox Alignment Guard

## Overview

WorldSim 的玩法改动必须先对齐 WorldBox 式上帝沙盒体验，再决定镜像、简化或有意识地偏离。核心原则是：玩家是神，世界自治，因果可读，干预有后果。

## Hard Gate

在修改 `apps/world-sim` 的玩法、数值、模拟规则、神力、村庄、王国、外交、战争、叛乱、可读性 UI 或路线图前，先完成 WorldBox 对照分析。没有完成对照分析，不进入实现。

## Workflow

1. 定位当前机制在本仓库里的设计基线：先读 `apps/world-sim/AGENTS.md` 和 v2 四件套中相关章节。
2. 分析 WorldBox 对应机制：优先查当前可访问资料，例如官方页面、Wiki、更新说明、玩家可验证资料或实际玩法记录；资料不确定时明确标注“推断”。
3. 输出三行结论再改代码：
   - `WorldBox 行为`：它如何触发、如何演进、玩家如何观察或干预。
   - `本项目取舍`：本次镜像、简化、延后或偏离什么。
   - `验收点`：测试、观测报告或手动验收应证明什么。
4. 如果要偏离 WorldBox，必须写出理由：性能、当前架构阶段、可读性、避免直接克隆资产/内容、或路线图分期。
5. 实现后按 `game-doc-sync-guard` 同步长期文档，让 ROADMAP/MECHANICS/VISION 和代码保持一致。

## Alignment Rules

| 主题 | 必须检查 |
|---|---|
| 神力 | 是否像 WorldBox 一样通过环境和事件影响世界，而不是变成 RTS 直接操控。 |
| 村庄/文明 | 是否有自治成长、命名、领土、资源压力、扩张或衰退的可读链路。 |
| 王国/外交 | 是否能让边境、资源、战争、内部稳定原因被玩家看懂。 |
| 战争/叛乱 | 是否有准备窗口、独立/冲突后果、可观察事件，而不是无提示瞬间状态切换。 |
| UI 可读性 | 是否解释“为什么发生”，而不只显示内部字段。 |
| 性能取舍 | 是否保留 WorldBox 的宏观体验，同时用聚合模拟、降频或投影裁剪适配当前规模目标。 |

## Common Mistakes

- 只根据旧 ROADMAP 实现，忘记重新看 WorldBox 的当前或公认玩法。
- 把 WorldBox 的表层名词搬过来，却没有保留“自治世界 + 神力干预 + 后果可读”的核心循环。
- 为了省事跳过准备窗口，让战争、叛乱、扩张突然发生。
- 偏离 WorldBox 但没有记录原因，导致后续任务误以为这是目标设计。
- 使用 WorldBox 素材、图标、文案或专有表达；本项目只对齐机制体验，不复制受保护资产。

## PR-12G Example

做叛乱链路时，不能只让低忠诚村庄显示 `叛乱` 标签。应先分析 WorldBox 中忠诚、叛乱、独立、战争之间的关系，再决定本项目分期：例如 PR-12G.2 只做准备可读性，PR-12G.3 做分裂建国，PR-12G.4 再接内战可读性和调参。
