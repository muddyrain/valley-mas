---
name: web-loading-overlay-strategy
description: 统一 Valley MAS Web 端 loading 体验的决策与落地方式。适用于需要新增/改造加载态、判断是否使用 BoxLoadingOverlay、或在小尺寸媒体区域抽取轻量公共 loading 组件的场景。
---

# Web Loading Overlay Strategy

当任务涉及 Web 加载态时，优先使用本策略，避免每个页面各写一套 loading。

## 目标

1. 视觉统一：同类加载场景使用同一套组件语言。
2. 可复用：优先用公共组件，而不是页面内联 JSX。
3. 不阻塞交互：默认不吞掉点击，除非业务明确要求阻塞。

## 决策树

1. 目标是“页面内的中大型内容盒子”（列表区、卡片墙、面板区）
- 使用 `BoxLoadingOverlay`。
- 父容器要求：`relative` + 可继承圆角（推荐 `rounded-*`）+ 有稳定高度（推荐 `min-h-[240px]` 以上）。

2. 目标是“小尺寸媒体区域”（资源卡封面、缩略图、头像块）
- 不使用 `BoxLoadingOverlay` 的大面板样式。
- 使用轻量公共组件（例如 `MediaLoadingOverlay`），只保留必要遮罩和 spinner。

3. 目标是“深色预览/全屏弹框中的图片区域”
- 仍可使用 `BoxLoadingOverlay`，但设置 `tone="dark"`。
- 推荐加 `className="pointer-events-none"`，避免遮罩抢占关闭/拖拽交互。

## 组件约定

### BoxLoadingOverlay

- 适用：中大型容器加载。
- 关键参数：
  - `show`: 是否显示。
  - `tone`: `light | dark`。
  - `compact`: 仅在中等容器需要更紧凑时启用。
  - `title` / `hint`: 文案可按上下文调整。
  - `className`: 额外控制圆角、指针事件、背景叠层。

### MediaLoadingOverlay

- 适用：小尺寸媒体位。
- 设计原则：轻、快、少文案，不破坏缩略图阅读。

## 落地步骤

1. 找到加载触发点（请求中 / 图片 onLoad 前）。
2. 先判断容器类型（大盒子 / 小媒体 / 深色弹框）。
3. 选择组件：`BoxLoadingOverlay` 或 `MediaLoadingOverlay`。
4. 把内联 loading JSX 抽掉，保留单一 loading 源。
5. 校验交互：
- 弹框关闭按钮是否可点。
- 图片拖拽/缩放是否被遮罩干扰。
- 分页/筛选切换时是否平滑。

## 代码检查

- `pnpm --filter web exec biome check src/components src/pages`
- 涉及中文文案时运行 `python .codex/skills/encoding-guard/scripts/check_mojibake.py`

## 反模式

- 在多个页面复制同一段 spinner + 渐变遮罩 JSX。
- 小卡片区域直接套用重量级全盒 loading 面板，导致视觉过重。
- overlay 默认拦截点击，影响关闭、拖拽、翻页。
