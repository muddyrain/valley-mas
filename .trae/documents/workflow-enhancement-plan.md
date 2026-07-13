# 工作流编辑器增强计划（刷新版）

## Context

用户反馈工作流编辑器"操作很不顺畅"，希望参考 Coze 增加节点功能、检查现有节点缺失能力。经探索确认：

1. **前端表单已就绪但未启用**：8个节点（input/fileUpload/knowledge/code/http/condition/loop/variable）的 PropertyForm 文件已存在于 `properties/` 目录，但 nodeConfig 标记 `available: false`、未注册到 `PROPERTY_FORM_MAP`、验证逻辑直接拦截。
2. **服务端执行器完全缺失**：`server/internal/workflow/types.go` 只定义了5个 NodeType 常量，`registry.go` 只声明了5个 NodeDefinition，8个新节点从类型定义到执行器全部需要新增。
3. **操作流畅度已部分改善**：搜索、点击添加、复制粘贴、折叠、全选已实现（未提交），右键菜单半成品（只有 state，缺处理函数和渲染）。
4. **B 档 UI 改进已实现**：节点名称 Tooltip、按钮统一大小、复制按钮 hover 提示（未提交）。

本计划刷新原计划，准确反映当前进度，分阶段继续实施。

---

## 当前进度快照

### 已完成（工作树未提交，4个文件改动）

| 阶段 | 内容 | 文件 |
|---|---|---|
| 0 · B档 | 节点名称 Tooltip、复制按钮 Tooltip、按钮统一 icon-xs | WorkflowNode.tsx |
| 1.1 | 节点面板搜索框 | NodePanel.tsx |
| 1.2 | 点击添加节点（handleAddNode） | NodePanel.tsx + WorkflowEditor/index.tsx |
| 1.3 | Ctrl+C/V 复制粘贴（clipboardRef） | WorkflowEditor/index.tsx |
| 1.5 | 节点折叠/展开（onNodeDoubleClick + collapsed） | WorkflowNode.tsx + types.ts + WorkflowEditor/index.tsx |
| 1.6 | Ctrl+A 全选 | WorkflowEditor/index.tsx |

### 进行中

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1.4 | 右键菜单 | **部分完成**：contextMenu state 已加（第205-209行），缺处理函数、useEffect、渲染 |

### 未开始

- 阶段1.7：tsc 检查 + 浏览器验证 + 提交
- 阶段2：启用8个计划中节点（前端 + 服务端）
- 阶段3：参考 Coze 新增节点

---

## 阶段1剩余：完成右键菜单 + 验证提交

### 1.4 右键菜单（完成实现）

