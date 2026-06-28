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

8. **地图命中索引**：`findProvinceAt` 对每张 `MapData` 使用 `WeakMap` 缓存 `d3-delaunay` site 索引，hover / 点击 / 编辑涂抹不再每次线性扫描全州。

### 8.2 渲染性能
1. **批次合并**：同 atlas 的 sprite 一次提交；标签 BitmapText 复用 buffer。
2. **Dirty Rect**：版图栅格只上传变化区域；Cities/Armies 只 diff 变化项。
3. **owner / border chunk 脏区层**：`MapCanvas` 通过 `ownerRenderCache` 与 `borderRenderCache` 对归属、地形可绘制性、势力颜色和边界可见状态生成签名；签名未变时跳过 ownerLayer / borderLayer / labelLayer / markerLayer，归属变化或占领动画只重画受影响的 chunk。
4. **标签锚点快路径**：`MapCanvas` 通过 `labelLayout` 优先使用 `FactionSummary.centroidRegionId / capitalRegionId` 定位势力名和首都标记；只有锚点缺失或失效时才懒加载一次全图 owner 聚合兜底，避免每次势力变化都扫全州。
5. **LOD + 视口剔除**：远景隐藏 unit 个体，只显示版图与城市图标；近景才生成兵种动画。
6. **避免每帧 new**：渲染对象池化，事件/特效短期实例预分配。
7. **节流**：势力名/数字 HUD 0.5s 一次；不每帧重排版。
8. **GPU 优先**：势力色着色用 shader（fragment 层 LUT），避免 CPU 重新填充栅格。

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
  - **三国剧本**：固定中国地图 + 184/220/263 多个起始时间点；预置魏蜀吴及群雄；引入"汉室正统/僭越"政治字段。当前 Sidebar 暴露「三国剧本」（8 家汉末诸侯），使用九宫格方位分配出生区域，并随剧本切换到宽幅三国地图。
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
  - `ReplayHistorySummary { version, meta, status, winnerFactionId, keyEvents, eventCounts, factionFates }`：轻量史书摘要；不包含完整 `frames`，用于长局分享与平衡复盘。
  - `ReplaySpeed = '0.25x'|'0.5x'|'1x'|'2x'|'4x'|'8x'` + `REPLAY_SPEED_MULTIPLIER`。
- **状态层**：新增 `state/slices/replaySlice.ts`，挂到 `WorldSimStore`。
  - 字段：`replayMode`（recording / replaying）、`replayPlaying`、`replaySpeed`、`replayCursor`、`replayFrames`、`initialOwnership`、`initialFactions`、`baselineScenarioId`、`replayMessage`。
  - 动作：`captureBaseline / recordFrame / enterReplayMode / exitReplayMode / toggleReplayPlay / setReplaySpeed / stepReplay / seekReplay / exportReplayToJson / exportReplaySummaryToJson / importReplayFromJson`。
  - 内部 `rebuildWorldUpToCursor`：从 `initialOwnership` 复制，按 `frames[0..cursor)` 应用 patches；同时聚合 events、重建 factions（regions 重新统计、name/leader/color 用 initialFactions 还原）、写回 `map/factions/logs/tick/status/winnerFactionId/snapshotVersion`。logs 末端按 `MAX = 1000` 截断。
- **录制时机**：`captureBaseline()` 由 `loadScenario` / `resetBattle` 在结束设置后立即调用；`mapSlice.regenerateMap` / `loadGeoMap` 通过末尾的 `loadScenario(currentScenarioId)` 间接触发。`simSlice.driveOneTick` 写完 `set` 后，仅当 `replayMode === 'recording'` 时把 `patches/events/rankings/status/winnerFactionId` 打包成 `ReplayFrame` 调 `recordFrame`，cursor++。
- **回放驱动**：`App.tsx` 主 RAF 在 `replayMode === 'replaying'` 时优先：累积 `dt * REPLAY_SPEED_MULTIPLIER * BASE_TICKS_PER_SECOND`，每帧最多 `stepReplay(8)`；到达末尾自动暂停。`replayMode === 'recording'` 时走原有 sim 推进逻辑，互不交叉。
- **UI**：`ui/replaybar/ReplayBar.tsx` 居于 LogPanel 之上的 HUD 中。
  - 左：title + 模式 chip（录制中 / 回放中）+ `cursor / total`。
  - 中（仅回放）：← / 播放暂停 / → / range 时间轴（`min=0 max=total`）。中（录制）：提示文案。
  - 右：6 档倍速（仅回放可见）、进入回放 / 退出回放、导出 JSON、导入 JSON（隐藏 file input）。
  - 导出：`Blob` + `URL.createObjectURL` 触发下载；完整回放文件名为 `worldsim-replay-<ISO>.json`，史书摘要文件名为 `worldsim-summary-<ISO>.json`。
- **导入兼容**：`importReplayFromJson` 校验 version、provinceCount 与当前地图一致，落地后切到 `replayMode = 'replaying'`、`replayPlaying = false`、`cursor = 0`，并立即 `rebuildWorldUpToCursor(0)`。
- **不变量**：模拟内核（`core/sim`）、地图层（`core/map`）、剧本系统（`core/scenario`）、编辑模式（`editSlice`）、Phase 10 GeoJSON 加载链路均零改动；Replay 仅依赖 `RegionId / FactionId` 索引，与地图来源无关，random / GeoJSON / 编辑后导入的地图均可录制与回放。

### 9.9 Territory Warfare Refactor（Phase 8.5 新增）

把势力扩张从"百级州 + 全表扫描"升级到"千级州 + 增量推进 + 欧陆风云视觉"。十项实施目标：

