> [!HISTORICAL] 该计划已迁移为历史参考，不作为当前可执行计划

# Life Trace Pantry Mobile Browsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Valley MAS project rules prohibit automatic commits unless the user explicitly requests one, so each task ends with a verification checkpoint instead of a commit.

**Goal:** 修复 Pantry 从详情返回跳顶和分页丢失，并把默认库存语义与移动端筛选重构为已批准的“当前库存 + 包含已过期开关 + 精确筛选”模式。

**Architecture:** 沿用 React Router、Zustand 和现有 `AppShell` 滚动记忆，不新增依赖。服务端负责准确的库存集合与排序，前端纯函数负责 URL/筛选映射，Zustand 保留当前查询快照，AppShell 按规范化查询 key 恢复商品锚点。

**Tech Stack:** React 19、React Router 7、Zustand 5、TypeScript、Vitest、Gin、GORM、Go testing、Tailwind 4。

---

## File Map

- Create `apps/life-trace/src/lib/pantryListFilters.ts`: Pantry URL、筛选草稿、API options 与查询相等判断的纯函数。
- Create `apps/life-trace/src/lib/pantryListFilters.test.ts`: 筛选与 URL 契约测试。
- Create `apps/life-trace/src/components/PantryFilterSheet.tsx`: 移动端筛选 BottomSheet。
- Modify `apps/life-trace/src/pages/PantryPage.tsx`: 新筛选 UI、URL 同步、当前查询快照和详情来源 state。
- Modify `apps/life-trace/src/pages/PantryItemDetailPage.tsx`: 删除、空状态和直达场景的来源列表回退。
- Modify `apps/life-trace/src/lib/lifeTraceNavigation.ts`: Pantry 查询 key、已加载数量与共享滚动记忆访问。
- Modify `apps/life-trace/src/lib/lifeTraceNavigation.test.ts`: Pantry key、锚点和已加载数量测试。
- Modify `apps/life-trace/src/components/AppShell.tsx`: 使用 pathname + search 的滚动 key 和共享记忆。
- Modify `apps/life-trace/src/api/pantry.ts`: `includeExpired` 查询参数。
- Modify `apps/life-trace/src/types.ts`: 用户偏好字段。
- Modify `apps/life-trace/src/store/useLifeTraceStore.ts`: 偏好规范化、查询快照保持和后台刷新。
- Modify `server/internal/model/life_trace.go`: `pantry_list_include_expired` 设置字段。
- Modify `server/internal/lifetrace/settings_handler.go`: 设置请求、默认值和持久化。
- Modify `server/internal/lifetrace/settings_handler_test.go`: 偏好默认值与更新测试。
- Modify `server/internal/lifetrace/pantry_handler.go`: 默认集合、精确状态和视图排序。
- Modify `server/internal/lifetrace/pantry_handler_test.go`: 默认、包含过期、精确状态和排序测试。
- Modify `apps/life-trace/docs/PLAN.md`: 实施完成后从未开始更新为待验收。

### Task 1: Pantry 设置持久化

**Files:**
- Modify: `server/internal/model/life_trace.go`
- Modify: `server/internal/lifetrace/settings_handler.go`
- Test: `server/internal/lifetrace/settings_handler_test.go`
- Modify: `apps/life-trace/src/types.ts`
- Modify: `apps/life-trace/src/store/useLifeTraceStore.ts`

- [ ] **Step 1: 写失败的服务端设置测试**

在默认设置测试中断言 `pantryListIncludeExpired == false`，并在更新请求中传入：

```json
{
  "pantryListIncludeExpired": true,
  "pantryListSortMode": "created-desc"
}
```

更新响应和再次 GET 都必须返回 `true` 与 `created-desc`。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd server && go test ./internal/lifetrace -run 'Test(GetSettingsCreatesDefaultForCurrentUser|UpdateSettingsPersistsCurrentUserPreferences)$'`

Expected: FAIL，响应不存在 `pantryListIncludeExpired` 或无法持久化。

- [ ] **Step 3: 增加后端字段和保存接线**

模型字段：

```go
PantryListIncludeExpired bool `gorm:"column:pantry_list_include_expired;default:false" json:"pantryListIncludeExpired"`
```

请求、默认值和更新映射：

```go
PantryListIncludeExpired bool `json:"pantryListIncludeExpired"`

PantryListIncludeExpired: false,