**文件**：[WorkflowEditor/index.tsx](file:///d:/my-code/valley-mas/apps/web/src/pages/WorkflowEditor/index.tsx)

当前已有 contextMenu state（第205-209行），需要补充：

#### 1.4.1 添加处理函数

在 `onNodeDoubleClick` 之后（约第408行后）添加：

```tsx
const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
  event.preventDefault();
  setContextMenu({ x: event.clientX, y: event.clientY });
}, []);

const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
  event.preventDefault();
  setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
}, []);
```

#### 1.4.2 添加关闭菜单的 useEffect

在 `handleKeyDown` 的 useEffect 之后添加：

```tsx
useEffect(() => {
  if (!contextMenu) return;
  const close = () => setContextMenu(null);
  window.addEventListener('click', close);
  window.addEventListener('contextmenu', close);
  return () => {
    window.removeEventListener('click', close);
    window.removeEventListener('contextmenu', close);
  };
}, [contextMenu]);
```

#### 1.4.3 渲染浮动菜单

在 `</ReactFlowProvider>` 之前（约第956行前）添加浮动菜单渲染。使用自定义 fixed 定位 div（不用 shadcn ContextMenu，因为 ReactFlow 动态右键不适合绑定到元素）：

```tsx
{contextMenu && (
  <div
    className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
    style={{ left: contextMenu.x, top: contextMenu.y }}
    onClick={(e) => e.stopPropagation()}
  >
    {contextMenu.nodeId ? (
      <>
        <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent" 
          onClick={() => { handleCopyNode(contextMenu.nodeId!); setContextMenu(null); }}>
          <Copy className="mr-2 h-3.5 w-3.5" /> 复制
        </button>
        <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
          onClick={() => { handleDeleteNode(contextMenu.nodeId!); setContextMenu(null); }}>
          <Trash2 className="mr-2 h-3.5 w-3.5" /> 删除
        </button>
        <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          onClick={() => { /* 切换折叠 */ setContextMenu(null); }}>
          <ChevronDown className="mr-2 h-3.5 w-3.5" /> 折叠/展开
        </button>
      </>
    ) : (
      <>
        <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          disabled={!clipboardRef.current}
          onClick={() => { /* 粘贴逻辑 */ setContextMenu(null); }}>
          <Clipboard className="mr-2 h-3.5 w-3.5" /> 粘贴
        </button>
        <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          onClick={() => { setNodes((prev) => prev.map((n) => ({ ...n, selected: true }))); setContextMenu(null); }}>
          <CheckSquare className="mr-2 h-3.5 w-3.5" /> 全选
        </button>
        <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          onClick={() => { reactFlowInstance.current?.fitView(); setContextMenu(null); }}>
          <Maximize className="mr-2 h-3.5 w-3.5" /> 重置视图
        </button>
      </>
    )}
  </div>
)}
```

#### 1.4.4 ReactFlow 添加事件 props

在 ReactFlow 组件（约第899行）添加：
```tsx
onPaneContextMenu={onPaneContextMenu}
onNodeContextMenu={onNodeContextMenu}
```

#### 1.4.5 导入图标

在 lucide-react 导入中添加：`Clipboard`, `CheckSquare`, `Maximize`（Copy/Trash2/ChevronDown 已导入）

**实现决策**：
- 折叠/展开右键菜单项：调用 `setNodes` 切换 `data.collapsed`（复用 onNodeDoubleClick 逻辑）
- 粘贴右键菜单项：复用 handleKeyDown 中的粘贴逻辑，提取为 `handlePaste` 函数
- 不使用 shadcn ContextMenu 组件：它是绑定到元素的，ReactFlow 动态右键需要 fixed 定位

### 1.5 提取 handlePaste 函数（重构）

将 handleKeyDown 中的粘贴逻辑提取为独立函数，供快捷键和右键菜单复用：

```tsx
const handlePaste = useCallback(() => {
  if (!clipboardRef.current || clipboardRef.current.length === 0) return;
  const stamp = Date.now();
  const pasted = clipboardRef.current.map((n, i) => ({
    ...n,
    id: `${n.id}-paste-${stamp}-${i}`,
    position: { x: n.position.x + 30, y: n.position.y + 30 },
    selected: true,
  }));
  setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...pasted]);
}, []);
```

### 1.6 验证与提交

1. `pnpm exec tsc --noEmit`（在 apps/web 目录）
2. 浏览器访问 `/workbench/create?template=blog-import` 验证：
   - 右键画布：显示粘贴/全选/重置视图
   - 右键节点：显示复制/删除/折叠展开
   - 搜索框、点击添加、Ctrl+C/V/A、双击折叠
3. 提交（conventional commit）：
   ```
   ✨ feat(workflow): 优化编辑器交互体验，支持搜索、快捷键、折叠和右键菜单
   ```

---

## 阶段2：启用8个计划中节点

**目标**：让8个已有前端表单的节点可用。分前端启用和服务端执行器两步。

### 2.1 前端启用（可独立交付）

#### 2.1.1 启用节点配置

**文件**：[nodeConfig.ts](file:///d:/my-code/valley-mas/apps/web/src/components/workflow/nodeConfig.ts)

8个节点的 `available` 改为 `true`，`description` 从"计划中"改为实际描述：

| 节点 | 新 description |
|---|---|
| input | 声明工作流的可复用输入参数 |
| fileUpload | 上传文件供下游节点使用 |
| knowledge | 检索知识库返回相关片段 |
| code | 执行 JavaScript 代码处理输入 |
| http | 发送 HTTP 请求获取外部数据 |
| condition | 根据条件分支到不同路径 |
| loop | 遍历数组对每项执行子流程 |
| variable | 赋值或转换变量 |

`getNodeConfigSummary`（第139行）为每个节点添加摘要逻辑，参照已有 start/llm.text 模式。

#### 2.1.2 注册表单

**文件**：[properties/index.ts](file:///d:/my-code/valley-mas/apps/web/src/components/workflow/properties/index.ts)

导入并注册8个已存在的表单到 `PROPERTY_FORM_MAP`：

```tsx
import { InputPropertyForm } from './InputPropertyForm';
import { FileUploadPropertyForm } from './FileUploadPropertyForm';
import { KnowledgePropertyForm } from './KnowledgePropertyForm';
import { CodePropertyForm } from './CodePropertyForm';
import { HTTPPropertyForm } from './HTTPPropertyForm';
import { ConditionPropertyForm } from './ConditionPropertyForm';
import { LoopPropertyForm } from './LoopPropertyForm';
import { VariablePropertyForm } from './VariablePropertyForm';

// 添加到 PROPERTY_FORM_MAP:
input: InputPropertyForm,
fileUpload: FileUploadPropertyForm,
knowledge: KnowledgePropertyForm,
code: CodePropertyForm,
http: HTTPPropertyForm,
condition: ConditionPropertyForm,
loop: LoopPropertyForm,
variable: VariablePropertyForm,
```

#### 2.1.3 移除验证拦截

**文件**：[validateWorkflowConfig.ts](file:///d:/my-code/valley-mas/apps/web/src/components/workflow/validateWorkflowConfig.ts)

- 删除第18-20行 `unavailable` 检查和"该节点尚未开放"拦截
- 为每个新节点添加必填字段验证（参照已有 llm.text 模式）：
  - `condition`: 验证表达式非空
  - `http`: 验证 URL 非空
  - `code`: 验证代码非空
  - `variable`: 验证变量名和值非空
  - `input`: 验证至少一个输入参数
  - `fileUpload`/`knowledge`/`loop`: 基础非空验证

#### 2.1.4 WorkflowNode 图标和颜色

**文件**：[WorkflowNode.tsx](file:///d:/my-code/valley-mas/apps/web/src/components/workflow/WorkflowNode.tsx)

- `iconMap`（第41行）和 `NODE_COLORS`（第63行）已包含8个新节点的配置，无需改动
- condition 节点 `outputs: 2` 已有 handle 渲染逻辑（第252-269行），自动生效

### 2.2 服务端执行器实现

**文件**：[server/internal/workflow/types.go](file:///d:/my-code/valley-mas/server/internal/workflow/types.go) + [registry.go](file:///d:/my-code/valley-mas/server/internal/workflow/registry.go) + 新建执行器文件

#### 2.2.1 类型定义

**types.go** 添加 NodeType 常量：

```go
const (
    NodeTypeInput      NodeType = "input"
    NodeTypeFileUpload NodeType = "fileUpload"
    NodeTypeKnowledge  NodeType = "knowledge"
    NodeTypeCode       NodeType = "code"
    NodeTypeHTTP       NodeType = "http"
    NodeTypeCondition  NodeType = "condition"
    NodeTypeLoop       NodeType = "loop"
    NodeTypeVariable   NodeType = "variable"
)
```

#### 2.2.2 注册 NodeDefinition

**registry.go** 的 `DefaultRegistry()` 添加 NodeDefinition：

```go
NodeDefinition{Type: NodeTypeVariable, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("value", ValueTypeObject))},
NodeDefinition{Type: NodeTypeCondition, InputPorts: ports("input"), OutputPorts: ports("output-true", "output-false")},
NodeDefinition{Type: NodeTypeHTTP, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("status", ValueTypeNumber), field("body", ValueTypeString), field("headers", ValueTypeObject))},
NodeDefinition{Type: NodeTypeCode, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("result", ValueTypeObject))},
NodeDefinition{Type: NodeTypeInput, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("params", ValueTypeObject))},
NodeDefinition{Type: NodeTypeFileUpload, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("file", ValueTypeFile))},
NodeDefinition{Type: NodeTypeLoop, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("items", ValueTypeObject))},
NodeDefinition{Type: NodeTypeKnowledge, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("snippets", ValueTypeStringList))},
```

#### 2.2.3 执行器实现（按优先级分批）

新建文件 `server/internal/workflow/control_nodes.go`（variable/condition）和 `action_nodes.go`（http/code）和 `data_nodes.go`（input/fileUpload/knowledge/loop）。

**优先级1：variable** — 最简单，解析 `{{}}` 引用后赋值
- 输入：`{ variableName: "{{node.output.field}}", value: "..." }`
- 输出：`{ value: <resolved value> }`

**优先级2：condition** — 条件分支
- 输入：`{ left: "...", operator: "eq|ne|gt|lt|contains|empty", right: "..." }`
- 输出：根据条件返回 `output-true` 或 `output-false`
- **注意**：Execute 函数需要改造，支持条件分支后跳过不匹配的分支。当前 Execute 是线性拓扑执行，condition 需要 DAG 分支语义。这是较大改动，可能需要单独设计。

**优先级3：http** — HTTP 请求
- 输入：`{ url, method, headers, body }`
- 用 `net/http` 发送，30秒超时
- 输出：`{ status, body, headers }`

**优先级4：code** — 代码执行（需要沙箱）
- **决策**：使用 `github.com/dop251/goja`（ES5 纯 Go 实现，无外部进程）
- 输入：`{ code: "...", args: {...} }`
- 5秒超时 + 限制可访问的 API
- 输出：`{ result: <return value> }`

**优先级5：loop** — 循环（复杂）
- 需要递归调用执行引擎
- 最大迭代次数限制（1000）
- **可能需要 Execute 函数改造**

**优先级6：knowledge** — 知识库检索
- 需要调研项目是否已有 RAG 能力
- 若无现成基础设施，标记为"需要知识库基础设施"，暂不实现

**优先级7：input/fileUpload** — 输入参数
- input：从 run.Inputs 中提取声明的参数
- fileUpload：处理文件上传（复用现有 FileInput 逻辑）

#### 2.2.4 注册执行器

**registry.go** 添加 `RegisterCoreWorkflowExecutors` 函数（参照 `RegisterBlogWorkflowExecutors` 模式）：

```go
func RegisterCoreWorkflowExecutors(registry *Registry) error {
    for _, executor := range []NodeExecutor{
        variableExecutor{},
        conditionExecutor{},
        httpExecutor{},
        codeExecutor{},
        inputExecutor{},
        fileUploadExecutor{},
        loopExecutor{},
    } {
        if err := registry.RegisterExecutor(executor); err != nil {
            return err
        }
    }
    return nil
}
```

在 composition root 调用此函数。

### 2.3 阶段2验证

- 前端：8个节点可拖拽到画布、属性面板可配置、验证逻辑生效
- 服务端：每个新执行器编写单元测试（参照 execute_test.go 模式）
- 集成：用 blog-import 模板 + 新增 variable 节点，端到端运行

---

## 阶段3：参考 Coze 增加新节点

**目标**：补齐 Coze 有而我们没有的高价值节点。每新增一个节点需要：前端表单 + nodeConfig + 服务端执行器 + 验证逻辑。

### 3.1 文本处理节点（text.process）— 优先

- 功能：字符串拼接、分割、替换、大小写转换、模板格式化
- 前端：新建 `TextProcessPropertyForm.tsx`，选择操作类型 + 输入参数
- 服务端：纯字符串操作，无外部依赖
- nodeConfig category: 'data'

### 3.2 消息回复节点（message.reply）— 优先

- 功能：在工作流中输出文本/卡片消息，支持流式
- 前端：新建 `MessageReplyPropertyForm.tsx`，配置回复内容模板
- 服务端：通过 SSE 推送消息给前端
- 可作为 end 节点的替代，支持中途输出

### 3.3 JSON处理节点（json.process）

- 功能：JSON 解析、提取字段、合并、格式化
- 前端：新建 `JsonProcessPropertyForm.tsx`
- 服务端：用 `encoding/json` 处理

### 3.4 意图识别节点（intent.recognize）

- 功能：基于 LLM 对用户输入分类，实现语义级分支
- 前端：配置意图标签列表
- 服务端：调用 LLM（复用现有 llm.text 执行器）+ 分类判断

### 3.5 暂不实现的节点

- 并行节点（需要并发执行引擎改造）
- 子工作流节点（需要工作流嵌套调用能力）
- 多模态节点（依赖图像/语音模型服务）
- 数据库节点（需要 DB 连接池管理）
- 插件节点（需要插件市场生态）

---

## 实施顺序

1. **阶段1.4-1.6**（本次）：完成右键菜单 + tsc + 浏览器验证 + 提交
2. **阶段2.1**（下次）：前端启用8个节点，用户可配置但运行时报"执行器未实现"
3. **阶段2.2 优先级1-3**：实现 variable/condition/http 执行器（condition 需评估分支语义改造）
4. **阶段2.2 优先级4-7**：实现 code/loop/input/fileUpload 执行器
5. **阶段3.1-3.2**：文本处理 + 消息回复
6. **阶段3.3-3.4**：JSON处理 + 意图识别

---

## 验证方法

### 阶段1验证
- `pnpm exec tsc --noEmit`（apps/web 目录）
- 浏览器访问 `/workbench/create?template=blog-import`
- 验证：搜索框过滤、点击添加、Ctrl+C/V 复制粘贴、右键菜单（画布+节点）、双击折叠、Ctrl+A 全选
- 截图记录关键交互

### 阶段2验证
- 前端：8个节点可拖拽、属性面板可配置、验证逻辑生效
- 服务端：`go test ./internal/workflow/...` 通过
- 集成：端到端运行含新节点的工作流

### 全局验证
- `pnpm check:harness` 通过
- 浏览器实测每个功能，不依赖静态代码宣称

---

## 计划文档同步

- 阶段2启用节点后，需同步 `apps/web/AGENTS.md` 中节点能力说明
- 阶段3新增节点后，更新 `nodeConfig.ts` 的 NODE_CATEGORIES（如需新增分类）
- 服务端新增执行器后，更新 `server/AGENTS.md` 的模块说明

---

## Assumptions & Decisions

1. **右键菜单用自定义浮动 div**：不用 shadcn ContextMenu 组件，因为 ReactFlow 动态右键需要 fixed 定位，ContextMenu 绑定到元素不适合
2. **condition 节点分支语义**：当前 Execute 是线性拓扑执行，condition 的 output-true/output-false 分支需要 DAG 语义改造，阶段2.2 实现时需单独评估
3. **code 节点沙箱**：使用 goja（ES5 纯 Go），不执行外部进程，5秒超时
4. **knowledge 节点**：若无现成 RAG 基础设施，标记为"需要知识库基础设施"暂不实现
5. **阶段2.1 可独立交付**：前端启用8节点后，用户可配置但运行时会报"执行器未实现"，这是可接受的中间状态
6. **提交策略**：阶段1（B档 + 流畅度）一次提交，阶段2.1 一次提交，阶段2.2 按优先级分批提交
