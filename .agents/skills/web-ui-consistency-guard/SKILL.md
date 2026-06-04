---
name: web-ui-consistency-guard
description: Web 页面改动时使用，统一检查主题 token、品牌色、loading 态、URL query 状态同步、列表刷新/回退一致性。
---

# Web UI 一致性护栏

本 skill 是 Web UI 场景的执行入口。它只负责调度和红线，不替代组件、页面或业务实现细节。

## 触发场景

- Web 页面、共享组件、用户可见文案或页面样式发生变化。
- loading、空状态、错误态、搜索、分页、筛选、URL query、刷新或浏览器回退行为发生变化。
- `apps/web` 复用的共享包 UI 逻辑发生变化。

## 执行流程

1. 判断改动是否影响 Web UI、loading、URL 状态或用户可见文案。
2. 检查是否存在可复用组件、hook、utils 或页面模式。
3. 检查主题、loading、URL 状态是否触及本 skill 红线。
4. 如果发现重复 JSX、handler 或列表逻辑，使用 `component-reuse-guard`。
5. 如果涉及中文或非 ASCII 文案，使用 `encoding-guard`。
6. 按最终 Checklist 收尾。

## 必须

- 使用项目主题 token、`theme-*` 工具类或已有组件承接主视觉。
- 使用已有 loading 组件处理加载态；中大型内容容器使用 `BoxLoadingOverlay`，小媒体位使用 `MediaLoadingOverlay`。
- 让列表页搜索、筛选、分页状态支持刷新和浏览器回退一致性。
- 在发现重复 UI 结构或重复 handler 时使用 `component-reuse-guard`。

## 禁止

- 为单个页面创建脱离全站主题的独立色系。
- 使用硬编码高饱和颜色作为主按钮、主 Banner、页面大背景或高频入口色。
- 复制粘贴 spinner、遮罩或 loading JSX。
- 仅用组件内 `useState` 管理列表页真实搜索、筛选和分页条件。

## SHOULD

- SHOULD 优先复用 Button、Card、PageBanner、EmptyState、BoxLoadingOverlay、MediaLoadingOverlay 或已有页面布局。
- SHOULD 使用 URL query 承载列表页真实条件，并保留无关 query 参数。
- SHOULD 对列表页验证刷新、复制 URL、浏览器前进/后退后的状态一致性。
- SHOULD 运行 `pnpm --filter @valley/web exec tsc --noEmit`；样式或 lint 相关改动运行 `pnpm --filter @valley/web check`。

## 示例

错误：

```tsx
<button className="bg-purple-500 text-white">发布</button>
```

正确：

```tsx
<Button className="theme-btn-primary">发布</Button>
```

错误：

```tsx
{loading && <div className="absolute inset-0"><span className="animate-spin" /></div>}
```

正确：

```tsx
<BoxLoadingOverlay show={loading} title="加载中" />
```

错误：

```tsx
const [keyword, setKeyword] = useState("");
const [page, setPage] = useState(1);
```

正确：

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const keyword = searchParams.get("keyword") ?? "";
const page = Math.max(1, Number(searchParams.get("page") ?? 1));
```

## 最终 Checklist

- [ ] 是否复用主题 token、`theme-*` 工具类或已有组件。
- [ ] 是否没有新增单页独立色系或高饱和主视觉。
- [ ] loading 是否使用已有 loading 组件。
- [ ] 是否没有复制 spinner / overlay JSX。
- [ ] 列表页搜索、筛选、分页是否支持刷新和回退一致性。
- [ ] 是否检查组件复用；发现重复时是否使用 `component-reuse-guard`。
- [ ] 涉及中文或非 ASCII 文案时，是否运行 encoding 检查。
- [ ] 是否运行适用 Web 校验，或说明未运行原因。

## 违规处理

- 发现“必须”或“禁止”违规时，先修复再继续。
- 无法修复时，在最终回复中说明违规项、原因、影响范围和后续处理步骤。
