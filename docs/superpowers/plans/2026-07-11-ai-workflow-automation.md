# AI 工作流自动化第一阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让博客导入模板能够上传 Markdown、传递标签、真实调用 ARK 生成摘要、创建博客草稿，并展示可回看的节点运行结果。

**Architecture:** 服务端在 `server/internal/workflow` 提供 graph 校验、变量解析、节点执行器注册和运行事件模型；handler 只负责鉴权、multipart 输入、SSE 与持久化。博客导入被拆成领域服务，旧导入接口与新工作流节点共同调用。Web 编辑器仅开放有服务端执行器的节点，通过 FormData 发起运行并渲染持久化的节点结果。

**Tech Stack:** Go 1.25、Gin、GORM、SQLite 测试数据库、ARK Runtime SDK、React 19、TypeScript、React Flow、shadcn UI、SSE。

**执行约束：** 不新增第三方依赖；不自动提交；不覆盖工作区现有的用户改动。只有用户明确要求提交时才运行 commit 流程。

---

## 文件结构

| 路径 | 责任 |
| --- | --- |
| `server/internal/workflow/types.go` | Graph v1、节点、边、运行上下文、结构化事件与节点执行器接口 |
| `server/internal/workflow/validate.go` | 图结构、端口、变量引用和节点配置校验 |
| `server/internal/workflow/execute.go` | 拓扑执行、节点事件、失败终止和输出聚合 |
| `server/internal/workflow/registry.go` | 白名单节点执行器注册与查找 |
| `server/internal/workflow/*_test.go` | 图校验、变量解析、执行顺序与失败传播测试 |
| `server/internal/service/blogworkflow/service.go` | Markdown 解析、摘要生成、标签合并和草稿创建的可复用领域服务 |
| `server/internal/service/blogworkflow/service_test.go` | 博客导入服务的草稿、标签、失败与清理测试 |
| `server/internal/model/workflow.go` | `WorkflowRun` 补充字段与 `WorkflowNodeRun` 模型 |
| `server/migrations/045_workflow_runs.sql` | 已有数据库的 workflow run 升级和节点运行记录表 |
| `server/internal/handler/workflow.go` | multipart 运行、SSE、运行详情/列表 handler；移除模拟逻辑 |
| `server/internal/handler/blog_workflow.go` | 旧博客导入接口适配到领域服务 |
| `server/internal/handler/workflow_test.go` | 鉴权、multipart、真实事件、历史隔离和错误分支集成测试 |
| `server/internal/router/router.go` | 增加运行历史路由，保留既有运行路径 |
| `apps/web/src/api/workflow.ts` | FormData SSE 客户端、run/history 类型与查询函数 |
| `apps/web/src/components/workflow/types.ts` | Graph v1 和节点配置的 TypeScript 类型 |
| `apps/web/src/components/workflow/nodeConfig.ts` | 仅列出第一阶段可执行节点和禁用节点说明 |
| `apps/web/src/components/workflow/properties/*` | 节点字段映射、ARK 参数、博客草稿参数表单 |
| `apps/web/src/components/workflow/RunPanel.tsx` | 文件、标签、分组输入与真实运行结果/历史入口 |
| `apps/web/src/pages/WorkflowEditor/index.tsx` | 正式博客模板、保存前校验、SSE 状态与运行历史联动 |
| `apps/web/src/pages/Workbench/index.tsx` | 模板能力文案与未开放节点状态同步 |

## Task 1: 固化 Graph v1 和校验器

**Files:**
- Create: `server/internal/workflow/types.go`
- Create: `server/internal/workflow/validate.go`
- Create: `server/internal/workflow/validate_test.go`

- [ ] **Step 1: 编写 graph 校验失败测试**

```go
func TestValidateGraphRejectsCycleAndUnknownVariable(t *testing.T) {
	graph := Graph{SchemaVersion: 1, Nodes: []Node{
		{ID: "start", Type: NodeTypeStart},
		{ID: "summary", Type: NodeTypeLLMText, Config: json.RawMessage(`{"prompt":"{{missing.output.text}}","systemPrompt":"x","maxOutputTokens":120}`)},
		{ID: "end", Type: NodeTypeEnd},
	}, Edges: []Edge{{Source: "start", Target: "summary"}, {Source: "summary", Target: "start"}, {Source: "summary", Target: "end"}}}
	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "工作流不能包含循环")
	assertContains(t, errs, "变量 missing.output.text 不存在或不在上游")
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd server && go test ./internal/workflow -run TestValidateGraphRejectsCycleAndUnknownVariable -count=1`

