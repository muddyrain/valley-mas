# WorldSim v2 - 项目协作入口

本文件只补充 `apps/world-sim` 的局部规则。全局协作、Git、skills 和完成标准仍以仓库根目录 `AGENTS.md` 为准。

## 项目定位

WorldSim v2 是一个 2D 像素风上帝沙盒文明模拟游戏：

- 玩家扮演上帝，不直接操控单位。
- 小人自动求生、繁殖、迁徙，并在后续阶段形成村庄、王国和战争。
- 玩家通过神力命令改变世界条件，例如生成生命、放置资源、改变地形、闪电打击。
- Phaser 只负责表现层；模拟真源必须独立于 Phaser。

## v2 文档入口

| 文档 | 路径 | 用途 |
|---|---|---|
| 愿景 | `docs/VISION.md` | WorldBox 式核心循环、产品北极星和永久玩法规则 |
| 架构 | `docs/ARCHITECTURE.md` | 模拟真源、命令、事件、projection、Phaser 边界 |
| 机制 | `docs/MECHANICS.md` | 地图、单位、资源、神力、村庄、王国和战争规则草案 |
| 路线图 | `docs/ROADMAP.md` | 当前阶段、下一步、验收点和延后队列 |
| WorldBox 对齐计划 | `docs/WORLDBOX_ALIGNMENT_PLAN.md` | WorldBox 玩法调研、差距矩阵和未来分期路线 |
| 计划规范 | `docs/PLANNING.md` | 后续计划文档的状态口径、模板和防膨胀规则 |

旧版 M1 原型文档已被 v2 文档入口替换。后续不要引用旧 `GAME_DESIGN.md`、`TASK_BREAKDOWN.md`、`SIMULATION_CONTRACT.md` 等文件。

## 当前 v2 状态

当前整体阶段是 `Foundation prototype`，不是可玩 MVP。已实现内容用于验证 v2 架构方向，不能把它等同于完整 WorldBox 式游戏第一版。

| 阶段 | 状态 | 说明 |
|---|---|---|
| PR-0 原地清场 | 已完成 | 旧 `src` 和旧 `docs` 已替换为 v2 入口 |
| PR-1 纯模拟内核 | Foundation slice | `SimWorld`、`SimLoop`、seed RNG、命令队列、事件日志、命令拒绝已接入；正式回放/存档格式仍缺 |
| PR-2 地图/资源 | Foundation slice | 128 x 128 simulation 默认地图、256 x 256 交互 demo 地图、tile、chunk、biome、resource deposit 与 seed 地图生成已接入；资源独立索引和渲染裁剪仍缺 |
| PR-3 生命求生 | Foundation slice | hunger、hp、age、eat、wander、death、birth 已接入；1000 单位基础测试已补，行为仍是最小 needs loop |
| PR-4 Phaser Projection | Foundation slice | Scene 只读 projection，输入只发 command，源码级 sim 边界扫描已补，中文轻量 HUD、独立 UI camera、WASD/方向键移动、viewport-relative pan speed、Q/E 与 +/- 缩放、鼠标点滚轮缩放、默认 cover 视角和最小 contain 全图概览已接入；渲染路径已开始传入 camera viewport 做 projection culling，全量 projection 仍作为默认兼容路径保留 |
| PR-5 God Command | Foundation slice | 基础神力命令、命令校验和拒绝路径已接入；PR-13.1 已补分组可点击神力工具栏，PR-13.2 已补基础笔刷范围、越界目标和点击拒绝反馈，PR-13.3a/b 已补关注/追踪观察工具和事件后果时间线，PR-13.4a/b/c 已补基础地形目标限制、外交工具入口、底部后果反馈和最近神力事件聚合 |
| PR-6 村庄 | Done | 人口聚集和本地食物压力会形成村庄；村庄库存、住房容量、食物消耗、增长上限和衰退状态已接入 |
| PR-7 建筑和领土 | Done | 村庄 surplus 会自动建造 house、storage、farm，且 PR-12B 已补 town hall anchor、house 升级链、mine 矿址 hook、barrack 军队 hook 和 dock 岸线 hook；建筑影响住房、库存上限、食物生产、军队动员、未来航运入口和领土投射 |
| PR-8 王国 | Done | 稳定村庄会自动建国，同族村庄可加入同一王国，王国聚合首都、成员村庄、人口、建筑、领土和库存统计；首都在有效时保持稳定，失效后才按 town hall/建筑/人口重选 |
| PR-9 外交压力 | Done | 王国会根据边境摩擦、资源压力和种族倾向积累外交压力，并产生宣战事件 |
| PR-10 最小战争 | Done | 宣战会生成聚合军队组，军队可推进、结算伤亡、撤退/解散并占领村庄 |
| PR-11 规模门槛 | Done | `SimWorld.project()` 已支持 viewport culling，Phaser 已按 camera 视口取可见 tiles/units/territory/buildings/armies；PR-11A 测量 harness、PR-11B/PR-11D step phase profiling、PR-11C 村庄居民索引优化、PR-11E 单位行为降频和 PR-11F 重复居民索引重建移除已补；本地 10000 聚合人口 / 656 可见单位连续 5 次低于 16.7 ms；worker simulation 和 hot-data layout 留到更大目标按指标决定 |
| PR-12+ | Foundation slice | `PR-12A-D` 已完成检查面板、建筑链、职业资源和城市成长 foundation；`PR-12E/F` 已完成王国/战争可读性与文明成长主线的大部分 foundation；`PR-12G` 已完成忠诚、叛乱准备、分裂建国、parent-vs-rebel war、内战事件故事、支持者调参、密集冲突标签优先级和 `observe:rebellion` foundation。当前下一步是 `PR-13.5` 关注列表和对象历史。 |

