# 工作流编辑器全面对齐 Coze 改造计划

## Context

用户反馈当前工作流编辑器与 Coze/Dify 差距很大，具体问题：
1. **没有"开始"节点** — Coze 每个 workflow 默认有一个 Start 节点定义输入参数，我们是"触发器"节点，概念不同
2. **运行面板不对** — Coze 点击"试运行"后展开右侧运行面板填写参数，我们用的是 Dialog 弹窗
3. **看不到节点详情/进度** — 运行后无法查看每个节点的输入输出和执行状态
4. **属性面板太弱** — 只有基础配置，没有执行结果展示
5. **参数输入框样式差** — 跟 Coze 的变量引用式输入完全不同
6. **节点间无变量引用** — Coze 用 `{{start.input}}` 引用上游输出，我们没有

## Coze 核心交互模式

```
画布布局:
  开始节点(固定) → 大模型节点 → 代码节点 → 结束节点(固定)
       ↓                ↓             ↓            ↓
   定义输入参数     配置模型+提示词   写代码      定义输出

运行流程:
  点"试运行" → 右侧展开运行面板(非弹窗) → 填写开始节点参数 → 点运行
  → 每个节点显示执行状态(进度条/成功/失败) → 点击节点查看输入输出详情

节点配置:
  点击节点 → 右侧属性面板显示:
    - 基本设置(名称等)
    - 专属配置(模型选择、提示词等)
    - 输入参数(可引用上游变量 {{node.output}})
    - 输出参数(定义本节点输出什么)
    - 运行结果(执行后显示 input/output)
```

## 改动范围

| # | 改动 | 文件 | 说明 |
|---|---|---|---|
| 1 | trigger → start 节点重命名 | nodeConfig.ts, types.ts, templates, 所有引用处 | Coze 用"开始"节点，不是"触发器" |
| 2 | output → end 节点重命名 | 同上 | Coze 用"结束"节点 |
| 3 | 工作流自动创建 start+end | WorkflowEditor/index.tsx | 新建/空工作流默认有 start 和 end |
| 4 | 运行面板替换 Dialog | 新建 RunPanel.tsx, 改 WorkflowEditor | 右侧展开式面板，非弹窗 |
| 5 | 属性面板增加执行结果 | PropertyPanel.tsx, PropertyFormBase.tsx | 运行后显示节点的 input/output |
| 6 | 节点显示执行状态 | WorkflowNode.tsx | 运行中/成功/失败的视觉反馈增强 |
| 7 | 模板更新 | WorkflowEditor/index.tsx | blog-import 模板用 start/end |

## 详细步骤

### Step 1: trigger → start, output → end 重命名

**nodeConfig.ts**:
- `trigger` → `start`: label 从"触发器"→"开始"，description "工作流入口，定义输入参数和触发方式"，icon 保持 Zap
- `output` → `end`: label 从"输出"→"结束"，description "工作流出口，定义输出结果"，icon 保持 Send
- start 节点 handles: `{ output: true }` (只有出口)
- end 节点 handles: `{ input: true }` (只有入口)
- start 不再需要 triggerType/cron 等配置，只定义输入参数(与 input 节点的 variables 一致)

**types.ts**:
- `TriggerConfig` → `StartConfig`: `{ variables: Array<{name, type, required}> }`
- `OutputConfig` → `EndConfig`: `{ outputMappings: Array<{source, target}> }`
- `WorkflowNodeType` 中 trigger→start, output→end

**属性表单**:
- `TriggerPropertyForm.tsx` → `StartPropertyForm.tsx`: 只保留"输入参数"定义(复用 InputPropertyForm 的变量编辑逻辑)
- `OutputPropertyForm.tsx` → `EndPropertyForm.tsx`: 输出映射配置

**index.ts (properties)**: 更新映射
**validateWorkflowConfig.ts**: trigger→start, output→end
**RunParametersDialog.tsx**: 改为从 start 节点提取输入参数
**所有其他引用 trigger/output 的地方**: 全局替换

### Step 2: 工作流自动包含 start + end 节点

**WorkflowEditor/index.tsx**:
- 新建空工作流时，自动添加 start 和 end 节点，位置分别在画布左侧和右侧
- start 节点不可删除(或删除时提示"开始节点不可删除")
- end 节点不可删除
- 从左侧面板拖拽时，不再显示 start/end(因为已存在)

**nodeConfig.ts**:
- 给 start 和 end 增加 `fixed: true` 标记，表示固定节点

### Step 3: 运行面板(右侧展开式)替换 Dialog

这是最核心的改动。Coze 的运行面板不是弹窗，而是右侧滑出的面板。

