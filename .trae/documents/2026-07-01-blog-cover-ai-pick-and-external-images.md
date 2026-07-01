# 博客封面 · AI 一键选图 + 外部图源 Tab 弹窗

**日期**: 2026-07-01
**范围**: apps/web + server
**档位**: C 档（多文件、新接口、新 config、新依赖来源），落地前保留本 plan，落地后由 owner 决定归档/清理

## Context

当前博客创建/编辑（apps/web/src/pages/BlogCreate/index.tsx）已有三种封面来源：本地上传+裁剪、AI 生图（ARK GenerateImages，慢且质量差）、从公用壁纸弹窗中挑选（PublicWallpaperPickerDialog）。

用户希望：

1. 增加"AI 选图"——从已有 wallpaper 资源池里由 LLM 根据博客内容一键挑一张，不满意可点"换一张"。跳过慢/丑的文生图。
2. 外部图源接入——因为 haowallpaper 每天限流 10 张，本地资源池扩不动。希望在选封面弹窗里加 Tab，能浏览 Unsplash / Pexels / Pixabay / Wallhaven 的图并直接当封面。MVP 只做 Unsplash + Pexels，后两家占位。
3. 差异化（同页避免相似封面）本次不做。

外部图选中后**只转存为当前博客封面**（复用既有 uploadBlogCoverByUrl），不落 Resource 表。

---

## 后端实施

### 1. AI 选图接口

