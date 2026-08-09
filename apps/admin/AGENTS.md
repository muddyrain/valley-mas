# Admin 后台 AGENTS

## AI 任务最小上下文入口（本文件）

- `AGENTS.md` -> `apps/admin/AGENTS.md` -> `apps/admin/src/App.tsx` -> `apps/admin/src/layouts/Layout.tsx` -> `server/internal/router/router.go`
- 文档治理/约束变更任务：补读 `docs/README.md` -> `docs/PROJECT_GUIDE.md` -> `docs/HARNESS_ENGINEERING.md`。


本文件只补充 `apps/admin` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- `apps/admin` 是 Valley MAS 的管理后台，负责仪表盘、用户管理、创作者管理、创作者空间、创作者申请审核、资源管理、下载记录、博客/图文内容管理等运营工作流。
- 技术栈为 React 19 + Vite 6 + React Router 7 + Ant Design 6。
- Admin API 地址来自 `VITE_API_BASE_URL`，示例见 `.env.example`。

## 路由与代码入口

- 应用路由入口：`src/App.tsx`。
- 认证守卫：`PrivateRoute` 使用 `localStorage.admin_token`；`TokenValidator` 在窗口激活和聚焦时校验当前用户。
- 布局入口：`src/layouts/Layout.tsx`。
- 页面目录：`src/pages`。
- API 封装：`src/api`；请求工具：`src/utils/request.ts`。
- 管理端公共组件：`src/components`。

## 开发规范

- 管理端是高频操作后台，界面应保持信息密度、表格/表单可扫描性和稳定操作路径，不做营销式 hero 或装饰性大版面。
- 优先使用 Ant Design 和已有 API 封装；不要为单个页面引入新的 UI 体系。
- 新增管理页时同步检查 `src/App.tsx` 路由、`src/layouts/Layout.tsx` 菜单入口、对应 `src/api/*` 和服务端 `/api/v1/admin/*` 路由。
- 权限边界必须跟服务端中间件保持一致；不要只依赖前端隐藏按钮表达权限。
- 涉及列表、筛选、分页、刷新或回退一致性时，遵守根目录的 Web UI skill 路由并启用 `web-ui-consistency-guard`。
- 不在源码或示例配置中写真实密钥、真实 token 或个人账号凭据。

## AI Coding 约束（行为改动默认顺序）

- 行为改动（状态变更、权限分支、列表筛选、审核动作、请求参数映射、导出/导入）默认按以下顺序执行：
  1. 先补齐或更新相关测试；没有测试时补齐最邻近可测模块的最小用例。
  2. 先运行受影响测试，确认能看到失败和断言差异。
  3. 实现改动。
  4. 再运行受影响测试并确认通过。
- 仅文案/纯样式且无可观测行为边界的改动，可在交付说明中明确豁免原因，不作为行为改动。

## 本地 Preflight 约束（AI Coding 默认前置）

- 进入实现前先跑：
  1. `pnpm --filter @valley/admin check`。
  2. `pnpm --filter @valley/admin exec tsc --noEmit`。
  3. 受影响行为测试（`pnpm --filter @valley/admin test` 或对应受影响最小测试）。
- 处理跨模块改动（路由/权限/共享 API 封装）后再补跑一次受影响的行为回归范围。

## 常用命令

```bash
cd apps/admin && pnpm dev
pnpm --filter @valley/admin exec tsc --noEmit
pnpm --filter @valley/admin check
pnpm --filter @valley/admin build
```

## 校验要求

- 仅类型或逻辑改动：至少运行 `pnpm --filter @valley/admin exec tsc --noEmit`。
- 样式、格式、lint 相关改动：运行 `pnpm --filter @valley/admin check`。
- 行为类高风险提测前最小门禁：
  1. `pnpm --filter @valley/admin exec tsc --noEmit`。
  2. `pnpm --filter @valley/admin check`。
  3. 受影响行为测试通过（优先 `pnpm --filter @valley/admin test`，无该脚本时补齐并说明）。
  4. 管理端路由、权限、表单提交或审核流程改动：联动检查对应服务端 handler/API，并在最终回复说明验证范围。
