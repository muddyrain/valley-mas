# Seed Garden 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于设计文档 [2026-06-16-seed-garden-design.md](file:///Users/bytedance/Desktop/study/valley-mas/docs/superpowers/specs/2026-06-16-seed-garden-design.md)，在 valley-mas monorepo 中分阶段交付一个 0 现金成本、Nintendo 动森风的 AI 挂机种田作品集小游戏「语种园（Seed Garden）」MVP。

**Architecture:** 前端独立子项目 `apps/seed-garden`（Vite + React 18 + TS + Tailwind + shadcn/ui + Framer Motion + Zustand），后端 `server/internal/garden` 子包（参照 `mindarena` 模式：handler / service / store / types），数据库复用现有 MySQL，鉴权复用 JWT 中间件。AI 文本调用走 Gemini Free / ARK 兜底（复用 `internal/ai`），植物图片靠 ChatGPT Pro 预生成图库 + manifest 标签语义匹配（**不在运行时调用图片生成 API**）。

**Tech Stack:**
- 前端：React 18 + TypeScript + Vite 5 + Tailwind 3 + shadcn/ui + Framer Motion + Zustand
- 后端：Go + Gin + GORM（复用 `valley-server`）
- AI：复用 `server/internal/ai`（Gemini 优先、ARK 兜底）
- 资产：预生成 PNG（命名 `<concept_key>_<stage>.png`）+ `manifest.json`
- Lint/格式：复用根目录 Biome / Tailwind / tsconfig

**Spec 引用规范：** 本计划频繁引用设计文档，统一写作 [设计文档 §X.Y](file:///Users/bytedance/Desktop/study/valley-mas/docs/superpowers/specs/2026-06-16-seed-garden-design.md)，请在执行任务时回看对应章节。

---

## File Structure 总览

### 后端（server/）

| 路径 | 责任 |
|---|---|
| `server/internal/model/garden.go` | Garden / Plant / GrowthLog / InteractionLog / Harvest 五个 GORM 模型 |
| `server/internal/garden/types.go` | API 请求/响应 DTO + 常量（稀有度、状态、阶段、water style） |
| `server/internal/garden/store.go` | 接口 `Store`（Garden / Plant / Log / Harvest 持久化方法） |
| `server/internal/garden/gorm_store.go` | `Store` 的 GORM 实现 |
| `server/internal/garden/asset_manifest.go` | 资产 manifest.json 加载 + assetMatcher 算法 |
| `server/internal/garden/prompts.go` | 5 个 AI prompt 模板（A 种子诞生、B 阶段日志、C 浇水、D 聊天、E 收获） |
| `server/internal/garden/ai.go` | 调用 `internal/ai` 的 wrapper：JSON 解析 + 兜底文案 |
| `server/internal/garden/growth_engine.go` | 时间戳驱动的阶段推进：`AdvancePlant(now)` |
| `server/internal/garden/rarity.go` | 稀有度 roll 算法（concept 长度 + 随机数） |
| `server/internal/garden/service.go` | 业务编排：`InitGarden / Plant / GetPlant / Water / Chat / Harvest / ListEncyclopedia` |
| `server/internal/garden/handler.go` | Gin handler：路径参数 / JSON 绑定 / 错误响应 |
| `server/internal/garden/routes.go` | `RegisterGardenRoutes(api *gin.RouterGroup, h *Handler, auth gin.HandlerFunc)` |
| `server/internal/garden/*_test.go` | 单元测试（store mock、growth engine、rarity、asset matcher、handler 用 httptest） |
| `server/internal/garden/assets/manifest.json` | 资产清单（与前端 public/assets 同步） |
| `server/internal/router/router.go` | 在 `api := r.Group("/api/v1")` 内注册 garden 路由（参照 mindarena） |
| `server/internal/database/database.go` | 在 AutoMigrate 列表内追加 garden 5 个模型 |

### 前端（apps/seed-garden/）

| 路径 | 责任 |
|---|---|
| `apps/seed-garden/package.json` | `@valley/seed-garden`，scripts: dev/build/typecheck/check/clean |
| `apps/seed-garden/vite.config.ts` | dev 端口 5180，proxy 到 8080 |
| `apps/seed-garden/tsconfig.json` | 严格模式 + paths |
| `apps/seed-garden/tailwind.config.js` | 复用 monorepo 主题，扩展 garden 色板 |
| `apps/seed-garden/postcss.config.js` | tailwindcss + autoprefixer |
| `apps/seed-garden/index.html` | Vite 入口 |
| `apps/seed-garden/.env.example` | `VITE_API_BASE_URL=http://localhost:8080/api/v1` |
| `apps/seed-garden/AGENTS.md` | 子项目协作约定 |
| `apps/seed-garden/README.md` | 启动说明、资产生产流程 |
| `apps/seed-garden/public/assets/encyclopedia/manifest.json` | 与后端同步的资产清单 |
| `apps/seed-garden/public/assets/encyclopedia/{N,R,SR,SSR}/*.png` | 预生成植物图 |
| `apps/seed-garden/src/main.tsx` | 应用入口 |
| `apps/seed-garden/src/App.tsx` | 路由：`/garden`、`/garden/plant/:id`、`/garden/encyclopedia`、`/garden/share/:id`、`/login` |
| `apps/seed-garden/src/index.css` | Tailwind base + 全局样式（暖黄渐晕） |
| `apps/seed-garden/src/lib/request.ts` | axios 实例 + token 拦截器 |
| `apps/seed-garden/src/api/garden.ts` | `initGarden / getGarden` |
| `apps/seed-garden/src/api/plant.ts` | `plantSeed / getPlant / harvest` |
| `apps/seed-garden/src/api/interaction.ts` | `water / chat` |
| `apps/seed-garden/src/api/encyclopedia.ts` | `listEncyclopedia / getShareCard` |
| `apps/seed-garden/src/stores/useAuthStore.ts` | JWT 持久化 |
| `apps/seed-garden/src/stores/useGardenStore.ts` | 当前花园 + plants 缓存 |
| `apps/seed-garden/src/components/SeedInputBar.tsx` | 概念词输入 |
| `apps/seed-garden/src/components/WaterStyleSelector.tsx` | 4 选 1 浇水方式 |
| `apps/seed-garden/src/components/PlantPot.tsx` | 单个花盆视图（含状态：空 / 生长中 / 成熟） |
| `apps/seed-garden/src/components/EncyclopediaCard.tsx` | 图鉴卡（含稀有度卡框） |
| `apps/seed-garden/src/components/RarityBadge.tsx` | 稀有度徽章 |
| `apps/seed-garden/src/components/GrowthTimeline.tsx` | 时间线日志 |
| `apps/seed-garden/src/components/ShareCardExport.tsx` | html2canvas 导出 PNG |
| `apps/seed-garden/src/components/SeedBirthAnimation.tsx` | 种子诞生 10s 加载动画 |
| `apps/seed-garden/src/pages/Garden.tsx` | 首页（花盆视图 + 输入栏） |
| `apps/seed-garden/src/pages/PlantDetail.tsx` | 单棵植物详情 |
| `apps/seed-garden/src/pages/Encyclopedia.tsx` | 图鉴瀑布流 |
| `apps/seed-garden/src/pages/SharePreview.tsx` | 公开分享页 |
| `apps/seed-garden/src/pages/Login.tsx` | 登录（复用 web 端策略） |
| `apps/seed-garden/src/lib/rarityStyles.ts` | 稀有度卡框 Tailwind class 表 |
| `apps/seed-garden/src/lib/stageTimer.ts` | 阶段倒计时格式化 |
| `apps/seed-garden/src/lib/__tests__/*.test.ts` | 关键 lib 单测（vitest） |

### 文档与协作

| 路径 | 责任 |
|---|---|
| `docs/superpowers/specs/seed-garden-prompt-v3.2.md` | Prompt v3.2 全文（图片生产参考） |
| `apps/seed-garden/AGENTS.md` | 子项目协作约定 |
| `apps/seed-garden/README.md` | 启动说明 |
| `AGENTS.md`（根） | 在「子项目 AGENTS 路由」表追加一行 |

---

## 总任务索引（M1–M7）

- **M1：子项目骨架与服务端模型**（任务 1–4）
- **M2：资产 manifest 与匹配引擎**（任务 5–6）
- **M3：种子诞生闭环**（任务 7–10）
- **M4：挂机生长闭环**（任务 11–12）
- **M5：互动与收获**（任务 13–15）
- **M6：图鉴与分享卡**（任务 16–17）
- **M7：动画 / 兜底 / 移动端 / 收尾**（任务 18–20）

---

# M1 子项目骨架与服务端模型

## Task 1: 抽取 Prompt v3.2 到独立文档

**Files:**
- Create: `docs/superpowers/specs/seed-garden-prompt-v3.2.md`

- [ ] **Step 1：创建 prompt 文档**

把设计文档 §7.3 的 Prompt 模板 v3.2 摘要扩写为完整可复制版本，结构：
1. 顶部说明（用途：在 ChatGPT Pro / GPT Image 1 中批量出图）
2. 完整的 ART STYLE / OUTLINE / BACKGROUND / COMPOSITION / NEGATIVE / PLANT_VARIABLES 段落
3. 「替换变量」清单：Concept、Form、Signature element、Mood、Rarity（含稀有度装饰差异化表，§7.5）
4. 4 个 worked example：未读消息·R / 周一早上·N / 1 个 SR 范例 / 1 个 SSR 范例

- [ ] **Step 2：encoding 校验 + 提交**

```bash
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py docs/superpowers/specs/seed-garden-prompt-v3.2.md
git add docs/superpowers/specs/seed-garden-prompt-v3.2.md
git commit -m "docs(seed-garden): 抽取 Prompt v3.2 模板为独立文档"
```

预期：encoding 校验输出 `PASS`，commit 成功。

---

## Task 2: 创建 apps/seed-garden 子项目骨架

**Files:**
- Create: `apps/seed-garden/package.json`
- Create: `apps/seed-garden/tsconfig.json`
- Create: `apps/seed-garden/vite.config.ts`
- Create: `apps/seed-garden/tailwind.config.js`
- Create: `apps/seed-garden/postcss.config.js`
- Create: `apps/seed-garden/index.html`
- Create: `apps/seed-garden/.env.example`
- Create: `apps/seed-garden/src/main.tsx`
- Create: `apps/seed-garden/src/App.tsx`
- Create: `apps/seed-garden/src/index.css`
- Create: `apps/seed-garden/AGENTS.md`
- Create: `apps/seed-garden/README.md`
- Create: `apps/seed-garden/public/assets/encyclopedia/.gitkeep`
- Modify: `AGENTS.md`（根，追加路由表行）

- [ ] **Step 1：写 package.json**

```json
{
  "name": "@valley/seed-garden",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5180",
    "build": "vite build",
    "preview": "vite preview --port 5180",
    "typecheck": "tsc --noEmit",
    "check": "biome check src",
    "lint": "biome lint src",
    "format": "biome format --write src",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.0.2",
    "axios": "^1.7.0",
    "clsx": "catalog:shared-runtime",
    "framer-motion": "^11.0.0",
    "html2canvas": "^1.4.1",
    "lucide-react": "catalog:shared-runtime",
    "react": "catalog:react-18",
    "react-dom": "catalog:react-18",
    "react-router-dom": "^6.22.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "catalog:node-22",
    "@types/react": "catalog:react-18",
    "@types/react-dom": "catalog:react-18",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "catalog:tailwind-3",
    "postcss": "catalog:tailwind-3",
    "tailwindcss": "catalog:tailwind-3",
    "typescript": "catalog:ts-tooling",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

> 若 `react-18`、`react-router-dom`、`zustand`、`vitest`、`framer-motion` 在根 catalog 中已有 pin，使用 `catalog:` 引用，按 `apps/admin/package.json`、`apps/life-trace/package.json` 同名依赖对齐。**实施前先 `cat pnpm-workspace.yaml`** 确认 catalog 名称。

- [ ] **Step 2：写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3：写 vite.config.ts**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5180,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4：写 tailwind.config.js / postcss.config.js / index.html / .env.example**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        garden: {
          warm: "#FFE9B0",
          peach: "#FFD09A",
          ink: "#4A3A2C",
        },
      },
    },
  },
  plugins: [],
};
```

```js
// postcss.config.js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>语种园 · Seed Garden</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```
# .env.example
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_API_PROXY_TARGET=http://localhost:8080
```

- [ ] **Step 5：写最小可运行的 main.tsx / App.tsx / index.css**

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

```tsx
// src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/garden" replace />} />
      <Route
        path="/garden"
        element={
          <div className="min-h-screen flex items-center justify-center text-garden-ink">
            语种园占位页（M3 替换）
          </div>
        }
      />
    </Routes>
  );
}
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", system-ui, sans-serif;
  background: radial-gradient(circle at center, #FFE9B0 0%, #FFD09A 100%);
  color: #4A3A2C;
}
```

- [ ] **Step 6：写 AGENTS.md（子项目）**

```markdown
# Seed Garden AGENTS

