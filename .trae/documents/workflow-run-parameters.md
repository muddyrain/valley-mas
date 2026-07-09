# 工作流运行参数功能实现计划

## Context

当前工作流编辑器点击"运行"直接执行，没有运行时参数收集环节。用户从模板创建的工作流（如"博客导入"），运行前应该能填写输入参数、看到节点配置校验结果。后端也是纯 mock 执行，忽略所有节点配置。

本计划补齐"运行参数对话框 + 节点配置校验 + 后端存储 inputs"，后端仍保持 mock 执行，真实节点执行器留给后续迭代。

## 改动文件

| # | 文件 | 改动 |
|---|---|---|
| 1 | `server/internal/model/workflow.go` | WorkflowRun 增加 `Inputs` 字段 |
| 2 | `server/internal/handler/workflow.go` | AdminRunWorkflow 解析 body 存 inputs |
| 3 | `apps/web/src/components/workflow/validateWorkflowConfig.ts` | 新建，运行前校验节点配置完整性 |
| 4 | `apps/web/src/components/workflow/RunParametersDialog.tsx` | 新建，运行参数对话框组件 |
| 5 | `apps/web/src/api/workflow.ts` | runWorkflow 增加 body 参数 |
| 6 | `apps/web/src/pages/WorkflowEditor/index.tsx` | 替换确认 Dialog 为 RunParametersDialog |

## 详细步骤

### Step 1: 后端 — WorkflowRun 模型加 Inputs 字段

`server/internal/model/workflow.go`：

```go
type WorkflowRun struct {
    // ... 已有字段 ...
    Inputs     string         `gorm:"type:json" json:"inputs,omitempty"`  // 新增
    // ...
}
```

GORM AutoMigrate 会自动加列，无需手写迁移。

### Step 2: 后端 — AdminRunWorkflow 解析请求 body

`server/internal/handler/workflow.go`：

在 `AdminRunWorkflow` 函数中：
1. 用 `io.ReadAll(c.Request.Body)` 读取 body
2. 解析 `{ "inputs": {...} }` 结构
3. 创建 WorkflowRun 时存入 inputs
4. 兼容无 body 请求（旧客户端）

### Step 3: 前端 — 新建 validateWorkflowConfig.ts

`apps/web/src/components/workflow/validateWorkflowConfig.ts`

导出 `validateWorkflowConfig(nodes): ValidationError[]`

校验规则：
- `llm` → model 非空
- `http` → url 非空
- `code` → code 非空
- `knowledge` → datasetId 非空
- `condition` → expression 非空
- `loop` → iterationCount > 0
- `variable` → variableName 非空
- `trigger`/`output`/`input` → 不校验

### Step 4: 前端 — 新建 RunParametersDialog.tsx

`apps/web/src/components/workflow/RunParametersDialog.tsx`

Props: `open, onOpenChange, workflowName, nodes, onConfirm(inputs), isRunning`

UI 结构：
- DialogHeader: "运行工作流" + 描述
- 工作流摘要区: 节点数、各类型统计
- 输入参数区: 遍历所有 input 节点的 variables，按类型渲染控件
  - string → Input
  - number → Input[type=number]
  - boolean → Checkbox
  - object → Textarea (JSON 校验)
- 无 input 节点时显示"此工作流无需运行参数"
- DialogFooter: 取消 + 确认运行

确认前校验 required 字段。

### Step 5: 前端 — 修改 runWorkflow API

`apps/web/src/api/workflow.ts`：

- 函数签名增加 `body: { inputs?: Record<string, Record<string, unknown>> }` 参数
- fetch 请求加 `Content-Type: application/json` 和 `body: JSON.stringify(body)`

### Step 6: 前端 — 修改 WorkflowEditor

`apps/web/src/pages/WorkflowEditor/index.tsx`：

1. 移除旧 `showRunConfirm` 状态和确认 Dialog
2. 引入 `RunParametersDialog` 和 `validateWorkflowConfig`
3. `handleRun`：校验节点配置 → 有错误 toast 提示 → 打开 RunParametersDialog
4. `handleRunConfirm(inputs)`：收起对话框 → 调用 `runWorkflow(workflowId, { inputs }, handlers, signal)`

## 数据流

```
用户点"运行" → validateWorkflowConfig(nodes)
  → 校验失败: toast 逐条提示
  → 校验成功: 打开 RunParametersDialog
    → 用户填写 input 节点定义的参数
    → 点确认 → 校验 required 字段
    → runWorkflow(id, { inputs }, handlers)
      → POST /workflows/:id/run body={inputs:{...}}
        → 后端存 inputs 到 WorkflowRun
        → mock 执行 → SSE 事件流
```

## 验证方式

1. 从博客导入模板创建工作流 → 点运行 → 应弹出参数对话框
2. 无 input 节点或无变量定义时 → 对话框显示"无需运行参数"
3. LLM 节点未选模型时点运行 → toast 提示"AI 解析内容: 请选择模型"
4. 填写参数后确认 → 后端 WorkflowRun 记录中 inputs 字段有值
5. TypeScript 编译通过，Go 编译通过
