# Life Trace Calendar Selection Design

## Goal

Life Trace 的计划页顶部日历可以切换日期，并复用 `@valley/calendar` 的日期逻辑。共享日历包新增农历日期工具，后续页面可按需引入。

## Scope

- 计划页保留现有 7 天横条样式，增加上一周、下一周和回到今天。
- 点击日期后，计划列表按该日期查询；搜索、类型、提醒、周期筛选继续生效。
- `@valley/calendar` 提供无 UI 的日期 key、周起点、周日期格子和农历日期工具。
- 农历本轮只提供农历月日文本，不加入节气或传统节日。

## Architecture

`packages/calendar` 只沉淀纯逻辑：输入日期或日期 key，输出稳定的日期 key、周视图单元和农历信息。Life Trace 页面负责渲染按钮、维护选中日期和查询参数，不把 UI 组件放进共享包。

计划页使用 `selectedDateKey` 和 `weekCursorKey` 管理用户选择。选中日期时，`listOptions` 传入 `dateFrom` 与 `dateTo`；切到“未来”时清空具体日期范围，避免把“未来”和“单日”混在一起。

## Data Flow

1. 页面初始化当天为选中日期和周游标。
2. 周横条由 `getCalendarWeekDays(weekCursorKey)` 生成。
3. 点击日期更新 `selectedDateKey` 和主筛选为 `today`。
4. `loadPlans(listOptions)` 使用 `dateFrom/dateTo` 查询同一天计划。
5. 页面本地继续按搜索、类型、快捷筛选和完成状态过滤当前列表。

## Error Handling

日期工具遇到非法 date key 时回退到当天或返回 `null`，不抛出 UI 层难处理的异常。农历工具限定 1900-2100 年，超出范围返回 `null`，调用方可选择不展示农历。

## Testing

- `packages/calendar` 增加 vitest，覆盖周起点、周日期格子、日期 key、本月/今天/选中状态和农历样例。
- Life Trace 运行 TypeScript 检查，验证页面和 workspace 依赖接线。
- 修改中文文档和 UI 文案后运行编码检查。

## Spec Review

- 没有占位项。
- 范围限定在计划页日期选择与共享 calendar 包逻辑。
- 不新增第三方依赖。
- 不改变服务端接口，复用现有 `dateFrom/dateTo` 查询参数。