本文件只补充 `apps/seed-garden` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- AI 驱动的网页放置挂机收集小游戏「语种园」。
- 用户输入概念词 → AI 生成「概念植物」→ 挂机生长 → 收获入图鉴。
- 视觉风格锁定 Nintendo / 动森 Q 版 plush 风，**植物图全部来自预生成图库**，运行时不调用图片生成 API。
- 后端入口：`server/internal/garden`，路由前缀 `/api/v1/garden`。

## 路由与代码入口

- 应用入口：`src/main.tsx`、`src/App.tsx`。
- API 封装：`src/api/{garden,plant,interaction,encyclopedia}.ts`。
- 状态：`src/stores/{useAuthStore,useGardenStore}.ts`。
- 资产：`public/assets/encyclopedia/{N,R,SR,SSR}/*.png` + `manifest.json`。
- 设计文档：`docs/superpowers/specs/2026-06-16-seed-garden-design.md`。
- 实施计划：`docs/superpowers/plans/2026-06-16-seed-garden-plan.md`。
- Prompt 模板：`docs/superpowers/specs/seed-garden-prompt-v3.2.md`。

## 视觉与产品规范

- 全屏暖黄→桃橙渐晕背景，无白底。
- 植物图保持 1024×1024 透明感，**前端代码画卡框**，AI 不画 UI。
- 稀有度卡框颜色见设计文档 §7.6。
- 不要把游戏改成扁平 SaaS 风。

## 常用命令

\`\`\`bash
cd apps/seed-garden && pnpm dev
pnpm --filter @valley/seed-garden typecheck
pnpm --filter @valley/seed-garden check
pnpm --filter @valley/seed-garden test
pnpm --filter @valley/seed-garden build
\`\`\`

## 校验要求

- 类型/逻辑改动：至少 `pnpm --filter @valley/seed-garden typecheck`。
- 样式/lint：`pnpm --filter @valley/seed-garden check`。
- 测试：`pnpm --filter @valley/seed-garden test`。
- 接口契约改动：同步检查 `server/internal/garden`。
```

- [ ] **Step 7：写 README.md**

```markdown
# 语种园 · Seed Garden

AI 驱动的网页放置挂机小游戏。详见：

- 设计文档：[docs/superpowers/specs/2026-06-16-seed-garden-design.md](../../docs/superpowers/specs/2026-06-16-seed-garden-design.md)
- 实施计划：[docs/superpowers/plans/2026-06-16-seed-garden-plan.md](../../docs/superpowers/plans/2026-06-16-seed-garden-plan.md)

## 启动

\`\`\`bash
cp .env.example .env.local
cd ../.. && pnpm install
cd apps/seed-garden && pnpm dev
\`\`\`

后端：

\`\`\`bash
cd ../../server && go run ./cmd/server
\`\`\`

## 资产生产流程

1. 使用 ChatGPT Pro（GPT Image 1）按 `docs/superpowers/specs/seed-garden-prompt-v3.2.md` 出图。
2. 命名 `<concept_key>_<stage>.png`（如 `monday_morning_3.png`）。
3. 放入 `public/assets/encyclopedia/<rarity>/`。
4. 同步更新 `public/assets/encyclopedia/manifest.json` 与 `server/internal/garden/assets/manifest.json`。
```

- [ ] **Step 8：在根 AGENTS.md 路由表追加 seed-garden 行**

修改 [AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/AGENTS.md) 子项目 AGENTS 路由表，新增：

```
| 语种园 | `apps/seed-garden/AGENTS.md` | AI 挂机种田作品集小游戏的前端、视觉规范、资产清单和接口契约。 |
```

放在「Go 服务端」行之前。

- [ ] **Step 9：占位 .gitkeep**

```bash
mkdir -p apps/seed-garden/public/assets/encyclopedia
touch apps/seed-garden/public/assets/encyclopedia/.gitkeep
```

- [ ] **Step 10：装依赖、跑 typecheck**

```bash
pnpm install
pnpm --filter @valley/seed-garden typecheck
```

预期：typecheck 通过。

- [ ] **Step 11：encoding 校验 + 提交**

```bash
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
  apps/seed-garden/AGENTS.md \
  apps/seed-garden/README.md \
  AGENTS.md
git add apps/seed-garden/ AGENTS.md pnpm-lock.yaml
git commit -m "feat(seed-garden): 创建 apps/seed-garden 子项目骨架"
```

预期：encoding `PASS`，commit 成功。

---

## Task 3: 后端模型 server/internal/model/garden.go

**Files:**
- Create: `server/internal/model/garden.go`
- Create: `server/internal/model/garden_test.go`
- Modify: `server/internal/database/database.go`（AutoMigrate 列表）

- [ ] **Step 1：写失败的模型表名测试**

```go
// server/internal/model/garden_test.go
package model

import "testing"

func TestGardenTableNames(t *testing.T) {
    cases := []struct{ name, want string }{
        {(&Garden{}).TableName(), "gardens"},
        {(&Plant{}).TableName(), "garden_plants"},
        {(&GrowthLog{}).TableName(), "garden_growth_logs"},
        {(&InteractionLog{}).TableName(), "garden_interaction_logs"},
        {(&Harvest{}).TableName(), "garden_harvests"},
    }
    for _, c := range cases {
        if c.name != c.want {
            t.Fatalf("expected %s, got %s", c.want, c.name)
        }
    }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd server && go test ./internal/model/ -run TestGardenTableNames
```

预期：编译错误（Garden 等类型未定义）。

- [ ] **Step 3：写 garden.go**

```go
// server/internal/model/garden.go
package model

import "time"

// Garden 用户的语种园配置
type Garden struct {
    ID         uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
    UserID     uint64    `gorm:"uniqueIndex;not null"     json:"user_id"`
    SlotCount  int       `gorm:"not null;default:3"       json:"slot_count"`
    Experience int       `gorm:"not null;default:0"       json:"experience"`
    CreatedAt  time.Time `json:"created_at"`
    UpdatedAt  time.Time `json:"updated_at"`
}

func (Garden) TableName() string { return "gardens" }

// Plant 一棵植物
type Plant struct {
    ID           uint64     `gorm:"primaryKey;autoIncrement"             json:"id"`
    UserID       uint64     `gorm:"index;not null"                       json:"user_id"`
    SlotIndex    int        `gorm:"not null;default:-1"                  json:"slot_index"`
    ConceptInput string     `gorm:"type:varchar(255);not null"           json:"concept_input"`
    ConceptEN    string     `gorm:"type:varchar(120);not null"           json:"concept_en"`
    Name         string     `gorm:"type:varchar(120);not null"           json:"name"`
    Description  string     `gorm:"type:varchar(500);not null"           json:"description"`
    WaterStyle   string     `gorm:"type:varchar(20);not null"            json:"water_style"`
    Rarity       string     `gorm:"type:varchar(8);not null;index"       json:"rarity"`
    Stage        int        `gorm:"not null;default:0"                   json:"stage"`
    StageMax     int        `gorm:"not null;default:3"                   json:"stage_max"`
    AssetKey     string     `gorm:"type:varchar(120);not null;index"     json:"asset_key"`
    NextStageAt  time.Time  `gorm:"index"                                json:"next_stage_at"`
    Mood         string     `gorm:"type:varchar(60);not null;default:''" json:"mood"`
    Status       string     `gorm:"type:varchar(20);not null;index"      json:"status"`
    CreatedAt    time.Time  `json:"created_at"`
    UpdatedAt    time.Time  `json:"updated_at"`
    HarvestedAt  *time.Time `json:"harvested_at"`
}

func (Plant) TableName() string { return "garden_plants" }

// GrowthLog 生长日志
type GrowthLog struct {
    ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
    PlantID   uint64    `gorm:"index;not null"           json:"plant_id"`
    Stage     int       `gorm:"not null"                 json:"stage"`
    Type      string    `gorm:"type:varchar(20);not null" json:"type"`
    Content   string    `gorm:"type:text;not null"       json:"content"`
    CreatedAt time.Time `gorm:"index"                    json:"created_at"`
}

func (GrowthLog) TableName() string { return "garden_growth_logs" }

// InteractionLog 用户互动
type InteractionLog struct {
    ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
    PlantID   uint64    `gorm:"index;not null"           json:"plant_id"`
    Action    string    `gorm:"type:varchar(20);not null;index" json:"action"`
    UserInput string    `gorm:"type:varchar(500)"        json:"user_input"`
    AIReply   string    `gorm:"type:text"                json:"ai_reply"`
    CreatedAt time.Time `gorm:"index"                    json:"created_at"`
}

func (InteractionLog) TableName() string { return "garden_interaction_logs" }

// Harvest 收获结果
type Harvest struct {
    ID               uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
    PlantID          uint64    `gorm:"uniqueIndex;not null"     json:"plant_id"`
    FinalAssetKey    string    `gorm:"type:varchar(120);not null" json:"final_asset_key"`
    FinalStory       string    `gorm:"type:text;not null"       json:"final_story"`
    FruitName        string    `gorm:"type:varchar(120);not null" json:"fruit_name"`
    FruitDescription string    `gorm:"type:varchar(500);not null" json:"fruit_description"`
    FarewellLetter   string    `gorm:"type:text;not null"       json:"farewell_letter"`
    CreatedAt        time.Time `json:"created_at"`
}

func (Harvest) TableName() string { return "garden_harvests" }
```

- [ ] **Step 4：跑测试确认通过**

```bash
cd server && go test ./internal/model/ -run TestGardenTableNames -v
```

预期：PASS。

- [ ] **Step 5：把模型加入 AutoMigrate**

阅读 [database.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/database/database.go) 找到 `db.AutoMigrate(...)` 调用，在末尾追加：

```go
&model.Garden{},
&model.Plant{},
&model.GrowthLog{},
&model.InteractionLog{},
&model.Harvest{},
```

- [ ] **Step 6：跑全量测试 + 提交**

```bash
cd server && go test ./...
git add server/internal/model/garden.go server/internal/model/garden_test.go server/internal/database/database.go
git commit -m "feat(garden): 新增 Garden/Plant/GrowthLog/InteractionLog/Harvest 模型与迁移"
```

预期：所有测试 PASS。

---

## Task 4: 后端 garden 子包骨架与路由占位

**Files:**
- Create: `server/internal/garden/types.go`
- Create: `server/internal/garden/store.go`
- Create: `server/internal/garden/gorm_store.go`
- Create: `server/internal/garden/service.go`
- Create: `server/internal/garden/handler.go`
- Create: `server/internal/garden/routes.go`
- Create: `server/internal/garden/handler_test.go`
- Modify: `server/internal/router/router.go`（注册路由）

- [ ] **Step 1：写常量与 DTO（types.go）**