**新建 RunPanel.tsx**:
```
布局:
┌─────────────────────────────┐
│ 试运行                    ✕ │
├─────────────────────────────┤
│ 输入参数                     │
│ ┌─────────────────────────┐ │
│ │ 参数名    类型    值     │ │
│ │ url      String  [____] │ │
│ │ count    Number  [____] │ │
│ └─────────────────────────┘ │
│                              │
│ [▶ 开始运行]                │
│                              │
│ 运行结果                     │
│ ┌─ 开始 ──────────────────┐ │
│ │ ✅ 成功  耗时 0.1s      │ │
│ │ 输出: { url: "..." }    │ │
│ └─────────────────────────┘ │
│ ┌─ AI 解析 ───────────────┐ │
│ │ 🔄 运行中...            │ │
│ └─────────────────────────┘ │
│ ┌─ 生成摘要 ──────────────┐ │
│ │ ⏳ 等待中               │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Props**:
- `open: boolean` — 面板是否展开
- `onOpenChange: (open: boolean) => void`
- `nodes: Node[]`
- `workflowId: string | null`
- `onRun: (inputs) => void`
- `isRunning: boolean`
- `nodeResults: Record<string, { status, input?, output?, duration? }>`

**关键特性**:
1. 面板从右侧滑出，宽度 w-96，覆盖属性面板
2. 顶部显示"试运行"+ 关闭按钮
3. 从 start 节点提取输入参数定义，生成输入表单
4. 输入表单用表格形式(参数名 | 类型 | 输入框)，不是 Card 嵌套
5. 点击"开始运行"执行工作流
6. 下方实时显示每个节点的运行状态和结果
7. 每个节点可展开查看详细 input/output

**WorkflowEditor 改动**:
- 移除 RunParametersDialog 引用
- 增加 `showRunPanel` 状态
- 增加 `nodeResults` 状态，记录每个节点的执行结果
- 点击"运行"→ 直接打开 RunPanel(不弹窗)
- RunPanel 展开时覆盖属性面板
- SSE 事件中更新 nodeResults

### Step 4: 属性面板增加执行结果

**PropertyFormBase.tsx**:
- 接收 `nodeResult?: { status, input?, output?, duration? }` prop
- 在表单底部增加"运行结果"卡片:
  - 状态: 成功/失败/未运行
  - 输入: JSON 展示
  - 输出: JSON 展示
  - 耗时

**PropertyPanel.tsx**:
- 传递 nodeResult 到 PropertyFormBase

**WorkflowEditor/index.tsx**:
- 选中节点时，从 nodeResults 中取对应结果传给 PropertyPanel

### Step 5: 节点执行状态视觉增强

**WorkflowNode.tsx**:
- 运行中: 脉冲动画边框 + 进度指示
- 成功: 绿色勾 + 微小缩放动画
- 失败: 红色叉 + 错误提示
- 等待中: 灰色 + 等待图标
- 增加执行耗时显示(如果有的话)

### Step 6: 模板更新

**blog-import 模板**:
```
开始 → 上传文件(改为input) → AI解析内容(LLM) → 生成摘要(knowledge) → 结束
```
- trigger-1 → start-1 (开始)
- output-1 → end-1 (结束)
- start 节点定义输入变量: url(String, required)
- end 节点定义输出映射

### Step 7: 删除废弃代码

- 删除 `RunParametersDialog.tsx` (被 RunPanel 替代)
- 删除 `TriggerPropertyForm.tsx` (被 StartPropertyForm 替代)
- 删除 `OutputPropertyForm.tsx` (被 EndPropertyForm 替代)

## 实现顺序

```
1. Step 1 (重命名) — 全局替换 trigger→start, output→end
2. Step 6 (模板更新) — 更新 blog-import 模板
3. Step 2 (自动 start+end) — 空工作流默认包含
4. Step 3 (运行面板) — 核心交互改造
5. Step 5 (节点状态增强) — 视觉优化
6. Step 4 (属性面板结果) — 执行结果展示
7. Step 7 (清理) — 删除废弃代码
```

## 验证方式

1. 新建空工作流 → 自动包含"开始"和"结束"节点
2. 从模板创建 → 节点链路完整(start → input → llm → knowledge → end)
3. 点击"运行" → 右侧展开运行面板(非弹窗)
4. 运行面板填写 start 节点参数 → 点"开始运行"
5. 节点逐一显示运行状态 → 运行面板下方显示每个节点的结果
6. 点击节点 → 属性面板显示配置 + 执行结果
7. TypeScript 编译通过