1. **3000 州预设**：`mapSlice.ProvincePreset` 扩展为 `100 | 300 | 500 | 1000 | 3000`，`PROVINCE_PRESETS` 同步；Sidebar 数量切换按钮自动派生，无须 UI 单独改。
2. **势力名称钉到领土中心**：`drawFactionLabels` 优先使用 `f.centroidRegionId` 对应州的中心；缺失时回退到聚合 centroid。
3. **半透明势力染色**：`drawOwnerOverlay` 的 `targetAlpha` 由 `0.95` 下调到 `0.78`，让地形仍能透出，色块不再压死底图。
4. **势力边界高亮**：`redrawBorders` 区分四种情形——外边界 / 同势力内部（跳过）/ 跨势力（势力色 darken 0.55，宽 1.6）/ 双边无主（淡灰细线 0.5）。
5. **每 Tick 40–100 次扩张（终局 ×2）**：`runExpansionTick` 默认 `attempts = clamp(势力数 × 16, 40, 100)`；当可占陆地占领率超过 95% 或存活势力 ≤3 时尝试次数翻倍，避免 3000 州下"前期速胜、后期疲软"。
6. **Frontline 系统**：`expansion.ts` 内部维护 `FactionRuntime { id, border: Set<RegionId>, totalRegions }`；每次 owner 变化只对该州 + 邻居调用 `applyOwnerChange / refreshBorderState` 局部 patch，避免每 attempt 全表扫。
7. **避免飞地闪烁**：扩张只沿 `border` 邻居推进，但攻陷瓶颈州仍可能切开防守方领土；`ownerFactionId` 表示归属，不再用来表达断补给。每个 tick 只把首都/重心所在主连通块放进可扩张边界集合，断开的陆地飞地保留原势力颜色但不能作为扩张源，直到相邻敌方正常攻下。dev 模式 `assertContiguous` 仍用 BFS 兜底告警异常连通分量增长。
8. **首都系统**：`FactionSummary.capitalRegionId`；新建势力默认设为 `birthRegionId`，导出导入剧本与 Replay 时随同写入。
9. **领土重心与迁都评分**：`FactionSummary.centroidRegionId`；`simSlice.driveOneTick` 在 patches 应用后调用 `computeCapitalsAndCentroids(nextMap, factions)`：聚合 owned centroid 平均、找最近 owned region 当 centroid；若 `provinces[capital].ownerFactionId !== self.id`，优先按幸存聚落的等级、人口、发展度和接近领土重心评分迁都，没有可用聚落时回退到 centroid。
10. **欧陆风云视觉**：MapCanvas 新增 `markerLayer`（介于 owner 与 label 之间）画首都金色菱形 `#f6c453` + 暗色描边；标签字体改为 serif italic（Garamond / Times / 中文宋体回退）+ letter-spacing 1.5 + 米黄色 `#f6e7c1` 填充 + 黑色 4px outline。

**Replay 兼容性升 v2**：`REPLAY_DOC_VERSION = 2`，`ReplayInitialFaction` 新增 `capitalRegionId`；`importReplayFromJson` 同时接受 `version === 1`（缺失字段时 fallback 为 `birthRegionId`）与 `version === 2`，rebuild 时给每个 faction 写 capital/centroid。

**性能预算**：3000 州 × 60 FPS。Pixi ticker 仅在 `ownerAnims.size > 0` 时推进占领动画；`drawOwnerOverlay` 通过 owner chunk tracker 跳过“归属和势力视觉信息未变化”的重绘，归属变化时只重画 dirty chunk，动画帧只重画包含动画州的 chunk；`redrawBorders` 通过 border chunk tracker 只重画边界可见状态变化的 chunk。ownerLayer 颜色采用 lerp + ease-out cubic 600ms 动画。

**势力命名规范**（避免「势力·甲 / 未知君主」占位文案）：

- 默认池统一抽到 `core/scenario/defaults.ts`：`DEFAULT_FACTION_NAME_POOL`（20 个朝代名）+ `DEFAULT_LEADER_POOL`（16 位历史君主）+ `NAME_LEADER_PRESET`（朝代→君主预设，如 蜀汉→刘备 / 大唐→李世民）。`state/slices/factionSlice.ts` 通过 `import { ... } from '@/core/scenario'` 获取并 re-export，保证 `state/index.ts` 对外接口稳定。
- 随机剧本 `RANDOM_SCENARIO` 不再写死 `factions`，改为 `factionsFactory(rng, options)`：每次加载抽 `RANDOM_FACTION_COUNT = 8` 家不重名势力（4 家在 3000 州下死亡 1-2 家就空场，8 家在标签可读性 + 早期容错上更平衡）。`scenarioSlice.loadScenario` 在执行 `applyScenarioToWorld` 前用 factory 替换 `scenario.factions`；当整批势力都是单个 `random` 出生点时，`applyScenarioToWorld` 会走 `spawnBalance.ts` 批量软平衡选点，而不是逐家均匀随机。
- 中外政体**互不混配**：中文池走 `DEFAULT_FACTION_NAME_POOL` + `NAME_LEADER_PRESET` / `DEFAULT_LEADER_POOL`；国外政体抽 `WORLD_POLITY_PAIRS`（如 `法兰西帝国 + 拿破仑` / `第三帝国 + 希特勒` / `苏维埃 + 斯大林` / `大英帝国 + 维多利亚`），政体名与领袖整组打包出现，避免「大唐 + 拿破仑」「大宋 + 斯大林」这类跨时空违和组合。`FOREIGN_POLITY_RATIO = 0.3` 控制国外政体出现概率（8 家中平均 2-3 家）。
- Sidebar 只保留一个「剧本」入口，当前暴露「随机剧本 / 三国剧本 / 国外政体」三项。`Scenario.preferredMapMode` 与 `Scenario.mapSeedSuffix` 让剧本选择同步驱动地图形态；`Scenario.factoryOptions` 固定动态势力池，避免 UI 另挂「随机剧本来源」开关。
- 「国外政体」作为独立剧本 `FOREIGN_POLITIES_SCENARIO` 复用随机剧本工厂，但固定 `factoryOptions = { includeChinese: false, includeForeign: true }`，整批只从 `WORLD_POLITY_PAIRS` 抽取。
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
| 10000 | 1-3 s | 30-45 | 无变化帧跳过；归属变化/动画帧按 dirty chunk 重画 | 一般（标签会挤） | 标记为「实验」级；首次加载明显卡顿，进入后能跑但大规模占领动画、overlay 开启时仍会跌帧 |

> 30000 州当前架构仍不作为目标：ownerLayer 与 borderLayer 已拆成 chunk dirty layer，标签已优先走首都/重心锚点快路径，少量归属/边界变化不再整层重画；但单个大规模动画窗口、overlay 层、首次生成仍可能触发大量 `Graphics.poly().fill()` 提交，O(N) 级瓶颈尚未全部消除。如需 3w/5w，需要继续把 overlay 层 chunk 化，或把 ownerLayer 迁移到 Mesh+Texture / Tilemap-style 渲染（独立 PR / Phase 12 任务）。