```go
// server/internal/garden/types.go
package garden

const (
    StatusGrowing   = "growing"
    StatusMature    = "mature"
    StatusHarvested = "harvested"

    RarityN   = "N"
    RarityR   = "R"
    RaritySR  = "SR"
    RaritySSR = "SSR"

    WaterPlain  = "water"
    WaterCoffee = "coffee"
    WaterWine   = "wine"
    WaterPotion = "potion"

    LogTypeBirth   = "birth"
    LogTypeGrow    = "grow"
    LogTypeEvent   = "event"
    LogTypeHarvest = "harvest"

    ActionWater = "water"
    ActionChat  = "chat"
)

// PlantSeedReq 种下种子的请求
type PlantSeedReq struct {
    Concept    string `json:"concept"     binding:"required,max=80"`
    WaterStyle string `json:"water_style" binding:"required,oneof=water coffee wine potion"`
}

// WaterReq / ChatReq
type WaterReq struct{}
type ChatReq struct {
    Message string `json:"message" binding:"required,max=200"`
}
```

- [ ] **Step 2：写 Store 接口骨架（store.go）**

```go
// server/internal/garden/store.go
package garden

import (
    "context"
    "valley-server/internal/model"
)

type Store interface {
    GetGarden(ctx context.Context, userID uint64) (*model.Garden, error)
    EnsureGarden(ctx context.Context, userID uint64) (*model.Garden, error)

    CreatePlant(ctx context.Context, p *model.Plant) error
    GetPlant(ctx context.Context, id uint64) (*model.Plant, error)
    UpdatePlant(ctx context.Context, p *model.Plant) error
    ListActivePlantsByUser(ctx context.Context, userID uint64) ([]model.Plant, error)
    ListHarvestedPlantsByUser(ctx context.Context, userID uint64) ([]model.Plant, error)

    AppendGrowthLog(ctx context.Context, log *model.GrowthLog) error
    ListGrowthLogs(ctx context.Context, plantID uint64) ([]model.GrowthLog, error)

    AppendInteractionLog(ctx context.Context, log *model.InteractionLog) error
    CountTodayInteractions(ctx context.Context, plantID uint64, action string) (int, error)

    CreateHarvest(ctx context.Context, h *model.Harvest) error
    GetHarvest(ctx context.Context, plantID uint64) (*model.Harvest, error)
}
```

- [ ] **Step 3：写 GormStore 实现（gorm_store.go）**

参照 [gorm_store.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/mindarena/gorm_store.go) 实现每个方法：用 `db.WithContext(ctx).Where(...)` + `First/Find/Create/Save`。`EnsureGarden` 用 `FirstOrCreate(...)`，`CountTodayInteractions` 用 `Where("plant_id = ? AND action = ? AND created_at >= ?", id, action, todayMidnight)`。

```go
// server/internal/garden/gorm_store.go
package garden

import (
    "context"
    "errors"
    "time"

    "valley-server/internal/model"

    "gorm.io/gorm"
)

type gormStore struct{ db *gorm.DB }

func NewGormStore(db *gorm.DB) Store { return &gormStore{db: db} }

func (s *gormStore) GetGarden(ctx context.Context, userID uint64) (*model.Garden, error) {
    var g model.Garden
    if err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&g).Error; err != nil {
        return nil, err
    }
    return &g, nil
}

func (s *gormStore) EnsureGarden(ctx context.Context, userID uint64) (*model.Garden, error) {
    var g model.Garden
    err := s.db.WithContext(ctx).Where(model.Garden{UserID: userID}).
        Attrs(model.Garden{SlotCount: 3}).FirstOrCreate(&g).Error
    if err != nil {
        return nil, err
    }
    return &g, nil
}

func (s *gormStore) CreatePlant(ctx context.Context, p *model.Plant) error {
    return s.db.WithContext(ctx).Create(p).Error
}

func (s *gormStore) GetPlant(ctx context.Context, id uint64) (*model.Plant, error) {
    var p model.Plant
    if err := s.db.WithContext(ctx).First(&p, id).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, ErrPlantNotFound
        }
        return nil, err
    }
    return &p, nil
}

func (s *gormStore) UpdatePlant(ctx context.Context, p *model.Plant) error {
    return s.db.WithContext(ctx).Save(p).Error
}

func (s *gormStore) ListActivePlantsByUser(ctx context.Context, userID uint64) ([]model.Plant, error) {
    var ps []model.Plant
    err := s.db.WithContext(ctx).
        Where("user_id = ? AND status <> ?", userID, StatusHarvested).
        Order("slot_index ASC").Find(&ps).Error
    return ps, err
}

func (s *gormStore) ListHarvestedPlantsByUser(ctx context.Context, userID uint64) ([]model.Plant, error) {
    var ps []model.Plant
    err := s.db.WithContext(ctx).
        Where("user_id = ? AND status = ?", userID, StatusHarvested).
        Order("harvested_at DESC").Find(&ps).Error
    return ps, err
}

func (s *gormStore) AppendGrowthLog(ctx context.Context, log *model.GrowthLog) error {
    return s.db.WithContext(ctx).Create(log).Error
}

func (s *gormStore) ListGrowthLogs(ctx context.Context, plantID uint64) ([]model.GrowthLog, error) {
    var logs []model.GrowthLog
    err := s.db.WithContext(ctx).Where("plant_id = ?", plantID).
        Order("created_at ASC").Find(&logs).Error
    return logs, err
}

func (s *gormStore) AppendInteractionLog(ctx context.Context, log *model.InteractionLog) error {
    return s.db.WithContext(ctx).Create(log).Error
}

func (s *gormStore) CountTodayInteractions(ctx context.Context, plantID uint64, action string) (int, error) {
    var n int64
    today := time.Now().Truncate(24 * time.Hour)
    err := s.db.WithContext(ctx).Model(&model.InteractionLog{}).
        Where("plant_id = ? AND action = ? AND created_at >= ?", plantID, action, today).
        Count(&n).Error
    return int(n), err
}

func (s *gormStore) CreateHarvest(ctx context.Context, h *model.Harvest) error {
    return s.db.WithContext(ctx).Create(h).Error
}

func (s *gormStore) GetHarvest(ctx context.Context, plantID uint64) (*model.Harvest, error) {
    var h model.Harvest
    if err := s.db.WithContext(ctx).Where("plant_id = ?", plantID).First(&h).Error; err != nil {
        return nil, err
    }
    return &h, nil
}

// 错误常量在 service.go 定义
```

- [ ] **Step 4：写 service.go 占位**

```go
// server/internal/garden/service.go
package garden

import "errors"

var (
    ErrPlantNotFound      = errors.New("plant not found")
    ErrPlantNotOwned      = errors.New("plant not owned by user")
    ErrSlotsFull          = errors.New("all slots are full")
    ErrAlreadyMature      = errors.New("plant already mature")
    ErrNotMature          = errors.New("plant not yet mature")
    ErrInteractionLimited = errors.New("daily interaction limit reached")
)

// Service 是 handler 调用的业务接口；实现在后续任务逐步填充
type Service struct {
    store Store
    // ai / matcher / clock 等依赖在后续任务注入
}

func NewService(store Store) *Service {
    return &Service{store: store}
}
```

- [ ] **Step 5：写 handler.go + routes.go 占位**

```go
// server/internal/garden/handler.go
package garden

import (
    "net/http"

    "github.com/gin-gonic/gin"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Health 是 M1 的占位；后续任务逐个加 handler 方法
func (h *Handler) Health(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"ok": true, "module": "garden"})
}
```

```go
// server/internal/garden/routes.go
package garden

import "github.com/gin-gonic/gin"

func RegisterGardenRoutes(api *gin.RouterGroup, h *Handler, auth gin.HandlerFunc) {
    g := api.Group("/garden")
    g.GET("/health", h.Health)
    // 后续任务在此注册具体路由
    _ = auth
}
```

- [ ] **Step 6：写 handler_test.go 验证 health**

```go
// server/internal/garden/handler_test.go
package garden_test

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "valley-server/internal/garden"

    "github.com/gin-gonic/gin"
)

func TestHealth(t *testing.T) {
    gin.SetMode(gin.TestMode)
    r := gin.New()
    api := r.Group("/api/v1")
    h := garden.NewHandler(garden.NewService(nil))
    garden.RegisterGardenRoutes(api, h, func(c *gin.Context) { c.Next() })

    w := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodGet, "/api/v1/garden/health", nil)
    r.ServeHTTP(w, req)
    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d", w.Code)
    }
}
```

- [ ] **Step 7：在 router.go 注册 garden 路由**

