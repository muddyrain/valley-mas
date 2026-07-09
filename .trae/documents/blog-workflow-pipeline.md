# 博客智能体 Workflow Pipeline 实现计划

## Context

用户希望实现一个"智能体流程"：上传 MD 文件后，通过预定义的服务端 pipeline 自动完成博客创建（解析 → AI 摘要 → AI 封面 → AI 标签 → 创建草稿），用户确认后发布。类似 Coze 的 Workflow，但是提前定义好的固定步骤。

现有基础：
- 服务端 Agent Runtime（tool loop）已在 Life Trace Assistant 中使用，但本场景是固定步骤 pipeline，无需动态 tool 选择，直接顺序执行更简单
- 博客 AI 能力（摘要/封面/封面选图）已有完整实现，但分散在各 handler 中，需要抽取可复用的内部函数
- MD 解析目前仅前端 TypeScript 实现，只提取 title，需新增服务端 Go 实现
- SSE 流式推送有成熟模式（`prepareLifeTraceSSE`）

## 实现方案

### Phase 1：服务端 Pipeline 基础设施

#### 1.1 Go 端 MD Front Matter 解析器

**新建** `server/internal/utils/frontmatter.go`

- 使用已有的 `go.yaml.in/yaml/v3`（go.mod 间接依赖已有）
- 去除 BOM、统一换行符
- 解析 `---` 分隔的 YAML front matter
- 支持字段别名映射：`description`/`summary` → `Excerpt`，`image`/`cover_image` → `Cover`，`keywords` → `Tags`
- 标题三级回退：front matter `title` → 首个 `# heading` → 调用方传 filename
- 内容剥离 front matter 定界符后存储

```go
type FrontMatter struct {
    Title       string   `yaml:"title"`
    Date       string   `yaml:"date"`
    Excerpt    string   `yaml:"excerpt"`      // aliases: description, summary
    Cover      string   `yaml:"cover"`        // aliases: image, cover_image
    Tags       []string `yaml:"tags"`         // aliases: keywords
    Categories []string `yaml:"categories"`
    Visibility string   `yaml:"visibility"`
    Status     string   `yaml:"status"`
}

type ParsedMarkdown struct {
    FrontMatter FrontMatter
    Content     string // body after front matter stripped
}

func ParseFrontMatter(raw []byte) (*ParsedMarkdown, error)
```

**新建** `server/internal/utils/frontmatter_test.go` - 覆盖正常 front matter、无 front matter、BOM、字段别名、多级标题回退

#### 1.2 博客标签推荐 Prompt Contract

**新建** `server/internal/lifetrace/ai/prompts/blog_tag_suggest.go`

遵循 `BlogCoverKeywordsContract` 模式（`PromptContract[I, O]`）：

```go
type BlogTagSuggestInput struct {
    Title   string
    Excerpt string
    Content string
}

type BlogTagSuggestOutput struct {
    Tags []string `json:"tags"`
}

var BlogTagSuggestContract = ai.PromptContract[BlogTagSuggestInput, BlogTagSuggestOutput]{...}
```

Prompt 要求 LLM 从博客标题/摘要/内容中提取 3-5 个标签，输出 JSON `{"tags": ["..."]}`。

#### 1.3 重构 blog_ai.go - 抽取可复用内部函数

**修改** `server/internal/handler/blog_ai.go`

从现有 handler 抽取两个内部函数供 pipeline 调用：

```go
// 从 AdminAIGenerateBlogExcerpt 抽取
func generateBlogExcerptInternal(title, content string) (excerpt string, model string, err error)

// 从 AdminAIGenerateBlogCover 抽取
func generateBlogCoverInternal(title, excerpt, content string) (coverURL string, coverStorageKey string, model string, err error)
```

原 handler 调用内部函数，行为不变。同时抽取 `readArkTextModelConfig` 已是包级函数可直接用。

#### 1.4 Pipeline 执行器 + API Handler

**新建** `server/internal/handler/blog_workflow.go`

**SSE 事件格式：**
```json
{
  "step": "parse|excerpt|cover|tags|create",
  "status": "running|success|skipped|error|done",
  "message": "解析 Markdown...",
  "data": { ... },
  "postId": "..."
}
```

**Pipeline 步骤：**

| Step | 触发条件 | 复用逻辑 |
|------|---------|---------|
| parse | 始终执行 | `utils.ParseFrontMatter` |
| excerpt | front matter 无 excerpt 时执行 | `generateBlogExcerptInternal` |
| cover | front matter 无 cover 时执行，先 pick from resources，再 AI generate | `extractBlogCoverKeywords` + `pickBlogCoverResource` + `generateBlogCoverInternal` |
| tags | 始终执行 | `BlogTagSuggestContract.Generate` + DB match/create |
| create | 始终执行 | 复用 `AdminCreatePost` 的核心逻辑（model 构建 + DB 写入） |