Expected: FAIL，因为 `Graph`、`ValidateGraph` 与 `DefaultRegistry` 尚不存在。

- [ ] **Step 3: 定义稳定运行时类型和白名单接口**

```go
type NodeType string

const (
	NodeTypeStart          NodeType = "start"
	NodeTypeBlogParse      NodeType = "blog.parseMarkdown"
	NodeTypeLLMText        NodeType = "llm.text"
	NodeTypeBlogCreateDraft NodeType = "blog.createDraft"
	NodeTypeEnd            NodeType = "end"
)

type Node struct { ID string `json:"id"`; Type NodeType `json:"type"`; Config json.RawMessage `json:"config"` }
type Edge struct { Source string `json:"source"`; Target string `json:"target"` }
type Graph struct { SchemaVersion int `json:"schemaVersion"`; Nodes []Node `json:"nodes"`; Edges []Edge `json:"edges"` }
type RunStatus string
const ( StatusRunning RunStatus = "running"; StatusSucceeded RunStatus = "success"; StatusFailed RunStatus = "error" )
type RunContext struct { ID string; Inputs map[string]any; Outputs map[string]map[string]any }
type NodeResult struct { Output map[string]any; Metadata map[string]any }
type NodeExecutor interface { Type() NodeType; Validate(json.RawMessage) error; Execute(context.Context, RunContext, Node) (NodeResult, error) }
```

实现 `ValidateGraph`：要求 `schemaVersion == 1`、恰有一个开始和结束节点、边端点存在、没有环、节点 executor 已注册；解析 `{{...}}` 后确认引用节点位于拓扑上游且输出字段已声明。

- [ ] **Step 4: 增加可验证配置边界**

`llm.text` 校验 `systemPrompt`、`prompt`、`maxOutputTokens`；`blog.parseMarkdown` 校验 `fileInput`；`blog.createDraft` 校验 title/content/tag 输入映射；`end` 校验至少一个输出映射。温度限制为 `0 <= temperature <= 2`，最大输出限制为 `1 <= maxOutputTokens <= 4096`。

- [ ] **Step 5: 运行包测试**

Run: `cd server && go test ./internal/workflow -count=1`

Expected: PASS，覆盖缺失开始/结束、环、未知节点、未知变量、无效 LLM 参数和合法博客 graph。

## Task 2: 以测试驱动实现运行器、变量解析与事件契约

**Files:**
- Create: `server/internal/workflow/execute.go`
- Create: `server/internal/workflow/registry.go`
- Create: `server/internal/workflow/execute_test.go`

- [ ] **Step 1: 写执行顺序与失败停止测试**

```go
func TestExecutorPublishesNodeOutputAndStopsAfterFailure(t *testing.T) {
	registry := NewRegistry(stubExecutor{"first", map[string]any{"title": "文章"}, nil}, stubExecutor{"second", nil, errors.New("ARK unavailable")})
	events := make([]Event, 0)
	err := Execute(context.Background(), graphFor("first", "second"), registry, RunContext{}, func(event Event) { events = append(events, event) })
	if err == nil || len(events) != 4 { t.Fatalf("err=%v events=%+v", err, events) }
	if events[0].Status != StatusRunning || events[1].Output["title"] != "文章" || events[3].Status != StatusFailed { t.Fatalf("unexpected events: %+v", events) }
}
```

- [ ] **Step 2: 运行失败测试**

Run: `cd server && go test ./internal/workflow -run TestExecutorPublishesNodeOutputAndStopsAfterFailure -count=1`

Expected: FAIL，因为 `Execute`、`Event` 与状态常量尚不存在。

- [ ] **Step 3: 实现受控变量解析和拓扑执行**

