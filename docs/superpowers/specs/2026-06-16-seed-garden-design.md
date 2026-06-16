# 语种园（Seed Garden）· 设计文档

> 「万物皆可种」——一个 AI 驱动的网页放置挂机小游戏。
> 用户写下任意一个概念（情绪、事件、关键词），AI 把它种成一棵从未存在过的虚拟植物，
> 它会自己生长、写日记、和你说话，最终结果作为图鉴卡永久收藏。

- 文档版本：v1.0
- 创建日期：2026-06-16
- 所属仓库：`valley-mas`
- 目标分支：`feature/seed-garden`
- 作者：通过 brainstorming 协作设计

---

## 1. 一句话定位

> 「语种园」是一个 **网页放置挂机收集类小游戏**：
> 玩家把任何抽象概念当作种子写进输入框，AI 实时生成一棵带有人格、外形、稀有度的「概念植物」，
> 玩家挂机等待它生长，过程中收获 AI 写的成长日志，
> 最终作为图鉴卡入库收藏，也可分享给他人。

---

## 2. 核心目标与非目标

### 2.1 项目目标

| # | 目标 | 优先级 |
|---|---|---|
| G1 | 作为作者的 **作品集 / 技术展示项目**，体现 AI 时代独立开发者的工程化能力 | P0 |
| G2 | MVP 一周内可上线、可演示、可分享 | P0 |
| G3 | 视觉精致度对标 Nintendo / 动森 Q 版游戏图标，**一眼有图鉴感** | P0 |
| G4 | **0 现金运行成本**：模型用现有 Gemini Free / ChatGPT Pro，图片采用预生成 | P0 |
| G5 | 可演进为接入 valley-mas 创作者空间的「种植日记」内容模块 | P2 |

### 2.2 非目标

- 不做付费变现 / 数值氪金，MVP 阶段不接支付
- 不做多人 PVP / 实时社交
- 不做手机原生 App，只做网页（响应式适配移动端浏览器即可）
- 不做完整经济系统（货币、商店、交易），MVP 不引入复杂数值

---

## 3. 用户与场景

### 3.1 目标用户画像

- 25-35 岁、互联网/创意/学生人群
- 习惯刷小红书、推特，能 get「赛博吐槽」语境
- 喜欢治愈系、收集类小游戏（动森、Stardew Valley、Bongo Cat、Banana）
- 偶尔有情绪表达需求（焦虑、加班、失眠、八卦）

### 3.2 核心使用场景

1. **下班路上 / 摸鱼时**：打开网页种一棵「今天的情绪」，挂机一晚上回来收获
2. **深夜 emo 时**：把负面情绪种出去，AI 把它转化成有趣的植物，情绪被处理
3. **截图分享时**：把"我把 KPI 种成了食人花"截图发小红书 / 推特

### 3.3 用户旅程

```
打开首页
  → 看到自己之前种的植物已经长大（挂机产出）
  → 点开看 AI 写的成长日志（情感价值）
  → 浇水 / 收获 / 聊天（轻互动）
  → 想种新的 → 输入一个词 + 选浇水方式 → AI 生成种子 → 入花盆
  → 挂机离开
  → 下次回来又有新东西看
```

---

## 4. 玩法设计

### 4.1 核心玩法循环

```
[写下概念词] 
   ↓
[AI 生成种子：图鉴主体图 + 名片 + 首日志]
   ↓
[落入花盆，开始挂机生长]
   ↓
[3-5 个生长阶段，每阶段 AI 写一段日志]
   ↓
[偶尔触发事件：托梦 / 写信 / 长歪 / 变异]
   ↓
[收获：终结图鉴卡 + 果实 + 告别信]
   ↓
[图鉴永久收藏 → 截图分享]
```

### 4.2 种子诞生

- 用户在首页大输入框写下任意概念词（中文或英文）
- 选择「浇水方式」决定生长基调（4 选 1）：
  - 💧 普通水：中性
  - ☕ 咖啡：讽刺/赛博
  - 🍷 红酒：emo/诗意
  - 🧪 神秘药水：魔幻/中二