- 路由：`POST /admin/blog/ai/cover/pick`
  - 挂在 [router.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/router/router.go#L272-L273) 的 content 组（`Auth + CreatorOrAdmin`）。
- Handler：新增 [blog_ai_pick.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai_pick.go) → `AdminAIPickBlogCoverFromResources`
  - Bind `{title?, excerpt?, content, excludedIds []string}`。
  - Step 1 抽关键词：调用新增的 PromptContract（见下）。空/失败 → 用 title 分词兜底；再失败 → 走 Step 2 无关键词分支。
  - Step 2 匹配查询：`db.Model(&model.Resource{}).Where("deleted_at IS NULL").Where(publicVisibilityWhere).Where("type = ?", "wallpaper")`
    - 关键词匹配优先级：`title ILIKE any(kw)` OR `EXISTS(SELECT 1 FROM resource_tag_relations rtr JOIN resource_tags rt ON rt.id = rtr.tag_id WHERE rtr.resource_id = resources.id AND rt.name ILIKE any(kw))`
    - 排除：`id NOT IN excludedIds`
    - 排序 `ORDER BY RANDOM()`（MySQL 用 `RAND()`，按项目 DB 方言写），`LIMIT 1`。
  - Step 3 兜底：命中 0 → 放宽只保留 title 条件重查；仍为 0 → 完全随机取一张 wallpaper（保证"一键必有图"）；连 wallpaper 表都空 → `404 no wallpaper available`。
  - 返回：`{resource: <Resource JSON>, matchedKeywords: []string, model?: string}`（Resource JSON 复用 [home.go 中 wallpaper 序列化格式](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/home.go#L672)，字段与前端 `Resource` 类型对齐）。
- 已存在的复用点：
  - [publicVisibilityWhere](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/home.go#L17)
  - `ensureSharedArkClient` / `readArkTextModelConfig` / `callChatStream`（见 [blog_ai.go AdminAIGenerateBlogExcerpt](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go#L386-L450)）

### 2. Prompt 下沉

新增 [server/internal/lifetrace/ai/prompts/blog_cover_keywords.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/blog_cover_keywords.go)，遵循同目录 PromptContract[I,O] 范式（参考 [pantry_description.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/pantry_description.go)）：

```
BlogCoverKeywordsInput  { Title, Excerpt, Content string }
BlogCoverKeywordsOutput { Keywords []string }
BuildBlogCoverKeywordsPrompt(input)  // 要求 LLM 输出 3~5 个视觉主体关键词的 JSON
ParseBlogCoverKeywordsOutput(text)   // 去 code fence、trim、去重、裁到 5 个
BlogCoverKeywordsContract            // 组合上面两个
```

约束：Prompt 中文说明 + 输出示例；Normalize 里过滤 stop word（"文章、博客、思考"等）；最大关键词长度 20。

生成图老逻辑（`AdminAIGenerateBlogCover`）**不动**，两种能力并存。

### 3. 外部图源代理

- 路由：`GET /admin/blog/external-images/search`（同 content 组）。
  - Query：`provider=unsplash|pexels`、`query=<string>`、`page=<int>`、`perPage=<int>`。
- Handler：新增 [blog_external_images.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_external_images.go) → `AdminSearchExternalCoverImages`
  - Provider switch。每次本地建 `&http.Client{Timeout: cfg.TimeoutSeconds*time.Second}`（沿用项目现风格）。
  - **Unsplash**: `GET https://api.unsplash.com/search/photos?query=&page=&per_page=&orientation=landscape`，Header `Authorization: Client-ID <UNSPLASH_ACCESS_KEY>`。
  - **Pexels**: `GET https://api.pexels.com/v1/search?query=&page=&per_page=&orientation=landscape`，Header `Authorization: <PEXELS_API_KEY>`。
  - Key 未配置 → `503 provider not configured`；上游错误 → `502 provider unavailable`。
- 统一响应 shape：
  ```
  {
    list: [{
      id: string,
      thumbnailUrl: string,        // 小图
      fullUrl: string,             // 用作 uploadBlogCoverByUrl 输入
      previewUrl: string,          // 网格展示的中等图
      width, height: number,
      attribution: { name, profileUrl, provider }
    }],
    total: number, page: number, perPage: number
  }
  ```
- **Unsplash download trigger（合规义务）**：新增 `POST /admin/blog/external-images/unsplash/trigger-download`，body `{ downloadLocation: string }`，后端向 Unsplash `downloadLocation`（列表返回里带的追踪 URL）发 GET，成功即可。前端在 uploadBlogCoverByUrl 完成后调用一次。
  - 这是 Unsplash TOS 强要求，Pexels 不需要。
- **白名单扩展**：[isAllowedRemoteCoverHost](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_cover.go#L66-L72) 增加固定 host（用 `==` 精确比较，不用 endsWith 防钓鱼）：
  - `images.unsplash.com`
  - `plus.unsplash.com`
  - `images.pexels.com`

### 4. 配置

- [config.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/config/config.go) 新增 struct：
  ```
  type ExternalImagesConfig struct {
      UnsplashAccessKey string
      PexelsAPIKey      string
      TimeoutSeconds    int
  }
  ```
  加载：`getEnv("UNSPLASH_ACCESS_KEY","")`、`getEnv("PEXELS_API_KEY","")`、`getEnvInt("EXTERNAL_IMAGES_TIMEOUT_SECONDS", 8)`。
- 同步 [.env.example](file:///Users/bytedance/Desktop/study/valley-mas/server/.env.example) 加三条（值留空 + 注释来源链接）。

---

## 前端实施

### 5. BlogCreate 页面

[BlogCreate/index.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/pages/BlogCreate/index.tsx#L910-L963) 封面区改动：

- 在"AI配图封面"（生图）右侧新增按钮"AI 选图"（icon `Wand2`）。
- 把"选择壁纸"按钮改名为"选择封面"（打开新的多 Tab 弹窗）。生图和 AI 选图都保留，用户可自由切换。
- 新 state：
  - `aiPickLoading: boolean`
  - `aiPickExcludedIds: string[]`
- 新 handler `handleAIPickCover()`：
  - 校验 `!isContentEmpty`（复用已有变量）。
  - 调 `pickBlogCoverFromResources({ title, excerpt, content, excludedIds: aiPickExcludedIds })`。
  - 命中：`resetLocalCoverEditing()` → `setCover(resource.url); setCoverStorageKey(''); setPendingCoverRemoteUrl(resource.url)` → `setAiPickExcludedIds(prev => [...prev, resource.id])` → toast"AI 已挑选公用壁纸，发布时会自动转存"。
  - 无命中/失败：toast 提示但**不**清空 excludedIds。
  - "换一张"入口：AI 选图按钮命中后原地显示一个副按钮"换一张"（点了再调 handler），或简单方案——AI 选图按钮点第一次显示图，第二次点开始就自然带 excludedIds。选后者，最小改动。
- 切换标题/正文/摘要时不清空 excludedIds（不同分页体验；如需重置由"AI 选图"再次首点触发 UX 微调，v1 不做）。

### 6. 多 Tab 选图弹窗

- 新组件：[CoverPickerDialog.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/CoverPickerDialog.tsx)，替换主页里的 `PublicWallpaperPickerDialog` 挂载点。
- 结构：`<Dialog>` 内 `<Tabs value onValueChange>`（复用 [ui/tabs.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/ui/tabs.tsx)）
  - Tab `wallpaper` "我的资源池"：内部**直接复用** `PublicWallpaperPickerDialog` 的主体逻辑——重构方式为把 `PublicWallpaperPickerDialog` 内部的 body（Search + 网格 + 分页）抽为无 Dialog 壳的 `PublicWallpaperPickerBody` 子组件（同文件导出），两处共用。onSelect 回调同现有 `resource => url`。
  - Tab `unsplash` / `pexels`：新组件 `ExternalImageGrid`（同 CoverPickerDialog.tsx 内）
    - Props：`provider: 'unsplash' | 'pexels'`、`initialQuery: string`（用当前博客 title 预填）、`onSelect: (image: ExternalCoverImage) => void`。
    - state：keyword / page / list / total / loading。
    - 网格复用 [ResourceCard](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/ResourceCard.tsx) 的视觉风格，但**不复用组件**（数据字段不一样）。写一个简易 ExternalImageCard 内联在此文件；卡片右下角必须显示 `by {name}` + 跳转链接（attribution）。
  - Tab `pixabay` / `wallhaven`：显示"即将上线"占位块。
- 统一选中：
  - Tab `wallpaper` → `onSelect(resource.url)`
  - Tab `unsplash` / `pexels` → 先关弹窗，主页把 `pendingCoverRemoteUrl` 设为 `image.fullUrl`；主页在**发布提交时**：uploadBlogCoverByUrl 成功后，如果 image.provider === 'unsplash'，追加调用 `triggerUnsplashDownload(downloadLocation)`（异步，失败静默）。
- 主页删除 `wallpaperPickerOpen` 相关 state，改为 `coverPickerOpen`。原 `handleSelectPublicWallpaperCover` 改造为 `handleSelectCoverUrl(url: string, meta?: { provider?: 'unsplash'|'pexels'; downloadLocation?: string })`，Unsplash 命中时把 downloadLocation 存到一个新 state `pendingUnsplashDownloadLocation`（发布后调用完清空）。

### 7. API 封装

[apps/web/src/api/blog.ts](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/api/blog.ts) 追加：

```ts
export interface AIPickBlogCoverResponse {
  resource: Resource;                // from '@/api/resource'
  matchedKeywords: string[];
  model?: string;
}

export function pickBlogCoverFromResources(data: {
  title?: string; excerpt?: string; content: string; excludedIds?: string[];
}) { return request.post<unknown, AIPickBlogCoverResponse>('/admin/blog/ai/cover/pick', data); }

export interface ExternalCoverImage {
  id: string;
  thumbnailUrl: string;
  previewUrl: string;
  fullUrl: string;
  downloadLocation?: string;         // Unsplash trigger-download
  width: number;
  height: number;
  attribution: { name: string; profileUrl?: string; provider: 'unsplash' | 'pexels' | 'pixabay' | 'wallhaven' };
}

export function searchExternalCoverImages(params: {
  provider: 'unsplash' | 'pexels';
  query: string;
  page?: number;
  perPage?: number;
}) { /* GET /admin/blog/external-images/search */ }

export function triggerUnsplashDownload(downloadLocation: string) {
  /* POST /admin/blog/external-images/unsplash/trigger-download */
}
```

---

## 验证

- **后端**：`cd server && go test ./...`（新 handler、Contract Normalize 建议起码补一条 unit：keywords 空数组、命中/未命中降级各一）。
- **前端类型**：`pnpm --filter @valley/web exec tsc --noEmit`。
- **前端样式/lint**：`pnpm --filter @valley/web check`（本次涉及新组件与页面结构，建议全跑一遍）。
- **CJK 编码**：`python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <改动的中文文件>`（新 prompt、按钮文案、弹窗标题、.env.example 说明）。
- **手动验收**（浏览器）：
  1. 空正文时 "AI 选图" 按钮 disabled，鼠标悬停有 tooltip。
  2. 有正文点 "AI 选图" 命中 → 第二次点 → 结果不重复（excludedIds 生效）。
  3. 匹配 0 时 toast 提示"未找到匹配壁纸"（走兜底或提示）。
  4. 打开 "选择封面" 弹窗，Tab 切换 `我的资源池 / Unsplash / Pexels / Pixabay / Wallhaven`，前三个正常拉数据，后两个显示占位。
  5. Unsplash 卡片右下角显示作者归属 + 可点。
  6. 从 Unsplash 选一张 → 发布博客 → TOS 有转存 → Unsplash 侧收到 trigger-download 请求（可用后端日志验）。
  7. 未配置任一 API Key 时后端返回 503，前端 toast 友好。

---

## 不做

- Pixabay / Wallhaven 真实接入（仅 Tab 占位）。
- 外部图源 rate limit / 缓存 / 使用统计。
- 外部图选中后落 Resource 表或 wallpaper 资源池同步。
- 抽象通用 HTTP client / provider interface 注册中心。
- 重构现有 `AdminAIGenerateBlogCover` 生成图 prompt 到 PromptContract。
- 封面差异化（同页去重、主色打散、二次裁剪）。
- BlogList 侧任何改动。

---

## 计划文档同步

- 本 plan 属于新增能力（新接口、新前端组件、新 config、新 .env 变量），落地时需在 [apps/web/AGENTS.md 常用命令](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/AGENTS.md) 或根 [PROJECT_GUIDE.md](file:///Users/bytedance/Desktop/study/valley-mas/docs/PROJECT_GUIDE.md) 的环境变量段落里补一行外部图源 Key 说明；博客产品长期计划文件当前项目未设立，不新造。
- 落地后由 owner 决定 plan 归档还是清理。

## Skill 披露

本轮 plan 使用：brainstorming、writing-plans、component-reuse-guard、encoding-guard、karpathy-guidelines、skill-usage-disclosure。