**容错规则：**
- parse 或 create 失败 → 整个 pipeline 终止，发 error 事件
- excerpt/cover/tags 失败 → 标记该步 error，继续执行，不影响创建
- cover 步骤先尝试从资源池选图（快、免费），无匹配再 AI 生成（慢、有成本），都失败则 coverSource="none"

**两个 API 端点：**

1. `POST /admin/blog/workflow/import` - 启动 pipeline
   - 请求：multipart form（file, groupId?, visibility?, excludedCoverIds?）
   - 响应：SSE 流

2. `POST /admin/blog/workflow/:id/publish` - 确认发布草稿
   - 验证 post 状态为 draft 且属于当前用户
   - 更新 status="published"，设置 PublishedAt

#### 1.5 路由注册

**修改** `server/internal/router/router.go`

在 `content` 路由组添加：
```go
content.POST("/blog/workflow/import", handler.AdminBlogWorkflowImport)
content.POST("/blog/workflow/:id/publish", handler.AdminBlogWorkflowPublish)
```

### Phase 2：前端

#### 2.1 API 层

**新建** `apps/web/src/api/blogWorkflow.ts`

- `startBlogWorkflow(data, handlers, signal?)` - FormData + fetch SSE 流式消费
- `publishWorkflowDraft(postId)` - POST 确认发布
- SSE 事件类型定义（`WorkflowSSEEvent`、各步骤 data 类型）

SSE 消费模式参考 `apps/web/src/api/blog.ts` 中 `askBlogPostStream` 的 ReadableStream 读取模式。

#### 2.2 Workflow Dialog 组件

**新建** `apps/web/src/components/blog/BlogWorkflowDialog.tsx`

与现有 `BatchMarkdownImportDialog` 并列但独立，交互模式不同（自动化 pipeline vs 手动批量）。

**使用 ReactFlow + dagre 实现 Coze/Dify 风格流水线可视化：**
- 5 个自定义 WorkflowNode 节点，带状态颜色和动画
- dagre 自动排版（一键重排），连线带箭头
- 运行中节点脉冲高亮，成功标绿，跳过虚线，失败标红
- 前端新增依赖：`@xyflow/react`、`dagre`、`@types/dagre`

**UI 分 5 区：**

1. **上传区** - 文件选择 + 分组/可见性设置
2. **进度区** - 垂直 stepper，5 步各带 pending/running/success/skipped/error 图标
3. **预览区** - pipeline 完成后显示：标题(可编辑)、摘要(可编辑)、封面图、标签(可删除)、内容预览
4. **操作区** - "保存草稿"(默认) / "立即发布" 按钮
5. **结果区** - 成功提示 + 文章编辑链接

**步骤中文标签：**
- parse: "解析 Markdown"
- excerpt: "AI 生成摘要"
- cover: "AI 匹配封面"
- tags: "AI 推荐标签"
- create: "创建草稿"

**交互流程：**
1. 用户上传 .md → 选分组/可见性 → 点"开始"
2. SSE 实时更新 stepper
3. 完成后展示预览，可编辑标题/摘要/标签
4. 点击"保存草稿"关闭对话框 / 点击"立即发布"调用 publishWorkflowDraft
5. 支持中途取消（AbortController）

#### 2.3 页面集成

**修改** `apps/web/src/pages/BlogCreate/index.tsx` - 在"批量导入 MD"按钮旁添加"AI 工作流导入"按钮

**修改** `apps/web/src/pages/MyPosts/index.tsx` - 同上

## 文件清单

### 新建

| 文件 | 用途 |
|------|------|
| `server/internal/utils/frontmatter.go` | Go 端 MD front matter 解析器 |
| `server/internal/utils/frontmatter_test.go` | 解析器测试 |
| `server/internal/lifetrace/ai/prompts/blog_tag_suggest.go` | 博客标签推荐 prompt |
| `server/internal/handler/blog_workflow.go` | Pipeline 执行器 + 2 个 API handler |
| `apps/web/src/api/blogWorkflow.ts` | 前端 workflow API + SSE 类型 |
| `apps/web/src/components/blog/BlogWorkflowDialog.tsx` | Workflow UI 组件 |

### 修改

| 文件 | 改动 |
|------|------|
| `server/internal/handler/blog_ai.go` | 抽取 `generateBlogExcerptInternal` + `generateBlogCoverInternal` |
| `server/internal/router/router.go` | 注册 2 条新路由 |
| `apps/web/src/pages/BlogCreate/index.tsx` | 添加 workflow 入口按钮 + dialog |
| `apps/web/src/pages/MyPosts/index.tsx` | 添加 workflow 入口按钮 + dialog |

## 验证

1. `cd server && go test ./internal/utils/...` - front matter 解析器测试
2. `cd server && go test ./...` - 全量服务端测试
3. `pnpm --filter @valley/web exec tsc --noEmit` - 前端类型检查
4. 手动验证：启动 server + web → 上传测试 .md 文件 → 观察逐步进度 → 预览 → 确认发布
5. 测试错误场景：AI 配置缺失、空 MD、超大文件、中途取消