settings.PantryListIncludeExpired = req.PantryListIncludeExpired
```

- [ ] **Step 4: 接入前端设置类型与规范化**

在 `UserSettings` 增加：

```ts
pantryListIncludeExpired: boolean;
```

默认值设为 `false`，`normalizeSettings` 只接受布尔值：

```ts
pantryListIncludeExpired:
  typeof settings.pantryListIncludeExpired === 'boolean'
    ? settings.pantryListIncludeExpired
    : defaultSettings.pantryListIncludeExpired,
```

- [ ] **Step 5: 运行定向测试和类型检查**

Run: `cd server && go test ./internal/lifetrace -run 'Test(GetSettingsCreatesDefaultForCurrentUser|UpdateSettingsPersistsCurrentUserPreferences)$'`

Expected: PASS。

Run: `pnpm --filter @valley/life-trace exec tsc --noEmit`

Expected: PASS。

### Task 2: 服务端默认集合与排序

**Files:**
- Modify: `server/internal/lifetrace/pantry_handler.go`
- Test: `server/internal/lifetrace/pantry_handler_test.go`

- [ ] **Step 1: 扩展失败用例数据**

在 `TestListPantrySupportsDerivedStatusFiltersAndPagination` 增加 `kept` 和 `used-up` 商品，并把默认列表断言改为：

```go
expectedDefaultNames := []string{"临期鸡蛋", "大米", "仍在使用酸奶", "未设过期纸巾"}
```

增加 `includeExpired=true` 断言：临期仍在首位，过期商品加入但位于可用商品之后；增加 `status=normal` 断言只返回“大米”，不返回“未设过期纸巾”。

- [ ] **Step 2: 运行测试确认旧语义失败**

Run: `cd server && go test ./internal/lifetrace -run TestListPantrySupportsDerivedStatusFiltersAndPagination`

Expected: FAIL，默认列表仍包含过期、遗漏未设过期，且排序不符合临期优先。

- [ ] **Step 3: 实现默认与精确状态过滤**

将默认分支改为：

```go
if status == "" || status == "all" {
    query = query.Where("status NOT IN ?", []string{"used-up", "discarded"})
    if !parseBoolQuery(c.Query("includeExpired")) {
        today, _ := pantryDerivedDateBounds(time.Now())
        query = query.Where("status = ? OR expires_at = '' OR expires_at IS NULL OR expires_at >= ?", "kept", today)
    }
}
```

`normal` 精确分支使用：

```go
query = query.
    Where("status NOT IN ?", []string{"used-up", "discarded", "kept"}).
    Where("expires_at <> '' AND expires_at > ?", expiringDeadline)
```

`parseBoolQuery` 仅把 `true`、`1`、`yes`、`on` 视为开启。

- [ ] **Step 4: 实现视图排序**

默认 `expiry-asc` 的 CASE 优先级调整为：临期 0、未来到期 1、kept 2、无日期 3、已过期 4、历史状态 5；`status=expired` 时改用 `expires_at DESC`，让最近过期在前。所有分支保留 `updated_at DESC, created_at DESC` 作为稳定次序。

- [ ] **Step 5: 运行 Pantry 服务端测试**

Run: `cd server && go test ./internal/lifetrace -run 'TestListPantry'`

Expected: PASS。

### Task 3: 前端筛选纯函数与 API 契约

**Files:**
- Create: `apps/life-trace/src/lib/pantryListFilters.ts`
- Create: `apps/life-trace/src/lib/pantryListFilters.test.ts`
- Modify: `apps/life-trace/src/api/pantry.ts`

- [ ] **Step 1: 写失败的纯函数测试**

覆盖：

```ts
expect(readPantryListFilters(new URLSearchParams(), {
  includeExpired: true,
  sort: 'created-desc',
})).toMatchObject({
  status: 'all',
  category: 'all',
  includeExpired: true,
  sort: 'created-desc',
});

expect(buildPantryListSearchParams({
  status: 'expired',
  category: '食品',
  includeExpired: true,
  sort: 'expiry-asc',
  q: '牛奶',
}).toString()).toBe('status=expired&category=%E9%A3%9F%E5%93%81&q=%E7%89%9B%E5%A5%B6');
```

并断言 `toPantryListApiOptions` 只在 `status=all` 时发送 `includeExpired`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @valley/life-trace exec vitest run src/lib/pantryListFilters.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现筛选模型**

导出稳定常量和类型：

```ts
export type PantryListFilters = {
  status: PantryListStatusFilter;
  category: PantryListCategoryFilter;
  includeExpired: boolean;
  sort: PantrySortMode;
  q: string;
};