进入 PR-12+ 时以 `docs/ROADMAP.md` 的 `Current Position` 和 `Active Work` 为准。
后续不得在本文件维护长篇历史状态；计划文档写法遵守 `docs/PLANNING.md`。
更大地图、worker simulation、hot-data layout 或资源索引继续由 `measure:scale` 的最慢阶段驱动。

## 目录结构

```txt
apps/world-sim/
├── docs/
│   ├── VISION.md
│   ├── ARCHITECTURE.md
│   ├── MECHANICS.md
│   ├── ROADMAP.md
│   ├── WORLDBOX_ALIGNMENT_PLAN.md
│   └── PLANNING.md
├── src/
│   ├── sim/          # 纯模拟核心，不允许 import Phaser
│   ├── game/         # Phaser 表现层，只读 projection
│   ├── test/         # Vitest setup
│   ├── main.ts
│   └── styles.css
├── assets/           # 可复用本地素材
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 局部红线

- MUST NOT 在 `src/sim` 中 import Phaser 或浏览器专属 API。
- MUST NOT 让 Phaser Scene 持有世界真源。
- MUST NOT 让 UI 直接修改 unit、tile、resource 或后续 village/kingdom。
- MUST 玩家输入统一转换为 `SimCommand`。
- MUST 模拟结果通过 `SimEvent` 和 `WorldProjection` 暴露。
- MUST 在新增或调整玩法、数值、神力、文明、战争、叛乱或可读性 UI 前使用 `worldbox-alignment-guard`，先分析 WorldBox 对应机制，再决定镜像、简化、延后或有意识地偏离。
- MUST 保持 WorldBox 式核心循环：玩家是神、世界自治、因果可读、干预有后果；如果不强化这条循环，先改设计形态或记录明确的偏离理由。
- MUST 新增玩法时同步更新 v2 文档入口中的对应章节。
- MUST 避免高频行为全图扫描；优先使用 chunk、空间索引或后续 Worker/TypedArray 热路径。

## 开发命令

```bash
pnpm --filter @valley/world-sim dev
pnpm --filter @valley/world-sim typecheck
pnpm --filter @valley/world-sim test
pnpm --filter @valley/world-sim measure:scale
pnpm --filter @valley/world-sim build
```

## 校验 Checklist

- [ ] 模拟或玩法改动：`pnpm --filter @valley/world-sim test`
- [ ] TypeScript 改动：`pnpm --filter @valley/world-sim typecheck`
- [ ] 入口或构建改动：`pnpm --filter @valley/world-sim build`
- [ ] 中文文档或文案改动：`python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/world-sim`

## Skill 路由

- 修改玩法、数值、模拟规则、神力、村庄、王国、外交、战争、叛乱或可读性 UI 前，使用 `worldbox-alignment-guard`。
- 修改玩法、架构、机制参数、路线图或文档时，使用 `game-doc-sync-guard`。
- 修改中文文档或中文 UI 文案时，使用 `encoding-guard`。
- 多步骤执行或重构时，使用 `task-completion-guard`。
