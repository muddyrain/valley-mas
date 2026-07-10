# Life Trace Pantry Mobile Browsing Design

## Goal

让 Pantry 库存列表具备接近移动电商列表的浏览连续性：用户从列表进入详情或编辑后返回，继续停留在原商品和原筛选上下文；默认列表聚焦当前可用库存，不让已过期和历史商品占据首屏。

## Current Evidence

- `AppShell` 已有滚动数值、列表锚点和重试恢复能力，但 `getLifeTraceScrollMemoryKey` 明确没有为 `/pantry` 返回记忆 key。
- Pantry 返回后会重新请求第一页，并在 `pantryLoading` 时用整段骨架替换已有列表；已加载页和锚点因此可能在恢复前消失。
- 当前服务端默认 `status=all` 只查询有过期日期且未用完、未丢弃的商品，会遗漏未设过期商品，同时仍包含已过期商品。
- 当前页面把状态、分类和排序渲染成三排横向按钮，常用入口、精确筛选和历史状态处于同一层级。

## Scope

- 修复 `/pantry` 列表到 `/pantry/:itemId` 的返回滚动、数据快照和分页连续性。
- 重构 Pantry 移动端筛选层级和默认查询语义。
- 持久化“包含已过期”与排序偏好；具体状态和分类继续由 URL 表达当前浏览上下文。
- 修正服务端默认筛选、状态筛选和默认排序，并补齐设置字段。
- 同步 Life Trace 产品计划和验收标准。

## Non-goals

- 不迁移整个 Life Trace 的服务端状态管理。
- 不引入 TanStack Query、Keep Alive 或新的路由库。
- 不改变库存状态模型、商品编辑字段、提醒规则和家庭空间模型。
- 不把已用完、已丢弃数据删除或归档到新表。

## UX Design

### Default list

默认进入“当前库存”，查询：

- 正常；
- 临期；
- 未设过期；
- 用户主动标记“仍在使用”。

默认关闭“包含已过期”，并记住用户上次选择。开启后，已过期商品加入“当前库存”，但排在可用商品之后。已用完和已丢弃永远不进入当前库存。

默认排序改为“临期优先”：临期商品按最近到期优先，其后依次为未来到期、仍在使用、未设日期；开启包含过期后，已过期商品放在当前库存末尾。单独查看已过期时按最近过期优先。

### Mobile controls

列表顶部保留搜索，并把常用状态收敛为三个入口：

- 当前库存；
- 临期；
- 已过期。

“当前库存”视图直接提供“包含已过期”开关。旁边的“筛选”按钮打开 BottomSheet，面板包含：

- 状态：正常、临期、未设过期、仍在使用；
- 分类：食品、日用品、药品、宠物、其他；
- 排序：临期优先、录入时间、保质期最长；
- 历史状态：已用完、已丢弃；
- 重置与应用操作。

面板中的状态为单选。具体状态筛选忽略“包含已过期”开关，只返回该状态；回到“当前库存”后重新使用持久化的开关偏好。

### URL and preference rules

- 搜索词、当前状态、分类、排序和是否包含过期写入 URL，支持刷新、复制链接和浏览器前进后退。
- “包含已过期”和排序同步到用户设置，作为下次进入 Pantry 的默认偏好。
- 正常、临期、已过期等具体状态和分类不作为长期默认，避免一次临时查询影响下次进入。

## Architecture

### Scroll context

扩展现有 `lifeTraceNavigation` 和 `AppShell`，为 Pantry 生成由规范化 pathname 与 search params 组成的列表浏览 key。滚动时记录数值位置和已加载页数；点击商品卡片时额外记录商品锚点和视口偏移。

列表进入详情时把来源 URL 写入路由 state。常规返回优先使用浏览历史；删除商品或无法使用历史时回到来源 URL；外部直达详情没有来源时才回退 `/pantry`。

### List snapshot

继续使用现有 Zustand store，不增加第二套服务端状态层。Store 记录当前 Pantry 查询上下文、已加载商品和分页进度：

- 返回相同查询时立即复用现有列表；
- 只有首次进入或查询上下文变化且没有可用数据时显示列表骨架；
- 返回后的后台刷新覆盖当前已加载范围，不把多页列表压回第一页；
- 刷新期间继续显示现有列表，并使用非挤压刷新状态；
- 商品新增、编辑、使用和删除优先原地修正当前快照，再按需后台校准。

本轮只维护当前查询快照，不建立多查询通用缓存。浏览器回到旧查询时根据该 key 保存的已加载页数重新请求到原范围，再在锚点或数值位置可用后恢复。

### Filter boundary