阅读 [router.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/router/router.go#L31-L46) 后，在 mindarena 注册块之后追加：

```go
// import 增加：
//   "valley-server/internal/garden"

if db := database.GetDB(); db != nil {
    gardenStore := garden.NewGormStore(db)
    gardenSvc := garden.NewService(gardenStore)
    garden.RegisterGardenRoutes(api, garden.NewHandler(gardenSvc), middleware.Auth(cfg))
}
```

- [ ] **Step 8：跑测试 + 提交**

```bash
cd server && go test ./internal/garden/... ./internal/router/...
git add server/internal/garden/ server/internal/router/router.go
git commit -m "feat(garden): 新增 garden 子包骨架与 /api/v1/garden 路由占位"
```

预期：handler_test PASS，全量 go test 不退化。

---

# M2 资产 manifest 与匹配引擎

## Task 5: 资产 manifest 数据结构 + 匹配引擎

**Files:**
- Create: `server/internal/garden/asset_manifest.go`
- Create: `server/internal/garden/asset_manifest_test.go`
- Create: `server/internal/garden/assets/manifest.json`（最小种子数据）
- Create: `apps/seed-garden/public/assets/encyclopedia/manifest.json`（与上同步）

- [ ] **Step 1：写失败的匹配测试**

```go
// server/internal/garden/asset_manifest_test.go
package garden

import (
    "math/rand"
    "testing"
)

func TestMatchAssetByTagsAndRarity(t *testing.T) {
    entries := []AssetEntry{
        {Key: "monday_morning", Rarity: "N", Tags: []string{"sleepy", "monday", "coffee"}, Stages: map[string]string{"1": "x.png"}},
        {Key: "unread_msg", Rarity: "R", Tags: []string{"anxious", "phone", "pink"}, Stages: map[string]string{"1": "y.png"}},
        {Key: "kpi", Rarity: "R", Tags: []string{"work", "anxious", "thorny"}, Stages: map[string]string{"1": "z.png"}},
    }
    m := NewManifest(entries)
    rng := rand.New(rand.NewSource(1))

    got := m.Match([]string{"anxious", "phone"}, "R", rng)
    if got == nil || got.Key != "unread_msg" {
        t.Fatalf("expected unread_msg, got %+v", got)
    }

    if m.Match(nil, "SSR", rng) != nil {
        t.Fatalf("expected nil for non-existent rarity")
    }
}

func TestFallbackPicksRandomWithinRarity(t *testing.T) {
    entries := []AssetEntry{
        {Key: "a", Rarity: "N", Tags: []string{"x"}},
        {Key: "b", Rarity: "N", Tags: []string{"y"}},
    }
    m := NewManifest(entries)
    rng := rand.New(rand.NewSource(1))
    got := m.Match([]string{"unrelated"}, "N", rng)
    if got == nil {
        t.Fatalf("expected fallback")
    }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd server && go test ./internal/garden/ -run TestMatch
```

预期：编译错误。

- [ ] **Step 3：实现 asset_manifest.go**

```go
// server/internal/garden/asset_manifest.go
package garden

import (
    "encoding/json"
    "math/rand"
    "os"
    "sort"
)

type AssetEntry struct {
    Key          string            `json:"key"`
    NameZH       string            `json:"name_zh"`
    Rarity       string            `json:"rarity"`
    Tags         []string          `json:"concept_tags"`
    Stages       map[string]string `json:"stages"`
    PaletteHint  string            `json:"palette_hint,omitempty"`
}

type Manifest struct{ entries []AssetEntry }

func NewManifest(entries []AssetEntry) *Manifest { return &Manifest{entries: entries} }

func LoadManifest(path string) (*Manifest, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    var entries []AssetEntry
    if err := json.Unmarshal(data, &entries); err != nil {
        return nil, err
    }
    return NewManifest(entries), nil
}

// Match 按 (rarity 过滤) → (tag 重合度排序) → (top3 随机) 选一张图
func (m *Manifest) Match(tags []string, rarity string, rng *rand.Rand) *AssetEntry {
    cands := []AssetEntry{}
    for _, e := range m.entries {
        if e.Rarity == rarity {
            cands = append(cands, e)
        }
    }
    if len(cands) == 0 {
        return nil
    }
    score := func(e AssetEntry) int {
        n := 0
        for _, t := range tags {
            for _, et := range e.Tags {
                if t == et {
                    n++
                }
            }
        }
        return n
    }
    sort.SliceStable(cands, func(i, j int) bool { return score(cands[i]) > score(cands[j]) })
    top := 3
    if len(cands) < top {
        top = len(cands)
    }
    pick := cands[rng.Intn(top)]
    return &pick
}

func (m *Manifest) Get(key string) *AssetEntry {
    for _, e := range m.entries {
        if e.Key == key {
            return &e
        }
    }
    return nil
}
```

- [ ] **Step 4：跑测试通过**

```bash
cd server && go test ./internal/garden/ -run TestMatch -v
```

预期：PASS。

- [ ] **Step 5：写最小 manifest.json 种子数据（10 条，覆盖 4 档稀有度）**

```json
[
  {
    "key": "monday_morning",
    "name_zh": "周一早上",
    "rarity": "N",
    "concept_tags": ["sleepy", "monday", "tired", "coffee", "morning"],
    "stages": { "1": "monday_morning_1.png", "2": "monday_morning_2.png", "3": "monday_morning_3.png" },
    "palette_hint": "warm brown"
  },
  {
    "key": "unread_msg",
    "name_zh": "未读消息",
    "rarity": "R",
    "concept_tags": ["anxious", "phone", "pink", "bell", "social"],
    "stages": { "1": "unread_msg_1.png", "2": "unread_msg_2.png", "3": "unread_msg_3.png" },
    "palette_hint": "soft pink"
  }
]
```

> 余下 8 条按设计文档 §9.1（至少 30 张资产）的方向占位。本任务先创建 10 条种子，M3 上线后由用户用 Prompt v3.2 持续补图。每条至少 1 个 stage 文件名（实际 PNG 文件可由用户后续用 ChatGPT Pro 生成补齐）。

- [ ] **Step 6：把 manifest 同时复制到前端 public**

```bash
mkdir -p apps/seed-garden/public/assets/encyclopedia
cp server/internal/garden/assets/manifest.json apps/seed-garden/public/assets/encyclopedia/manifest.json
```

- [ ] **Step 7：encoding 校验 + 提交**

```bash
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
  server/internal/garden/assets/manifest.json \
  apps/seed-garden/public/assets/encyclopedia/manifest.json
git add server/internal/garden/asset_manifest.go server/internal/garden/asset_manifest_test.go \
        server/internal/garden/assets/ apps/seed-garden/public/assets/encyclopedia/manifest.json
git commit -m "feat(garden): 新增资产 manifest 加载与标签语义匹配引擎"
```

预期：encoding `PASS`，go test PASS。

---

## Task 6: 稀有度 roll 算法

**Files:**
- Create: `server/internal/garden/rarity.go`
- Create: `server/internal/garden/rarity_test.go`

- [ ] **Step 1：写失败测试**

```go
// server/internal/garden/rarity_test.go
package garden

import (
    "math/rand"
    "testing"
)

func TestRollRarityDistribution(t *testing.T) {
    rng := rand.New(rand.NewSource(42))
    counts := map[string]int{}
    for i := 0; i < 10000; i++ {
        counts[RollRarity("中性概念", rng)]++
    }
    if counts["N"] < 5000 {
        t.Fatalf("N 比例过低：%v", counts)
    }
    if counts["SSR"] > 1000 {
        t.Fatalf("SSR 比例过高：%v", counts)
    }
    for _, r := range []string{RarityN, RarityR, RaritySR, RaritySSR} {
        if counts[r] == 0 {
            t.Fatalf("rarity %s 未出现：%v", r, counts)
        }
    }
}
```

- [ ] **Step 2：实现 rarity.go**

```go
// server/internal/garden/rarity.go
package garden

import "math/rand"

// RollRarity 按基础概率 + 概念长度加权 roll 稀有度
// 基础：N 65% / R 25% / SR 8% / SSR 2%
func RollRarity(_ string, rng *rand.Rand) string {
    r := rng.Float64()
    switch {
    case r < 0.65:
        return RarityN
    case r < 0.90:
        return RarityR
    case r < 0.98:
        return RaritySR
    default:
        return RaritySSR
    }
}
```

- [ ] **Step 3：测试 + 提交**

```bash
cd server && go test ./internal/garden/ -run TestRollRarity -v
git add server/internal/garden/rarity.go server/internal/garden/rarity_test.go
git commit -m "feat(garden): 新增稀有度 roll 算法（基础概率 65/25/8/2）"
```

预期：PASS。

---

# M3 种子诞生闭环

## Task 7: AI prompt 模板与 wrapper

**Files:**
- Create: `server/internal/garden/prompts.go`
- Create: `server/internal/garden/ai.go`
- Create: `server/internal/garden/ai_test.go`

- [ ] **Step 1：写失败的 JSON 解析测试**

```go
// server/internal/garden/ai_test.go
package garden

import "testing"

func TestParseSeedJSONStrict(t *testing.T) {
    raw := `{
      "name_zh": "未读消息",
      "concept_en": "unread message",
      "tags": ["anxious", "phone"],
      "rarity": "R",
      "mood": "焦虑",
      "description": "那个一直没回的人...",
      "first_log": "我刚刚发芽，铃铛上还沾着昨晚的提示音。"
    }`
    got, err := ParseSeedJSON(raw)
    if err != nil {
        t.Fatalf("unexpected err: %v", err)
    }
    if got.NameZH != "未读消息" || got.Rarity != "R" || len(got.Tags) != 2 {
        t.Fatalf("parse mismatch: %+v", got)
    }
}

func TestParseSeedJSONExtractsFromFenced(t *testing.T) {
    raw := "```json\n{\"name_zh\":\"周一早上\",\"concept_en\":\"monday\",\"tags\":[\"sleepy\"],\"rarity\":\"N\",\"mood\":\"困\",\"description\":\"咖啡因不够\",\"first_log\":\"我打哈欠\"}\n```"
    if _, err := ParseSeedJSON(raw); err != nil {
        t.Fatalf("should tolerate fenced json: %v", err)
    }
}
```

- [ ] **Step 2：实现 prompts.go**

```go
// server/internal/garden/prompts.go
package garden

import "fmt"

func PromptSeedBirth(concept, waterStyle string) string {
    return fmt.Sprintf(`你是「语种园」的种子精灵。用户写下了一个概念："%s"，使用浇水方式：%s。
请输出严格 JSON（不要包含解释、不要 Markdown 代码块）：
{
  "name_zh": "中二有梗的中文植物名（4-8 字）",
  "concept_en": "用于资产匹配的英文概念关键词（1-3 词，全小写）",
  "tags": ["匹配标签 5-10 个，描述外观/情绪/形态，全小写英文"],
  "rarity": "N | R | SR | SSR",
  "mood": "情绪词（中文，2-4 字）",
  "description": "卡片描述，30-50 字",
  "first_log": "首段成长日志，100-150 字，第一人称（植物自己说）"
}
风格基调（按 water_style）：
- water 普通中性、coffee 讽刺赛博、wine emo 诗意、potion 中二魔幻`, concept, waterStyle)
}

func PromptStageLog(plantName, mood, waterStyle string, stage, stageMax int, recentLogs string) string {
    return fmt.Sprintf(`植物档案：%s（情绪：%s，浇水方式：%s）
当前阶段：%d/%d
之前的成长日志（最近 3 段）：
%s

请用第一人称（植物自己写）输出 100-200 字的新日志，不要 JSON、不要标题、只要正文。`,
        plantName, mood, waterStyle, stage, stageMax, recentLogs)
}

func PromptWaterReply(plantName, mood, waterStyle string) string {
    return fmt.Sprintf(`植物 "%s"（情绪 %s，浇水风格 %s）刚被浇了一次水。
用第一人称写一句 30-50 字的回应，体现它的情绪与人格。`, plantName, mood, waterStyle)
}

func PromptChat(plantName, mood, waterStyle, userMsg string) string {
    return fmt.Sprintf(`你是植物 "%s"（情绪 %s，浇水风格 %s）。
用户对你说："%s"。
用第一人称回复 50-100 字，保持人格，不要破戒。`, plantName, mood, waterStyle, userMsg)
}

func PromptHarvest(plantName, mood, waterStyle string, allLogs string) string {
    return fmt.Sprintf(`植物 "%s" 即将被收获。情绪：%s，浇水风格：%s。
完整成长日志：
%s

请输出严格 JSON：
{
  "final_story": "完整故事总结，200-300 字，第三人称",
  "fruit_name": "趣味果实名（4-12 字）",
  "fruit_description": "果实属性，30-60 字，叙事性，无系统效果",
  "farewell_letter": "植物给用户的告别信，第一人称，150-300 字"
}`, plantName, mood, waterStyle, allLogs)
}
```

- [ ] **Step 3：实现 ai.go（JSON 解析 + AI 调用 wrapper）**

```go
// server/internal/garden/ai.go
package garden

import (
    "context"
    "encoding/json"
    "errors"
    "regexp"
    "strings"
)

// SeedJSON 是 PromptSeedBirth 期望的结构化输出
type SeedJSON struct {
    NameZH      string   `json:"name_zh"`
    ConceptEN   string   `json:"concept_en"`
    Tags        []string `json:"tags"`
    Rarity      string   `json:"rarity"`
    Mood        string   `json:"mood"`
    Description string   `json:"description"`
    FirstLog    string   `json:"first_log"`
}

type HarvestJSON struct {
    FinalStory       string `json:"final_story"`
    FruitName        string `json:"fruit_name"`
    FruitDescription string `json:"fruit_description"`
    FarewellLetter   string `json:"farewell_letter"`
}

var fencedRe = regexp.MustCompile("(?s)```(?:json)?\\s*(\\{.*\\})\\s*```")

func extractJSON(raw string) string {
    s := strings.TrimSpace(raw)
    if m := fencedRe.FindStringSubmatch(s); len(m) == 2 {
        return strings.TrimSpace(m[1])
    }
    if i := strings.Index(s, "{"); i >= 0 {
        if j := strings.LastIndex(s, "}"); j > i {
            return s[i : j+1]
        }
    }
    return s
}

func ParseSeedJSON(raw string) (*SeedJSON, error) {
    var out SeedJSON
    if err := json.Unmarshal([]byte(extractJSON(raw)), &out); err != nil {
        return nil, err
    }
    if out.NameZH == "" || out.Rarity == "" {
        return nil, errors.New("seed json missing required fields")
    }
    return &out, nil
}

func ParseHarvestJSON(raw string) (*HarvestJSON, error) {
    var out HarvestJSON
    if err := json.Unmarshal([]byte(extractJSON(raw)), &out); err != nil {
        return nil, err
    }
    if out.FinalStory == "" {
        return nil, errors.New("harvest json missing final_story")
    }
    return &out, nil
}

// TextAI 是 service 依赖的 AI 文本生成接口（便于 mock）
type TextAI interface {
    GenerateText(ctx context.Context, prompt string) (string, error)
}
```

- [ ] **Step 4：测试 + 提交**

```bash
cd server && go test ./internal/garden/ -run TestParseSeed -v
git add server/internal/garden/prompts.go server/internal/garden/ai.go server/internal/garden/ai_test.go
git commit -m "feat(garden): 新增 5 个 AI prompt 模板与 JSON 解析 wrapper"
```

预期：PASS。

---

## Task 8: 服务层 PlantSeed 业务逻辑

**Files:**
- Modify: `server/internal/garden/service.go`（PlantSeed 方法）
- Create: `server/internal/garden/service_test.go`（in-memory store + fake AI）

- [ ] **Step 1：写失败测试**

```go
// server/internal/garden/service_test.go
package garden_test

import (
    "context"
    "testing"
    "time"

    "valley-server/internal/garden"
    "valley-server/internal/model"
)

type memStore struct {
    g       *model.Garden
    plants  []model.Plant
    logs    []model.GrowthLog
    nextID  uint64
}

func newMemStore() *memStore { return &memStore{nextID: 1} }

func (m *memStore) GetGarden(_ context.Context, userID uint64) (*model.Garden, error) { return m.g, nil }
func (m *memStore) EnsureGarden(_ context.Context, userID uint64) (*model.Garden, error) {
    if m.g == nil { m.g = &model.Garden{ID: 1, UserID: userID, SlotCount: 3} }
    return m.g, nil
}
func (m *memStore) CreatePlant(_ context.Context, p *model.Plant) error {
    p.ID = m.nextID; m.nextID++
    p.CreatedAt = time.Now()
    m.plants = append(m.plants, *p); return nil
}
func (m *memStore) GetPlant(_ context.Context, id uint64) (*model.Plant, error) {
    for i := range m.plants { if m.plants[i].ID == id { return &m.plants[i], nil } }
    return nil, garden.ErrPlantNotFound
}
func (m *memStore) UpdatePlant(_ context.Context, p *model.Plant) error {
    for i := range m.plants { if m.plants[i].ID == p.ID { m.plants[i] = *p; return nil } }
    return garden.ErrPlantNotFound
}
func (m *memStore) ListActivePlantsByUser(_ context.Context, userID uint64) ([]model.Plant, error) {
    var out []model.Plant
    for _, p := range m.plants {
        if p.UserID == userID && p.Status != garden.StatusHarvested { out = append(out, p) }
    }
    return out, nil
}
func (m *memStore) ListHarvestedPlantsByUser(_ context.Context, userID uint64) ([]model.Plant, error) {
    var out []model.Plant
    for _, p := range m.plants {
        if p.UserID == userID && p.Status == garden.StatusHarvested { out = append(out, p) }
    }
    return out, nil
}
func (m *memStore) AppendGrowthLog(_ context.Context, log *model.GrowthLog) error {
    log.ID = m.nextID; m.nextID++
    log.CreatedAt = time.Now()
    m.logs = append(m.logs, *log); return nil
}
func (m *memStore) ListGrowthLogs(_ context.Context, plantID uint64) ([]model.GrowthLog, error) {
    var out []model.GrowthLog
    for _, l := range m.logs { if l.PlantID == plantID { out = append(out, l) } }
    return out, nil
}
func (m *memStore) AppendInteractionLog(_ context.Context, _ *model.InteractionLog) error  { return nil }
func (m *memStore) CountTodayInteractions(_ context.Context, _ uint64, _ string) (int, error) { return 0, nil }
func (m *memStore) CreateHarvest(_ context.Context, _ *model.Harvest) error                  { return nil }
func (m *memStore) GetHarvest(_ context.Context, _ uint64) (*model.Harvest, error)           { return nil, nil }

type fakeAI struct{ reply string }

func (f *fakeAI) GenerateText(_ context.Context, _ string) (string, error) { return f.reply, nil }

func TestPlantSeedHappyPath(t *testing.T) {
    store := newMemStore()
    store.EnsureGarden(context.Background(), 7)
    ai := &fakeAI{reply: `{"name_zh":"未读消息","concept_en":"unread","tags":["anxious","phone"],"rarity":"R","mood":"焦虑","description":"那个没回的人","first_log":"我发芽了"}`}
    manifest := garden.NewManifest([]garden.AssetEntry{{Key: "unread_msg", Rarity: "R", Tags: []string{"anxious", "phone"}, Stages: map[string]string{"1": "unread_msg_1.png"}}})
    svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))

    plant, err := svc.PlantSeed(context.Background(), 7, garden.PlantSeedReq{Concept: "未读消息", WaterStyle: "water"})
    if err != nil {
        t.Fatalf("PlantSeed err: %v", err)
    }
    if plant.Name != "未读消息" || plant.Rarity != "R" || plant.Status != garden.StatusGrowing {
        t.Fatalf("unexpected plant: %+v", plant)
    }
    if plant.SlotIndex < 0 || plant.SlotIndex >= 3 {
        t.Fatalf("slot index out of range: %d", plant.SlotIndex)
    }
    if plant.AssetKey != "unread_msg" {
        t.Fatalf("expected asset matched to unread_msg, got %s", plant.AssetKey)
    }
    logs, _ := store.ListGrowthLogs(context.Background(), plant.ID)
    if len(logs) != 1 || logs[0].Type != garden.LogTypeBirth {
        t.Fatalf("expected birth log, got %+v", logs)
    }
}

