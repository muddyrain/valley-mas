# 历史势力争霸沙盘模拟器 · 技术设计文档（TDD）

- 子项目：`apps/world-sim`
- 文档版本：v0.1（初始架构稿）
- 适用范围：纯前端沙盘模拟器，多势力在程序化生成的地图上扩张、对抗、兴衰；产物可在浏览器中长时间稳定运行并支持录屏
- 技术栈：React 18 + TypeScript 5 + PixiJS 8 + Zustand 4 + d3-delaunay 6 + simplex-noise 4 + Vite

> 命名说明：用户提到的 `apps/worldsim` 与仓库既有约定 `apps/world-sim` 不一致，本文按仓库既有约定（连字符）落地。TDD 不写源码，只描述设计与契约。

---

## 1. 产品目标与设计原则

### 1.1 产品目标
- 在程序化生成的随机地图上，模拟若干"历史势力"（人物 + 文化 + 兵种 + AI 风格）从 0 起步的扩张、对抗、外交、衰亡。
- 玩法节奏：以"年"或"季节"为模拟 tick，画面以高速回放的方式呈现版图变化、战争、迁徙、城市兴起，可暂停/加速/快退（仅基于历史回放的"软回退"）。
- 用户可在 UI 选择剧本（势力组合、地图形态、起始条件、规则参数）后开始一局，全过程在浏览器内运行，可直接屏幕录制成解说素材。

### 1.2 设计原则
1. **纯前端 / 无后端**：所有数据、模拟、渲染都在浏览器中完成；剧本与配置通过静态 JSON/TS 注入。
2. **可录屏友好**：渲染稳定 60 FPS；UI/HUD 可隐藏；时间轴推进可由"模拟驱动"切换为"挂钟驱动"，避免录屏卡顿造成时间错位。
3. **模拟与渲染解耦**：核心规则跑在确定性 ECS-lite 内核上，渲染层只读快照；可在不动渲染的情况下替换/扩展规则。
4. **数据驱动**：势力、人物、兵种、地形、事件、剧本均由数据表（TS/JSON）定义，便于后续加"三国/中国/世界/历史人物/公司争霸"剧本而不需要重写引擎。
5. **可长期扩展**：模块边界以"内核 / 规则 / 渲染 / UI / 剧本"五层划分，剧本只能依赖向下接口，不能反向污染内核。
6. **确定性优先，性能兜底**：核心模拟使用可种子化的 PRNG 与整型/定点策略；渲染与 UI 使用浮点。

---

## 2. 系统架构设计

### 2.1 总体分层

