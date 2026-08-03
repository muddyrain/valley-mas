# AGENTS 示例模板（Web / Admin / Server）

用途：新建/重写子项目 `AGENTS.md` 时，不用从零编写“行为约束+验证闭环”。

## 示例 1：前端项目（以 web 为例）

```md
## AI Coding 约束（行为改动默认顺序）

- 行为改动（权限分支、请求参数映射、列表筛选分页、上传下载、页面关键交互）默认按：
  1. 先补齐/更新就近测试。
  2. 先跑受影响测试，确认先失败再改。
  3. 再实现改动。
  4. 再跑受影响测试并通过。
- 仅文案/纯样式且无行为边界可豁免，需在交付说明写明原因与替代验证。

## 本地 Preflight 约束（AI Coding 默认前置）

- 约定行为任务在实现前先跑：
  1. `pnpm --filter @valley/web check`
  2. `pnpm --filter @valley/web exec tsc --noEmit`
  3. 受影响行为测试最小范围（先失败再改）

## 校验要求

- 行为类高风险提测前最小门禁：
  1. `pnpm --filter @valley/web exec tsc --noEmit`
  2. `pnpm --filter @valley/web check`
  3. 受影响行为测试通过（或 `pnpm --filter @valley/web test`）
```

配套命令建议：
`pnpm --filter @valley/web test`、`pnpm --filter @valley/web test:cov`（按改动风险决定是否补跑）。

---

## 示例 2：管理后台（以 admin 为例）

```md
## AI Coding 约束（行为改动默认顺序）

- 行为改动（列表筛选、审核动作、路由权限、请求参数映射）默认按：
  1. 先补齐/更新同目录可测试模块。
  2. 先跑受影响测试，确认失败到通过。
  3. 再实现改动。
  4. 再跑受影响测试并通过。

## 本地 Preflight 约束（AI Coding 默认前置）

- 行为任务实现前先跑：
  1. `pnpm --filter @valley/admin check`
  2. `pnpm --filter @valley/admin exec tsc --noEmit`
  3. 受影响行为测试（无脚本时给出替代验证）

## 校验要求

- 行为类高风险提测前最小门禁：
  1. `pnpm --filter @valley/admin exec tsc --noEmit`
  2. `pnpm --filter @valley/admin check`
  3. 受影响行为测试（优先 `pnpm --filter @valley/admin test`，无脚本时说明替代）
```

配套命令建议：
`cd apps/admin && pnpm dev`、`pnpm --filter @valley/admin build`（视变更范围决定）。

---

## 示例 3：后端服务（以 server 为例）

```md
## AI Coding 约束（行为改动默认顺序）

- 行为改动（路由、handler、模型、迁移、AI tool、权限与状态分支）默认按：
  1. 先补齐/更新对应 Go 测试（受影响包）。
  2. 先跑受影响测试，确认先失败可复现。
  3. 再实现改动。
  4. 再跑受影响测试并通过。

## 本地 Preflight 约束（AI Coding 默认前置）

- 行为任务实现前先跑：
  1. `cd server && go test ./...`（或先缩到受影响包）
  2. 若改动受限，可先跑目标包测试
  3. 路由/配置/权限改动后补充联调校验

## 校验要求

- 行为类高风险提测前最小门禁：
  1. `cd server && go test ./...`（或受影响包最小回归）
  2. 路由/权限/迁移改动同步校验前端/API 契约
  3. `.env.example` 与运行配置同步确认
```

配套命令建议：
`cd server && go build ./cmd/server ./cmd/migrate`、必要时 `cd server && go run ./cmd/server` 做关键联调。