func TestPlantSeedSlotsFull(t *testing.T) {
    store := newMemStore()
    store.EnsureGarden(context.Background(), 7)
    ai := &fakeAI{reply: `{"name_zh":"x","concept_en":"x","tags":["x"],"rarity":"N","mood":"困","description":"d","first_log":"l"}`}
    manifest := garden.NewManifest([]garden.AssetEntry{{Key: "k", Rarity: "N", Tags: []string{"x"}}})
    svc := garden.NewServiceWithDeps(store, ai, manifest, garden.FixedRandSource(1))
    for i := 0; i < 3; i++ {
        if _, err := svc.PlantSeed(context.Background(), 7, garden.PlantSeedReq{Concept: "x", WaterStyle: "water"}); err != nil {
            t.Fatalf("seed %d err: %v", i, err)
        }
    }
    if _, err := svc.PlantSeed(context.Background(), 7, garden.PlantSeedReq{Concept: "x", WaterStyle: "water"}); err != garden.ErrSlotsFull {
        t.Fatalf("expected ErrSlotsFull, got %v", err)
    }
}
```

- [ ] **Step 2：扩展 service.go**

```go
// server/internal/garden/service.go (扩展)
package garden

import (
    "context"
    "errors"
    "math/rand"
    "time"

    "valley-server/internal/model"
)

var (
    ErrPlantNotFound      = errors.New("plant not found")
    ErrPlantNotOwned      = errors.New("plant not owned by user")
    ErrSlotsFull          = errors.New("all slots are full")
    ErrAlreadyMature      = errors.New("plant already mature")
    ErrNotMature          = errors.New("plant not yet mature")
    ErrInteractionLimited = errors.New("daily interaction limit reached")
)

type Service struct {
    store    Store
    ai       TextAI
    manifest *Manifest
    rng      *rand.Rand
    now      func() time.Time
}

func NewService(store Store) *Service {
    return &Service{store: store, now: time.Now, rng: rand.New(rand.NewSource(time.Now().UnixNano()))}
}

func NewServiceWithDeps(store Store, ai TextAI, manifest *Manifest, seed int64) *Service {
    return &Service{store: store, ai: ai, manifest: manifest, rng: rand.New(rand.NewSource(seed)), now: time.Now}
}

func FixedRandSource(seed int64) int64 { return seed } // 仅为测试可读性

func (s *Service) PlantSeed(ctx context.Context, userID uint64, req PlantSeedReq) (*model.Plant, error) {
    g, err := s.store.EnsureGarden(ctx, userID)
    if err != nil {
        return nil, err
    }
    active, err := s.store.ListActivePlantsByUser(ctx, userID)
    if err != nil {
        return nil, err
    }
    used := map[int]bool{}
    for _, p := range active {
        if p.SlotIndex >= 0 {
            used[p.SlotIndex] = true
        }
    }
    slot := -1
    for i := 0; i < g.SlotCount; i++ {
        if !used[i] {
            slot = i
            break
        }
    }
    if slot < 0 {
        return nil, ErrSlotsFull
    }

    raw, err := s.ai.GenerateText(ctx, PromptSeedBirth(req.Concept, req.WaterStyle))
    if err != nil {
        return nil, err
    }
    seed, err := ParseSeedJSON(raw)
    if err != nil {
        return nil, err
    }

    rarity := seed.Rarity
    if !validRarity(rarity) {
        rarity = RollRarity(req.Concept, s.rng)
    }
    asset := s.manifest.Match(seed.Tags, rarity, s.rng)
    if asset == nil {
        // 兜底 fallback：找任意稀有度
        asset = s.manifest.Match(seed.Tags, RarityN, s.rng)
    }
    var assetKey string
    if asset != nil {
        assetKey = asset.Key
    }

    stageMax := stageMaxForRarity(rarity)
    interval := stageInterval(rarity)
    plant := &model.Plant{
        UserID:       userID,
        SlotIndex:    slot,
        ConceptInput: req.Concept,
        ConceptEN:    seed.ConceptEN,
        Name:         seed.NameZH,
        Description:  seed.Description,
        WaterStyle:   req.WaterStyle,
        Rarity:       rarity,
        Stage:        1,
        StageMax:     stageMax,
        AssetKey:     assetKey,
        NextStageAt:  s.now().Add(interval),
        Mood:         seed.Mood,
        Status:       StatusGrowing,
    }
    if err := s.store.CreatePlant(ctx, plant); err != nil {
        return nil, err
    }
    _ = s.store.AppendGrowthLog(ctx, &model.GrowthLog{
        PlantID: plant.ID, Stage: 1, Type: LogTypeBirth, Content: seed.FirstLog,
    })
    return plant, nil
}

func validRarity(r string) bool {
    return r == RarityN || r == RarityR || r == RaritySR || r == RaritySSR
}

func stageMaxForRarity(r string) int {
    switch r {
    case RaritySSR:
        return 5
    case RaritySR:
        return 4
    default:
        return 3
    }
}

// stageInterval 决定下一阶段的等待时间（MVP：5-15 分钟）
func stageInterval(r string) time.Duration {
    switch r {
    case RaritySSR:
        return 15 * time.Minute
    case RaritySR:
        return 12 * time.Minute
    case RarityR:
        return 8 * time.Minute
    default:
        return 5 * time.Minute
    }
}
```

- [ ] **Step 3：测试 + 提交**

```bash
cd server && go test ./internal/garden/ -v
git add server/internal/garden/service.go server/internal/garden/service_test.go
git commit -m "feat(garden): 实现 PlantSeed 业务逻辑（AI JSON + 资产匹配 + 花盆分配）"
```

预期：所有测试 PASS。

---

## Task 9: HTTP 端点 POST /api/v1/garden/plant + GET /api/v1/garden

**Files:**
- Modify: `server/internal/garden/handler.go`
- Modify: `server/internal/garden/routes.go`
- Modify: `server/internal/garden/handler_test.go`
- Modify: `server/internal/router/router.go`（接入真实 AI 服务）

- [ ] **Step 1：写失败测试**

```go
// server/internal/garden/handler_test.go (追加)
func TestPlantHandlerCreatesPlant(t *testing.T) {
    gin.SetMode(gin.TestMode)
    store := newMemStore()
    store.EnsureGarden(context.Background(), 42)
    ai := &fakeAI{reply: `{"name_zh":"x","concept_en":"x","tags":["x"],"rarity":"N","mood":"困","description":"d","first_log":"l"}`}
    manifest := garden.NewManifest([]garden.AssetEntry{{Key: "k", Rarity: "N", Tags: []string{"x"}}})
    svc := garden.NewServiceWithDeps(store, ai, manifest, 1)

    r := gin.New()
    api := r.Group("/api/v1")
    fakeAuth := func(c *gin.Context) { c.Set("user_id", uint64(42)); c.Next() }
    garden.RegisterGardenRoutes(api, garden.NewHandler(svc), fakeAuth)

    body := strings.NewReader(`{"concept":"未读消息","water_style":"water"}`)
    req := httptest.NewRequest(http.MethodPost, "/api/v1/garden/plant", body)
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)
    if w.Code != 200 {
        t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
    }
}
```

> import 增加 `bytes`、`context`、`strings`、`valley-server/internal/garden`、对应类型。

- [ ] **Step 2：实现 handler 方法**

```go
// server/internal/garden/handler.go（替换/扩展）
package garden

import (
    "errors"
    "net/http"

    "github.com/gin-gonic/gin"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Health(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"ok": true, "module": "garden"})
}

func (h *Handler) GetGarden(c *gin.Context) {
    uid := userID(c)
    g, err := h.svc.GetGardenView(c.Request.Context(), uid)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, g)
}