> 性能数字基于 M 系列 Mac + Pixi 8.13 + Vite 6 dev 实测的「数量级估算」，非严格 benchmark；`generate` 主要瓶颈是 `d3-delaunay` + 地形 noise 计算，`sim tick` 与 N 解耦（attemptsPerTick 默认 clamp 在 100 内，终局阶段最高 200）。

> 交互命中已从线性扫描升级为按 `MapData` 缓存的 Delaunay site 索引，hover / 点击 / 编辑涂抹不会随每次 pointermove 扫全州；ownerLayer 与 borderLayer 已使用 chunk tracker 跳过无变化 tick，并把归属变化、边界变化和动画帧限制到 dirty chunk；标签定位优先复用势力首都/重心锚点。10000 州的主要瓶颈剩余在首次生成、overlay 层、大规模同帧占领动画和标签 LOD 可读性。

**平衡性参数**（确保势力能够衰亡，对齐产品目标第 1.1 节）：

- **软平衡随机出生**：随机剧本批量评分所有可用陆地州，综合离地图边缘距离、离海岸/大湖距离、周边可达陆地容量、地形质量和已选出生点间距。边缘出生不被绝对禁止，但会降权；三国等方位/固定出生剧本不强制套用该平衡层。
- **无主地开拓成本**：空州不再永远必占。势力前 10 州有本土起步保护；之后远离首都/出生核心、边疆边界过长或目标地形复杂时，开拓成功率会下降，并优先选择更靠近核心的无主邻居。该机制用于压制边缘出生势力早期无成本铺满半张图的滚雪球。
- **前线压力修正**：当前战斗主修正来自 `frontPressure.ts`，用“势力战争潜力 → 接敌前线 → 前线分配”替代单纯州数强弱。州数仍决定战争潜力来源，但多线作战会稀释单条前线兵力，补给和局部合围会影响目标州胜率。
- **目标选择**：每次边境扩张时按可占陆地占领率曲线决定是否优先战争：占领率 ≤35% 时 15%，占领率 ≥92% 时 70%，中间用 `smoothstep` 平滑插值。命中战争偏好后，优先挑选邻接有主敌州的边境源州，再只在有主敌州中按 `1 / (守方州数 + 1)` 加权选择目标；未命中时保留随机选择，继续允许自然占空州。
- **尝试次数**：基础为 `clamp(势力数 × 16, 40, 100)`；当可占陆地占领率从 85%→98% 或存活势力从 6→3 收敛时，速度倍率从 1x→2x 平滑增长，加快终局节奏但避免阶跃式滚雪球。
- **残局小国压力**：当可占陆地占领率从 75%→95% 进入后期，且守方小于 12 州时，`getSmallRealmCollapseBias` 会按占领率和守方规模平滑增加最高 12% 的被吞并压力。小国短期苟活符合沙盒预期，但长期只剩几块地仍不灭不符合当前节奏目标。
- **地形胜率**：平原 0.55 / 沙漠 0.55 / 森林 0.50 / 河流 0.40 / 山脉 0.32 / 海洋 0（不可进攻），叠加前线压力、局部合围、残局压力、多线惩罚、河流跨越惩罚后为最终胜率，并由 `clamp01` 限制在 2%–98%。
- **河流跨越惩罚**：进攻跨越河流州时，攻方胜率降低 12%（模拟渡河作战难度）。
- **不规则地图**：通过陆地掩膜（simplex-noise fBm）生成不规则海岸线，中心区域更偏陆地，地图边缘更偏海洋；仅保留最大的陆地连通分量，避免海洋不可通行后产生不可达飞地。
- **水体边界**：`ocean` 代表海洋/大湖等不可通行水体，不可出生、不可占领、不可扩张、不可形成前线，不参与势力州数、首都/重心和排行榜占比统计；内陆水体只允许保留小湖，过大的封闭中心湖会还原为陆地纹理。`river` 仍是可占陆地，只提供渡河/河网作战惩罚。

**战争日志可读性**：

- `capture / repel / eliminate` 事件必须带上可解释细节：节奏阶段、目标州地形、最终胜率、基础地形胜率、前线修正、兵力、补给、多线压力、局部合围、残局压力、攻守双方州数、可占陆地占领率、战争偏好。
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
- `pnpm --filter @valley/world-sim test:stability` 通过 Vitest 运行 `tests/runtimeStability.test.ts`，覆盖软平衡随机出生、远疆无主地开拓减速、空地图、坏邻接、陈旧 owner、前线压力缺失、overlay 坏边和迁都边界，防止运行时崩溃回归。
- `pnpm --filter @valley/world-sim test:longrun` 通过固定 seed 跑 3000 州 / 8 家势力 / 最多 500 年长跑，输出采样报告并在可占陆地占领率低于 98%、50 年最大势力占比异常过高、没有按期出现灭国或战斗停滞时失败；飞地不通过 owner 清空来表达，因此不应出现“有主/无主”视觉闪烁。
- 测试覆盖 0–50 年窗口：应保持早期扩张节奏，战争偏好从 15% 小幅平滑增长，不触发终局加速，且随机局最大势力占比不得过早进入碾压态。
- 测试覆盖 150–300 年窗口：应平滑进入接触战争、霸权吞并和后期加速，并验证最大势力占比升高时强弱倍率下降。
- 测试覆盖后期小国清理压力、16x 速度档位、前线压力 summary 的无前线/单线/多线高压/最高风险前线排序，以及 overlay 仅生成敌对边界线段，防止后续调参误删这些行为。

---

## 10. 项目定位与边界

### 10.1 核心命题

**本游戏只做一件事：版图变化好看、好读、能复盘、可分享。**

势力是颜料，地图是舞台，时间是画笔；玩家是「时间的观察者」，不是「上帝玩家」。Replay 是一等公民，所有功能都服务于「版图洪流的几何美感 + 复盘叙事」。

### 10.2 当前阶段明确不做

以下机制在 Phase 8.5 版图洪流阶段不做，不进入当前 UI 文案、sim 内核或数据模型；后续若进入第 11 章路线图，需要先更新本节边界，再实现代码：

