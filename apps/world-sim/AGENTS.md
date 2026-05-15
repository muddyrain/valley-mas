# WorldSim — 项目协作引导入口 (AGENTS.md)

> 本文件是 AI 在 `apps/world-sim` 内工作的调度入口。  
> 全局规则、Git 规则、Skill 选择以根目录 `AGENTS.md` 为准，本文件只补充本项目局部规范。

---

## 项目定位

**WorldSim** 是一个 2D 像素风沙盒文明模拟游戏：

- 玩家扮演**上帝**，不直接控制任何单位
- 文明（人类/兽人/精灵/矮人）从零开始**自主演化**
- 小人自动采集资源、建造、繁殖、组建军队、扩张领土、攻城略地
- 玩家通过**神力工具**干预世界（召唤、灾难、地形改造）
- 目标平台：**浏览器（Web 优先）**，Electron 打包为可选后期方向

---

## 文档索引

| 文档 | 路径 | 内容 |
|---|---|---|
| 架构合同 | `docs/ARCHITECTURE.md` | 渲染层、模拟层、数据层、Worker 层、依赖边界、状态真源 |
| 模拟合同 | `docs/SIMULATION_CONTRACT.md` | tick 顺序、命令模型、事件模型、确定性与失败处理 |
| 实体 Schema | `docs/ENTITY_SCHEMA.md` | World / Tile / Unit / Faction / Building / Event 等实体字段 |
| 内容定义 | `docs/CONTENT_DEFS.md` | 种族、职业、建筑、神力、事件等配置格式 |
| 存档格式 | `docs/SAVE_FORMAT.md` | 存档顶层字段、版本、迁移、导入导出、确定性要求 |
| 评测平衡 | `docs/EVAL_AND_BALANCE.md` | 指标、不变量、回放、压测、平衡方法 |
| 设计评审工作流 | `docs/DESIGN_REVIEW_WORKFLOW.md` | 熟练玩家、玩法评审、架构师、平衡数据等研发评审视角 |
| 游戏设计文档 (GDD) | `docs/GAME_DESIGN.md` | 世界观、系统设计、玩法、视觉风格、里程碑 |
| 任务拆分 | `docs/TASK_BREAKDOWN.md` | 40 个 Task，按 M0~M4 里程碑分阶段 |
| UI 设计文档 | `docs/UI_DESIGN.md` | 像素风 UI 规范、布局、美工资产清单、免版权资源推荐 |

---

## 技术栈

| 层级 | 选型 |
|---|---|
| 渲染引擎 | **Phaser 3**（WebGL，原生 Tilemap 支持）|
| 语言 | **TypeScript** |
| 构建 | **Vite** |
| AI 计算 | **Web Worker**（A* 寻路、FSM tick 不阻塞渲染）|
| 状态管理 | **Zustand** |
| 地形生成 | **simplex-noise** |
| 桌面打包 | **Electron**（可选，后期按需）|

---

## 目录结构（规划）