- 点击「播种」→ 调用 LLM 生成：
  - 植物外观 JSON（用于图鉴图匹配）
  - 植物名片（中二名 + 描述）
  - 稀有度（N/R/SR/SSR，按算法 + 随机）
  - 首段成长日志（300 字内）
- 前端展示「种子诞生」加载动画（10 秒内），完成后落入空闲花盆

### 4.3 挂机生长

- 每棵植物 **3-5 个生长阶段**：萌芽 → 幼苗 → 抽枝 → 开花 → 结果（具体阶段数随稀有度）
- 阶段间隔：**MVP 阶段全部缩短为 5-15 分钟**（让用户能在一次会话内体验完整循环），未来上线版可调长
- 每进入新阶段：
  - 切换到对应阶段的图鉴图（同一植物的不同阶段图）
  - LLM 生成一段成长日志（追加到时间线）
  - 偶尔（10% 概率）触发「植物事件」：托梦 / 长歪 / 写信 / 变异
- 用户**不需要在线**，所有进度由后端时间戳驱动

### 4.4 互动玩法

| 互动 | 频率 | 效果 | AI 调用 |
|---|---|---|---|
| 浇水 | 每天 5 次/植物 | 加速一次小阶段、AI 短文回复 | 1 次文本 |
| 聊天 | 成熟后每天 3 次 | 短对话 | 1 次文本 |
| 收获 | 成熟后 1 次 | 终结卡片 + 果实 + 告别信 | 1 次文本 |

### 4.5 收获

- 完全长成后用户可点击「收获」
- 系统产出：
  - 一张**终结图鉴卡**（最终成熟态图 + 完整故事总结）
  - 一颗**果实**（带 AI 生成属性，比如「未读消息之果 · 吃掉它会让你今天少回 3 条微信」，纯叙事，无系统效果）
  - 一段**植物给你的告别信**（300 字以内）
- 收获后植物从花盆移除，进入图鉴

### 4.6 图鉴

- 瀑布流展示所有种过的植物（终结卡）
- 每张卡可点开看完整时间线（所有阶段日志）
- 每张卡可生成「分享图」导出 PNG（含编号 / 名字 / 描述 / 稀有度）
- 支持按稀有度 / 时间 / 浇水方式筛选

---

## 5. 数据模型

### 5.1 核心实体

```
User (复用 valley-mas 现有用户系统)
   │
   └─< Garden (用户的语种园，1:1)
          │
          └─< PlantSlot (花盆位，初始 3 个，可升级)
                 │
                 └─0..1 Plant (当前花盆里的植物)

User
   │
   └─< Plant (用户种过的所有植物，包含图鉴中已收获的)
          │
          ├─< GrowthLog (生长日志条目)
          ├─< InteractionLog (浇水/聊天/事件记录)
          └─0..1 Harvest (收获信息，仅成熟收获后存在)
```

### 5.2 主要字段（Go GORM 风格示意）

```go
// Garden 用户的语种园配置
type Garden struct {
    ID            uint64
    UserID        uint64
    SlotCount     int        // 花盆数量，初始 3，可升级
    Experience    int        // 园艺经验值
    CreatedAt     time.Time
}

// Plant 一棵植物
type Plant struct {
    ID                uint64
    UserID            uint64
    SlotIndex         int        // 0/1/2... 当前位于哪个花盆，-1 表示已收获
    ConceptInput      string     // 用户原始输入
    ConceptEN         string     // LLM 翻译/规范化后的英文概念词
    Name              string     // AI 生成的中文中二名
    Description       string     // AI 生成的描述（卡片正面）
    WaterStyle        string     // water/coffee/wine/potion
    Rarity            string     // N/R/SR/SSR
    Stage             int        // 当前阶段 0/1/2/3/4
    StageMax          int        // 总阶段数 3-5
    AssetKey          string     // 对应预生成图鉴图库中的资产 key
    NextStageAt       time.Time  // 下次进入新阶段的时间戳
    Mood              string     // AI 生成的情绪词
    Status            string     // growing / mature / harvested
    CreatedAt         time.Time
    HarvestedAt       *time.Time
}

// GrowthLog 生长日志条目
type GrowthLog struct {
    ID         uint64
    PlantID    uint64
    Stage      int        // 在哪个阶段写的
    Type       string     // birth / grow / event / harvest
    Content    string     // AI 生成的文本
    CreatedAt  time.Time
}

// InteractionLog 用户和植物的互动
type InteractionLog struct {
    ID         uint64
    PlantID    uint64
    Action     string     // water / chat / fertilize
    UserInput  string     // 用户说的话（chat 时）
    AIReply    string     // AI 的回复
    CreatedAt  time.Time
}

// Harvest 收获结果
type Harvest struct {
    ID              uint64
    PlantID         uint64
    FinalAssetKey   string  // 终结卡用的图鉴图
    FinalStory      string  // AI 生成的完整故事总结
    FruitName       string
    FruitDescription string
    FarewellLetter  string
    CreatedAt       time.Time
}
```