- **外交 / 同盟 / 朝贡 / 议和 / 联盟**：版图层不需要"非战争状态"，每两家之间永远是潜在敌对，胜率由地形 + 强弱比决定。
- **战争目标 / 部分割让**：占地 = 整州转色，没有"割让 N 州"的中间态。
- **资源 / 人口经济**：本期不做独立经济循环；战争潜力可以从州数派生并用于前线压力，但不引入人口、粮食、税收、库存、生产链等背包式数据。
- **士兵实体 / RTS 操作**：不做单兵实体、士兵寻路、兵种克制、玩家调兵、战术战斗或大规模军队 sprite。前线压力只能作为版图推进的内部解释层。
- **历史人物事件 / 君主继承 / 英雄出现**：Replay 叙事不靠"故事点"，靠色块洪流。
- **文化 / 宗教 / 种族 / 文明阶段**：势力一出场就是政体+君主级别，不演化阶段。
- **气候 / 季节 / 灾难（火山/瘟疫/陨石）**：超出"版图变化"核心命题。
- **生物链 / 动物 / 水手 / 航海**：同理。

### 10.3 当前阶段只做清单（与核心直接相关）

- **前线压力模型**：允许做聚合战争潜力、接敌前线、多线压力、局部合围和补给近似，用来解释边界推进节奏；不把军队本身变成玩法中心。
- **色块占领 + 边界重画**：ownerLayer + borderLayer 是视觉核心。
- **首都 + 领土重心 + 标签**：EU4 风的可读性锚点。
- **占领瞬时反馈**：闪光、箭头、涟漪 —— 让版图变化有"心跳"。
- **叛乱 / 分裂建国**：唯一值得做的非战斗机制，产出"版图突然碎裂"的视觉戏剧性，防终局疲软。
- **Replay 事件锚点 + 跨地图校验**：把 Replay 从"能看"推到"值得分享"。
- **性能**：dirty rect → SoA → 可选 10000 州流畅。不追 10w 州，除非 Tier A/B 已经做完且 10000 州体验已经极致。

---

## 11. 后续玩法迭代路线图

> 设计锚点：当前系统已经从“均匀随机出生 + 无主地必占”升级到“软平衡出生 + 远疆开拓成本”，但本质仍是势力色块在州图上流动。后续大方向不是继续堆胜率参数，而是把版图变化建立在“聚落核心、行政距离、忠诚动荡、战争目标、最小外交和史书复盘”之上，让世界自治且因果可读。

### 11.1 第一性原理诊断

- **玩家真正想看的是历史感**：不是每 tick 谁随机赢一次，而是“为什么这家兴起、为什么那家分裂、为什么边疆失控、为什么首都陷落后局势反转”。
- **版图必须仍是主角**：所有新增系统都要服务于颜色版图的变化、复盘和录屏，不把主玩法转成 RTS、城市经营或背包经济。
- **自治优先于操控**：玩家可以观察和干预世界，但不应该像 RTS 一样直接调兵、下建筑队列或指定外交条约。
- **可读性优先于复杂度**：新增字段只有在它能解释地图变化时才值得加入；不能为了“更像模拟器”堆大量 UI 看不懂的数值。
- **聚合模拟优先于实体洪流**：3000-10000 州目标下，优先用聚落、前线、势力级指标做聚合结算，不做每个士兵/居民的逐个寻路与渲染。

### 11.2 WorldBox 式对齐取舍

- **镜像的体验**：村庄/聚落作为文明核心，王国围绕核心扩张；忠诚低会酝酿少量重大叛乱；战争、分裂和灾害会改变世界状态。
- **简化的实现**：不复制 WorldBox 的单位生态、动物、生物链、素材和图标；第一版用聚合数值表达人口、忠诚和战争压力。
- **有意识偏离**：WorldSim 的主要卖点是大地图版图流动和 Replay 复盘，因此会保留 EU4 式标签、前线 overlay、长跑统计和事件年表，而不是做近景小人生态。
- **验收原则**：任何新增系统必须能在地图、侧栏、日志或 replay 中说明“为什么发生”，否则不上主线。

### 11.3 Phase 0：观测与平衡报告（已开始）

目标：先建立衡量世界是否“好玩”的仪表，而不是继续靠肉眼看单局截图调参。

- 已新增 `core/sim/balanceReport.ts`：提供 `runBalanceProbe` 和 `formatBalanceReport`，可被 Vitest、后续 Debug 面板或独立 CLI 复用。
- 固定 seed 批量探针默认设计为 20 个 seed、3000 州、8 家势力，采样 0/25/50/100/200/500 年；常规测试使用 4 个 seed、1000 州、100 年的快版守门，避免每次验证过慢。
- 已输出关键指标：可占陆地占领率、最大势力占比、存活势力数、首个灭国年份、灭国总数、边缘/中部/中心出生分布、边缘出生存活率、中心出生存活率、边缘赢家占比、中心赢家占比、owner 反复易主州数。
- 已区分“世界生成问题”和“玩法推进问题”：报告包含地图陆地率、出生带分布、50 年最大势力占比、最终存活/灭国、owner churn。最大内陆湖、海岸出生比例和飞地组件告警仍留作后续扩展。
- 新增长跑对比模式：同一批 seed 可对比参数改动前后，避免一次调参修了边缘优势却破坏终局收敛。
- UI 暂不做复杂面板，先做测试报告和 console/table 输出；后续再接 Debug 面板。

验收：

- `test:longrun` 仍覆盖单 seed 收敛。
- `pnpm --filter @valley/world-sim test:balance-report` 通过 Vitest 跑快版固定 seed 批量报告。
- 报告能回答：边缘出生是否显著更容易赢；50 年是否过早一超；100/500 年是否仍有战争和灭国。

### 11.4 Phase 1：聚落/城市作为统治核心（已开始）

目标：把“势力 = 一团颜色”升级为“势力由首都和聚落网络支撑”。

- 新增 `Settlement` 概念：`id`、`factionId`、`regionId`、`tier`、`population`、`development`、`influenceRadius`、`isCapital`、`foundedTick`。
- 每个势力出生时不只是拥有一个州，而是在出生州生成首都聚落；首都聚落是扩张、补给、忠诚和标签的核心。
- 聚落等级分为村、镇、城、都四档；第一版只影响影响力半径、战争潜力、忠诚稳定，不引入建筑队列。
- 新聚落由模拟自动生成：当某片领土距离现有聚落过远、局部可居住性足够、且势力没有严重过度扩张时，概率建立新聚落。
- 聚落选址评分：平原/河流/森林更优，山地/沙漠更差；不能在 ocean；不能过度贴近已有聚落；不能建立在断补给飞地上。
- 首都被占后，势力迁都到最高等级/最大人口/最靠近领土重心的己方聚落；没有聚落则进入灭亡或残余状态。

当前实现：