```
┌─────────────────────────────────────────────────────────────┐
│  Shell / App Layer (React)                                  │
│  - 路由、剧本选择、HUD、时间轴、势力面板、回放控制           │
├─────────────────────────────────────────────────────────────┤
│  Presentation Layer (PixiJS Renderer)                       │
│  - 地图层 / 势力版图层 / 单位层 / 标签层 / 特效层 / 调试层  │
│  - 摄像机、视口剔除、批次绘制、纹理 Atlas                    │
├─────────────────────────────────────────────────────────────┤
│  State Bridge (Zustand + Selectors + Snapshots)             │
│  - 持有 UI 状态 + 模拟 readonly 快照 + 订阅分发              │
├─────────────────────────────────────────────────────────────┤
│  Simulation Core (Pure TS, Worker-ready)                    │
│  - World、Tick Loop、ECS-lite Stores                         │
│  - Systems: Map / Faction / Economy / Military / Diplomacy  │
│              / Population / Event / History                  │
├─────────────────────────────────────────────────────────────┤
│  Foundation                                                  │
│  - PRNG、几何工具(d3-delaunay)、噪声(simplex-noise)、调度器  │
│  - 数据加载、剧本注册、事件总线、日志/录像                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 进程/线程模型
- **主线程**：React UI、Pixi 渲染、输入处理。
- **Worker（v1 起预留接口，v1.1 启用）**：模拟内核运行在 `simulation.worker.ts` 中，主线程通过 `postMessage` 拿"快照帧"与"事件流"。
- **通信协议**：双方使用 SharedArrayBuffer（可用时）或 transferable `ArrayBuffer` 传递地图/版图栅格；事件用结构化克隆的小对象。
- **Fallback**：未启用 Worker 时，模拟以 `requestAnimationFrame` 切片运行（每帧最多 X ms），保持 UI 响应。

### 2.3 时间模型
- **Sim Tick**：固定步长（默认 1 tick = 游戏内 1 季，4 tick = 1 年；UI 不展示内部 tick）。
- **Sim Speed**：UI 控制每秒执行多少 tick（暂停 / 0.5x / 1x / 2x / 4x / 8x / 16x）。
- **Render Frame**：60 FPS 上限；渲染只读最近一帧已发布的快照，不参与计算。
- **回放**：内核保留"历史关键帧 + 增量事件"；UI 可滑动时间轴回看，但不能改变历史（v1）。v2 引入"分支回放"。

### 2.4 关键非功能指标
| 指标 | 目标 |
|---|---|
| 首屏时间 | < 2.5s（剧本选择页） |
| 进入模拟首帧 | < 1.5s（地图生成 + 渲染就绪） |
| 稳态帧率 | 1080p / 中规模剧本（≤ 8 势力，≤ 1.5w 单位）≥ 60 FPS |
| 模拟吞吐 | 单 Worker ≥ 200 tick/s（中规模剧本，1x 渲染下） |
| 录屏稳定性 | 30 分钟连续运行无内存泄漏（Heap 增长 < 10%） |
| 长期扩展 | 新增剧本不改内核与渲染层；只改 `scenarios/*` 与必要的规则插件 |

---

## 3. 模块划分

### 3.1 顶层模块
1. **`core/`**：与 React/Pixi 无关的纯 TS 模拟内核。
2. **`renderer/`**：Pixi 渲染层，输入是 readonly 快照，输出是画面。
3. **`state/`**：Zustand store + selectors + 桥接订阅。
4. **`ui/`**：React 组件、HUD、面板、时间轴。
5. **`scenarios/`**：剧本数据与剧本注册器（三国 / 中国 / 世界 / 历史人物 / 公司争霸）。
6. **`workers/`**：Worker 入口与协议封装。
7. **`shared/`**：通用类型、PRNG、几何、调度器、事件总线。
8. **`debug/`**：调试 HUD、性能采样、确定性回放工具。

### 3.2 内核子模块（`core/`）
- `world/`：世界容器、Tick Loop、ECS-lite stores（SoA 数据布局）。
- `map/`：地形生成（noise + plates）、Voronoi 区域、河流/海洋/可耕度。
- `faction/`：势力定义、领袖、文化、AI 性格。
- `population/`：人口、迁徙、城市生长。
- `economy/`：粮食、税收、生产、补给。
- `military/`：军队、兵种、行军、战场结算。
- `diplomacy/`：关系、同盟、宣战、和约、附庸。
- `event/`：事件触发器（天灾、英雄诞生、剧本钩子）。
- `history/`：历史事件流、关键帧快照、回放索引。
- `ai/`：势力 AI 决策（行为树 / 效用打分 / 任务队列）。
- `rules/`：可插拔规则插件，剧本可在此注入或覆盖。

### 3.3 渲染子模块（`renderer/`）
- `stage/`：Pixi Application、Camera、Layer 管理。
- `layers/`：
  - `terrain`：底图（高度/生物群落，烘焙后纹理 + tilemap chunk）。
  - `territory`：势力版图（颜色填充 + 边界线，使用版图栅格 + 动态 mesh）。
  - `units`：军队/部队符号（Sprite + InstancedBatch）。
  - `cities`：城市、首都、要塞图标（带等级动画）。
  - `effects`：战场特效、迁徙箭头、宣战闪烁。
  - `labels`：势力名、城市名、人物头像（LOD 控制）。
  - `debug`：网格、寻路、性能图层。
- `pipelines/`：纹理 Atlas、Mesh 重建、Dirty Rect 调度。
- `bridge/`：从 store/快照拉取数据并 diff 到渲染对象池。

### 3.4 UI 子模块（`ui/`）
- `pages/`：`SetupPage`（剧本选择）、`SimPage`（主画面）、`PostGamePage`（年表 / 历史回看）。
- `hud/`：顶部时间条、速度控制、势力小图标条。
- `panels/`：势力详情、城市详情、外交矩阵、年表、设置。
- `overlays/`：战争弹窗、剧本事件弹窗、教学层。
- `controls/`：通用控件（图标按钮、滑块、矩阵、时间轴）。

---

## 4. 目录结构设计

> 所有路径以 `apps/world-sim/` 为根。

```
apps/world-sim/
├─ AGENTS.md                       # 子项目协作入口（后续补，本 TDD 内未写）
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ public/
│  └─ assets/                      # 静态贴图、字体、图标
├─ docs/
│  ├─ TDD.md                       # 本文件
│  ├─ PLAN.md                      # 产品/迭代计划（后续）
│  ├─ DATA-MODEL.md                # 数据结构详解（后续）
│  └─ scenarios/                   # 各剧本设计文档
└─ src/
   ├─ main.tsx                     # React 入口
   ├─ App.tsx                      # Shell + Router
   ├─ shared/
   │  ├─ types/                    # 全局基础类型
   │  ├─ math/                     # PRNG、向量、几何包装
   │  ├─ events/                   # EventBus、事件类型
   │  ├─ scheduler/                # 帧调度、时间预算
   │  └─ utils/
   ├─ core/
   │  ├─ index.ts                  # createWorld / runTick 出口
   │  ├─ world/
   │  │  ├─ World.ts               # 世界容器
   │  │  ├─ TickLoop.ts            # 固定步长循环
   │  │  ├─ stores/                # SoA 实体仓库
   │  │  └─ snapshots/             # 快照与差分
   │  ├─ map/
   │  │  ├─ generator.ts           # noise + plate
   │  │  ├─ regions.ts             # d3-delaunay Voronoi
   │  │  ├─ rivers.ts
   │  │  ├─ biomes.ts
   │  │  └─ pathfinding.ts         # 区域级 A* / Flow Field
   │  ├─ faction/
   │  │  ├─ Faction.ts
   │  │  ├─ Leader.ts
   │  │  ├─ Culture.ts
   │  │  └─ traits.ts
   │  ├─ population/
   │  ├─ economy/
   │  ├─ military/
   │  ├─ diplomacy/
   │  ├─ ai/
   │  │  ├─ behaviors/             # 行为树节点
   │  │  ├─ utility/               # 效用打分
   │  │  └─ orders.ts              # 命令队列
   │  ├─ event/
   │  ├─ history/
   │  └─ rules/
   │     ├─ registry.ts            # 规则注册器
   │     └─ default/               # 默认规则插件集
   ├─ renderer/
   │  ├─ index.ts                  # createRenderer
   │  ├─ stage/
   │  │  ├─ App.ts                 # Pixi Application
   │  │  ├─ Camera.ts
   │  │  └─ Layers.ts
   │  ├─ layers/
   │  │  ├─ TerrainLayer.ts
   │  │  ├─ TerritoryLayer.ts
   │  │  ├─ UnitsLayer.ts
   │  │  ├─ CitiesLayer.ts
   │  │  ├─ EffectsLayer.ts
   │  │  ├─ LabelsLayer.ts
   │  │  └─ DebugLayer.ts
   │  ├─ pipelines/
   │  │  ├─ AtlasManager.ts
   │  │  ├─ TerritoryMesh.ts
   │  │  └─ DirtyRect.ts
   │  └─ bridge/
   │     ├─ snapshotDiff.ts
   │     └─ syncToScene.ts
   ├─ state/
   │  ├─ store.ts                  # Zustand root
   │  ├─ slices/
   │  │  ├─ uiSlice.ts             # 选中、面板、HUD 显隐
   │  │  ├─ simSlice.ts            # 速度、暂停、tick、快照引用
   │  │  ├─ scenarioSlice.ts       # 当前剧本配置
   │  │  └─ replaySlice.ts         # 时间轴、关键帧
   │  ├─ selectors/
   │  └─ subscribe.ts              # 与 core/renderer 的桥接
   ├─ ui/
   │  ├─ pages/
   │  ├─ hud/
   │  ├─ panels/
   │  ├─ overlays/
   │  ├─ controls/
   │  └─ theme/
   ├─ scenarios/
   │  ├─ registry.ts               # 剧本注册器
   │  ├─ schema.ts                 # 剧本 JSON schema 类型
   │  ├─ random/                   # 默认随机剧本（v1）
   │  ├─ three-kingdoms/           # 三国剧本（v2 起）
   │  ├─ china/                    # 中国地图剧本（v2+）
   │  ├─ world/                    # 世界地图剧本（v2+）
   │  ├─ historical-figures/       # 历史人物剧本
   │  └─ company-wars/             # 公司争霸剧本
   ├─ workers/
   │  ├─ simulation.worker.ts
   │  └─ protocol.ts
   └─ debug/
      ├─ HUD.tsx
      ├─ profiler.ts
      └─ replayInspector.tsx
```

---

## 5. 状态管理设计

### 5.1 状态分层
| 层 | 持有方 | 写入方 | 读取方 |
|---|---|---|---|
| **Sim State**（权威） | `core/world/World` | 仅内核内 systems | 内核内部、快照导出 |
| **Snapshot**（只读帧） | `core/world/snapshots` | 内核每 N tick 发布 | 渲染层、Zustand `simSlice` |
| **Bridge State** | Zustand `simSlice` | snapshot 订阅器 | UI、渲染入口 |
| **UI State** | Zustand `uiSlice` 等 | UI 组件 | UI、渲染（如选中高亮） |
| **Scenario Config** | Zustand `scenarioSlice` | 剧本选择页 | 内核启动参数 |

### 5.2 Zustand Slices
- `simSlice`
  - `tick: number`、`speed: SpeedTier`、`paused: boolean`
  - `snapshotRef: { id: number; data: Snapshot }`（不直接存大对象，存指针/版本号）
  - `lastEvents: GameEvent[]`（环形缓冲，UI 通知用）
- `uiSlice`
  - `selectedFactionId?: FactionId`、`selectedRegionId?`
  - `hudVisible: boolean`（录屏隐藏）
  - `openedPanels: Set<PanelKey>`
  - `theme: 'light' | 'dark'`
- `scenarioSlice`
  - `scenarioId: string`
  - `seed: string`
  - `params: Record<string, unknown>`（剧本 schema 校验过）
- `replaySlice`
  - `mode: 'live' | 'replay'`
  - `cursorTick: number`
  - `keyframes: KeyframeIndex[]`

### 5.3 订阅与桥接
- 内核完成一帧 → `publishSnapshot(snapshot)` →
  1. 写入 ring buffer（最近 N 帧用于 UI/diff）。
  2. 通过 `simSlice.set` 发布"指针 + 版本号"。
  3. 触发 `subscribeWithSelector` 回调；渲染层用 `snapshotDiff` 决定哪些 layer 需要 dirty。
- UI 不直接订阅大对象；只订阅"摘要字段"（如势力得分、tick、当前事件计数），避免重渲染风暴。
- 选中态使用 `useStoreWithEqualityFn` + 浅比较，所有列表面板按 ID 绑定。

### 5.4 持久化
- 局内：`localStorage` 存 UI 偏好（速度、HUD 显隐、主题）。
- 存档：v1 仅支持"导出当前世界 JSON"；v2 支持"完整存档（种子 + 关键事件流）"导入导出，便于复盘。

---

## 6. 数据结构设计

### 6.1 ECS-lite 总览
- 实体类型固定且数量上限可估，使用 **SoA（Structure of Arrays）** + 槽位 ID 复用。
- 实体包括：`Region`、`City`、`Army`、`Leader`、`Faction`、`Battle`、`Event`。
- 每类实体一个 `Store`，内部用并行的 `Float32Array / Uint32Array` 等 TypedArray 表示组件字段，便于 Worker 传输与 SIMD 友好。

### 6.2 关键实体（字段为示意，不写代码）
- **Region（地图最小政治单元）**
  - `id`, `centroidX/Y`, `area`, `terrain`, `biome`, `fertility`, `defenseBonus`
  - `ownerFactionId`（0 表示无主）
  - `populationCount`, `loyalty`, `unrest`
  - `cityId`（可选）、`adjacency: RegionId[]`
- **City**
  - `id`, `regionId`, `tier`(村/镇/城/都), `population`, `economy`, `walls`, `garrisonArmyId`
- **Army**
  - `id`, `factionId`, `posRegionId`, `targetRegionId?`, `morale`, `supply`
  - `composition: { unitTypeId: count }`（轻量映射，存为定长结构）
  - `state`（`idle | moving | besieging | retreating | engaged`）
- **Leader / HistoricalFigure**
  - `id`, `factionId?`, `traits`, `skill: { command, politics, charisma }`
  - `lifeSpan: { birthTick, deathTick? }`、`role`（君主/统帅/谋士）
- **Faction**
  - `id`, `name`, `cultureId`, `colorHex`, `capitalRegionId`
  - `aiProfile`（保守/扩张/外交/掠夺等枚举 + 权重表）
  - `treasury`, `manpower`, `prestige`
  - `relations: Map<FactionId, RelationState>`
- **Battle / Event / Edict**：以"事件实体"形式入历史流，便于回放。

### 6.3 地图数据
- **Heightmap**：`Float32Array(width * height)`，由 simplex-noise 多 octave 合成。
- **Plates**：随机种子生成的板块，决定大陆/海洋/山脉走向（可选 v1.1）。
- **Voronoi Regions**：使用 `d3-delaunay` 在 N 个采样点上生成 Voronoi 单元；每个单元 = 一个 `Region`。
- **Adjacency Graph**：从 Delaunay 边推导；用于扩张、行军、外交。
- **River/Coast**：从高度图沿梯度下降+合并，结果存为折线集合。

### 6.4 版图栅格（Territory Raster）
- 一张与画面 1:4 或 1:8 分辨率的 `Uint16Array`，记录每像素属于哪个 `factionId`。
- 用于：
  - 快速渲染版图填充（GPU 上传为单通道纹理 + LUT 着色）。
  - 边界提取（Sobel / 邻居比较）→ 描边。
  - 截图/录屏静态背景层。
- 当 `Region.ownerFactionId` 改变时，仅 dirty 该 region 覆盖的栅格区域。

### 6.5 历史与事件流
- `HistoryStore` 是不可变 append-only 列表 + 关键帧索引：
  - 每 K tick 存一个关键帧（精简快照：版图栅格 + 势力得分）。
  - 之间的变化以事件序列（征服、立国、覆灭、宣战、和约、英雄诞生/死亡）记录。
- 用于：年表面板、时间轴、回放、导出"史书"。

### 6.6 剧本数据契约
- `Scenario`
  - `id`, `name`, `description`, `version`
  - `mapPreset`：`{ kind: 'random' | 'fixed'; params }`
  - `factions: FactionSeed[]`
  - `figures: HistoricalFigureSeed[]`
  - `rulesOverrides: RulePatch[]`
  - `events: ScripedEvent[]`
  - `winConditions: WinCondition[]`
- 所有剧本通过 `scenarios/registry` 在编译期注册，不依赖网络。

---

## 7. 渲染架构设计

### 7.1 Pixi 应用结构
- 单个 `Application`，启用 `autoDensity` + `resolution = devicePixelRatio` 上限 2。
- 顶层 `Stage` → `WorldContainer`（受 Camera 控制） → 各 `Layer`。
- 各 Layer 内部按"对象池"管理 Sprite / Graphics / Mesh，不每帧重建。

### 7.2 Layer 分工与刷新策略
| Layer | 数据来源 | 刷新策略 |
|---|---|---|
| Terrain | 烘焙纹理（生成期一次） | 仅在缩放跨档时切换 mip 纹理 |
| Territory | 版图栅格 + 势力色 LUT | 受 dirty rect 触发；着色用 shader（`Filter`）或 `MeshMaterial` |
| Cities | City Store | 按版本号 diff，仅增删变 sprite |
| Units | Army Store | 大量对象使用 `ParticleContainer` 或 `Mesh` 批次绘制 |
| Effects | EventBus 推送 | 短生命周期 sprite，结束自动回池 |
| Labels | UI 选项 + LOD | 缩放档位决定可见集合 |
| Debug | 内部信号 | 仅开发模式下显示 |

### 7.3 摄像机与视口
- Camera 维护 `x, y, zoom`，支持鼠标/触控拖拽与缩放、键盘平移、聚焦势力/城市动画。
- 视口剔除按 `Region.bounds` 与 `City.bounds` 过滤；Units 用网格分桶（按地图分块 grid）。
- LOD：
  - 远景：版图色块 + 势力大字 + 简化标签
  - 中景：城市图标 + 简化兵种符号
  - 近景：详细兵种、人物头像、特效

### 7.4 Snapshot → Scene 的同步
- 每个发布的快照带 `version`、`changeSet`：
  - `addedEntities`, `removedEntities`, `dirtyEntities`
  - `dirtyRegions`（用于版图栅格局部更新）
  - `events`（用于特效层）
- `bridge/syncToScene.ts` 按 changeSet 增量更新渲染对象池；从不全量重建。
- 渲染层永远读"已发布的最近一帧"，避免读到正在被内核改写的中间态。

### 7.5 文本与图标
- 标签使用 `BitmapText`（中文字体子集化预生成），杜绝 CanvasText 卡顿。
- 图标走 `Spritesheet` + `Atlas`；势力色通过 tint 着色，避免重复贴图。

### 7.6 录屏支持
- "录屏模式"：
  - 隐藏 HUD（按 `H`）。
  - 切换到挂钟驱动：1 秒固定推进 N tick，避免速度波动导致录屏抖动。
  - 关闭 React DevTools/Debug Layer。
  - 提供"自动 letterbox"以适配 16:9。
- 不内置 MediaRecorder（避免膨胀），但提供"录屏指南"与可隐藏 UI、可固定速率，实际录屏交给系统/OBS。

---

## 8. 性能方案设计

### 8.1 计算性能
1. **固定步长 + 时间预算**：UI 帧最多花 8 ms 在模拟，余下给渲染；超出预算则暂存任务到下一帧。
2. **Worker 化模拟**：v1.1 起把内核搬到 `simulation.worker.ts`；快照通过 `transferable` 传输；UI 与渲染零阻塞。
3. **SoA 布局 + TypedArray**：势力数 ≤ 32、单位数 ~万级；用 TypedArray 而非对象数组，缓存友好、GC 压力小。
4. **空间分桶**：地图按固定 chunk（例如 64×64 像素或区域聚类）建桶，邻近查询/视口剔除/AOE 计算 O(k)。
5. **批量决策**：势力 AI 不每 tick 全跑；按"政策 tick / 战术 tick / 战略 tick"分层（如 1 / 4 / 16 tick），分摊算力。
6. **PRNG 与确定性**：所有随机基于种子化 PRNG（如 mulberry32），保证同种子可复现，便于回放与回归。
7. **事件优先于轮询**：势力关系、战争结算等通过事件触发，避免每 tick 全图扫描。

### 8.2 渲染性能
1. **批次合并**：同 atlas 的 sprite 一次提交；标签 BitmapText 复用 buffer。
2. **Dirty Rect**：版图栅格只上传变化区域；Cities/Armies 只 diff 变化项。
3. **LOD + 视口剔除**：远景隐藏 unit 个体，只显示版图与城市图标；近景才生成兵种动画。
4. **避免每帧 new**：渲染对象池化，事件/特效短期实例预分配。
5. **节流**：势力名/数字 HUD 0.5s 一次；不每帧重排版。
6. **GPU 优先**：势力色着色用 shader（fragment 层 LUT），避免 CPU 重新填充栅格。

### 8.3 内存与稳定性
- 历史事件流上限：超过阈值滚动到 IndexedDB（v2）；v1 保留最近 K 万条。
- 关键帧最多保存 M 张（默认 60）；老的合并/丢弃。
- 监控：Debug HUD 实时显示 tick/s、fps、heap、layer drawcalls，便于回归。

### 8.4 输入与交互
- 输入事件去抖，缩放/拖拽走 RAF 节流。
- 大型 select（势力列表）使用虚拟列表。
- 重计算（如打开外交矩阵）懒加载，关闭面板立即释放。

---

## 9. 后续扩展方案设计

### 9.1 剧本扩展（核心扩展点）
- **接入方式**：在 `scenarios/<id>/index.ts` 中导出符合 `Scenario` 契约的对象，并在 `scenarios/registry.ts` 注册；剧本可：
  - 提供 `mapPreset`（包括 fixed 地图：上传 PNG 高度图 + 区域多边形 JSON）。
  - 注入 `factions` / `figures` / `cultures` 数据。
  - 通过 `RulePatch` 覆盖默认规则参数（不直接改 core）。
  - 注册脚本事件（按 tick/条件触发）。
- **目标剧本路线图**：
  - **三国剧本**：固定中国地图 + 184/220/263 多个起始时间点；预置魏蜀吴及群雄；引入"汉室正统/僭越"政治字段。
  - **中国地图剧本**：高保真中国行政区/历史九州地图，可换皮做朝代模拟。
  - **世界地图剧本**：低多边形世界地图；势力以"现代国家/古文明"开局。
  - **历史人物剧本**：以"个人传记"为主线，势力围绕单人英雄生成；引入"威望/年龄/继承"专属规则。
  - **公司争霸剧本**：把"区域=市场份额"，势力=公司，兵种=产品线，外交=合并/收购；只换数据与表现层，不动内核。

### 9.2 规则插件化
- `core/rules/registry` 提供 `register(rule)`，每条规则声明：
  - 监听的 system hook（如 `onYearTick`、`onBattleResolve`、`onFactionFounded`）。
  - 可写字段白名单（避免乱改全局状态）。
  - 优先级与互斥关系。
- 剧本通过 `RulePatch` 增/删/调权重，不需要 fork 内核。

### 9.3 国际化与文化包
- `i18n/`：默认 `zh-CN`，预留 `en-US`；剧本字符串归剧本目录，引擎字符串归引擎。
- 文化包：兵种贴图、城市样式、字体、UI 主色由剧本提供 `assetPack` 字段，运行期按需加载。

### 9.4 持久化与分享
- v1：导出 PNG 截图、JSON 历史年表。
- v2：导出"复盘种子"（剧本 + 种子 + 设置）一键复现整局。
- v3：导出 WebM/GIF（基于 OffscreenCanvas + MediaRecorder）。

### 9.5 模组与编辑器
- v3+：内置"剧本编辑器"页面，可在浏览器内拖拽配置势力/地图/事件，导出 JSON 剧本，零代码扩展。

### 9.6 兼容根项目协作约定
- `apps/world-sim/AGENTS.md`：后续补 WorldSim 子项目协作入口（路由、命名、规则）。
- `apps/world-sim/docs/PLAN.md`：作为唯一计划文档，受 `game-doc-sync-guard` 约束。
- 任何玩法/参数/架构改动需要同步本 TDD、PLAN 与对应剧本设计文档（受 `game-doc-sync-guard` 与根 `AGENTS.md` 红线约束）。
- 由于本项目定位与既有"WorldBox 式沙盒"略有不同，后续根级文档（`docs/PROJECT_GUIDE.md` 与根 `AGENTS.md` 的 WorldSim 描述）需要在确认后同步更新；TDD 仅描述设计，不改动这些文档。

### 9.7 GeoJSON 地图源（Phase 10 新增）
- **定位**：地图来源由"随机生成"扩展为"随机 + 真实地理 GeoJSON"，模拟内核（争夺/地形权重/事件/剧本）保持不变；只替换 `MapData` 的产出方。
- **核心入口**：`core/map/geojson.ts` 提供 `buildMapFromGeoJSON(raw, options)`，负责 `FeatureCollection → MapData` 的转换：
  - 仅接受 `Polygon`/`MultiPolygon`；MultiPolygon 取面积最大的 outer ring 作为渲染主多边形，所有 ring 仍参与邻接推导。
  - equirectangular 投影到目标 `bounds`（保纵横比、居中），不使用 mercator，避免高纬变形。
  - 通过 quantize 后的有向边 hash 推导邻接：同一条边出现在 2+ feature 即邻居，仅一次即外边界。
  - 调用既有 `assignTerrains` 给每个 region 分配 elevation/moisture/terrain，与 random 地图共用同一套地形模型。
- **地图源注册表**：`core/map/sources.ts` 声明 `GeoMapId = 'china-province' | 'china-city' | 'world-country' | 'us-state'`，每个 source 提供 `defaultUrl`、`nameProperty`、`bounds` 与稳定 seed（`defaultSeedFor`）。运行期通过 `fetch` 加载，不打包 GeoJSON 数据；用户可在 `apps/world-sim/public/geo/<id>.json` 放离线副本，或通过 `loadGeoMap({ url })` 替换 CDN。
- **状态层**：`mapSlice` 引入 `mapSource: 'random' | GeoMapId`、`geoRegionNames`、`geoLoadStatus`（idle/loading/ok/error）、`geoLoadError`，新增 `loadGeoMap(id, options)` 异步动作。加载完成后会复用 `loadScenario(currentScenarioId)`，确保剧本（势力/出生点）在新地图上重新落地。
- **UI 入口**：Sidebar 新增"地图来源"面板，提供"随机生成 / 中国省份 / 中国地级市 / 世界国家 / 美国州"5 个按钮；加载中禁用、出错时展示 `geoLoadError`。Inspector 在 GeoJSON 模式下展示中文行政区名（`{name}（#id）`）。
- **不变量**：`Province / BorderEdge / MapData` 结构、Phase 5 模拟内核、Phase 6 日志、Phase 8 剧本系统、Phase 9 编辑模式均零改动；GeoJSON 地图与 random 地图在下游一视同仁。

### 9.8 Replay System（Phase 11 新增）
- **定位**：在不动模拟内核与渲染层的前提下，把每个 sim tick 的副作用结构化记录下来，支持暂停/快进/慢放/拖动时间轴/导出 JSON/导入 JSON 与重新观看完整历史。
- **数据结构**：`shared/types/replay.ts`
  - `ReplayPatch { regionId, from, to }`：本 tick 内州归属变化（plain number，便于 JSON 化）。
  - `ReplayRankingRow { factionId, regions }`：本 tick 结束后排行榜行（仅 regions，名字/颜色由 baseline 索引）。
  - `ReplayFrame { tick, patches, events, rankings, status, winnerFactionId }`：单 tick 帧。
  - `ReplayDoc { version, exportedAt, meta, initialOwnership, initialFactions, frames }`：完整可导出文档；`meta` 含 seed / provinceCount / mapSource / scenarioId / totalTicks。
  - `ReplaySpeed = '0.25x'|'0.5x'|'1x'|'2x'|'4x'|'8x'` + `REPLAY_SPEED_MULTIPLIER`。
- **状态层**：新增 `state/slices/replaySlice.ts`，挂到 `WorldSimStore`。
  - 字段：`replayMode`（recording / replaying）、`replayPlaying`、`replaySpeed`、`replayCursor`、`replayFrames`、`initialOwnership`、`initialFactions`、`baselineScenarioId`、`replayMessage`。
  - 动作：`captureBaseline / recordFrame / enterReplayMode / exitReplayMode / toggleReplayPlay / setReplaySpeed / stepReplay / seekReplay / exportReplayToJson / importReplayFromJson`。
  - 内部 `rebuildWorldUpToCursor`：从 `initialOwnership` 复制，按 `frames[0..cursor)` 应用 patches；同时聚合 events、重建 factions（regions 重新统计、name/leader/color 用 initialFactions 还原）、写回 `map/factions/logs/tick/status/winnerFactionId/snapshotVersion`。logs 末端按 `MAX = 1000` 截断。
- **录制时机**：`captureBaseline()` 由 `loadScenario` / `resetBattle` 在结束设置后立即调用；`mapSlice.regenerateMap` / `loadGeoMap` 通过末尾的 `loadScenario(currentScenarioId)` 间接触发。`simSlice.driveOneTick` 写完 `set` 后，仅当 `replayMode === 'recording'` 时把 `patches/events/rankings/status/winnerFactionId` 打包成 `ReplayFrame` 调 `recordFrame`，cursor++。
- **回放驱动**：`App.tsx` 主 RAF 在 `replayMode === 'replaying'` 时优先：累积 `dt * REPLAY_SPEED_MULTIPLIER * BASE_TICKS_PER_SECOND`，每帧最多 `stepReplay(8)`；到达末尾自动暂停。`replayMode === 'recording'` 时走原有 sim 推进逻辑，互不交叉。
- **UI**：`ui/replaybar/ReplayBar.tsx` 居于 LogPanel 之上的 HUD 中。
  - 左：title + 模式 chip（录制中 / 回放中）+ `cursor / total`。
  - 中（仅回放）：← / 播放暂停 / → / range 时间轴（`min=0 max=total`）。中（录制）：提示文案。
  - 右：6 档倍速（仅回放可见）、进入回放 / 退出回放、导出 JSON、导入 JSON（隐藏 file input）。
  - 导出：`Blob` + `URL.createObjectURL` 触发下载，文件名 `worldsim-replay-<ISO>.json`。
- **导入兼容**：`importReplayFromJson` 校验 version、provinceCount 与当前地图一致，落地后切到 `replayMode = 'replaying'`、`replayPlaying = false`、`cursor = 0`，并立即 `rebuildWorldUpToCursor(0)`。
- **不变量**：模拟内核（`core/sim`）、地图层（`core/map`）、剧本系统（`core/scenario`）、编辑模式（`editSlice`）、Phase 10 GeoJSON 加载链路均零改动；Replay 仅依赖 `RegionId / FactionId` 索引，与地图来源无关，random / GeoJSON / 编辑后导入的地图均可录制与回放。

### 9.9 Territory Warfare Refactor（Phase 8.5 新增）

把势力扩张从"百级州 + 全表扫描"升级到"千级州 + 增量推进 + 欧陆风云视觉"。十项实施目标：

1. **3000 州预设**：`mapSlice.ProvincePreset` 扩展为 `100 | 300 | 500 | 1000 | 3000`，`PROVINCE_PRESETS` 同步；Sidebar 数量切换按钮自动派生，无须 UI 单独改。
2. **势力名称钉到领土中心**：`drawFactionLabels` 优先使用 `f.centroidRegionId` 对应州的中心；缺失时回退到聚合 centroid。
3. **半透明势力染色**：`drawOwnerOverlay` 的 `targetAlpha` 由 `0.95` 下调到 `0.78`，让地形仍能透出，色块不再压死底图。
4. **势力边界高亮**：`redrawBorders` 区分四种情形——外边界 / 同势力内部（跳过）/ 跨势力（势力色 darken 0.55，宽 1.6）/ 双边无主（淡灰细线 0.5）。
5. **每 Tick 40–100 次扩张（终局 ×2）**：`runExpansionTick` 默认 `attempts = clamp(势力数 × 16, 40, 100)`；当已占领州数超过 95% 或存活势力 ≤3 时尝试次数翻倍，避免 3000 州下"前期速胜、后期疲软"。
6. **Frontline 系统**：`expansion.ts` 内部维护 `FactionRuntime { id, border: Set<RegionId>, totalRegions }`；每次 owner 变化只对该州 + 邻居调用 `applyOwnerChange / refreshBorderState` 局部 patch，避免每 attempt 全表扫。
7. **避免飞地**：扩张内核结构上仅沿 `border` 邻居推进 → 不会产生新飞地。dev 模式 `assertContiguous` 用 BFS 检测每势力 owned 的连通分量是否唯一，`> 1` 就 `console.warn`。
8. **首都系统**：`FactionSummary.capitalRegionId`；新建势力默认设为 `birthRegionId`，导出导入剧本与 Replay 时随同写入。
9. **领土重心**：`FactionSummary.centroidRegionId`；`simSlice.driveOneTick` 在 patches 应用后调用 `computeCapitalsAndCentroids(nextMap, factions)`：聚合 owned centroid 平均、找最近 owned region 当 centroid；若 `provinces[capital].ownerFactionId !== self.id` 则迁都到 centroid。
10. **欧陆风云视觉**：MapCanvas 新增 `markerLayer`（介于 owner 与 label 之间）画首都金色菱形 `#f6c453` + 暗色描边；标签字体改为 serif italic（Garamond / Times / 中文宋体回退）+ letter-spacing 1.5 + 米黄色 `#f6e7c1` 填充 + 黑色 4px outline。

**Replay 兼容性升 v2**：`REPLAY_DOC_VERSION = 2`，`ReplayInitialFaction` 新增 `capitalRegionId`；`importReplayFromJson` 同时接受 `version === 1`（缺失字段时 fallback 为 `birthRegionId`）与 `version === 2`，rebuild 时给每个 faction 写 capital/centroid。

**性能预算**：3000 州 × 60 FPS。Pixi ticker 仅在 `ownerAnims.size > 0` 时重画 ownerLayer；borderLayer / labelLayer / markerLayer 仅在 `factions` 引用变化时重画（每 tick 一次）；ownerLayer 颜色采用 lerp + ease-out cubic 600ms 动画。

**势力命名规范**（避免「势力·甲 / 未知君主」占位文案）：

- 默认池统一抽到 `core/scenario/defaults.ts`：`DEFAULT_FACTION_NAME_POOL`（20 个朝代名）+ `DEFAULT_LEADER_POOL`（16 位历史君主）+ `NAME_LEADER_PRESET`（朝代→君主预设，如 蜀汉→刘备 / 大唐→李世民）。`state/slices/factionSlice.ts` 通过 `import { ... } from '@/core/scenario'` 获取并 re-export，保证 `state/index.ts` 对外接口稳定。
- 随机剧本 `RANDOM_SCENARIO` 不再写死 `factions`，改为 `factionsFactory(rng)`：每次加载抽 `RANDOM_FACTION_COUNT = 8` 家不重名势力（4 家在 3000 州下死亡 1-2 家就空场，8 家在标签可读性 + 早期容错上更平衡）。`scenarioSlice.loadScenario` 在执行 `applyScenarioToWorld` 前用 factory 替换 `scenario.factions`。
- 中外政体**互不混配**：中文池走 `DEFAULT_FACTION_NAME_POOL` + `NAME_LEADER_PRESET` / `DEFAULT_LEADER_POOL`；国外政体抽 `WORLD_POLITY_PAIRS`（如 `法兰西帝国 + 拿破仑` / `第三帝国 + 希特勒` / `苏维埃 + 斯大林` / `大英帝国 + 维多利亚`），政体名与领袖整组打包出现，避免「大唐 + 拿破仑」「大宋 + 斯大林」这类跨时空违和组合。`FOREIGN_POLITY_RATIO = 0.3` 控制国外政体出现概率（8 家中平均 2-3 家）。
- 随机剧本支持「中文 / 国外」独立开关：`scenarioSlice.randomScenarioOptions = { includeChinese, includeForeign }`，UI 在 Sidebar 剧本卡片下方加 checkbox（默认两边都开），切换时 `setRandomScenarioOptions` 自动重抽。两边都关闭时由工厂兜底强制开启中文，避免 0 家势力；只开一边时 `factionsFactory` 跳过概率切换、整批走对应池。`Scenario.factionsFactory` 签名升级为 `(rng, options?: ScenarioFactoryOptions) => ScenarioFaction[]`。
- 色板扩到 16 色硬编码（与 `factionSlice.FACTION_COLOR_PALETTE` 同源），8 家以下不会重复色相。
- `apply.ts.pickLeader` 优先级：剧本显式 leader → `NAME_LEADER_PRESET[factionName]` → `DEFAULT_LEADER_POOL` 未占用名 → `index % len` 循环回退（不再使用「未知君主」字面量）。
- Sidebar 新建势力 `pickFreeName`：默认池命中即可；池用尽走 `FALLBACK_NAME_PREFIXES × FALLBACK_NAME_SUFFIXES` 朝代字头/字尾随机拼接，再用尽才以「汉2 / 汉3」形式拼序号，避免出现「势力1 / 势力·甲」占位。

**州数规模与性能预期**（`PROVINCE_PRESETS = [500, 1000, 2000, 3000, 10000]`，默认 `3000`）：

| 州数 | generate 用时 | sim tick FPS | ownerLayer 重画 | 标签可读性 | 备注 |
|---|---|---|---|---|---|
| 500 | < 30 ms | 60 | 极快 | 优 | 调试用，势力扩张 5-10 tick 见胜负 |
| 1000 | < 80 ms | 60 | 流畅 | 良 | 入门体验，地形对比清晰 |
| 2000 | < 200 ms | 60 | 流畅 | 良 | 中等规模，类 EU4 标准布局 |
| 3000 | < 400 ms | 60（默认） | 流畅 | 良 | EU4 视觉基准；4 家死亡 1-2 家不会空场 |
| 10000 | 1-3 s | 30-45 | ownerLayer 全量重画约 16-25 ms/帧 | 一般（标签会挤） | 标记为「实验」级；首次加载明显卡顿，进入后能跑但 ownerAnims 期间帧率会跌 |

> 30000 州当前架构跑不动：`ownerLayer` 每帧用 `Graphics.poly().fill()` 全量重画，O(N) poly 调用 + Pixi 8 batcher 上限决定 30000 个 poly fill 没法撑 60 FPS。如需 3w/5w，需要先把 ownerLayer 重构为 Mesh+Texture 或 Tilemap-style 渲染（独立 PR / Phase 12 任务，不在本期范围内）。

> 性能数字基于 M 系列 Mac + Pixi 8.13 + Vite 6 dev 实测的「数量级估算」，非严格 benchmark；`generate` 主要瓶颈是 `d3-delaunay` + 地形 noise 计算，`sim tick` 与 N 解耦（attemptsPerTick 默认 clamp 在 100 内，终局阶段最高 200）。

**平衡性参数**（确保势力能够衰亡，对齐产品目标第 1.1 节）：

- **前线压力修正**：当前战斗主修正来自 `frontPressure.ts`，用“势力战争潜力 → 接敌前线 → 前线分配”替代单纯州数强弱。州数仍决定战争潜力来源，但多线作战会稀释单条前线兵力，补给和局部合围会影响目标州胜率。
- **目标选择**：每次边境扩张时按全图占领率曲线决定是否优先战争：占领率 ≤35% 时 15%，占领率 ≥92% 时 70%，中间用 `smoothstep` 平滑插值。命中战争偏好后，优先挑选邻接有主敌州的边境源州，再只在有主敌州中按 `1 / (守方州数 + 1)` 加权选择目标；未命中时保留随机选择，继续允许自然占空州。
- **尝试次数**：基础为 `clamp(势力数 × 16, 40, 100)`；当占领率从 85%→98% 或存活势力从 6→3 收敛时，速度倍率从 1x→2x 平滑增长，加快终局节奏但避免阶跃式滚雪球。
- **残局小国压力**：当全图占领率从 75%→95% 进入后期，且守方小于 12 州时，`getSmallRealmCollapseBias` 会按占领率和守方规模平滑增加最高 12% 的被吞并压力。小国短期苟活符合沙盒预期，但长期只剩几块地仍不灭不符合当前节奏目标。
- **地形胜率**：平原 0.55 / 沙漠 0.55 / 森林 0.50 / 河流 0.40 / 山脉 0.32，叠加前线压力、局部合围、残局压力、多线惩罚后为最终胜率，并由 `clamp01` 限制在 2%–98%。

**战争日志可读性**：

- `capture / repel / eliminate` 事件必须带上可解释细节：节奏阶段、目标州地形、最终胜率、基础地形胜率、前线修正、兵力、补给、多线压力、局部合围、残局压力、攻守双方州数、全图占领率、战争偏好。
- 灭国日志要说明最后失守州和攻灭者，便于判断“为什么这家死了”，而不是只显示色块消失。
- 事件面板保留 `eliminate / victory / stalemate` 里程碑日志，不受普通战斗日志滚动上限挤出；普通日志仍只保留最近窗口，避免长期模拟占用过多内存。

**前线压力模型（第一期实现边界）**：

> 前线压力模型是版图变化的解释层和调节层，不是士兵实体系统。它只服务于“为什么这条边界推进/崩溃”，不能把主玩法从版图洪流转向 RTS 式军队操作。

- **核心边界**：不引入单兵实体、士兵寻路、兵种克制、玩家调兵或战术战斗；不在地图上批量渲染士兵。可选的军团 marker 仅作为可读性投影，不作为权威模拟状态。
- **势力战争潜力**：第一版可由州数派生聚合战争潜力，例如 `warPotential = regions × basePotential`；它替代“州数直接修正胜率”的一部分，但不引入人口、税收、粮食、背包资源等经济循环。
- **前线定义**：前线是两家势力之间的接触关系，而不是单个州或单个士兵。每 tick 可基于边界州生成 `Front(factionA, factionB, contactEdges, borderRegions)`，用于描述大国多线作战、小国被夹击和局部突破。
- **兵力/压力分配**：每个势力把聚合战争潜力按前线权重分配；权重来自敌方弱势程度、接触边数量、靠近首都/重心的威胁、近期失地压力和 `tempo.ts` 的战争偏好。大国兵力更多，但前线越多，单条前线分配会被稀释。
- **胜率来源**：目标州仍以“整州转色”为结果；胜率为“地形 + 前线压力比 + 局部合围 + 残局压力 - 多线惩罚”。补给第一版只做近似距离并影响前线兵力效率，不做全图路径和运输单位。
- **Summary 解释层**：`summarizeFactionFrontPressure` 将底层 `FrontPressureState` 整理成 UI 可直接消费的势力摘要，包括前线数、压力等级、战争潜力、平均补给、多线惩罚、最高风险前线和风险排序。summary 不暴露 `Map/Set` 等内部结构，后续势力面板与地图 overlay 应复用这层数据，而不是重复解析底层 front/allocation。
- **势力面板展示**：侧边栏选中势力后显示前线压力卡片，展示压力等级、接敌前线数、平均补给、多线影响、战争潜力和最高风险前线。UI 只表达状态和风险，不提供调兵、行军或兵种操作。
- **地图 Overlay**：侧边栏提供“前线压力”开关；开启后 Canvas 在跨势力边界上绘制轻量金色描边，线宽和透明度由前线压力强度决定。Overlay 只消费 `getFrontPressureOverlaySegments` 的线段数据，不绘制士兵、军团、行军箭头或每州驻军数字。
- **性能约束**：算法复杂度必须保持在 `O(边界州数量 + 前线数量 + attempts)`；禁止按士兵数量、每州驻军扩散或 per-soldier 寻路结算。front 可以每 tick 构建一次，后续再用 owner 变更做局部刷新。
- **日志可读性**：战斗日志应逐步增加 `前线=西线 / 兵力=1800:1200 / 多线压力=-5% / 补给=82% / 局部合围=+4%` 等解释项。玩家即使不看数值面板，也应能从日志理解一次攻陷或灭国的原因。

**节奏单元测试**：

- `pnpm --filter @valley/world-sim test:balance` 通过 Vitest 运行 `tests/balancePacing.test.ts`。
- `pnpm --filter @valley/world-sim test:stability` 通过 Vitest 运行 `tests/runtimeStability.test.ts`，覆盖空地图、坏邻接、陈旧 owner、前线压力缺失、overlay 坏边和迁都边界，防止运行时崩溃回归。
- `pnpm --filter @valley/world-sim test:longrun` 通过固定 seed 跑 3000 州 / 8 家势力 / 最多 500 年长跑，输出采样报告并在未按目标收敛时失败。
- 测试覆盖 0–50 年窗口：应保持早期扩张节奏，战争偏好从 15% 小幅平滑增长，不触发终局加速。
- 测试覆盖 150–300 年窗口：应平滑进入接触战争、霸权吞并和后期加速，并验证最大势力占比升高时强弱倍率下降。
- 测试覆盖后期小国清理压力、16x 速度档位、前线压力 summary 的无前线/单线/多线高压/最高风险前线排序，以及 overlay 仅生成敌对边界线段，防止后续调参误删这些行为。

---

## 10. 项目定位与边界

### 10.1 核心命题

**本游戏只做一件事：版图变化好看、好读、能复盘、可分享。**

势力是颜料，地图是舞台，时间是画笔；玩家是「时间的观察者」，不是「上帝玩家」。Replay 是一等公民，所有功能都服务于「版图洪流的几何美感 + 复盘叙事」。

### 10.2 明确不做（除非未来用户改主意）

以下机制**本期不做**，不进入任何 UI 文案、sim 内核或数据模型：

- **外交 / 同盟 / 朝贡 / 议和 / 联盟**：版图层不需要"非战争状态"，每两家之间永远是潜在敌对，胜率由地形 + 强弱比决定。
- **战争目标 / 部分割让**：占地 = 整州转色，没有"割让 N 州"的中间态。
- **资源 / 人口经济**：本期不做独立经济循环；战争潜力可以从州数派生并用于前线压力，但不引入人口、粮食、税收、库存、生产链等背包式数据。
- **士兵实体 / RTS 操作**：不做单兵实体、士兵寻路、兵种克制、玩家调兵、战术战斗或大规模军队 sprite。前线压力只能作为版图推进的内部解释层。
- **历史人物事件 / 君主继承 / 英雄出现**：Replay 叙事不靠"故事点"，靠色块洪流。
- **文化 / 宗教 / 种族 / 文明阶段**：势力一出场就是政体+君主级别，不演化阶段。
- **气候 / 季节 / 灾难（火山/瘟疫/陨石）**：超出"版图变化"核心命题。
- **生物链 / 动物 / 水手 / 航海**：同理。

### 10.3 只做清单（与核心直接相关）

- **前线压力模型**：允许做聚合战争潜力、接敌前线、多线压力、局部合围和补给近似，用来解释边界推进节奏；不把军队本身变成玩法中心。
- **色块占领 + 边界重画**：ownerLayer + borderLayer 是视觉核心。
- **首都 + 领土重心 + 标签**：EU4 风的可读性锚点。
- **占领瞬时反馈**：闪光、箭头、涟漪 —— 让版图变化有"心跳"。
- **叛乱 / 分裂建国**：唯一值得做的非战斗机制，产出"版图突然碎裂"的视觉戏剧性，防终局疲软。
- **Replay 事件锚点 + 跨地图校验**：把 Replay 从"能看"推到"值得分享"。
- **性能**：dirty rect → SoA → 可选 10000 州流畅。不追 10w 州，除非 Tier A/B 已经做完且 10000 州体验已经极致。

---

## 11. 风险与未决项

| 风险 | 影响 | 缓解 |
|---|---|---|
| 中规模剧本下势力 AI 决策开销爆炸 | 帧率掉到 30 FPS | 分层 tick + 任务队列 + Worker 化 |
| 版图栅格在大地图下内存过大 | 内存占用 > 200MB | 1:8 分辨率 + 分 chunk 上传 |
| 中文字体子集化与 BitmapText 工作量 | 影响首屏 | 预置 GB2312 子集，按需扩展 |
| 录屏速率漂移 | 视频节奏不稳 | "录屏模式"使用挂钟驱动，关闭非必要 UI |
| 剧本数据格式频繁变动 | 历史剧本失效 | 剧本 `version` + 迁移函数 |
| 既有 `apps/world-sim/AGENTS.md` 路由占位与根文档定位变化 | 协作流程不一致 | 在确认本 TDD 后单独提 PR 同步根/子 AGENTS 与 PROJECT_GUIDE |

## 12. 里程碑（仅作设计落地参考，不替代 PLAN.md）

- **M1 引擎骨架**：World/TickLoop、SoA stores、Pixi 应用与摄像机、随机地图、版图栅格、最小 UI（开始/暂停/速度）。
- **M2 玩法闭环**：势力扩张、前线压力与战斗结算、年表事件流、剧本注册器、随机剧本可玩。
- **M3 剧本能力**：三国剧本第一版、固定地图加载、剧本事件脚本、文化资源包。
- **M4 可扩展生态**：Worker 化模拟、回放滑动条、导出/导入存档、剧本编辑器雏形。
- **M5 多剧本扩展**：中国/世界/历史人物/公司争霸剧本逐步上线。

---

## 13. 文档归档

- 本 TDD：`apps/world-sim/docs/TDD.md`
- 计划文档（待建）：`apps/world-sim/docs/PLAN.md`
- 数据模型详解（待建）：`apps/world-sim/docs/DATA-MODEL.md`
- 剧本设计文档（待建）：`apps/world-sim/docs/scenarios/<id>.md`