### 5.3 资产库（不入数据库，作为静态资源）

```
apps/seed-garden/public/assets/encyclopedia/
   ├─ N/      ← 普通稀有度植物图（每张 1024x1024）
   ├─ R/      ← 稀有
   ├─ SR/     ← 史诗
   └─ SSR/    ← 传说

每张图对应一个 manifest 条目：
{
  "key": "monday_morning",
  "name_zh": "周一早上",
  "rarity": "N",
  "concept_tags": ["sleepy", "tired", "monday", "coffee"],
  "stages": {
    "1": "monday_morning_1.png",
    "2": "monday_morning_2.png",
    "3": "monday_morning_3.png"
  },
  "palette_hint": "warm brown"
}
```

LLM 用「语义匹配 + 标签」从 manifest 中挑选最合适的资产 → 不需要实时生图。

---

## 6. 技术栈与目录结构

### 6.1 选型总览

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | React 18 + TypeScript + Vite | 与 valley-mas 其他子项目一致 |
| 状态管理 | Zustand（沿用 life-trace 风格） | 轻量、与现有项目一致 |
| 样式 | Tailwind CSS + shadcn/ui | 快速构建图鉴卡 UI |
| 动画 | Framer Motion | 生长动画、卡片翻面 |
| 后端框架 | Gin + GORM（复用 valley-mas server） | 已有基础设施 |
| 数据库 | 复用现有 MySQL（valley-mas 已配置） | 无额外成本 |
| 鉴权 | 复用 server 现有 JWT 中间件 | 无额外工作 |
| AI 文本 | Gemini 2.0 Flash（免费）+ 火山 ARK 备选 | 0 成本，已有接入 |
| AI 图片 | **不在运行时调用**，全部预生成 | 0 成本、风格统一 |
| 资产存储 | 直接打包进 `apps/seed-garden/public/`（小体量） | MVP 阶段最简方案 |

### 6.2 目录结构（计划新增）

```
apps/seed-garden/                    ← 新建子项目
├─ public/
│   └─ assets/
│       ├─ encyclopedia/            ← 预生成图鉴图
│       │   ├─ N/  R/  SR/  SSR/
│       │   └─ manifest.json
│       ├─ ui/                      ← UI 装饰元素（边框纹理、icon）
│       └─ bgm/                     ← 可选：背景音
├─ src/
│   ├─ api/                         ← 调用 server 的 HTTP 客户端
│   │   ├─ garden.ts
│   │   ├─ plant.ts
│   │   └─ interaction.ts
│   ├─ components/
│   │   ├─ ui/                      ← shadcn 组件
│   │   ├─ EncyclopediaCard.tsx    ← 图鉴卡（核心 UI 组件）
│   │   ├─ PlantPot.tsx             ← 花盆视图
│   │   ├─ SeedInputBar.tsx         ← 种子输入栏
│   │   ├─ WaterStyleSelector.tsx   ← 浇水方式选择
│   │   ├─ GrowthTimeline.tsx       ← 成长日志时间线
│   │   ├─ ShareCardExport.tsx      ← 分享卡导出
│   │   └─ RarityBadge.tsx          ← 稀有度徽章
│   ├─ pages/
│   │   ├─ Garden.tsx               ← 首页（花盆视图）
│   │   ├─ PlantDetail.tsx          ← 生长详情页
│   │   ├─ Encyclopedia.tsx         ← 图鉴页
│   │   └─ Login.tsx                ← 登录（复用 web）
│   ├─ stores/
│   │   ├─ useAuthStore.ts          ← 复用 / 引用 web 端
│   │   └─ useGardenStore.ts
│   ├─ lib/
│   │   ├─ assetMatcher.ts          ← 标签语义匹配 manifest 选图
│   │   ├─ rarityRoll.ts            ← 稀有度算法
│   │   └─ stageTimer.ts            ← 阶段倒计时
│   ├─ App.tsx
│   ├─ main.tsx
│   └─ index.css
├─ AGENTS.md                         ← 子项目协作约定
├─ README.md
├─ .env.example
├─ index.html
├─ package.json
├─ tailwind.config.js
└─ vite.config.ts

server/internal/
├─ handler/
│   └─ garden/                      ← 新增 handler 包
│       ├─ garden.go                ← 花园 / 花盆相关
│       ├─ plant.go                 ← 种子 / 生长 / 收获
│       └─ interaction.go           ← 浇水 / 聊天
├─ model/
│   └─ garden.go                    ← Garden / Plant / GrowthLog 等
├─ service/
│   └─ garden/
│       ├─ assetMatcher.go          ← 服务端语义匹配（兜底）
│       ├─ growthEngine.go          ← 生长引擎、阶段推进
│       └─ aiPrompts.go             ← 所有 AI 调用的 prompt 模板
└─ ai/
    └─ ...                          ← 复用现有 ARK / Gemini 客户端
```