```go
type Event struct { RunID, NodeID string; Status RunStatus; Message string; Input, Output map[string]any; Error string; DurationMs int64 }

func ResolveTemplate(value string, outputs map[string]map[string]any) (string, error) {
	var resolveErr error
	resolved := variablePattern.ReplaceAllStringFunc(value, func(token string) string {
		parts := strings.Split(strings.TrimSpace(token[2:len(token)-2]), ".")
		if len(parts) != 3 || parts[1] != "output" { resolveErr = fmt.Errorf("无效变量 %s", token); return token }
		output, exists := outputs[parts[0]]
		if !exists { resolveErr = fmt.Errorf("变量 %s 不存在或不在上游", strings.Join(parts, ".")); return token }
		field, exists := output[parts[2]]
		if !exists { resolveErr = fmt.Errorf("变量 %s 不存在或不在上游", strings.Join(parts, ".")); return token }
		return fmt.Sprint(field)
	})
	return resolved, resolveErr
}

func Execute(ctx context.Context, graph Graph, registry *Registry, run RunContext, emit func(Event)) error {
	for _, node := range TopologicalNodes(graph) {
		emit(Event{RunID: run.ID, NodeID: node.ID, Status: StatusRunning})
		result, err := registry.Executor(node.Type).Execute(ctx, run, node)
		if err != nil { emit(Event{RunID: run.ID, NodeID: node.ID, Status: StatusFailed, Error: err.Error()}); return err }
		run.Outputs[node.ID] = result.Output
		emit(Event{RunID: run.ID, NodeID: node.ID, Status: StatusSucceeded, Output: result.Output})
	}
	return nil
}
```

实现时不得执行表达式语言、Go template、用户代码或外部 URL；变量解析仅访问 `RunContext.Inputs` 和已验证的上游输出。

- [ ] **Step 4: 运行测试**

Run: `cd server && go test ./internal/workflow -count=1`

Expected: PASS，失败节点之后不再执行，且事件包含真实输入/输出/错误。

## Task 3: 增加可回看的运行数据模型与迁移

**Files:**
- Modify: `server/internal/model/workflow.go`
- Modify: `server/internal/database/database.go`
- Create: `server/migrations/045_workflow_runs.sql`
- Create: `server/internal/model/workflow_test.go`

- [ ] **Step 1: 写模型与迁移测试**

```go
func TestWorkflowNodeRunPersistsStructuredResult(t *testing.T) {
	db := openWorkflowSQLite(t)
	run := model.WorkflowRun{WorkflowID: 1, Status: "running", Inputs: `{"tagIds":["2"]}`, GraphSnapshot: `{"schemaVersion":1}`}
	requireNoError(t, db.Create(&run).Error)
	nodeRun := model.WorkflowNodeRun{WorkflowRunID: run.ID, NodeID: "draft", NodeType: "blog.createDraft", Status: "success", Output: `{"postId":"9"}`, DurationMs: 42}
	requireNoError(t, db.Create(&nodeRun).Error)
	if nodeRun.ID == 0 { t.Fatal("node run ID was not generated") }
}
```

- [ ] **Step 2: 运行失败测试**

Run: `cd server && go test ./internal/model -run TestWorkflowNodeRunPersistsStructuredResult -count=1`

Expected: FAIL，因为 `WorkflowNodeRun`、`GraphSnapshot` 和 `DurationMs` 尚不存在。

- [ ] **Step 3: 扩展模型并创建向前兼容迁移**

`WorkflowRun` 增加 `GraphSnapshot`、`Output`、`ErrorMessage`、`CancelledAt`。新增 `WorkflowNodeRun`，字段为 `ID`、`WorkflowRunID`、`NodeID`、`NodeType`、`Sequence`、`Status`、`Input`、`Output`、`ErrorMessage`、`StartedAt`、`FinishedAt`、`DurationMs`、`CreatedAt`。

`045_workflow_runs.sql` 必须使用幂等 DDL：为历史表补 `inputs` 与新增字段，创建 `workflow_node_runs` 和 `(workflow_run_id, sequence)`、`(workflow_id, created_at)`、`status` 索引。将新模型加入 `contentDomainMigrationModels()`，确保 `DB_AUTO_MIGRATE=true` 的本地环境也能建立表。

- [ ] **Step 4: 运行模型与迁移范围测试**

Run: `cd server && go test ./internal/model ./internal/database -count=1`

Expected: PASS，SQLite AutoMigrate 创建 run 与 node run 表，既有 content migration 范围仍包含工作流模型。

## Task 4: 抽取可复用博客导入领域服务与真实节点

**Files:**
- Create: `server/internal/service/blogworkflow/service.go`
- Create: `server/internal/service/blogworkflow/service_test.go`
- Modify: `server/internal/handler/blog_workflow.go`
- Create: `server/internal/workflow/blog_nodes.go`
- Create: `server/internal/workflow/llm_node.go`