func (h *Handler) PlantSeed(c *gin.Context) {
    var req PlantSeedReq
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    p, err := h.svc.PlantSeed(c.Request.Context(), userID(c), req)
    if err != nil {
        switch {
        case errors.Is(err, ErrSlotsFull):
            c.JSON(http.StatusConflict, gin.H{"error": "slots_full"})
        default:
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        }
        return
    }
    c.JSON(http.StatusOK, p)
}

func userID(c *gin.Context) uint64 {
    if v, ok := c.Get("user_id"); ok {
        if id, ok := v.(uint64); ok {
            return id
        }
    }
    return 0
}
```

- [ ] **Step 3：补 service.GetGardenView**

```go
// service.go 追加
type GardenView struct {
    Garden *model.Garden  `json:"garden"`
    Plants []model.Plant  `json:"plants"`
}

func (s *Service) GetGardenView(ctx context.Context, userID uint64) (*GardenView, error) {
    g, err := s.store.EnsureGarden(ctx, userID)
    if err != nil {
        return nil, err
    }
    plants, err := s.store.ListActivePlantsByUser(ctx, userID)
    if err != nil {
        return nil, err
    }
    return &GardenView{Garden: g, Plants: plants}, nil
}
```

- [ ] **Step 4：在 routes.go 注册路由**

```go
// server/internal/garden/routes.go
package garden

import "github.com/gin-gonic/gin"

func RegisterGardenRoutes(api *gin.RouterGroup, h *Handler, auth gin.HandlerFunc) {
    g := api.Group("/garden")
    g.GET("/health", h.Health)

    authed := g.Group("")
    authed.Use(auth)
    {
        authed.GET("", h.GetGarden)
        authed.POST("/plant", h.PlantSeed)
    }
}
```

- [ ] **Step 5：在 router.go 接入真实 AI**

```go
// server/internal/router/router.go (mindarena 后)
if db := database.GetDB(); db != nil {
    gardenStore := garden.NewGormStore(db)
    aiSvc := ai.NewServiceFromEnv()
    gardenAI := garden.NewAIAdapter(aiSvc) // 见下一步
    manifestPath := "internal/garden/assets/manifest.json"
    manifest, manifestErr := garden.LoadManifest(manifestPath)
    if manifestErr != nil {
        logger.Warnf("garden manifest 加载失败: %v", manifestErr)
        manifest = garden.NewManifest(nil)
    }
    gardenSvc := garden.NewServiceWithDeps(gardenStore, gardenAI, manifest, time.Now().UnixNano())
    garden.RegisterGardenRoutes(api, garden.NewHandler(gardenSvc), middleware.Auth(cfg))
}
```

> import 增加 `valley-server/internal/garden`、`time`。

- [ ] **Step 6：在 garden/ai.go 末尾追加 AI adapter**

```go
// 接入 internal/ai 服务（具体方法名跟随实际 ai.Service 签名调整）
type AIAdapter struct{ svc *ai.Service }

func NewAIAdapter(svc *ai.Service) *AIAdapter { return &AIAdapter{svc: svc} }

func (a *AIAdapter) GenerateText(ctx context.Context, prompt string) (string, error) {
    return a.svc.GenerateText(ctx, prompt) // 若 ai.Service 没有 GenerateText，则改用其单条 chat 方法并取首个回复
}
```

> 阅读 [server/internal/ai/service.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/ai/service.go) 找到合适的单 prompt 文本生成方法名后再实现。如果只暴露 chat 系列方法，包装成「单 user message」即可。

- [ ] **Step 7：联调命令**

```bash
cd server && go test ./internal/garden/...
cd server && go build ./cmd/server
git add server/internal/garden/ server/internal/router/router.go
git commit -m "feat(garden): 暴露 GET /garden 与 POST /garden/plant，接入真实 AI 与 manifest"
```

预期：所有 test PASS，build 成功。

---

## Task 10: 前端：登录、API 客户端、Garden 首页（M3 闭环）

**Files:**
- Create: `apps/seed-garden/src/lib/request.ts`
- Create: `apps/seed-garden/src/api/garden.ts`
- Create: `apps/seed-garden/src/api/plant.ts`
- Create: `apps/seed-garden/src/stores/useAuthStore.ts`
- Create: `apps/seed-garden/src/stores/useGardenStore.ts`
- Create: `apps/seed-garden/src/components/RarityBadge.tsx`
- Create: `apps/seed-garden/src/components/SeedInputBar.tsx`
- Create: `apps/seed-garden/src/components/WaterStyleSelector.tsx`
- Create: `apps/seed-garden/src/components/PlantPot.tsx`
- Create: `apps/seed-garden/src/components/SeedBirthAnimation.tsx`
- Create: `apps/seed-garden/src/lib/rarityStyles.ts`
- Create: `apps/seed-garden/src/pages/Garden.tsx`
- Create: `apps/seed-garden/src/pages/Login.tsx`
- Modify: `apps/seed-garden/src/App.tsx`

- [ ] **Step 1：写 request.ts**

```ts
// src/lib/request.ts
import axios from "axios";

