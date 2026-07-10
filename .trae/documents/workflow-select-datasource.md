# 工作流参数通用接口对接机制设计

## 摘要

为工作流 Start 节点的参数系统引入 `select` 类型，支持动态从系统接口拉取下拉选项（如博客分类、标签、分组等），同时保留手动输入自由度。这是一个通用机制，不仅限于博客分类，可对接系统内任意列表接口。

## 现状分析

### 当前参数系统
- **StartPropertyForm**（[StartPropertyForm.tsx](file:///d:/my-code/valley-mas/apps/web/src/components/workflow/properties/StartPropertyForm.tsx)）：支持 5 种参数类型 `string | number | boolean | object | file`
- **RunPanel**（[RunPanel.tsx](file:///d:/my-code/valley-mas/apps/web/src/components/workflow/RunPanel.tsx)）：运行面板根据参数类型渲染不同输入控件，`string` 类型只渲染普通 `<Input>`
- **博客导入模板**（[WorkflowEditor/index.tsx](file:///d:/my-code/valley-mas/apps/web/src/pages/WorkflowEditor/index.tsx#L47-L108)）："博客分类"参数当前是 `type: 'string'`，运行时只能手动输入

### 已有后端接口
- `GET /api/v1/public/blog/categories` → 返回 `PostCategory[]`（id, name, slug, description, sortOrder, postCount）
- `GET /api/v1/public/blog/tags` → 返回 `PostTag[]`（id, name, slug, postCount）
- `GET /api/v1/public/blog/groups` → 返回 `PostGroup[]`（id, name, slug, groupType, description, authorId, parentId, sortOrder, postCount）
- `GET /api/v1/admin/blog/categories` → Admin 侧分类列表（含增删改）
- `GET /api/v1/admin/blog/tags` → Admin 侧标签列表
- `GET /api/v1/admin/blog/groups` → Admin 侧分组列表

### 数据结构
- `VariableDef` 类型定义在 RunPanel 中：`{ name: string; type: 'string' | 'number' | 'boolean' | 'object' | 'file'; required: boolean }`
- 变量配置存在节点 `data.config.variables` 数组中

## 改动设计

### 1. 参数类型扩展：新增 `select` 类型

**VariableDef 扩展**：
```typescript
interface VariableDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'file' | 'select';
  required: boolean;
  // select 类型专用字段
  dataSource?: {
    api: string;           // 接口路径，如 '/public/blog/categories'
    labelField: string;    // 选项显示字段，如 'name'
    valueField: string;    // 选项值字段，如 'id'
  };
  options?: Array<{ label: string; value: string }>; // 静态选项（不调接口时使用）
  allowCustom?: boolean;   // 是否允许手动输入（默认 true）
}
```

**数据源注册表**（前端常量，不新增后端接口）：

```typescript
const DATA_SOURCES = {
  'blog/categories': {
    api: '/public/blog/categories',
    labelField: 'name',
    valueField: 'id',
  },
  'blog/tags': {
    api: '/public/blog/tags',
    labelField: 'name',
    valueField: 'id',
  },
  'blog/groups': {
    api: '/public/blog/groups',
    labelField: 'name',
    valueField: 'id',
  },
} as const;
```

### 2. StartPropertyForm 改动

**文件**：[StartPropertyForm.tsx](file:///d:/my-code/valley-mas/apps/web/src/components/workflow/properties/StartPropertyForm.tsx)

- Select 的类型下拉新增 `Select` 选项
- 当类型选择 `select` 时，展示额外配置区域：
  - **数据源** 下拉：从 `DATA_SOURCES` 中选择（如"博客分类"、"博客标签"、"博客分组"）
  - **允许手动输入** Checkbox：默认勾选
  - **静态选项**：当未选数据源时，可手动添加 `label/value` 选项对
- 选中数据源后自动填充 `dataSource` 字段（api、labelField、valueField）

### 3. RunPanel 改动

**文件**：[RunPanel.tsx](file:///d:/my-code/valley-mas/apps/web/src/components/workflow/RunPanel.tsx)

- 当参数 `type === 'select'` 时：
  - 有 `dataSource`：组件挂载时调用对应 API 拉取选项列表，渲染 shadcn `<Select>` 组件
  - 有 `options`（静态）：直接渲染选项
  - `allowCustom === true`：在 Select 旁显示一个可切换的手动输入框，或使用支持自由输入的 Combobox 模式
- 选中值存储 `valueField` 对应的值（如分类 ID）

### 4. 博客导入模板更新

**文件**：[WorkflowEditor/index.tsx](file:///d:/my-code/valley-mas/apps/web/src/pages/WorkflowEditor/index.tsx#L57-L60)

将模板中的：
```typescript
{ name: '博客分类', type: 'string', required: false }
```
改为：
```typescript
{
  name: '博客分类',
  type: 'select',
  required: false,
  dataSource: {
    api: '/public/blog/categories',
    labelField: 'name',
    valueField: 'id',
  },
  allowCustom: true,
}
```

### 5. 后端工作流执行（可选/P1）

**文件**：[blog_workflow.go](file:///d:/my-code/valley-mas/server/internal/handler/blog_workflow.go)

当前 `runBlogWorkflow` 硬编码使用 `getOrCreateFallbackCategoryID()`。未来通用工作流引擎执行时，应从 inputs 中读取 `categoryId` 并使用。此改动属于 P1，本次不改动已有的 `AdminBlogWorkflowImport`，因为它是独立于通用工作流引擎的旧流程。

通用工作流引擎（`AdminRunWorkflow`）当前是模拟执行（[workflow.go#L288-L297](file:///d:/my-code/valley-mas/server/internal/handler/workflow.go#L288-L297)），TODO 注释表明尚未实现真实执行逻辑。本次只需确保前端传入的 select 类型值能正确通过 inputs JSON 传到后端即可。

### 6. 新增前端数据源配置常量文件

**新文件**：`apps/web/src/components/workflow/dataSources.ts`

集中管理可对接的系统接口列表，方便后续扩展。

## 文件改动清单

| 文件 | 改动内容 |
|------|----------|
| `apps/web/src/components/workflow/dataSources.ts` | 新建：数据源注册表常量 |
| `apps/web/src/components/workflow/properties/StartPropertyForm.tsx` | 新增 select 类型选项及配置 UI |
| `apps/web/src/components/workflow/RunPanel.tsx` | 新增 select 类型参数的渲染逻辑（动态拉取 + 静态选项 + 手动输入） |
| `apps/web/src/pages/WorkflowEditor/index.tsx` | 更新博客导入模板的分类参数配置 |

## 实现步骤

### Step 1：创建数据源注册表
新建 `dataSources.ts`，定义 `DATA_SOURCES` 常量和 `DataSourceConfig` 类型。

### Step 2：扩展 VariableDef 类型
在 RunPanel.tsx 中扩展 `VariableDef` 接口，新增 `dataSource`、`options`、`allowCustom` 字段。同时导出该类型供 StartPropertyForm 引用。

### Step 3：StartPropertyForm 新增 select 配置 UI
- 类型下拉新增 `Select` 选项
- 选中 select 后展示数据源下拉、允许手动输入 checkbox
- 无数据源时展示静态选项编辑区

### Step 4：RunPanel 渲染 select 控件
- 动态拉取模式：useEffect 调 API，渲染 Select 组件
- 静态选项模式：直接渲染
- allowCustom 模式：Select 下方显示"或手动输入"的 Input

### Step 5：更新博客导入模板
将分类参数改为 select 类型 + blog/categories 数据源。

### Step 6：验证
- 运行 `pnpm --filter @valley/web exec tsc --noEmit` 确认类型正确
- 手动验证工作流编辑器中选择分类参数的配置和运行面板的下拉效果

## 假设与决策

1. **不新增后端接口**：所有数据源对接使用现有 public API，前端维护映射关系
2. **select 值传 ID**：运行时提交的值是 `valueField`（如分类 ID），后端可直接使用
3. **不引入 Combobox 组件**：为避免增加复杂依赖，用 Select + 可选 Input 组合实现"允许手动输入"
4. **数据源注册表前端维护**：后续新增数据源只需在 `dataSources.ts` 加一条记录
5. **P1 后端不改动**：通用工作流引擎尚未实现真实执行，本次确保数据格式正确传递即可

## 计划文档同步

- 无需同步计划文档：这是工作流编辑器的功能增强，不涉及产品方向、功能状态或接口路径变化。当前子项目无独立计划文档需要更新。
