---
name: component-reuse-guard
description: 自动判断当前改动是否存在可提取的公用组件或可复用逻辑，避免在多处重复写相同 JSX 和 handler，降低维护成本。
---

# component-reuse-guard

## 适用场景

- 同一段 JSX 结构（如弹窗、表单、卡片）在两个及以上文件中几乎一样
- 同一批 state + handler 逻辑（如上传流程、AI 起名、拖拽上传）被复制粘贴到多处
- 用户说"每个地方都要写一遍"、"维护成本大"、"改一个地方要改好几处"
- 新增功能页面时，发现已有页面里有相似功能可以抽取

## 核心规则

### 1. 判断是否值得提取

满足以下任一条件，就应该提取为公用组件：

- **结构相同**：两处以上的 JSX 模板相同（允许 props 差异）
- **逻辑相同**：相同的 useState 组合 + 相同的 handler 函数
- **未来增长**：这个场景将来还会出现在更多地方（如通用弹窗、通用表单）

不值得提取的情况：

- 只出现在一处，且未来极不可能复用
- 两处虽然"看起来像"，但交互行为本质不同（强行统一会引入不必要的 props 复杂度）

### 2. 提取位置规则

| 场景 | 放在哪里 |
|------|----------|
| 纯 UI 展示，无业务逻辑 | `apps/web/src/components/ui/` |
| 带业务逻辑的功能组件 | `apps/web/src/components/` |
| 跨 apps 共享的纯逻辑/类型 | `packages/shared/src/` |

### 3. Props 接口设计原则

- **控制权留给父组件**：`open` / `onOpenChange` 由父传入，组件内部不持有 Dialog 开关逻辑
- **回调而非副作用**：上传成功后通知父组件 `onSuccess()`, 由父决定如何刷新
- **可选 > 必填**：能推断的 props 设为可选并提供合理默认值
- **不要把父页面的 state 塞进子组件**：子组件应自包含内部 state，只通过 props/callback 与外部通信

```tsx
// 好的接口设计示例
export interface UploadResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;  // 父组件决定如何响应成功事件
}
```

### 4. 提取后的清理规则

提取完成后，必须同时：

1. 删除每个使用方的：内联 JSX 块、相关 state、相关 handler 函数
2. 删除使用方中已搬入组件的 import（如 `useRef`、API 函数等）
3. 保留使用方中仍然需要的最小 state（通常只有 `open` 控制弹窗显隐）
4. 检查是否有残留的未使用 import，一并清理

### 5. 自动推断场景

看到以下信号时，立即检查是否可以复用：

- 代码审查时发现 `// 同 MySpace.tsx` 或 `// 复制自` 注释
- 两个文件有相同的函数名（如 `handleUpload`, `resetUploadState`, `handleAiSuggestTitle`）
- 两个文件 import 了完全相同的一组 API 函数

## 和其他 skill 的协作

- [`task-completion-guard`](../task-completion-guard/SKILL.md)：提取完成后核查所有使用方都已切换到新组件、无编译错误

## 输出要求

执行提取时，按以下顺序操作，不要跳步：

1. 创建新组件文件（确保完整可运行）
2. 更新第一个使用方（清理 imports + state + handlers + 内联 JSX）
3. 更新第二个使用方（同上）
4. 检查每个文件的编译错误，逐一修复
5. 最终确认所有相关文件零错误