- 已新增 `SettlementSummary` 与 `SettlementId`，聚落等级包括 `village / town / city / capital`；当前落地首都 + 自动村镇 v1。
- 已新增 `core/sim/settlements.ts` 与 `settlementSlice`：剧本开局、势力重生、编辑归属变化、战斗 tick 和 replay 重建都会按势力首都/重心重建聚落网络。
- 自动村镇按势力领土规模生成，优先选择主连通块内、远离既有聚落、平原/河流/森林等更适合居住的州；断补给飞地、ocean 和过近州不会生成新聚落。
- 已新增 `test:settlements` 回归测试，覆盖随机剧本开局、势力重生、重置战局、replay baseline 重建、大势力多聚落、断开飞地不建聚落。
- 尚未实现聚落成长、城市升级和独立城市窗口；迁都评分、行政距离、聚落级忠诚/动荡热力与选中州聚落详情已由 Phase 2/Phase 3/Phase 4/Phase 8 首版承接。

验收：

- 随机局开局 8 家都拥有首都聚落。（已由 `test:settlements` 覆盖）
- 50 年后大势力必须有多个聚落，而不是一个首都拖半张图。（纯函数回归已覆盖大势力多聚落，长跑观测仍需后续接入报告）
- 边缘势力不能只靠连续空州必占铺开，必须形成聚落链才能稳定扩张。

### 11.5 Phase 2：行政距离与过度扩张（已开始）

目标：让“空心大国”自然变慢，让中部高密度核心有防守价值。

- 每个州计算 `adminDistance`：到最近己方聚落或首都的图距离/近似距离。
- 每个势力计算 `overextension`：领土数、聚落数、边境长度、远疆州比例、非主连通块比例、近期征服州比例。
- 扩张概率从“势力尝试次数 + 邻居目标”改为“源州治理质量 + 目标州距离 + 势力过度扩张”共同决定。
- 战争补给复用行政距离：远离聚落的前线攻击力降低，首都附近和聚落密集区更难被快速吞掉。
- 飞地保留颜色但治理质量极低：不能作为扩张源，忠诚下滑更快，容易被相邻势力正常吞并或在未来叛乱。
- 大国不被硬惩罚；如果它有足够聚落网络和稳定边疆，仍能强。

当前实现：

- 已新增 `core/sim/adminDistance.ts`：按当前地图、势力和聚落网络 BFS 计算每个己方州到最近己方聚落的行政距离；没有聚落数据时回退到首都/重心/出生点，保证报告工具兼容。
- `runExpansionTick` 已接收 `settlements`，真实 sim tick、长跑测试和 balance report 都会传入并随版图变化重建聚落网络。
- 无主地开拓已叠加行政距离与“每聚落治理州数”惩罚：有前线村镇支撑的边疆，比只有远方首都支撑的边疆更容易继续开拓。
- 攻击有主敌州的胜率已叠加行政补给惩罚，并在战斗详情中输出 `行政 / 聚落 / 距城`，用于解释远疆前线为什么推进变慢。
- 已新增 `summarizeFactionAdminPressure`：输出聚落数、平均距城、远疆比例、每聚落治理州数、平均治理质量和治理压力等级。
- 侧栏选中势力后展示“治理”卡片，显示 `聚落 / 距城 / 远疆 / 负荷 / 质量`，用于和“前线压力”一起解释扩张状态。
- 侧栏新增“行政距离”地图 overlay：将远离己方聚落/首都的有主陆地州叠加为热力层；选中势力时只显示该势力，用于定位空心大国和远疆失控区。
- 已新增近期征服记忆：真实占领 patch 会记录州最近一次换主 tick，治理摘要增加 `recentConquestShare`，侧栏“治理”卡片显示 `新占`；换图、换剧本、编辑、重置和回放 seek 会清空或重建这份短期记忆。
- 忠诚下滑与叛乱承接已由 Phase 3 首版落地；战争疲劳和首都陷落仍在后续叠加，神力干预已从主线下线。

验收：

- 同等州数下，聚落网络密集的势力比单线铺地势力更稳定。（行政距离纯函数和开拓速度回归已覆盖）
- 边缘出生不再稳定滚雪球；中部出生若形成多个核心聚落，应能长期存活。
- 日志、debug summary 和地图 overlay 能解释“远疆”“过度扩张”“补给不足”“新占领土”。（战斗日志、势力治理卡片与行政距离 overlay 已覆盖首版）

### 11.6 Phase 3：忠诚、动荡与叛乱酝酿（已开始）

目标：让大国终局不只是吞并，而会出现内部裂变和历史戏剧性。

- 聚落拥有 `loyalty`、`unrest`、`revoltProgress` 三个核心状态。
- 忠诚来源：距离首都、聚落等级差、近期被征服、战争疲劳、过度扩张、相邻敌对压力、首都陷落。
- 低忠诚不瞬间改颜色，而是进入“叛乱酝酿”：地图上可视、日志提示、持续若干年。
- 酝酿期间宗主可能自然平息，也可能因为战争失败或首都陷落而爆发。
- 叛乱爆发会创建新势力；周围同低忠诚聚落和州有概率加入；宗主与叛乱方进入战争状态。
- 叛乱不是为了公平，而是为了让过度扩张和边疆治理失败产生可读后果。

当前实现：

- `SettlementSummary` 已新增 `loyalty / unrest / revoltProgress`，聚落不再只有人口和等级，也能表达内部稳定性。
- 已新增 `core/sim/stability.ts`：按聚落等级、行政距离、每聚落治理州数和近期征服状态计算忠诚目标、动荡和叛乱进度；首都不会进入叛乱准备。
- `rebuildSettlements` 会保留既有聚落的稳定性并逐 tick 逼近目标，远疆、新占、过度扩张会逐步推高动荡；稳定环境下叛乱进度会自然回落。
- 侧栏选中势力后，“治理”卡片显示 `忠诚 / 动荡 / 叛乱`，用于提前观察风险。
- 已新增叛乱预警事件：非首都聚落 `revoltProgress` 首次跨过准备阈值时，事件日志写入 `叛乱` 分类，说明聚落、忠诚、动荡和进度；这只是预警，不会改变归属。
- 已新增聚落稳定性地图 overlay 内部能力：Canvas 可在聚落所在州绘制热力并按选中势力过滤；玩家侧栏入口已移除，避免整图染色噪声。
- 已新增叛乱爆发 v1：非首都聚落 `revoltProgress` 首次满进度时，会创建一个 `义军` 新势力、把该聚落州和最多 1 个相邻同属旧主的陆地州转给叛军，旧都、海洋和敌方州不会响应；事件写入 `举旗叛乱` 日志，并把 owner patch 与 `newFactions` 录入 Replay。叛乱爆发有全局冷却，同一时间最多保留少量活跃叛乱战争，避免地图碎成标签噪声。
- 已新增叛乱战争 v1：义军建国时会创建 `revolt` 战争状态，旧主与义军进入 active war；该状态写入 Replay `newWars`，回放 seek 会恢复，并让扩张内核优先处理这条内战边境。
- 已新增战争收束 v1：一方灭亡会结束战争；双方持续脱离接触会进入临时停战，停战期内双方不会被扩张内核选为彼此攻击目标；停战到期后从当前战争列表移除。
- 尚未实现完整议和评分和完整外交面板；这些仍归 Phase 5 最小外交后续。

