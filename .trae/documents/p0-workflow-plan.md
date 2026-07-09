# P0 工作流功能实现计划

## Context

当前 Valley MAS 的 AI 工作台已完成基础架构（节点拖拽、画布编辑、边连接），但与 Coze/Dify 相比存在三大核心差距：节点外观简陋、属性面板是通用 JSON 编辑器而非专属表单、工作流只存 localStorage 无后端持久化。本次 P0 实现聚焦这三项。

## 数据模型

### Workflow 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT (Snowflake) | 主键 |
| user_id | BIGINT | 所属用户 |
| name | VARCHAR(100) | 工作流名称 |
| description | VARCHAR(500) | 描述 |
| graph | JSON | `{"nodes": [...], "edges": [...]}` |
| status | VARCHAR(20) | draft / published |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | 标准时间戳 |

### WorkflowRun 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT (Snowflake) | 主键 |
| workflow_id | BIGINT | 关联工作流 |
| status | VARCHAR(20) | running / success / failed |
| result | JSON | 执行结果 |
| started_at / finished_at | TIMESTAMPTZ | 执行时间 |
| created_at / deleted_at | TIMESTAMPTZ | 标准时间戳 |

## API 契约

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /admin/workflows | 创建 |
| GET | /admin/workflows | 列表（分页） |
| GET | /admin/workflows/:id | 详情 |
| PUT | /admin/workflows/:id | 更新 |
| DELETE | /admin/workflows/:id | 删除（软删除） |
| POST | /admin/workflows/:id/run | 执行（SSE） |

所有接口需 Auth 中间件，校验 user_id 匹配防越权。Run 接口复用 blog_workflow.go 的 SSE 模式。

## 文件清单

### 新建文件（18 个）

**后端（3 个）**：
1. `server/internal/model/workflow.go` — Workflow + WorkflowRun 模型
2. `server/migrations/044_create_workflows.sql` — 建表 SQL
3. `server/internal/handler/workflow.go` — 6 个处理器

**前端（15 个）**：
4. `apps/web/src/api/workflow.ts` — Workflow API 封装
5. `apps/web/src/components/workflow/properties/PropertyFormBase.tsx` — 属性面板壳组件
6-15. `apps/web/src/components/workflow/properties/{Trigger,Input,LLM,Knowledge,Code,HTTP,Condition,Loop,Variable,Output}PropertyForm.tsx` — 10 个专属表单
16. `apps/web/src/components/workflow/properties/index.ts` — 表单注册表

### 修改文件（7 个）

17. `server/internal/database/database.go` — 添加 workflow 模型迁移映射
18. `server/internal/router/router.go` — 注册 workflow 路由
19. `apps/web/src/components/workflow/nodeConfig.ts` — 添加摘要函数和条纹颜色
20. `apps/web/src/components/workflow/WorkflowNode.tsx` — 重设计为卡片式
21. `apps/web/src/components/workflow/PropertyPanel.tsx` — 重构为按类型分发专属表单
22. `apps/web/src/components/workflow/types.ts` — 扩展 config 类型和 runningState
23. `apps/web/src/pages/WorkflowEditor/index.tsx` — 接入后端 API
24. `apps/web/src/pages/Workbench/index.tsx` — 从 API 加载工作流列表

## 实施步骤

### Phase 1: 后端数据层

1. 创建 `model/workflow.go`：Workflow + WorkflowRun 模型，遵循 Int64String + BeforeCreate 模式，Graph/Result 用 `string` + `gorm:"type:json"`
2. 创建 `migrations/044_create_workflows.sql`：两表建表 + 索引
3. 修改 `database/database.go`：添加模型映射

### Phase 2: 后端 API 层

4. 创建 `handler/workflow.go`：6 个处理器。Run 接口先做框架（遍历节点发 SSE 事件），实际 AI 调用后续迭代
5. 修改 `router/router.go`：admin group 注册路由

### Phase 3: 前端节点外观重设计

6. 扩展 `nodeConfig.ts`：添加 `CATEGORY_STRIPE_COLORS` 和 `getNodeConfigSummary()` 函数
7. 重写 `WorkflowNode.tsx`：卡片式（~220px 宽），顶部彩色条纹 + 图标标签 + 配置摘要 + 运行状态叠加

### Phase 4: 前端属性面板专属表单

8. 扩展 `types.ts`：各节点 config 类型 + runningState
9. 创建 `PropertyFormBase.tsx`：通用壳组件
10. 创建 10 个专属属性表单（每个 ~50-80 行）
11. 创建 `properties/index.ts`：注册表
12. 重写 `PropertyPanel.tsx`：按 nodeType 分发到专属表单

### Phase 5: 前端 API + 页面集成

13. 创建 `api/workflow.ts`：CRUD + SSE 运行
14. 改造 `WorkflowEditor/index.tsx`：保存/加载/运行走后端 API，节点 runningState 由 SSE 驱动
15. 改造 `Workbench/index.tsx`：从 API 加载真实工作流列表

## 节点外观设计

```
+===========================+
|  顶部彩色条纹 (4px)        |  ← data=blue, ai=purple, action=orange, control=green
+---------------------------+
|  [Icon]  节点标签          |
|  配置摘要（灰色小字）       |  ← LLM: "gpt-4", HTTP: "GET /api/..."
+---------------------------+
```

运行状态叠加：
- running：蓝色半透明 + 旋转图标
- success：绿色边框
- error：红色边框 + 错误图标

## 属性表单字段

| 节点 | 字段 | 控件 |
|------|------|------|
| Trigger | triggerType (manual/scheduled/webhook) | Select |
| Input | variables 动态列表 (name/type/required) | Input + Select + Checkbox |
| LLM | model, systemPrompt, temperature, maxTokens | Select + Textarea + range + number |
| Knowledge | datasetId, topK, scoreThreshold | Select + number x2 |
| Code | language, code, inputVars, outputVars | Select + Textarea(monospace) + 标签列表 x2 |
| HTTP | method, url, headers, body | Select + Input + 动态键值对 + Textarea |
| Condition | expression, trueLabel, falseLabel | Textarea + Input x2 |
| Loop | loopVariable, iterationCount | Input + number |
| Variable | variableName, valueExpression | Input + Textarea |
| Output | outputMappings 动态列表 (source/target) | Input 对列表 |

## 验证方式

1. `cd server && go build ./...` — 编译通过
2. `cd server && go test ./...` — 测试通过
3. `pnpm --filter @valley/web exec tsc --noEmit` — 类型检查通过
4. 启动服务端，前端创建工作流 → 编辑节点 → 保存 → 在工作台列表可见
5. 运行工作流 → 节点状态实时变化（running → success/error）