- [ ] **Step 1: 编写博客导入服务失败与标签优先级测试**

```go
func TestCreateDraftKeepsManualTagsAndDoesNotCreateOnInvalidMarkdown(t *testing.T) {
	svc := newBlogWorkflowService(t)
	_, err := svc.ParseMarkdown("post.md", []byte("   "))
	if err == nil || !strings.Contains(err.Error(), "Markdown 内容为空") { t.Fatalf("err=%v", err) }
	draft, err := svc.CreateDraft(context.Background(), CreateDraftInput{Title: "标题", Content: "正文", ManualTagIDs: []string{"11"}, SuggestedTags: []string{"AI"}})
	requireNoError(t, err)
	assertPostHasTagIDs(t, draft.PostID, []string{"11"})
}
```

- [ ] **Step 2: 运行失败测试**

Run: `cd server && go test ./internal/service/blogworkflow -run TestCreateDraftKeepsManualTagsAndDoesNotCreateOnInvalidMarkdown -count=1`

Expected: FAIL，因为服务与输入类型尚不存在。

- [ ] **Step 3: 抽取 handler 无关的领域服务**

```go
type Service struct { DB *gorm.DB; GenerateExcerpt func(context.Context, string, string) (string, string, error) }
type ParsedMarkdown struct { Title, Content, Excerpt, Cover string; FrontMatterTags []string }
type CreateDraftInput struct { UserID int64; Role string; Title, Content, Excerpt, Cover string; ManualTagIDs []string; SuggestedTags []string; GroupID model.Int64String; Visibility string; TagMode string }

func (s Service) ParseMarkdown(filename string, content []byte) (ParsedMarkdown, error)
func (s Service) CreateDraft(ctx context.Context, input CreateDraftInput) (CreateDraftResult, error)
```

迁移 `runBlogWorkflow` 中的纯业务步骤到该服务。旧 handler 仅解析 multipart、转发 service 进度并输出旧 SSE 格式。标签策略实现 `merge`（手选 ID + Front Matter/建议名去重）与 `manual_only`（仅手选 ID）；无论策略为何，手选 ID 必须保留。

- [ ] **Step 4: 实现三类业务节点**

`blog.parseMarkdown` 从开始节点文件输入读取字节并输出 title/content/excerpt/cover/tags；`llm.text` 调用 `aiclient.ReadARKTextConfig`、`ARKClient` 与 `NewARKChatRequest`，使用 `WithARKChatTokens` 和 `WithARKChatTemperature`；`blog.createDraft` 只接受已校验的上游字段和用户 ID，输出 `postId`、`title`、`editPath`、`tagIds`。

无法读取 ARK 配置时 LLM executor 返回配置错误；上游失败、模型失败或创建草稿失败时执行器返回错误，运行器不得继续或制造文章。

- [ ] **Step 5: 运行服务与运行时测试**

Run: `cd server && go test ./internal/service/blogworkflow ./internal/workflow -count=1`

Expected: PASS，包含 Markdown 空内容、手选标签保留、ARK 配置缺失和草稿创建失败分支。

## Task 5: 用真实执行替换 workflow handler，并提供历史接口

**Files:**
- Modify: `server/internal/handler/workflow.go`
- Modify: `server/internal/router/router.go`
- Create: `server/internal/handler/workflow_test.go`

- [ ] **Step 1: 编写 multipart SSE 与权限隔离测试**

```go
func TestRunWorkflowStreamsRealNodeOutputAndHistoryIsOwnerScoped(t *testing.T) {
	router, workflowID := setupWorkflowRouter(t, graphWithBlogNodes())
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	_ = writer.WriteField("inputs", `{"tagIds":["7"],"visibility":"private"}`)
	part, _ := writer.CreateFormFile("markdownFile", "article.md")
	_, _ = part.Write([]byte("# 标题\n正文"))
	_ = writer.Close()
	rec := requestWorkflow(t, router, http.MethodPost, "/workflows/"+workflowID+"/run", "101", body, writer.FormDataContentType())
	if !strings.Contains(rec.Body.String(), `"nodeId":"parse"`) || !strings.Contains(rec.Body.String(), `"postId"`) { t.Fatalf("events=%s", rec.Body.String()) }
	other := requestWorkflow(t, router, http.MethodGet, "/workflows/"+workflowID+"/runs", "202", nil, "")
	if other.Code != http.StatusNotFound { t.Fatalf("got %d", other.Code) }
}
```