把 URL 解析、规范化、显示摘要和 API options 构造提取为纯函数，页面负责呈现和触发更新。BottomSheet 先维护草稿条件，点击“应用”后一次性更新 URL，避免每点一个选项都触发列表请求。

## API and Data Model

- 默认 `status=all` 改为“当前库存”语义：排除 `used-up`、`discarded`，包含无过期日期商品；未开启 `includeExpired` 时排除派生的已过期商品。
- 列表 API 增加 `includeExpired=true|false` 查询参数，只对 `status=all` 生效。
- `normal`、`expiring`、`expired`、`no-expiry`、`kept`、`used-up`、`discarded` 保持精确状态查询；其中 `normal` 只查询距离到期超过 7 天的商品，不再混入未设过期商品。
- 默认排序继续使用稳定的内部 sort id，但用户文案从“快过期”调整为“临期优先”，服务端按视图应用对应优先级。
- `LifeTraceSettings` 增加 `pantry_list_include_expired` 布尔字段，默认 `false`，前后端 JSON 字段为 `pantryListIncludeExpired`。
- 兼容保留已有 `pantryListStatusFilter` 与 `pantryListCategoryFilter` 字段，但新页面不再把它们作为首次进入的默认条件，也不再随临时筛选更新。

## Data Flow

1. 进入 `/pantry` 后，页面从 URL 和用户设置生成规范化查询上下文。
2. Store 若已有相同上下文的数据，立即渲染；否则请求第一页并展示骨架。
3. 用户滚动和加载下一页时，Store 保留列表与分页，`AppShell` 保留滚动锚点。
4. 点击商品时，记录商品锚点和来源 URL，再进入详情。
5. 返回后先渲染 Store 快照，`AppShell` 按商品锚点恢复视口。
6. 恢复后后台刷新当前已加载范围；列表尺寸变化时再次按锚点校准。
7. 如果目标商品已删除，恢复逻辑退化到原数值位置或相邻商品。
8. 修改搜索或筛选会生成新的上下文，并从顶部展示新结果。

## Error Handling

- 首次加载失败且没有快照时显示现有 `LoadErrorState`。
- 后台刷新失败时保留列表和滚动位置，仅显示非阻断错误提示。
- 偏好保存失败时保留本次会话内的开关效果，并提示偏好未保存。
- 快速切换查询继续使用 request id，旧请求不得覆盖新条件结果。
- 锚点暂未渲染时按短延迟重试；锚点不存在且列表高度足够时退化到数值位置。

## Testing

### Frontend automated checks

- Pantry 不同 URL 查询生成稳定且互不冲突的滚动 key。
- 锚点优先恢复、数值位置退化和目标未渲染重试。
- 默认查询、具体状态、分类、排序和 `includeExpired` 的 URL 解析与 API options。
- BottomSheet 草稿在“应用”前不改变实际查询，“重置”恢复当前库存默认值。
- 返回时已有快照不会显示整页骨架或丢失分页。

### Server automated checks

- 默认列表包含正常、临期、未设过期、仍在使用。
- 默认列表排除已过期、已用完、已丢弃。
- `includeExpired=true` 仅为当前库存加入已过期。
- 各精确状态筛选结果正确。
- 临期优先、已过期专属排序和分页稳定。
- 设置默认值、更新与读取能持久化包含过期偏好。

### Commands

- `pnpm --filter @valley/life-trace check`
- `pnpm --filter @valley/life-trace exec tsc --noEmit`
- `pnpm --filter @valley/life-trace exec vitest run`
- `go test ./internal/lifetrace/...`
- `pnpm check:harness`
- 对修改的中文文档和 UI 文件运行定向 encoding 检查。

## Runtime Acceptance

- 滚动到第二页以后打开详情，返回仍位于原商品和原视口偏移。
- 详情编辑后返回不跳顶；删除后返回原筛选及相邻位置。
- 搜索、筛选、刷新和浏览器前进后退保持 URL、列表与滚动上下文一致。
- 返回和后台刷新期间列表不闪白、不收缩成第一页。
- 首次默认隐藏已过期；开关开启后重新进入仍开启；单独查看已过期不改变默认视图偏好。

## Documentation Sync

本改动修正产品方向和验收标准，必须同步 `apps/life-trace/docs/PLAN.md`。设计阶段把该项标为未开始；代码落地并通过自动验证后更新为待验收，完成真机浏览路径后再标记已交付。

## Spec Review

- 无 `TBD`、`TODO` 或未决占位。
- 默认库存、包含过期和精确状态筛选语义互不冲突。
- 范围聚焦 Pantry 浏览连续性和筛选，不扩张到全应用状态管理迁移。
- 不新增第三方依赖；沿用 React Router、Zustand 和现有通用滚动恢复能力。
- 自动验证与真机验收边界明确。