验收：

- 长跑中后期会出现少量叛乱，但不会每局碎成噪声。（当前：聚落义军、保守相邻响应、叛乱战争、普通边境宣战、战争疲劳停战、停战收束、叛乱冷却和义军标签降噪 v1 已落地；后续需要继续调参验收频率）
- 叛乱前至少有可观察预警，不允许无提示瞬间变色。（当前：聚落稳定性字段、治理卡片、忠诚/动荡地图 overlay 和叛乱预警日志已覆盖首版预警）
- 叛乱日志必须说明核心原因：远疆、低忠诚、战争疲劳或首都失守。（当前预警/爆发日志覆盖低忠诚/动荡/进度；后续事件需要补齐战争疲劳和首都失守原因）

### 11.7 Phase 4：聚落级战争目标与围城

目标：战争不再只是边境随机抢格子，而是围绕聚落和首都产生战役节奏。

- 前线仍是聚合模型，不引入单兵实体。
- 战争目标优先指向聚落、首都、山口、河谷等战略州；普通州可被占，但聚落决定区域控制的稳定性。
- 新增 `siegeProgress` 或 `campaignProgress`：攻击聚落需要累积优势，不能一 tick 随机翻色。
- 城市等级、山地、河流、补给距离、多线压力影响围城速度。
- 首都陷落触发强事件：忠诚下降、迁都、前线崩溃、叛乱风险上升。
- 保留普通边境推进，但推进方向由战役目标牵引，减少“随机毛边”。

验收：

- 首都和大城在地图上有明确战略意义。（当前：active war 目标权重已优先聚落/首都）
- 战争日志能显示“围城中 / 补给不足 / 城防强 / 首都陷落”。（当前：战斗详情已显示聚落目标等级、持久围城进度、行政距离与城防惩罚；首都陷落会写入都城事件并进入 Replay；地图可切换围城 overlay）
- 版图推进更像战役线，而不是到处随机起毛。

当前实现：

- 已新增聚落战争目标 v1：`runExpansionTick` 在 active war 中选择有主敌州时，会按敌方聚落等级提高目标权重；首都最高，城市/城镇/村庄依次降低，普通州保持基础权重。
- 已新增聚落城防 v1：攻击敌方聚落州会按聚落等级扣减胜率，并在 combat detail 中输出 `目标=都城/城市/城镇/村庄`、`围城=N%` 与 `城防=-N%`；围城值优先读取战争状态里的持久 `siegeProgress`，没有目标进度时才回退到战争持续时间近似，避免聚落把终局完全锁死。
- 已新增持久围城进度 v1：`WarSummary.siegeProgress[]` 记录某场战争里某个聚落目标的攻守方、聚落、进度和最近更新时间；失败攻城会推进进度，攻下目标会清掉该目标进度，并通过 `updatedWars` 进入 Replay。
- 已新增自动破城阈值 v1：当目标聚落已有持久 `siegeProgress >= 90%` 时，下一次攻城接触即使普通胜率判定失败，也会转为占领；仅持久围城进度触发，战争持续时间近似值不会单独触发破城。
- 已新增围城 overlay v1 内部能力：Canvas 可按 active war 中有效的 `siegeProgress` 给被围聚落州绘制热力和描边；玩家侧栏入口已移除，围城状态优先通过战争卡片和聚落检视表达。
- 已新增选中聚落详情 v1：右侧栏 `检视` 区在选中聚落州时显示聚落名、等级、所属、地形、人口、发展、忠诚、动荡、叛乱、新占 tick 与围城攻守方/进度；非聚落州仍只显示州检视文本。
- 已新增围城摘要 v1：选中势力后，战争卡片会显示 active war 中相关围城目标数和最高围城进度；停战战争里的旧进度不计入摘要。
- 已新增首都陷落事件 v1：tick 应用占领 patch 后会检测旧首都是否被敌方攻陷，并按刷新后的势力首都写入 `都城` 日志，例如“都城 #N 陷落，迁都 #M”；该日志作为里程碑保留并进入 Replay。
- 已新增首都陷落稳定性冲击 v1：旧都陷落后的同一 tick，会对旧主非首都聚落施加短期忠诚下降、动荡上升和叛乱进度上升；首都聚落仍保留保护，不会因冲击直接进入普通叛乱。
- 已新增迁都评分 v1：旧都失守或首都缺失时，新都优先选择仍由本势力控制的幸存聚落，并按聚落等级、人口、发展度和接近领土重心评分；没有可用聚落时回退到领土重心。Replay frame 会记录首都变化，确保回放态与录制态迁都一致。
- 已新增都城震荡 v1：旧都陷落后，旧主参与的 active war 会获得短期 `capitalShocks`，在震荡窗口内作为防守方时更容易被突破，战斗日志显示 `都城震荡=+14%`；该状态通过 `updatedWars` 进入 Replay。它不会直接清空或赠送领土，只改变后续战斗结算。
- 尚未实现独立聚落窗口、建筑/人口构成和可操作内政，这仍归 Phase 8/后续 WorldBox 化内政层。

### 11.8 Phase 5：最小外交状态

目标：让世界不再是所有势力永远潜在混战，但避免进入复杂外交游戏。

- 第一版只做四种关系：和平、战争、停战、叛乱战争。
- 宣战由边境压力、实力差、历史仇恨、战略目标、叛乱关系触发。
- 和平由战争疲劳、目标达成、双方损失和停战冷却触发。
- 停战期降低再次开战概率，避免同两家反复秒打。
- 暂不做联盟、附庸、贸易、朝贡、手动条约、外交面板谈判。
- 关系状态要进入 Replay 事件流，方便复盘“某年开战 / 某年停战”。

