---
name: web-url-state-sync
description: 统一 Valley MAS Web 页面的 keyword/page 与 URL 查询参数联动规则，避免刷新丢状态与分页回退异常。适用于列表页搜索、分页、清除与重试链路。
category: web
---

# Web URL 状态联动

当任务涉及 Web 列表页的 `keyword/page`、搜索、分页、清除、重试时，使用这个 skill。

## 目标

- 让页面状态可分享、可刷新恢复、可前进后退。
- 统一 `keyword/page` 在 URL 与 UI 状态之间的同步方式。
- 避免“输入框有值但列表不是该条件”“翻页后参数丢失”等体验回退。

## 适用范围

- `apps/web` 内所有列表型页面（博客、资源、创作者、通知等）。
- 具备搜索词或分页状态的页面。
- 当前后端已支持 `keyword`/`page`，但前端尚未完成 URL 闭环的页面。

## 核心规则

1. 页面真实筛选条件以 URL 查询参数为准，而不是仅以内存 state 为准。
2. `keyword` 变化时，`page` 必须重置为 `1`。
3. 清除搜索时，删除 `keyword` 参数并保留其他无关参数。
4. 分页切换只更新 `page`，并保留当前 `keyword` 与其他已有参数。
5. 输入框状态应和 URL 参数同步，避免浏览器前进/后退后 UI 不一致。
6. 重试失败请求优先走“无刷新重试”（例如本地 `retryTick`），不要默认整页刷新。

## 推荐实现顺序

1. 使用 `useSearchParams` 解析 `keyword/page`，并做合法化处理（`page >= 1`）。
2. 用 URL 派生的 `currentKeyword/currentPage` 作为请求参数。
3. 搜索、清除、翻页统一通过 `setSearchParams` 更新 URL。
4. 在 effect 依赖中接入 URL 派生状态，确保刷新与回退都能触发正确请求。
5. 增加空态与错误态文案，明确当前是否有关键词筛选。

## 最低校验

1. 手动验证：刷新后条件保留、复制 URL 到新标签可复现同一结果。
2. 手动验证：浏览器前进/后退时，输入框与列表结果一致。
3. 运行：`pnpm --filter web exec tsc --noEmit`
4. 中文文案改动后运行：
   - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`

## 协作建议

- 与 `web-feature-iteration` 配合，用于把“列表闭环”任务持续推进到其他页面。
- 与 `task-completion-guard` 配合，避免停在“已设计未落地”。
- 与 `component-reuse-guard` 配合，若多页重复出现同类 URL 参数处理逻辑，应评估抽取公共 hook。