### 6.3 路由约定（前端）

```
/                          ← 重定向到 /garden
/garden                    ← 首页：花盆视图 + 种子输入
/garden/plant/:plantId     ← 单棵植物详情页
/garden/encyclopedia       ← 图鉴页
/garden/share/:plantId     ← 分享卡公开预览（无需登录）
```

### 6.4 后端 API（草案）

```
POST   /api/garden/init             初始化花园（首次访问）
GET    /api/garden                  获取我的花园 + 当前花盆
POST   /api/garden/plant            种下新种子（消耗一个空闲花盆）
GET    /api/garden/plant/:id        获取单棵植物详情
POST   /api/garden/plant/:id/water  浇水
POST   /api/garden/plant/:id/chat   和植物聊天
POST   /api/garden/plant/:id/harvest 收获
GET    /api/garden/encyclopedia     图鉴列表（已收获）
GET    /api/garden/share/:id        公开分享卡数据（不需要登录）
```

---

## 7. 视觉系统

### 7.1 风格定调（已锁定）

- **方向**：Nintendo / Animal Crossing / Pikmin / Kirby 风格的 **soft 3D-stylized 2D illustration**
- **关键词**：plush toy aesthetic、cel-shaded、warm gradient background、chibi proportions
- **背景**：暖黄 (#FFE9B0) → 桃橙 (#FFD09A) 全屏渐晕，**无卡框**
- **描边**：暖深棕 #4A3A2C 统一线宽
- **风格锚点图**：「未读消息·萌花花」（已生成）+「周一早上·咖啡豆」（已验证）

### 7.2 资产规范

- **画布**：1024 × 1024，1:1 正方形
- **构图**：主体居中、占画布 65%-75%、上下安全边距各 ≥ 15%
- **背景**：暖黄到桃橙径向渐晕，**铺满到画布四边**（不画卡框）
- **不含文字 / UI / 边框**（这些由前端代码层叠加）

### 7.3 Prompt 模板 v3.2（最终锁定）

> 完整 prompt 见 `docs/superpowers/specs/seed-garden-prompt-v3.2.md`（开发阶段会单独抽取，此处摘要核心结构）。

```
ART STYLE: Nintendo / Animal Crossing / Pikmin / Kirby inspired soft 3D-stylized 2D illustration,
           plush toy aesthetic, cel-shaded, mobile game icon polish.
OUTLINE:   warm dark brown #4A3A2C, consistent line weight.
BACKGROUND: full-bleed warm gradient (#FFE9B0 center → #FFD09A edges),
            radial vignette, NO card frame, edge-to-edge.
COMPOSITION: 1:1, 1024×1024, subject centered, 70% canvas height, 15% safe margin.
NEGATIVE: NO text, NO UI, NO card frame, NO watercolor, NO pure white, NO multiple subjects.
PLANT_VARIABLES (per entry):
   Concept / Form / Signature element / Mood / Rarity (N|R|SR|SSR)
```

### 7.4 资产生产流程

1. 用 ChatGPT Pro（GPT Image 1）按 v3.2 模板批量出图
2. 每个概念出 1-3 张（覆盖至少一张成熟态，幼苗中期可选）
3. 命名规范：`{concept_key}_{stage}.png`（如 `monday_morning_3.png`）
4. 写入 `manifest.json` 包含语义标签
5. 提交到 `apps/seed-garden/public/assets/encyclopedia/`

### 7.5 稀有度装饰差异化（在 prompt 内表达，不依赖代码后处理）

| 稀有度 | sparkle | aura | 其他 |
|---|---|---|---|
| N | 1 颗 | 无 | 极简 |
| R | 3 颗 | faint inner aura | - |
| SR | 5 颗 | inner + outer halo | bokeh dots |
| SSR | 5+ 颗 | full halo + light ribbon | 飘浮粒子 |

### 7.6 图鉴卡 UI（前端代码画，不依赖 AI）

```
┌─ EncyclopediaCard 组件 ───────────────┐
│  顶部条：编号 No.001     稀有度 ★ R   │  ← 文本 + RarityBadge
│  ┌─────────────────────────────────┐ │
│  │                                 │ │
│  │      [AI 主体图 1024x1024]      │ │  ← <img src={asset} />
│  │                                 │ │
│  └─────────────────────────────────┘ │
│  名字：未读消息                       │  ← Plant.Name
│  描述：那个一直没回的人...            │  ← Plant.Description
│  种植日：2026-06-16                   │  ← CreatedAt
└────────────────────────────────────────┘
```

#### 卡框样式系统（按稀有度切边框颜色）

| 稀有度 | 边框 | 阴影 |
|---|---|---|
| N  | `border-stone-300`     | `shadow-sm` |
| R  | `border-sky-400`       | `shadow-md shadow-sky-200/50` |
| SR | `border-violet-400`    | `shadow-lg shadow-violet-300/50` |
| SSR| `border-amber-400`     | `shadow-xl shadow-amber-300/60 + 边框金线动画` |

---

## 8. AI 集成

### 8.1 调用点清单

| 触发 | 类型 | 模型 | 单次成本 |
|---|---|---|---|
| 种下种子 | 文本（结构化 JSON） | Gemini 2.0 Flash | ~免费 |
| 进入新阶段 | 文本（短日志） | Gemini 2.0 Flash | ~免费 |
| 浇水回应 | 文本（短回复） | Gemini 2.0 Flash | ~免费 |
| 聊天 | 文本（短对话） | Gemini 2.0 Flash | ~免费 |
| 收获总结 | 文本（中长） | Gemini 2.0 Flash | ~免费 |
| **图片** | **不调用** | **预生成图库** | **0 元** |

### 8.2 主要 Prompt 设计

#### Prompt A：种子诞生（结构化输出）

```
你是「语种园」的种子精灵。用户写下了一个概念："{concept}"，使用浇水方式：{water_style}。
请输出 JSON：
{
  "name_zh": "中二有梗的中文植物名（4-8 字）",
  "concept_en": "用于资产匹配的英文概念关键词（1-3 词）",
  "tags": ["匹配标签 5-10 个，描述外观/情绪/形态"],
  "rarity": "N | R | SR | SSR（按概念独特性 + 随机决定）",
  "mood": "情绪词（中文）",
  "description": "卡片描述，30-50 字，中二/治愈/讽刺风格按 water_style 决定",
  "first_log": "首段成长日志，100-150 字，第一人称（植物自己说）"
}
```

#### Prompt B：阶段日志

```
植物档案：{plant_card}
当前阶段：{stage}/{stage_max}
之前的成长日志（最近 3 段）：{recent_logs}

请写一段新的成长日志，100-200 字，第一人称视角（植物自己写）。
风格基调：{water_style}（普通/讽刺/emo/中二）。
```

#### Prompt C：浇水回应、聊天回应、收获总结
（同上结构，按场景调整）

### 8.3 资产匹配算法（assetMatcher）

伪代码：

```ts
function matchAsset(tags: string[], rarity: string): AssetEntry {
  const candidates = manifest.filter(a => a.rarity === rarity);
  // 计算每个 candidate 与 tags 的标签重合度
  const scored = candidates.map(c => ({
    asset: c,
    score: tags.filter(t => c.concept_tags.includes(t)).length
  }));
  // 按分数排序，取 top 3 加随机
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  return top[Math.floor(Math.random() * top.length)].asset;
}
```

### 8.4 防滥用 / 配额

- 每用户每日：5 次种植 + 10 次浇水 + 3 次聊天
- 后端做速率限制（middleware）
- LLM 调用失败时给出兜底文案（"种子精灵在打盹..."），不阻塞游戏循环

---

## 9. MVP 范围

### 9.1 必做（P0，一周内目标）

- [x] 已完成：风格锁定 + Prompt 模板 v3.2 + 2 张验证图
- [ ] 创建 `apps/seed-garden` 子项目骨架
- [ ] 后端新增 `garden` handler / model / service
- [ ] 用户系统接入（复用 valley-mas JWT）
- [ ] 首页：3 个花盆 + 输入框 + 浇水方式 + 播种
- [ ] 种子诞生流程（含 AI JSON + 资产匹配）
- [ ] 挂机生长（后端时间戳驱动 + 前端 polling 或 SSE）
- [ ] 生长详情页 + 时间线
- [ ] 浇水互动
- [ ] 收获 → 图鉴
- [ ] 图鉴页（瀑布流）
- [ ] 至少 30 张预生成资产（覆盖 4 档稀有度）

### 9.2 体验加分（P1，MVP 内尽量）

- [ ] 浇水方式 4 选 1 + 风格化 prompt 影响
- [ ] 成熟植物聊天（每天 3 次）
- [ ] 分享卡导出（Canvas + html2canvas）
- [ ] Framer Motion 生长动画

### 9.3 V2（上线后扩展）

- [ ] 嫁接系统（两棵植物 → AI 合成新物种）
- [ ] 果实系统（趣味属性，无系统效果）
- [ ] 全站热门词（"今天大家都在种什么"）
- [ ] 多花盆解锁（按经验值）
- [ ] 成就系统

### 9.4 V3（生态融合）

- [ ] 接入 valley-mas 创作者空间：种植日记 = 创作者内容
- [ ] 朋友互送种子
- [ ] AI 季节系统（每周限定主题种子）

---

## 10. 里程碑与拆分

> 本设计文档不代表"立刻开始实现"，仅描述设计决策。
> 实施计划（含任务拆分、检查点）由后续 `writing-plans` 阶段生成 `docs/superpowers/plans/2026-06-16-seed-garden-plan.md`。

建议大致里程碑（顺序敲定，时长由实施计划再细化）：

1. **M1 - 子项目骨架与服务端模型**：创建 apps/seed-garden、新增 model 与迁移、最小路由跑通
2. **M2 - 美术资产首批入库**：30 张预生成图 + manifest.json + assetMatcher
3. **M3 - 种子诞生闭环**：输入 → AI JSON → 资产匹配 → 入花盆 → 首日志
4. **M4 - 挂机生长闭环**：阶段推进 + 日志生成 + 时间线渲染
5. **M5 - 互动 & 收获**：浇水、聊天、收获 → 图鉴
6. **M6 - 图鉴 & 分享**：图鉴页 + 分享卡导出
7. **M7 - 收尾**：动画打磨、空状态、错误兜底、移动端响应式

---

## 11. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| AI 生成 JSON 不规范导致前端崩溃 | 🟡 | LLM prompt 强约束 + JSON Schema 校验 + 兜底默认值 |
| 资产库覆盖不全，用户看到撞图 | 🟡 | manifest 增加随机加权 + 持续补充资产 |
| 挂机时间戳被前端篡改 | 🟢 | 所有阶段推进由后端校验时间戳 |
| Gemini Free 触发限速 | 🟡 | 双模型降级（Gemini → ARK 豆包），失败兜底文案 |
| 图鉴文件大小超限（30+ 张 1024px） | 🟢 | WebP 压缩、按需加载、CDN（valley-mas 已用 TOS） |
| MVP 工期超期 | 🟡 | 严控 P0 范围，P1 砍到 V2 |

---

## 12. 与 valley-mas 全局约定的衔接

- 默认中文沟通与中文文案，遵循 `AGENTS.md` 顶层红线
- 子项目入口 `apps/seed-garden/AGENTS.md`：在实施阶段创建，仅写局部规则
- 校验 checklist：
  - [ ] Go 服务改动：`cd server && go test ./...`
  - [ ] 子项目 TS：`pnpm --filter @valley/seed-garden exec tsc --noEmit`（待 package.json 命名后确认）
  - [ ] 中文文案 / Markdown：`python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <文件>`
- 计划文档同步：本文件即设计稿；后续实施计划单独写在 `docs/superpowers/plans/`
- Git 规则：
  - 分支已创建：`feature/seed-garden`
  - 提交按 `conventional-commit-guard` 风格
  - 不自动提交，只在用户明确要求时进入 commit 流程

---

## 13. 作品集叙事（Pitch）

> 「我做了一个 AI 挂机种田游戏，但你能种的不是萝卜白菜，而是任何东西——
> 你的焦虑、你的前任、你的代码、你的 KPI。AI 会把它种成一棵从未存在过的植物，
> 给它写日记、让它对你说话。
>
> 这是一个 vibecoding 时代的产品实验：
> 让 AI 不只是生成内容，而是生成情感关系。
>
> 工程上，我用一套统一的 prompt 模板 + 预生成资产库 + 语义匹配引擎，
> 把'AI 现场作画'变成'AI 现场策展'，
> 在 0 现金成本下做到了 Nintendo / 动森级的图鉴视觉精致度。」

---

## 14. 附录

### 14.1 已经验证的视觉锚点

- 「未读消息·R」萌花花（紫粉色铃铛 + 99+ 气泡 + 心口红点）
- 「周一早上·N」困倦咖啡豆（蒸汽 + 困倦表情 + 双脸蛋红晕 + 苔藓底座）

两张图风格高度一致，证明 Prompt 模板 v3.2 可批量复用。

### 14.2 待开发阶段产出的衍生文档

- `docs/superpowers/plans/2026-06-16-seed-garden-plan.md`（实施计划，由 writing-plans 阶段生成）
- `apps/seed-garden/AGENTS.md`（子项目协作约定，实现时创建）
- `apps/seed-garden/README.md`（子项目说明，实现时创建）
- 完整的 Prompt v3.2 全文（实现时抽取为独立文件方便复用）

### 14.3 设计决策记录（关键判断）

| 决策 | 备选 | 选择 | 理由 |
|---|---|---|---|
| 美术风格 | 水彩 / 像素 / 3D / **动森 Q 版** | 动森 Q 版 | 用户审美 + 作品集辨识度 + GPT 能稳定产出 |
| 图片来源 | 实时 AI 生图 / **预生成库** / 付费素材 | 预生成库 | 0 现金成本 + 风格统一可控 |
| 卡框 | AI 画 / **代码画** | 代码画 | 一致性 100% + 可改 + 工程化叙事 |
| AI 文本 | OpenAI / 豆包 / **Gemini Free** | Gemini Free + ARK 兜底 | 0 成本 + 已有接入 |
| 子项目位置 | apps/web 子模块 / **独立 apps/seed-garden** | 独立 | 解耦、可单独部署、AGENTS 路由清晰 |
| 阶段时长 MVP | 长（数小时）/ **短（5-15 分钟）** | 短 | MVP 让用户能在一次会话内体验完整循环 |

---

## 15. Spec 自查（写完之后的快速检查）

- [x] 没有 TBD / TODO / 占位符
- [x] 玩法、数据模型、技术栈、AI 调用、视觉系统四块自洽
- [x] MVP 范围明确，P0/P1/V2 分层清晰
- [x] 与 valley-mas 全局规则衔接（AGENTS / 校验 checklist / 计划文档）
- [x] 作品集叙事维度有体现
- [x] 风险有识别 + 缓解

— END —