验收：

- 战争有开始和结束，不是全图永远混战。
- 停战能降低边境反复易主。
- UI 能用极简方式表达当前关系概览、战争列表和敌对关系。

当前实现：

- 已落地叛乱战争 v1：叛乱爆发会创建旧主与义军的 active war，日志显示“叛乱战争”，Replay 记录并恢复 `newWars`。
- active war 会提高双方边境目标权重，并让扩张优先处理叛乱战争邻接州。
- 已落地普通宣战 v1：和平势力接壤后不会直接互攻，tick 驱动会先按边境接触生成 `border` active war，写入“宣战”日志和 Replay `newWars`，然后扩张内核才允许双方攻击有主敌州。
- 已落地战争疲劳停战 v1：active war 会记录起始州数和 `fatigue`，按持续时间、接触边数量和领土变化累积疲劳；普通边境战争疲劳更快，叛乱战争更慢。疲劳满值时转入 `truce`，写入“战事疲惫停战”日志和 Replay `updatedWars`。
- 已落地停战收束 v1：一方被消灭时战争结束；双方持续脱离接触会转入 `truce`，Replay 记录 `updatedWars / endedWarIds`，停战期内扩张不会选择对方作为攻击目标。
- 已落地外交概览 v1：`computeDiplomacyOverview` 会按存活势力两两关系统计和平、边境战争、叛乱战争和停战；active 关系优先于 truce，避免同一对势力重复计数。
- 侧栏新增“关系”卡片，显示存活势力数、关系对数以及和平/交战/内战/停战计数，让玩家不用逐条读战争列表也能判断世界局势。
- 侧栏选中势力后显示“战争”摘要，区分交战与停战数量，并列出主要对手；侧栏全局“战争”列表展示 active/truce、双方、战争类型、持续时间、疲劳和停战剩余。
- 完整议和评分和完整外交面板仍未实现。

### 11.9 Phase 6：地理战略价值与轻量资源

目标：让地形影响历史走势，但不引入背包经济。

- 每个州派生轻量战略值：`fertility`、`defensiveness`、`travelCost`、`habitability`、`strategicValue`。
- 聚落成长使用 fertility/habitability。
- 战争和围城使用 defensiveness/travelCost。
- AI 目标选择使用 strategicValue，不需要库存、贸易路线和生产链。
- 河谷、平原、山口、海岸、小湖周边应形成不同历史走势。
- 如果未来需要资源，先只做“战略标签”，例如粮仓/铁矿/圣地，不做数量库存。

验收：

- 同 seed 地形变化会导致不同聚落密度和战争路线。
- 山口/河流/平原的作用能从地图和日志中被看懂。
- 不新增复杂资源 UI。

当前实现：

- 已新增地理战略画像 v1：`computeRegionStrategicProfile` 从州的地形、海拔和湿度派生 `fertility / defensiveness / travelCost / habitability / strategicValue`；`ocean` 的肥力、宜居、战略值为 0 且不可作为聚落目标。
- 已新增 `scoreSettlementProvinceForStrategy`，聚落选址不再只看 terrain 名称，而是综合宜居、肥力、战略值、通行成本和防御性；湿润森林、河谷和平原会比干旱或高山州更容易成为聚落候选。
- 自动村镇选址已复用地理战略画像；战争目标权重已接入 `strategicValue`，更高战略价值的敌方州会获得更高目标权重。
- 战斗胜率已接入 `defensiveness / travelCost`：高防御、高通行成本的州会形成额外 `地利` 惩罚；战斗详情会显示 `地利 / 通行 / 战略`，用于解释山口、河谷和平原为什么推进节奏不同。
- 围城推进已接入 `defensiveness / travelCost`：同等级聚落攻城失败后，高防御、高通行成本州的持久 `siegeProgress` 增长更慢，避免山口/高地像平原一样被线性磨穿。
- 聚落成长已接入 `fertility / habitability / travelCost`：既有聚落的人口和发展度会逐 tick 向目标值靠近，河谷、湿润平原等宜居区域成长更快，高山和难通行区域成长更慢；新建聚落仍按当前势力规模给初始基线，避免开局空壳。
- 战略 overlay 已作为内部能力接入：Canvas 可按 `strategicValue` 绘制陆地热力，用于调试聚落选址、战争目标和成长差异；玩家侧栏入口已移除，资源库存和复杂资源 UI 仍不引入。

### 11.10 Phase 7：神力干预（已下线）

目标：当前产品收束为“历史势力争霸沙盘”，玩家以观察、剧本和编辑器配置开局为主，不再提供常驻神力玩法。

- 侧栏不再显示神力工具组。
- 地图点击不再触发祝福、诅咒、煽动、平息、加速、灾害、冻结战争或改变地形。
- 既有 Replay 数据结构和内部方法暂保留为兼容层，不作为玩家功能入口。
- 未来如重新引入干预能力，应先证明它服务历史沙盘主循环，而不是把体验带回上帝工具箱。

验收：

- 默认 UI 中看不到神力入口。
- 点击地图只做检视或编辑模式操作，不触发神力日志和短反馈。
- 历史势力争霸主循环不依赖神力。

### 11.11 Phase 8：可读性 UI 与 Debug Overlay

目标：每个新增机制都有观察入口，否则宁可不上。

- 地图 overlay：保留为调试/内部能力，不作为默认玩家侧入口；玩家侧优先看版图、首都、势力卡片、战争列表和日志。
- 势力面板：首都、聚落数、最大聚落、过度扩张、战争数、叛乱风险、近期关键事件。
- 聚落面板：人口、等级、忠诚、动荡、归属、近期征服状态、是否被围城。
- 日志分层：战争、叛乱、迁都、灭国、统一；普通 capture 继续限流。历史 Replay 中的旧神力事件仅作为兼容事件保留。
- Debug 面板显示 balance report 摘要，供调参使用，但不放在默认侧栏入口。
- 所有 UI 文案只描述玩家可理解的世界状态，不暴露无意义内部字段。

验收：

- 随机暂停任意一年，玩家能回答：谁强、谁危险、哪里会叛乱、哪里会突破、为什么。
- HUD 隐藏后仍可录屏；打开面板时能解释世界。

当前实现：