export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 30_000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem("seed_garden_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

- [ ] **Step 2：写 stores**

```ts
// src/stores/useAuthStore.ts
import { create } from "zustand";

interface AuthState {
  token: string | null;
  setToken: (t: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("seed_garden_token") : null,
  setToken: (token) => {
    if (token) localStorage.setItem("seed_garden_token", token);
    else localStorage.removeItem("seed_garden_token");
    set({ token });
  },
  logout: () => {
    localStorage.removeItem("seed_garden_token");
    set({ token: null });
  },
}));
```

```ts
// src/stores/useGardenStore.ts
import { create } from "zustand";
import type { Plant, Garden } from "@/api/types";

interface GardenState {
  garden: Garden | null;
  plants: Plant[];
  setGarden: (g: Garden | null) => void;
  setPlants: (p: Plant[]) => void;
  upsertPlant: (p: Plant) => void;
}

export const useGardenStore = create<GardenState>((set) => ({
  garden: null,
  plants: [],
  setGarden: (garden) => set({ garden }),
  setPlants: (plants) => set({ plants }),
  upsertPlant: (p) =>
    set((s) => {
      const existing = s.plants.findIndex((x) => x.id === p.id);
      if (existing >= 0) {
        const arr = [...s.plants];
        arr[existing] = p;
        return { plants: arr };
      }
      return { plants: [...s.plants, p] };
    }),
}));
```

- [ ] **Step 3：写 API + types**

```ts
// src/api/types.ts
export type Rarity = "N" | "R" | "SR" | "SSR";
export type WaterStyle = "water" | "coffee" | "wine" | "potion";
export type PlantStatus = "growing" | "mature" | "harvested";

export interface Garden {
  id: number;
  user_id: number;
  slot_count: number;
  experience: number;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: number;
  user_id: number;
  slot_index: number;
  concept_input: string;
  concept_en: string;
  name: string;
  description: string;
  water_style: WaterStyle;
  rarity: Rarity;
  stage: number;
  stage_max: number;
  asset_key: string;
  next_stage_at: string;
  mood: string;
  status: PlantStatus;
  created_at: string;
  updated_at: string;
  harvested_at: string | null;
}

export interface GardenView {
  garden: Garden;
  plants: Plant[];
}
```

```ts
// src/api/garden.ts
import { request } from "@/lib/request";
import type { GardenView } from "./types";

export const fetchGarden = () => request.get<GardenView>("/garden").then((r) => r.data);
```

```ts
// src/api/plant.ts
import { request } from "@/lib/request";
import type { Plant, WaterStyle } from "./types";

export const plantSeed = (concept: string, waterStyle: WaterStyle) =>
  request.post<Plant>("/garden/plant", { concept, water_style: waterStyle }).then((r) => r.data);
```

- [ ] **Step 4：写 rarityStyles.ts + RarityBadge**

```ts
// src/lib/rarityStyles.ts
import type { Rarity } from "@/api/types";

export const rarityFrame: Record<Rarity, string> = {
  N: "border-stone-300 shadow-sm",
  R: "border-sky-400 shadow-md shadow-sky-200/50",
  SR: "border-violet-400 shadow-lg shadow-violet-300/50",
  SSR: "border-amber-400 shadow-xl shadow-amber-300/60",
};

export const rarityLabel: Record<Rarity, string> = {
  N: "★",
  R: "★★",
  SR: "★★★",
  SSR: "★★★★",
};
```

```tsx
// src/components/RarityBadge.tsx
import type { Rarity } from "@/api/types";
import { rarityLabel } from "@/lib/rarityStyles";
import clsx from "clsx";

const colorMap: Record<Rarity, string> = {
  N: "bg-stone-200 text-stone-700",
  R: "bg-sky-100 text-sky-700",
  SR: "bg-violet-100 text-violet-700",
  SSR: "bg-amber-100 text-amber-700",
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold", colorMap[rarity])}>
      {rarityLabel[rarity]} {rarity}
    </span>
  );
}
```

- [ ] **Step 5：SeedInputBar + WaterStyleSelector**

```tsx
// src/components/WaterStyleSelector.tsx
import type { WaterStyle } from "@/api/types";
import clsx from "clsx";

const OPTIONS: { value: WaterStyle; emoji: string; label: string }[] = [
  { value: "water", emoji: "💧", label: "普通水" },
  { value: "coffee", emoji: "☕", label: "咖啡" },
  { value: "wine", emoji: "🍷", label: "红酒" },
  { value: "potion", emoji: "🧪", label: "神秘药水" },
];

export function WaterStyleSelector({
  value,
  onChange,
}: {
  value: WaterStyle;
  onChange: (v: WaterStyle) => void;
}) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-full border-2 px-3 py-1 text-sm transition",
            value === o.value
              ? "border-garden-ink bg-white text-garden-ink"
              : "border-transparent bg-white/40 text-garden-ink/70 hover:bg-white/70",
          )}
        >
          {o.emoji} {o.label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// src/components/SeedInputBar.tsx
import { useState } from "react";
import type { WaterStyle } from "@/api/types";
import { WaterStyleSelector } from "./WaterStyleSelector";

export function SeedInputBar({
  onSubmit,
  loading,
}: {
  onSubmit: (concept: string, waterStyle: WaterStyle) => void;
  loading: boolean;
}) {
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState<WaterStyle>("water");

  return (
    <div className="rounded-3xl bg-white/70 p-4 backdrop-blur shadow-lg flex flex-col gap-3">
      <input
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        placeholder="把任何东西种下去：未读消息、KPI、前任..."
        className="rounded-2xl bg-white px-4 py-3 outline-none text-garden-ink placeholder:text-garden-ink/40"
        maxLength={80}
      />
      <WaterStyleSelector value={style} onChange={setStyle} />
      <button
        type="button"
        disabled={!concept.trim() || loading}
        onClick={() => onSubmit(concept.trim(), style)}
        className="rounded-2xl bg-garden-ink py-3 text-white font-bold disabled:opacity-50"
      >
        {loading ? "种子精灵正在播种..." : "播种"}
      </button>
    </div>
  );
}
```

- [ ] **Step 6：PlantPot + SeedBirthAnimation**

```tsx
// src/components/PlantPot.tsx
import type { Plant } from "@/api/types";
import { Link } from "react-router-dom";
import { RarityBadge } from "./RarityBadge";
import { rarityFrame } from "@/lib/rarityStyles";
import clsx from "clsx";

export function PlantPot({ plant, slotIndex }: { plant?: Plant; slotIndex: number }) {
  if (!plant) {
    return (
      <div className="aspect-square rounded-3xl border-2 border-dashed border-garden-ink/30 flex items-center justify-center text-garden-ink/40">
        空花盆 · {slotIndex + 1}
      </div>
    );
  }
  const src = `/assets/encyclopedia/${plant.rarity}/${plant.asset_key}_${plant.stage}.png`;
  return (
    <Link
      to={`/garden/plant/${plant.id}`}
      className={clsx("block aspect-square rounded-3xl border-2 bg-white/40 p-2", rarityFrame[plant.rarity])}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-garden-ink">{plant.name}</span>
        <RarityBadge rarity={plant.rarity} />
      </div>
      <img src={src} alt={plant.name} className="w-full h-[80%] object-contain" loading="lazy" />
      <div className="text-center text-xs text-garden-ink/60">
        阶段 {plant.stage}/{plant.stage_max}
      </div>
    </Link>
  );
}
```

```tsx
// src/components/SeedBirthAnimation.tsx
import { motion } from "framer-motion";

export function SeedBirthAnimation({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-garden-warm/80 backdrop-blur"
    >
      <motion.div
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
        className="text-6xl"
      >
        🌱
      </motion.div>
      <div className="absolute bottom-1/3 text-garden-ink font-bold">种子精灵正在揉捏一颗新种子...</div>
    </motion.div>
  );
}
```

- [ ] **Step 7：Garden 页面 + Login 页面 + 路由**

```tsx
// src/pages/Garden.tsx
import { useEffect, useState } from "react";
import { fetchGarden } from "@/api/garden";
import { plantSeed } from "@/api/plant";
import { useGardenStore } from "@/stores/useGardenStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { Navigate } from "react-router-dom";
import { SeedInputBar } from "@/components/SeedInputBar";
import { PlantPot } from "@/components/PlantPot";
import { SeedBirthAnimation } from "@/components/SeedBirthAnimation";

export default function Garden() {
  const { token } = useAuthStore();
  const { garden, plants, setGarden, setPlants, upsertPlant } = useGardenStore();
  const [loading, setLoading] = useState(false);
  const [birthing, setBirthing] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchGarden().then((view) => {
      setGarden(view.garden);
      setPlants(view.plants);
    });
  }, [token, setGarden, setPlants]);

  if (!token) return <Navigate to="/login" replace />;

  const slots = Array.from({ length: garden?.slot_count ?? 3 });

  return (
    <main className="mx-auto max-w-2xl p-4 flex flex-col gap-6">
      <header className="text-center pt-6">
        <h1 className="text-3xl font-bold text-garden-ink">语种园</h1>
        <p className="text-garden-ink/60 text-sm">把任何东西种成一棵从未存在过的植物</p>
      </header>
      <div className="grid grid-cols-3 gap-3">
        {slots.map((_, i) => (
          <PlantPot key={i} slotIndex={i} plant={plants.find((p) => p.slot_index === i)} />
        ))}
      </div>
      <SeedInputBar
        loading={loading}
        onSubmit={async (concept, style) => {
          setLoading(true);
          setBirthing(true);
          try {
            const p = await plantSeed(concept, style);
            upsertPlant(p);
          } finally {
            setLoading(false);
            setTimeout(() => setBirthing(false), 800);
          }
        }}
      />
      <SeedBirthAnimation visible={birthing} />
    </main>
  );
}
```

```tsx
// src/pages/Login.tsx
// MVP 复用 valley-mas /api/v1/login（与 web 一致）。
// 简化版：只做账号密码 + 写 token 到 store，不做注册流程。
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { request } from "@/lib/request";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const setToken = useAuthStore((s) => s.setToken);
  const nav = useNavigate();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            const resp = await request.post<{ token: string }>("/login", { email, password });
            setToken(resp.data.token);
            nav("/garden", { replace: true });
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
        className="w-full max-w-sm rounded-3xl bg-white/80 p-6 flex flex-col gap-3 shadow-lg"
      >
        <h1 className="text-xl font-bold text-garden-ink">登录语种园</h1>
        <input className="rounded-xl bg-white px-3 py-2" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded-xl bg-white px-3 py-2" placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <button type="submit" className="rounded-xl bg-garden-ink py-2 text-white">进入花园</button>
      </form>
    </main>
  );
}
```

```tsx
// src/App.tsx（替换 M1 的占位）
import { Navigate, Route, Routes } from "react-router-dom";
import Garden from "@/pages/Garden";
import Login from "@/pages/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/garden" replace />} />
      <Route path="/garden" element={<Garden />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}
```

- [ ] **Step 8：typecheck + 提交**

```bash
pnpm --filter @valley/seed-garden typecheck
pnpm --filter @valley/seed-garden check
git add apps/seed-garden/src/
git commit -m "feat(seed-garden): 完成种子诞生闭环（首页 + 输入 + 花盆 + 诞生动画）"
```

预期：typecheck PASS，check 无 error。

- [ ] **Step 9：手动验收（提示用户）**

最终回复需告知用户清晰的验收标准（按根 AGENTS 规则不使用 Playwright 自动验收）：

> 启动 `cd server && go run ./cmd/server` 与 `cd apps/seed-garden && pnpm dev`；登录后在花园页输入概念词，应在 10s 内看到对应稀有度的植物落入花盆。

---

# M4 挂机生长闭环

## Task 11: GrowthEngine.AdvancePlant + 阶段日志生成

**Files:**
- Create: `server/internal/garden/growth_engine.go`
- Create: `server/internal/garden/growth_engine_test.go`
- Modify: `server/internal/garden/service.go`（GetPlantDetail 内调用 advance）
- Modify: `server/internal/garden/handler.go`、`routes.go`（GET /garden/plant/:id）

- [ ] **Step 1：写失败测试**

测试覆盖：
1. 当前 stage < stage_max 且 now >= next_stage_at → stage+1，写一条 grow log，重置 next_stage_at
2. 当前 stage == stage_max → 状态变 mature，next_stage_at 清零
3. 多次跨阶段（now 远超 next_stage_at）→ 一次性推进到位

```go
func TestAdvancePlantSingleStep(t *testing.T) { /* 构造 plant.Stage=1, NextStageAt=过去, ai 返回 fixed text；断言 Stage=2 + 写一条 grow log */ }
func TestAdvancePlantToMature(t *testing.T)   { /* Stage=stage_max-1, advance 后 Status=mature */ }
```

- [ ] **Step 2：实现 growth_engine.go**

核心方法：

```go
func (s *Service) AdvancePlant(ctx context.Context, p *model.Plant) error {
    if p.Status != StatusGrowing { return nil }
    now := s.now()
    for p.Stage < p.StageMax && !now.Before(p.NextStageAt) {
        recent, _ := s.store.ListGrowthLogs(ctx, p.ID)
        prompt := PromptStageLog(p.Name, p.Mood, p.WaterStyle, p.Stage+1, p.StageMax, summarize(recent))
        text, err := s.ai.GenerateText(ctx, prompt)
        if err != nil { text = "今天我又长了一点点。" }
        p.Stage++
        p.NextStageAt = now.Add(stageInterval(p.Rarity))
        _ = s.store.AppendGrowthLog(ctx, &model.GrowthLog{
            PlantID: p.ID, Stage: p.Stage, Type: LogTypeGrow, Content: text,
        })
    }
    if p.Stage >= p.StageMax {
        p.Status = StatusMature
    }
    return s.store.UpdatePlant(ctx, p)
}
```

- [ ] **Step 3：在 GetPlantDetail 内 lazy-advance**

```go
func (s *Service) GetPlantDetail(ctx context.Context, userID, plantID uint64) (*PlantDetailView, error) {
    p, err := s.store.GetPlant(ctx, plantID)
    if err != nil { return nil, err }
    if p.UserID != userID { return nil, ErrPlantNotOwned }
    if err := s.AdvancePlant(ctx, p); err != nil { return nil, err }
    logs, _ := s.store.ListGrowthLogs(ctx, plantID)
    return &PlantDetailView{Plant: *p, Logs: logs}, nil
}
```

- [ ] **Step 4：handler + 路由**

```go
// handler.go
func (h *Handler) GetPlantDetail(c *gin.Context) {
    id := parseUint64(c.Param("id"))
    view, err := h.svc.GetPlantDetail(c.Request.Context(), userID(c), id)
    if errors.Is(err, ErrPlantNotFound) { c.JSON(404, gin.H{"error": "not_found"}); return }
    if errors.Is(err, ErrPlantNotOwned) { c.JSON(403, gin.H{"error": "forbidden"}); return }
    if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
    c.JSON(200, view)
}
```

```go
// routes.go 在 authed 块加：
authed.GET("/plant/:id", h.GetPlantDetail)
```

- [ ] **Step 5：测试 + 提交**

```bash
cd server && go test ./internal/garden/ -v
git add server/internal/garden/
git commit -m "feat(garden): 实现挂机生长引擎（lazy advance + 阶段日志）"
```

---

## Task 12: 前端：PlantDetail 页面 + 时间线 + polling

**Files:**
- Create: `apps/seed-garden/src/api/types.ts`（已建则补 PlantDetailView）
- Create: `apps/seed-garden/src/components/GrowthTimeline.tsx`
- Create: `apps/seed-garden/src/lib/stageTimer.ts`
- Create: `apps/seed-garden/src/pages/PlantDetail.tsx`
- Modify: `apps/seed-garden/src/api/plant.ts`、`apps/seed-garden/src/App.tsx`

- [ ] **Step 1：补 API + 类型**

```ts
// src/api/types.ts 追加
export type GrowthLogType = "birth" | "grow" | "event" | "harvest";
export interface GrowthLog {
  id: number;
  plant_id: number;
  stage: number;
  type: GrowthLogType;
  content: string;
  created_at: string;
}
export interface PlantDetailView { plant: Plant; logs: GrowthLog[]; }
```

```ts
// src/api/plant.ts 追加
import type { PlantDetailView } from "./types";
export const fetchPlantDetail = (id: number) =>
  request.get<PlantDetailView>(`/garden/plant/${id}`).then((r) => r.data);
```

- [ ] **Step 2：stageTimer.ts**

```ts
// src/lib/stageTimer.ts
export function formatCountdown(targetISO: string, nowMs = Date.now()): string {
  const diff = new Date(targetISO).getTime() - nowMs;
  if (diff <= 0) return "马上发生";
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 3：GrowthTimeline.tsx + PlantDetail.tsx**

```tsx
// src/components/GrowthTimeline.tsx
import type { GrowthLog } from "@/api/types";

export function GrowthTimeline({ logs }: { logs: GrowthLog[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {logs.map((l) => (
        <li key={l.id} className="rounded-2xl bg-white/70 p-3 shadow-sm">
          <div className="text-xs text-garden-ink/60 mb-1">阶段 {l.stage} · {l.type}</div>
          <div className="text-sm text-garden-ink whitespace-pre-wrap">{l.content}</div>
        </li>
      ))}
    </ol>
  );
}
```

```tsx
// src/pages/PlantDetail.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPlantDetail } from "@/api/plant";
import type { PlantDetailView } from "@/api/types";
import { GrowthTimeline } from "@/components/GrowthTimeline";
import { RarityBadge } from "@/components/RarityBadge";
import { rarityFrame } from "@/lib/rarityStyles";
import { formatCountdown } from "@/lib/stageTimer";
import clsx from "clsx";

export default function PlantDetail() {
  const { id } = useParams();
  const [view, setView] = useState<PlantDetailView | null>(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const load = () => fetchPlantDetail(Number(id)).then((v) => alive && setView(v));
    load();
    const poll = setInterval(load, 30_000);
    const ticker = setInterval(() => setTick(Date.now()), 1000);
    return () => { alive = false; clearInterval(poll); clearInterval(ticker); };
  }, [id]);

  if (!view) return <div className="p-8 text-center">加载中...</div>;
  const p = view.plant;
  const src = `/assets/encyclopedia/${p.rarity}/${p.asset_key}_${p.stage}.png`;
  return (
    <main className="mx-auto max-w-xl p-4 flex flex-col gap-4">
      <div className={clsx("rounded-3xl border-2 bg-white/50 p-4", rarityFrame[p.rarity])}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-garden-ink">{p.name}</h1>
          <RarityBadge rarity={p.rarity} />
        </div>
        <img src={src} alt={p.name} className="w-full max-w-sm mx-auto" />
        <p className="text-sm text-garden-ink/70">{p.description}</p>
        <p className="text-xs text-garden-ink/50">
          阶段 {p.stage}/{p.stage_max} · 距下一阶段 {formatCountdown(p.next_stage_at, tick)} · 状态 {p.status}
        </p>
      </div>
      <GrowthTimeline logs={view.logs} />
    </main>
  );
}
```

- [ ] **Step 4：App.tsx 加路由**

```tsx
<Route path="/garden/plant/:id" element={<PlantDetail />} />
```

- [ ] **Step 5：typecheck + 提交**

```bash
pnpm --filter @valley/seed-garden typecheck
git add apps/seed-garden/src/
git commit -m "feat(seed-garden): 植物详情页 + 时间线 + 30s polling"
```

---

# M5 互动与收获

## Task 13: 浇水 API + 前端按钮

**Files:**
- Modify: `server/internal/garden/service.go`、`handler.go`、`routes.go`、`service_test.go`
- Modify: `apps/seed-garden/src/api/interaction.ts`、`pages/PlantDetail.tsx`

- [ ] **Step 1：服务端测试 + 实现**

```go
// service.go
func (s *Service) Water(ctx context.Context, userID, plantID uint64) (string, error) {
    p, err := s.ownedPlant(ctx, userID, plantID)
    if err != nil { return "", err }
    n, _ := s.store.CountTodayInteractions(ctx, plantID, ActionWater)
    if n >= 5 { return "", ErrInteractionLimited }
    text, err := s.ai.GenerateText(ctx, PromptWaterReply(p.Name, p.Mood, p.WaterStyle))
    if err != nil { text = "（咕嘟咕嘟，水声）" }
    _ = s.store.AppendInteractionLog(ctx, &model.InteractionLog{PlantID: plantID, Action: ActionWater, AIReply: text})
    // 浇水加速：把 NextStageAt 提前 30s
    if p.Status == StatusGrowing {
        p.NextStageAt = p.NextStageAt.Add(-30 * time.Second)
        _ = s.store.UpdatePlant(ctx, p)
    }
    return text, nil
}

func (s *Service) ownedPlant(ctx context.Context, uid, pid uint64) (*model.Plant, error) {
    p, err := s.store.GetPlant(ctx, pid)
    if err != nil { return nil, err }
    if p.UserID != uid { return nil, ErrPlantNotOwned }
    return p, nil
}
```

```go
// handler.go
func (h *Handler) Water(c *gin.Context) {
    reply, err := h.svc.Water(c.Request.Context(), userID(c), parseUint64(c.Param("id")))
    if errors.Is(err, ErrInteractionLimited) { c.JSON(429, gin.H{"error": "limited"}); return }
    if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
    c.JSON(200, gin.H{"reply": reply})
}
```

```go
// routes.go
authed.POST("/plant/:id/water", h.Water)
```

测试：每日 5 次后第 6 次返回 ErrInteractionLimited。

- [ ] **Step 2：前端**

```ts
// src/api/interaction.ts
import { request } from "@/lib/request";
export const waterPlant = (id: number) =>
  request.post<{ reply: string }>(`/garden/plant/${id}/water`).then((r) => r.data);
```

在 `PlantDetail.tsx` 加按钮：调用 `waterPlant`，把 reply 临时显示为 toast。

- [ ] **Step 3：测试 + 提交**

```bash
cd server && go test ./internal/garden/ -v
pnpm --filter @valley/seed-garden typecheck
git add server/internal/garden/ apps/seed-garden/src/
git commit -m "feat(garden): 浇水互动（每日 5 次配额 + 加速 30s + AI 回应）"
```

---

## Task 14: 聊天 API + 前端对话框（成熟后）

**Files:**
- Modify: 服务端同 Task 13 一组文件 + `Chat` 方法
- Modify: 前端 `api/interaction.ts`、`pages/PlantDetail.tsx`

- [ ] 服务端：`Chat(ctx, uid, pid, msg)` 仅在 `Status == mature` 可用，每日 3 次配额。复用 `PromptChat`。
- [ ] 路由：`POST /garden/plant/:id/chat`，body `{message}`。
- [ ] 前端：在 PlantDetail 页面成熟态下显示 chat 输入框。
- [ ] 测试：mature 状态下成功 + 配额耗尽返回 429 + growing 状态返回 ErrNotMature → 400。
- [ ] 提交：`feat(garden): 成熟植物聊天（每日 3 次）`。

---

## Task 15: 收获 API + 前端「收获」按钮

**Files:**
- Modify: 服务端 `service.go`、`handler.go`、`routes.go`
- Modify: 前端 `api/plant.ts`、`pages/PlantDetail.tsx`

- [ ] **服务端 Harvest**：

```go
func (s *Service) Harvest(ctx context.Context, uid, pid uint64) (*model.Harvest, error) {
    p, err := s.ownedPlant(ctx, uid, pid)
    if err != nil { return nil, err }
    if p.Status != StatusMature { return nil, ErrNotMature }
    logs, _ := s.store.ListGrowthLogs(ctx, pid)
    text, err := s.ai.GenerateText(ctx, PromptHarvest(p.Name, p.Mood, p.WaterStyle, summarize(logs)))
    if err != nil { return nil, err }
    parsed, err := ParseHarvestJSON(text)
    if err != nil { return nil, err }
    h := &model.Harvest{
        PlantID: pid, FinalAssetKey: p.AssetKey,
        FinalStory: parsed.FinalStory,
        FruitName: parsed.FruitName, FruitDescription: parsed.FruitDescription,
        FarewellLetter: parsed.FarewellLetter,
    }
    if err := s.store.CreateHarvest(ctx, h); err != nil { return nil, err }
    now := s.now()
    p.Status = StatusHarvested
    p.SlotIndex = -1
    p.HarvestedAt = &now
    _ = s.store.UpdatePlant(ctx, p)
    return h, nil
}
```

- [ ] 路由：`POST /garden/plant/:id/harvest`。
- [ ] 测试：未成熟返回 ErrNotMature；成熟收获后 SlotIndex 变 -1，再次种植可以使用同一槽位。
- [ ] 前端：`api/plant.ts` 加 `harvestPlant`；PlantDetail 成熟态显示「收获」按钮，收获后跳转 `/garden`。
- [ ] 提交：`feat(garden): 收获流程 + Harvest 实体`。

---

# M6 图鉴与分享卡

## Task 16: 图鉴列表 API + 瀑布流页面

**Files:**
- Modify: 服务端 `service.go`（`ListEncyclopedia(ctx, uid)` 返回 `[]EncyclopediaItem{Plant, Harvest}`）
- Modify: `handler.go` GET `/garden/encyclopedia`
- Create: `apps/seed-garden/src/api/encyclopedia.ts`
- Create: `apps/seed-garden/src/components/EncyclopediaCard.tsx`
- Create: `apps/seed-garden/src/pages/Encyclopedia.tsx`
- Modify: `apps/seed-garden/src/App.tsx`

- [ ] 服务端返回 `harvested` plants + 关联 harvest，按 `harvested_at desc`。
- [ ] 前端 `EncyclopediaCard` 复用稀有度卡框 class，显示编号 No.{idx+1}、名字、描述、final_asset 图。
- [ ] 路由：`/garden/encyclopedia`，从 Garden 页加入口按钮。
- [ ] typecheck + go test + 提交：`feat(garden): 图鉴页（瀑布流 + 稀有度卡框）`。

---

## Task 17: 分享卡导出 + 公开预览

**Files:**
- Modify: 服务端：路由 `GET /garden/share/:id`（不需要 auth；返回 plant + harvest 的脱敏副本）
- Create: `apps/seed-garden/src/components/ShareCardExport.tsx`
- Create: `apps/seed-garden/src/pages/SharePreview.tsx`
- Modify: `apps/seed-garden/src/App.tsx`

- [ ] 后端：在 `routes.go` 在 `authed` 之外加 `g.GET("/share/:id", h.GetShare)`，service 内只返回已 harvested 的内容；未收获返回 404。
- [ ] 前端：
  - `ShareCardExport` 用 `html2canvas` 把卡片节点导成 PNG，触发 `<a download>` 下载。
  - `SharePreview` 公开页支持任何人通过 `/garden/share/:id` 查看。
- [ ] 在 PlantDetail 收获后 / Encyclopedia 卡片上加「导出分享图」按钮。
- [ ] typecheck + 提交：`feat(garden): 分享卡导出（html2canvas）+ 公开分享页`。

---

# M7 收尾

## Task 18: 动画打磨与空状态

- [ ] PlantPot 在阶段切换时用 `framer-motion` 的 layout transition 做轻微回弹。
- [ ] Garden 首页 0 棵植物时显示空状态文案「在花盆里写点什么吧」。
- [ ] 加载失败时显示「种子精灵在打盹...」兜底文案（对齐设计文档 §8.4）。
- [ ] 提交：`chore(seed-garden): 动画与空状态打磨`。

## Task 19: 移动端响应式与可访问性

- [ ] 在 375px / 414px 视口下检查 Garden / PlantDetail / Encyclopedia 不溢出。
- [ ] 所有 button 加可读 `aria-label`。
- [ ] 暖黄渐晕在 dark mode 系统下保持暖黄（不切换暗色，因为这是产品风格锚点）。
- [ ] 提交：`fix(seed-garden): 移动端布局与无障碍打磨`。

## Task 20: 文档与计划同步收尾

- [ ] 更新 `docs/superpowers/specs/2026-06-16-seed-garden-design.md` §9 中已完成的 P0 项打勾。
- [ ] 在 `apps/seed-garden/README.md` 写明本地启动、生产部署 TODO（Vercel 子项目）。
- [ ] 全量校验：

```bash
cd server && go test ./...
pnpm --filter @valley/seed-garden typecheck
pnpm --filter @valley/seed-garden check
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
  docs/superpowers/specs/2026-06-16-seed-garden-design.md \
  docs/superpowers/specs/seed-garden-prompt-v3.2.md \
  docs/superpowers/plans/2026-06-16-seed-garden-plan.md \
  apps/seed-garden/AGENTS.md \
  apps/seed-garden/README.md \
  AGENTS.md
```

- [ ] 提交：`docs(seed-garden): 同步设计文档 P0 完成项与启动说明`。
- [ ] 最终回复用户：本次改了哪些（M1–M7 列表）、哪些已自动校验、哪些需要用户手动验收（页面观感、AI 文本质量、资产观感）。

---

## Self-Review

**Spec coverage**：

- §1–§3 定位/目标/用户：M3 Task 10 首页文案、空状态在 Task 18 体现 ✓
- §4 玩法（核心循环 / 种子诞生 / 挂机生长 / 互动 / 收获 / 图鉴）：分别由 M3 / M4 / M5 / M6 覆盖 ✓
- §5 数据模型：Task 3 / Task 4 ✓
- §6 技术栈与目录：Task 2 ✓；后端目录 Task 4 ✓
- §7 视觉系统：Task 1（prompt 抽取）+ Task 10（卡框、暖黄渐晕）✓
- §8 AI 集成：Task 7（5 个 prompt + 解析）+ Task 9 / 11 / 13 / 14 / 15 调用 + 配额 Task 13 / 14 ✓
- §9 MVP 范围：P0 全部分配到 M1–M6 ✓
- §10 里程碑：M1–M7 ✓
- §11 风险：JSON 兜底 Task 7、时间戳后端校验 Task 11、AI 失败兜底文案 Task 13 / 18、资产撞图 Task 5 随机加权 ✓
- §12 全局衔接：根 AGENTS 路由 Task 2 Step 8 ✓

**Placeholder scan**：无 TBD / TODO / 不可执行的「类似 Task X」表述。

**Type consistency**：`AssetEntry`、`Plant`、`Garden`、`GrowthLog`、`Harvest`、`SeedJSON`、`HarvestJSON`、`PlantSeedReq` 在所有引用任务命名一致。`stageInterval` / `stageMaxForRarity` 在 service 内单一定义。

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-16-seed-garden-plan.md`. Two execution options:**

1. **Subagent-Driven（推荐）** - 主对话每个任务派一个干净 subagent 实现 + 两阶段 review，推进快、隔离上下文。
2. **Inline Execution** - 在当前会话里按任务顺序批量执行，到 checkpoint 暂停让你 review。

请选择一种。

— END —