- [ ] **Step 2: 运行失败测试**

Run: `cd server && go test ./internal/handler -run TestRunWorkflowStreamsRealNodeOutputAndHistoryIsOwnerScoped -count=1`

Expected: FAIL，因为 handler 仍然只接受 JSON 并模拟成功。

- [ ] **Step 3: 实现 handler 与路由**

运行 handler 必须：验证当前用户是 workflow owner；解析 `multipart/form-data` 的 `inputs` 与文件；创建 `WorkflowRun`；校验 graph；在每个事件发生时创建/更新 `WorkflowNodeRun` 并 flush `data: <json>\n\n`；完成时写入最终 output，失败时写入错误。

新增：

```go
auth.GET("/workflows/:id/runs", handler.ListWorkflowRuns)
auth.GET("/workflows/:id/runs/:runId", handler.GetWorkflowRun)
```

运行 route 保持 `POST /workflows/:id/run`，以免破坏当前前端入口。错误状态映射：无效输入 `400`、无权 `403/404`、ARK 配置缺失 `503`、上游模型失败 `502`、内部持久化失败 `500`。

- [ ] **Step 4: 运行 handler 测试**

Run: `cd server && go test ./internal/handler -run 'TestRunWorkflow|TestListWorkflowRuns|TestGetWorkflowRun' -count=1`

Expected: PASS，断言不再存在 500ms 模拟成功，且历史记录不泄漏给其他用户。

## Task 6: 升级前端 graph、模板与 multipart SSE 客户端

**Files:**
- Modify: `apps/web/src/api/workflow.ts`
- Modify: `apps/web/src/components/workflow/types.ts`
- Modify: `apps/web/src/components/workflow/nodeConfig.ts`
- Modify: `apps/web/src/components/workflow/validateWorkflowConfig.ts`
- Modify: `apps/web/src/pages/WorkflowEditor/index.tsx`

- [ ] **Step 1: 定义前端 Graph v1 和运行类型**

```ts
export type ExecutableNodeType = 'start' | 'blog.parseMarkdown' | 'llm.text' | 'blog.createDraft' | 'end';
export interface WorkflowRunEvent { runId: string; nodeId?: string; status: 'running' | 'success' | 'error' | 'done'; durationMs?: number; input?: Record<string, unknown>; output?: Record<string, unknown>; error?: string; }
export interface WorkflowRunDetail { id: string; status: string; output?: Record<string, unknown>; errorMessage?: string; nodeRuns: WorkflowNodeRun[]; }
```

首次读取旧 graph 时显式标记 legacy 节点为不可运行；保存时只允许 `schemaVersion: 1` 和第一阶段节点组合。移除模板中的 `gpt-4o-mini`，LLM 默认配置改为 `modelProfile: 'ark-text-default'`。

- [ ] **Step 2: 把运行请求改为 FormData 并保持 SSE 解析**

```ts
const formData = new FormData();
formData.append('inputs', JSON.stringify(serializedInputs));
for (const [name, value] of Object.entries(inputs)) {
  if (value instanceof File) formData.append(name, value);
}
const response = await fetch(`${base}/workflows/${id}/run`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, body: formData, signal });
```

不得手动设置 `Content-Type`，让浏览器附带 multipart boundary。解析事件时以 `nodeId`、`durationMs`、`output`、`error` 更新 node result，并在 `done` 中保存 run ID。

- [ ] **Step 3: 构造正式博客导入模板**

模板固定为 `start -> blog.parseMarkdown -> llm.text -> blog.createDraft -> end`。开始节点字段定义 `markdownFile`、`tagIds`、`groupId`、`visibility`；草稿节点使用 `tagMode: 'merge'`；结束节点映射 `draft.postId`、`draft.editPath`、`summary.text`。模板中的每项映射都通过 `validateWorkflowConfig` 校验。

- [ ] **Step 4: 运行前端静态检查**

Run: `pnpm --filter @valley/web exec tsc --noEmit`

Expected: PASS，现有 API 调用均使用新的 `WorkflowRunEvent` 类型。

## Task 7: 完成节点表单、试运行结果和历史体验