- 侧栏已显示治理、前线压力、叛乱风险、势力战争摘要和全局战争列表；战争摘要覆盖交战/停战数量与主要对手，战争列表覆盖每场战争的状态、双方、疲劳和停战剩余。
- 地图 overlay 内部能力已覆盖前线压力、行政距离、战争状态、忠诚与动荡；玩家侧入口已移除，避免在地图区堆叠难理解按钮和热力噪声。
- 右侧栏已新增选中聚落详情首版：点击聚落所在州后，可直接看到等级、人口、发展、忠诚、动荡、叛乱、新占状态和围城状态，补足“为什么这里会叛乱/被围攻/难以推进”的可读性链路。
- Debug 摘要 v1 已从玩家侧栏移除；调参仍可通过测试报告和内部 selector 获取当前局摘要。

### 11.12 Phase 9：剧本系统升级

目标：让随机局验证系统，让三国局验证叙事。

- 随机剧本新增世界形态配置：大陆、群岛、河网、小湖、四周海洋、山脉割裂。
- 三国剧本升级为真实开局配置：预设首都、核心聚落、边疆、关系状态、势力特性。
- 剧本可覆盖规则参数，但不能绕过核心模拟；例如曹操可以有行政/战争加成，但不能直接免疫叛乱。
- 剧本数据加入版本号和迁移逻辑，避免 Replay/导入失效。
- 外国政体剧本沿用同机制，不做单独硬编码。

验收：

- 同一套聚落/忠诚/战争规则能跑随机局和三国局。
- 三国剧本有更强历史味，但不牺牲模拟一致性。

### 11.13 Phase 10：Replay 史书化

目标：把“能回放”升级成“值得分享的一段历史”。

- 自动生成时代节点：建国、迁都、首都陷落、最大战争、最大叛乱、统一、灭国潮。
- 时间轴支持按事件跳转，而不是只按 tick 拖动。
- 结算页展示势力兴衰表、战争列表、叛乱列表、最大版图年份、最终地图。
- 导出摘要 JSON：关键帧、事件、势力命运、参数版本。
- 后续可生成“史书文本”，但先保证结构化事件准确。

验收：

- 一局结束后能复盘出主要历史线。
- Replay 导入后聚落、战争、叛乱和历史兼容事件保持一致。

当前实现：

- 已新增 Replay 事件锚点 v1：`computeReplayEventAnchors` 从 `ReplayFrame.events` 中提取 `capital / eliminate / victory / stalemate / revolt / divine / diplomacy` 等关键事件，过滤普通占领/失地噪声，并返回可直接传给 `seekReplay` 的 cursor。
- ReplayBar 在回放模式下显示最近关键事件跳转按钮，按钮使用游戏时间 + 事件类型短标签；点击后跳到对应历史帧，普通录制模式不显示该组控件。
- 已新增 Replay 史书摘要 JSON v1：`computeReplayHistorySummary` 输出 meta、关键事件、事件分类计数、势力初始/最终领土、灭亡 tick、生存状态和胜者；ReplayBar 提供 `摘要` 导出，不包含完整 frames，适合长局分享和调参复盘。

### 11.14 实施优先级

最短安全路线：

1. **Phase 0 观测报告**：先有尺子。
2. **Phase 1 聚落核心**：重塑扩张基础。
3. **Phase 2 行政距离**：解决边缘滚雪球和空心大国。
4. **Phase 3 忠诚叛乱**：解决终局疲软和历史戏剧性。
5. **Phase 4 聚落战争目标**：让战争更像战役。
6. **Phase 5 最小外交**：让战争有开始/结束。
7. **Phase 10 Replay 史书化**：把可分享价值做完整。

暂缓事项：

- 单兵实体、复杂经济库存、联盟外交、贸易路线、航海殖民、文化宗教、多物种生态、建筑队列。
- 原因：这些都会把主线从“版图历史模拟”拖向另一个游戏，且会显著提高性能和 UI 成本。

---

## 12. 风险与未决项

| 风险 | 影响 | 缓解 |
|---|---|---|
| 中规模剧本下势力 AI 决策开销爆炸 | 帧率掉到 30 FPS | 分层 tick + 任务队列 + Worker 化 |
| 版图栅格在大地图下内存过大 | 内存占用 > 200MB | 1:8 分辨率 + 分 chunk 上传 |
| 中文字体子集化与 BitmapText 工作量 | 影响首屏 | 预置 GB2312 子集，按需扩展 |
| 录屏速率漂移 | 视频节奏不稳 | "录屏模式"使用挂钟驱动，关闭非必要 UI |
| 剧本数据格式频繁变动 | 历史剧本失效 | 剧本 `version` + 迁移函数 |
| 既有 `apps/world-sim/AGENTS.md` 路由占位与根文档定位变化 | 协作流程不一致 | 在确认本 TDD 后单独提 PR 同步根/子 AGENTS 与 PROJECT_GUIDE |
| 聚落/忠诚系统过早复杂化 | 主线变成城市经营而不是版图模拟 | 聚落只提供扩张、治理、战争目标和可读性，不做建筑队列 |
| 最小外交膨胀成复杂外交 | UI 和 AI 决策爆炸 | 第一版只保留和平/战争/停战/叛乱战争四态 |
| 神力工具偏离历史势力争霸主线 | UI 与玩法噪声上升 | 玩家侧下线神力入口，保留剧本、编辑器和自治模拟主循环 |

## 13. 里程碑（仅作设计落地参考，不替代 PLAN.md）

- **M1 引擎骨架**：World/TickLoop、SoA stores、Pixi 应用与摄像机、随机地图、版图栅格、最小 UI（开始/暂停/速度）。
- **M2 玩法闭环**：势力扩张、前线压力与战斗结算、年表事件流、剧本注册器、随机剧本可玩。
- **M3 剧本能力**：三国剧本第一版、固定地图加载、剧本事件脚本、文化资源包。
- **M4 可扩展生态**：Worker 化模拟、回放滑动条、导出/导入存档、剧本编辑器雏形。
- **M5 多剧本扩展**：中国/世界/历史人物/公司争霸剧本逐步上线。
- **M6 自治世界**：观测报告、聚落核心、行政距离、忠诚叛乱、聚落战争目标和最小外交闭环。
- **M7 史书复盘**：Replay 事件跳转、结算史书和可分享摘要。

---

## 14. 文档归档

- 本 TDD：`apps/world-sim/docs/TDD.md`
- 计划文档（待建）：`apps/world-sim/docs/PLAN.md`
- 数据模型详解（待建）：`apps/world-sim/docs/DATA-MODEL.md`
- 剧本设计文档（待建）：`apps/world-sim/docs/scenarios/<id>.md`