export const pantryQuickStatuses = ['all', 'expiring', 'expired'] as const;
export const pantryDetailedStatuses = ['normal', 'expiring', 'no-expiry', 'kept'] as const;
export const pantryHistoryStatuses = ['used-up', 'discarded'] as const;
```

实现 `readPantryListFilters`、`buildPantryListSearchParams`、`toPantryListApiOptions`、`isSamePantryListQuery` 和筛选摘要函数；URL 参数顺序固定为 status、category、includeExpired、sort、q。

- [ ] **Step 4: 接入 API 参数**

`ListPantryOptions` 增加：

```ts
includeExpired?: boolean;
```

`buildListQuery` 仅在 `options.includeExpired === true` 时设置 `includeExpired=true`。

- [ ] **Step 5: 运行纯函数测试**

Run: `pnpm --filter @valley/life-trace exec vitest run src/lib/pantryListFilters.test.ts`

Expected: PASS。

### Task 4: Pantry 滚动上下文与列表快照

**Files:**
- Modify: `apps/life-trace/src/lib/lifeTraceNavigation.ts`
- Test: `apps/life-trace/src/lib/lifeTraceNavigation.test.ts`
- Modify: `apps/life-trace/src/components/AppShell.tsx`
- Modify: `apps/life-trace/src/store/useLifeTraceStore.ts`

- [ ] **Step 1: 写失败的滚动 key 测试**

增加：

```ts
expect(getLifeTraceScrollMemoryKey('/pantry', '?status=expired&q=milk')).toBe(
  'list:/pantry?q=milk&status=expired',
);
expect(getLifeTraceScrollMemoryKey('/pantry/abc', '')).toBeNull();
expect(getLifeTraceScrollMemoryKey('/pantry', '?q=milk')).not.toBe(
  getLifeTraceScrollMemoryKey('/pantry', '?q=rice'),
);
```

并断言 `captureScrollMemory` 从 `[data-scroll-loaded-count="40"]` 读到 `loadedItemCount: 40`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @valley/life-trace exec vitest run src/lib/lifeTraceNavigation.test.ts`

Expected: FAIL，Pantry key 仍为空且没有已加载数量。

- [ ] **Step 3: 实现共享记忆和 Pantry key**

`ScrollMemoryEntry` 增加：

```ts
loadedItemCount?: number;
```

模块内维护 Map，并导出：

```ts
export function readScrollMemory(key: string) {
  return scrollMemory.get(key);
}

export function writeScrollMemory(entry: ScrollMemoryEntry) {
  scrollMemory.set(entry.key, entry);
}
```

`getLifeTraceScrollMemoryKey(pathname, search)` 对 `/pantry` 使用排序后的有效 query 参数生成 `list:/pantry?...`，详情路由返回 `null`。

- [ ] **Step 4: AppShell 改用共享记忆**

用 `location.pathname, location.search` 生成 key；捕获和恢复通过 `readScrollMemory` / `writeScrollMemory`，保留现有 anchor-first、requestAnimationFrame 和延迟重试策略。

- [ ] **Step 5: Store 保留相同查询快照**

`loadPantryList` 在请求前用 `isSamePantryListQuery` 比较当前 options：相同查询保留 `pantryListItems`；不同查询清空列表和分页。相同查询刷新使用当前已加载数量作为 `pageSize`，确保返回后不会压回 20 条。

- [ ] **Step 6: 运行滚动和类型测试**

Run: `pnpm --filter @valley/life-trace exec vitest run src/lib/lifeTraceNavigation.test.ts src/lib/pantryListFilters.test.ts`

Expected: PASS。

Run: `pnpm --filter @valley/life-trace exec tsc --noEmit`

Expected: PASS。

### Task 5: 移动端筛选面板与 Pantry 页面

**Files:**
- Create: `apps/life-trace/src/components/PantryFilterSheet.tsx`
- Modify: `apps/life-trace/src/pages/PantryPage.tsx`

- [ ] **Step 1: 创建筛选面板**

组件契约：

```ts
type PantryFilterSheetProps = {
  open: boolean;
  value: PantryListFilters;
  onOpenChange: (open: boolean) => void;
  onApply: (value: PantryListFilters) => void;
};
```

打开时复制 `value` 到草稿；状态、分类和排序使用现有 Button/Badge/BottomSheet；历史状态单独分组；“重置”恢复 `status: 'all'`、`category: 'all'`，保留用户的 `includeExpired` 与排序偏好；“应用”一次回传并关闭。

- [ ] **Step 2: PantryPage 改由 URL 派生真实条件**

移除 status/category/sort 的长期本地真源与三排 `LifeFilterBar`。从 `searchParams` 和设置读取 `PantryListFilters`，所有条件变更通过 `buildPantryListSearchParams` 一次性 replace URL；具体状态和分类不再调用 `updateSettings`。