```
apps/world-sim/
├── AGENTS.md              ← 本文件，AI 协作入口
├── docs/
│   ├── ARCHITECTURE.md           ← 架构合同
│   ├── SIMULATION_CONTRACT.md    ← 模拟合同
│   ├── ENTITY_SCHEMA.md          ← 实体 Schema
│   ├── CONTENT_DEFS.md           ← 内容定义规范
│   ├── SAVE_FORMAT.md            ← 存档格式
│   ├── EVAL_AND_BALANCE.md       ← 评测与平衡
│   ├── DESIGN_REVIEW_WORKFLOW.md ← 设计评审工作流
│   ├── GAME_DESIGN.md            ← 游戏设计文档
│   ├── TASK_BREAKDOWN.md         ← 任务拆分
│   └── UI_DESIGN.md              ← UI 与资产规范
├── src/
│   ├── main.ts            ← 入口
│   ├── game/              ← Phaser 实例 + 场景
│   ├── world/             ← 地图、地形生成、迷雾
│   ├── agent/             ← 小人实体、FSM、寻路
│   ├── faction/           ← 势力、领土、外交
│   ├── systems/           ← SimLoop、战斗、资源、繁殖、时间
│   ├── god/               ← 神力工具
│   ├── workers/           ← Web Worker（寻路）
│   ├── ui/                ← HUD、小地图、工具栏
│   ├── store/             ← Zustand 全局状态
│   └── utils/             ← A*、噪声、随机数工具
├── assets/                ← 瓦片图、sprite、音效
├── electron/              ← Electron 主进程（M4 阶段）
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 当前开发状态

| 里程碑 | 状态 | 说明 |
|---|---|---|
| M0 技术验证 | 🚧 进行中 | Vite/TypeScript 子项目骨架已创建，Phaser 场景骨架尚未接入 |
| M1 最小原型 | ⏳ 未开始 | 地形生成、寻路、FSM、战斗、领土 |
| M2 完整循环 | ⏳ 未开始 | 全职业、文明升级、外交、神力 |
| M3 内容填充 | ⏳ 未开始 | 4 种族、怪物、随机事件 |
| M4 Web 性能优化 | ⏳ 未开始 | 渲染优化、AI 分帧、Worker 批处理、压测 |

> 当前下一步：继续完成 TASK-001 中的 Phaser 依赖接入，然后执行 TASK-002（Phaser 场景骨架）。

---

## 核心系统概览

进入某个系统开发时，先阅读 `docs/GAME_DESIGN.md` 对应章节；如果涉及分层、数据、存档或 tick 规则，再优先补读上面的合同文档，再开始编码。

| 系统 | 设计文档章节 | 核心文件（规划）|
|---|---|---|
| 地图与地形 | §3.1 | `world/WorldMap.ts`, `world/TerrainGenerator.ts` |
| 小人 Agent | §3.2 | `agent/Unit.ts`, `agent/StateMachine.ts` |
| 势力与领土 | §3.3 | `faction/Faction.ts`, `faction/Territory.ts` |
| 战争系统 | §3.4 | `systems/CombatSystem.ts` |
| 外交系统 | §3.5 | `faction/DiplomacySystem.ts` |
| 神力系统 | §3.6 | `god/GodPower.ts` |
| 时间系统 | §3.7 | `systems/TimeSystem.ts` |

---

## 开发命令（搭建后）

```bash
# 启动开发服务器
cd apps/world-sim && pnpm dev

# 类型检查
pnpm --filter @valley/world-sim typecheck

# 构建
pnpm --filter @valley/world-sim build
```

---

## 局部 Skill 路由

本项目使用一个专属 skill，存放于根目录 `.codex/skills/`，其他子项目不需要使用它：

| Skill | 触发场景 |
|---|---|
| `game-doc-sync-guard` | 修改游戏系统参数、玩法机制、种族/职业/建筑属性时，强制同步 `docs/` 内设计文档 |

全局 skill（`encoding-guard` / `task-completion-guard` 等）以根目录 `AGENTS.md` 为准。

---

## 校验 Checklist

- [ ] 改动后运行：`pnpm --filter @valley/world-sim typecheck`
- [ ] 新增中文文案或 Markdown：运行 encoding-guard 检查
- [ ] 新增大量单位逻辑：在浏览器 DevTools 中确认帧率 > 30fps
- [ ] 修改 Worker 通信协议：确认主线程与 Worker 消息格式一致

---

## 局部红线

- MUST NOT 在 `WorldScene` 主线程中运行 A* 寻路（必须走 Worker）
- MUST NOT 每帧全量重绘领土叠加层（必须用脏标记）
- MUST NOT 每帧对所有单位都跑完整 FSM（使用分帧 tick）
- MUST 所有游戏配置数据（种族属性、建筑属性、神力费用）集中在 `config/` 目录，不硬编码
- MUST 新增 sprite 资源先放 `assets/` 目录，不引用外部 CDN 资源
