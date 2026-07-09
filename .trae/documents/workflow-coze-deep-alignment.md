# 工作流编辑器深度对齐 Coze 改造计划

## Context

当前工作流编辑器与 Coze/Dify 仍有很大差距，用户指出以下问题：

1. **连接线是动态的** — Coze 的连接线是静态直线，我们的连接线有动态弯曲效果
2. **没有删除节点功能** — 无法删除节点
3. **上传文件节点不支持真正上传** — 只是占位符
4. **节点右侧菜单** — Coze 每个节点右侧有操作菜单（复制、删除等）

## Coze 节点操作模式

```
节点右侧操作菜单:
┌──────────────────────┐
│ 节点名称             │ ⋮ ← 右键菜单按钮
│ 配置摘要             │
└──────────────────────┘

点击 ⋮ 后弹出菜单:
▸ 复制
▸ 复制为引用
▸ 重命名
▸ 删除
```

## 改动范围

| # | 改动 | 文件 |
|---|---|---|
| 1 | 连接线改为静态样式 | WorkflowEditor/index.tsx |
| 2 | 添加 Delete 键删除节点 | WorkflowEditor/index.tsx |
| 3 | 添加节点右键菜单 | WorkflowNode.tsx, WorkflowEditor/index.tsx |
| 4 | 实现文件上传节点 | InputPropertyForm.tsx, 新建 FileUploader |
| 5 | 节点右侧操作按钮 | WorkflowNode.tsx |

## 详细步骤

### Step 1: 连接线改为静态样式

**WorkflowEditor/index.tsx**:

修改 `defaultEdgeOptions` 和 `connectionLineStyle`：

```typescript
const defaultEdgeOptions: EdgeOptions = {
  type: 'smoothstep',  // 改为 smoothstep 或 straight
  style: {
    stroke: '#cbd5e1',  // 静态灰色线条
    strokeWidth: 2,
  },
  animated: false,      // 禁用动画
};

connectionLineStyle={{ stroke: '#cbd5e1', strokeWidth: 2 }}
```

### Step 2: 添加 Delete 键删除节点

**WorkflowEditor/index.tsx**:

添加键盘事件处理：

```typescript
const handleKeyDown = useCallback((event: KeyboardEvent) => {
  if (!selectedNode) return;
  
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    const nodeType = selectedNode.data.nodeType;
    if (nodeType === 'start' || nodeType === 'end') {
      toast.warning('开始/结束节点不可删除');
      return;
    }
    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  }
}, [selectedNode]);

useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleKeyDown]);
```

### Step 3: 添加节点右侧操作菜单

**WorkflowNode.tsx**:

添加右侧操作按钮和菜单：

```tsx
<div className="flex items-center gap-1">
  <button
    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
    onClick={(e) => {
      e.stopPropagation();
      // 打开菜单
    }}
  >
    <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
  </button>
</div>
```

使用 shadcn 的 `DropdownMenu` 组件。

**WorkflowEditor/index.tsx**:

添加菜单操作函数：

```typescript
const handleCopyNode = useCallback((nodeId: string) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const newNode = {
    ...node,
    id: `${nodeId}-copy-${Date.now()}`,
    position: {
      x: node.position.x + 50,
      y: node.position.y + 50,
    },
  };
  setNodes((prev) => [...prev, newNode]);
}, [nodes]);

const handleDeleteNode = useCallback((nodeId: string) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const nodeType = (node.data as { nodeType: string }).nodeType;
  if (nodeType === 'start' || nodeType === 'end') {
    toast.warning('开始/结束节点不可删除');
    return;
  }
  setNodes((prev) => prev.filter((n) => n.id !== nodeId));
  setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
}, [nodes]);

const handleRenameNode = useCallback((nodeId: string, newLabel: string) => {
  setNodes((prev) =>
    prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n)),
  );
}, []);
```

### Step 4: 实现文件上传节点

**InputPropertyForm.tsx**:

添加文件上传区域：

```tsx
<Card className="m-4 border-border/50">
  <CardHeader className="pb-3">
    <CardTitle className="text-sm">文件上传</CardTitle>
  </CardHeader>
  <CardContent>
    <div
      className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 cursor-pointer transition-colors"
      onClick={() => fileInputRef.current?.click()}
    >
      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">点击上传文件</p>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        multiple
      />
    </div>
    {uploadedFiles.length > 0 && (
      <div className="mt-3 space-y-2">
        {uploadedFiles.map((file, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </span>
            <Button variant="ghost" size="icon" onClick={() => removeFile(i)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

### Step 5: 节点右侧操作按钮 

**WorkflowNode.tsx**:

在节点右侧添加操作按钮（复制、删除等），按鼠标右键点击时显示：

```tsx
<div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
  <button
    onClick={(e) => { e.stopPropagation(); /* copy */ }}
    className="p-1.5 rounded-full bg-white border border-border shadow-sm hover:border-primary hover:text-primary transition-colors"
    title="复制"
  >
    <Copy className="h-3 w-3" />
  </button>
  <button
    onClick={(e) => { e.stopPropagation(); /* delete */ }}
    className="p-1.5 rounded-full bg-white border border-border shadow-sm hover:border-red-400 hover:text-red-500 transition-colors"
    title="删除"
  >
    <Trash2 className="h-3 w-3" />
  </button>
</div>
```

## 实现顺序

```
1. Step 1 (连接线样式) — 最简单，立竿见影
2. Step 2 (Delete 删除) — 核心操作
3. Step 5 (节点右侧按钮) — 交互优化
4. Step 3 (右键菜单) — 完整操作
5. Step 4 (文件上传) — 功能增强
```

## 验证方式

1. 删除节点：选中节点 → 按 Delete 键 → 节点删除，相关连线删除
2. 节点右侧按钮：hover 节点 → 右侧显示操作按钮 → 点击复制/删除
3. 文件上传：点击"上传文件"节点 → 右侧属性面板有上传区域 → 可上传文件
4. 连接线：连接节点后显示静态直线，无动画效果
5. TypeScript 编译通过