- [ ] **Step 3: 添加三个常用入口与开关**

渲染“当前库存 / 临期 / 已过期”三个按钮、“筛选”按钮和当前库存下的 `Switch`：

```tsx
<Switch
  size="sm"
  checked={filters.includeExpired}
  onCheckedChange={(checked) => {
    applyFilters({ ...filters, status: 'all', includeExpired: checked });
    updateSettings({ pantryListIncludeExpired: checked });
  }}
/>
```

文案只表达状态与动作，不加入设计解释。

- [ ] **Step 4: 保留列表并接入滚动数据**

Pantry 页面根容器增加 `data-scroll-loaded-count={pantryList.length}`。骨架条件改为“当前查询无数据且正在首次加载”，后台刷新仍渲染列表。进入详情时传来源：

```ts
navigate(`/pantry/${item.id}`, {
  state: { pantryListFrom: `${location.pathname}${location.search}` },
});
```

- [ ] **Step 5: 运行前端定向验证**

Run: `pnpm --filter @valley/life-trace check`

Expected: PASS。

Run: `pnpm --filter @valley/life-trace exec tsc --noEmit`

Expected: PASS。

### Task 6: 详情返回、删除回退与刷新连续性

**Files:**
- Modify: `apps/life-trace/src/pages/PantryItemDetailPage.tsx`
- Modify: `apps/life-trace/src/pages/PantryPage.tsx`

- [ ] **Step 1: 读取安全来源 URL**

从 `useLocation().state` 读取 `pantryListFrom`，只接受以 `/pantry` 开头且不以 `/pantry/` 开头的站内路径，否则使用 `/pantry`：

```ts
function getPantryListReturnPath(state: unknown) {
  const value = (state as { pantryListFrom?: unknown } | null)?.pantryListFrom;
  return typeof value === 'string' && /^\/pantry(?:\?|$)/.test(value) ? value : '/pantry';
}
```

- [ ] **Step 2: 删除与空状态回到来源列表**

删除成功、详情不存在按钮和无法走历史的 fallback 都使用 `pantryListReturnPath`。常规顶部返回仍优先 `navigate(-1)`，避免制造重复历史项。

- [ ] **Step 3: 刷新使用原查询 options**

详情编辑、状态更新和转移后调用 Store 当前的 `pantryListOptions`，不再只传 householdId 覆盖为默认列表；返回后列表先显示已保留快照，再后台校准。

- [ ] **Step 4: 运行相关测试和完整前端测试**

Run: `pnpm --filter @valley/life-trace exec vitest run`

Expected: PASS。

### Task 7: 计划状态、完整验证与运行时验收

**Files:**
- Modify: `apps/life-trace/docs/PLAN.md`
- Verify: all modified files

- [ ] **Step 1: 更新计划为待验收**

把 P0.2 从 `未开始` 改为 `待验收`，只描述真实落地能力和仍需真机验证的路径，不把运行时未验证项写成已交付。

- [ ] **Step 2: 运行编码与 diff 检查**

Run: `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <all modified CJK files>`

Expected: PASS。

Run: `git diff --check`

Expected: no output，exit 0。

- [ ] **Step 3: 运行完整自动验证**

Run: `pnpm --filter @valley/life-trace check`

Run: `pnpm --filter @valley/life-trace exec tsc --noEmit`

Run: `pnpm --filter @valley/life-trace exec vitest run`

Run: `cd server && go test ./internal/lifetrace/...`

Run: `pnpm check:harness`

Expected: all PASS。

- [ ] **Step 4: 本地运行时验收**

启动 Life Trace 和所需 API，验证：第二页商品详情返回原位置；编辑后返回不跳顶；删除后回到相邻位置；包含过期偏好重进仍生效；状态/分类/排序和浏览器前进后退保持 URL 一致；后台刷新不闪白、不收缩为第一页。

- [ ] **Step 5: 完成度自检**

逐项对照设计规格的 Runtime Acceptance。自动验证通过但真机或真实数据不可用时，计划保持 `待验收`，最终回复明确列出未验证路径。

## Plan Self-review

- 规格中的默认集合、包含过期、精确筛选、排序、返回恢复、分页保持、删除退化、URL 状态、错误处理、设置持久化和文档同步均有对应任务。
- 文件职责与类型命名在各任务中一致。
- 无新增第三方依赖，无跨应用状态管理迁移。
- 无占位步骤；每个代码动作都有目标结构、失败验证和通过命令。