**Files:**
- Modify: `apps/web/src/components/workflow/RunPanel.tsx`
- Modify: `apps/web/src/components/workflow/WorkflowNode.tsx`
- Modify: `apps/web/src/components/workflow/PropertyPanel.tsx`
- Modify: `apps/web/src/components/workflow/properties/LLMPropertyForm.tsx`
- Create: `apps/web/src/components/workflow/properties/BlogParsePropertyForm.tsx`
- Create: `apps/web/src/components/workflow/properties/BlogCreateDraftPropertyForm.tsx`
- Modify: `apps/web/src/pages/WorkflowEditor/index.tsx`
- Modify: `apps/web/src/pages/Workbench/index.tsx`

- [ ] **Step 1: 落实真实可配字段**

LLM 表单使用“默认文本模型”只读 profile，提供系统提示词、提示词模板、温度和最大输出；Markdown 节点选择文件变量；草稿节点选择上游 title/content/excerpt/cover、标签策略、分组和可见性来源。变量下拉只列出拓扑上游的已声明输出，禁止自由填写节点路径。

- [ ] **Step 2: 落实试运行输入与结果**

`RunPanel` 将 `markdownFile` 渲染为单文件选择，`tagIds` 渲染为标签多选，`groupId` 和 `visibility` 使用已有数据源/选项。成功后显示“打开草稿”按钮，链接来自 `end` 输出；每个节点展开时显示截断后的 JSON 输入/输出、毫秒耗时或可复制错误。刷新编辑器时通过 `getWorkflowRun` 恢复选中的历史运行。

- [ ] **Step 3: 关闭伪能力入口**

节点面板中 `fileUpload`、`knowledge`、`code`、`http`、`condition`、`loop`、`variable` 显示“计划中”，不能拖入新 graph；已存在 legacy graph 的这些节点在画布上显示“尚未支持，无法运行”。工作台不再宣称未交付的节点数或执行模式。

- [ ] **Step 4: 校验 Web 代码与手工运行路径**

Run: `pnpm --filter @valley/web check && pnpm --filter @valley/web build`

Expected: PASS。

手工验收：启动 Web 与 Go 服务，创建博客模板，上传 `.md`、选择两个标签，保存并运行；确认节点按顺序更新、最终出现草稿入口；刷新后仍能查看本次 run；故意移除 `ARK_API_KEY` 后确认 LLM 节点明确失败且不创建新草稿。

## Task 8: 收尾验证、文档状态和风险检查

**Files:**
- Modify: `docs/superpowers/specs/2026-07-11-ai-workflow-automation-design.md`
- Modify: `docs/superpowers/plans/2026-07-11-ai-workflow-automation.md`

- [ ] **Step 1: 运行定向与全链路校验**

Run:

```bash
pnpm check:harness
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/web check
pnpm --filter @valley/web build
cd server && go test ./...
python3 ../.agents/skills/encoding-guard/scripts/check_mojibake.py \
  internal/workflow internal/service/blogworkflow internal/handler/workflow.go \
  internal/handler/blog_workflow.go internal/model/workflow.go \
  ../apps/web/src/api/workflow.ts ../apps/web/src/components/workflow \
  ../apps/web/src/pages/WorkflowEditor/index.tsx ../apps/web/src/pages/Workbench/index.tsx
git diff --check
```

Expected: 每个命令 exit 0；真实 ARK 冒烟依赖本地环境变量，若不可用必须记录为未自动验证项。

- [ ] **Step 2: 更新真实状态**

只有在 Task 1 至 Task 7 全部完成并通过上述验证后，才将 spec 状态改为“已实施”；逐项勾选本计划实际完成的步骤。若某个节点、历史界面或真实模型调用未完成，保留未勾选状态并在最终报告列出。

- [ ] **Step 3: 完成前自检**

检查：没有模拟 `Sleep` 成功路径；不存在前端硬编码 `gpt-*` 模型；上传文件不经过 JSON 序列化；所有 run/history 查询均执行 owner 检查；没有开放 HTTP/代码执行；没有覆盖本任务前已有的工作区改动。

## 计划自审

- spec 中的 Graph v1、真实 ARK、Markdown + 标签、SSE、节点历史、兼容旧博客入口、未开放节点和安全边界，分别由 Task 1 至 Task 7 覆盖。
- 所有新增运行时类型先有 Go 测试，真实 handler 有 multipart/鉴权测试；前端没有现成测试框架，因此用类型检查、静态检查、构建和真实浏览器验收覆盖。
- 当前没有新增依赖、没有自动提交步骤，也没有为未来 HTTP/代码节点编写未被第一阶段使用的基础设施。
