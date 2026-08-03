# Web 前台 AGENTS

## AI 任务最小上下文入口（本文件）

- `AGENTS.md` -> `apps/web/AGENTS.md` -> `apps/web/src/App.tsx` -> `server/internal/router/router.go` -> `apps/web/src/api`
- 文档治理/约束变更任务：补读 `docs/README.md` -> `docs/PROJECT_GUIDE.md` -> `docs/HARNESS_ENGINEERING.md`。


本文件只补充 `apps/web` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- `apps/web` 是 Valley MAS 的用户侧前台，负责首页展示、创作者空间、资源库、博客/图文、个人空间、收藏关注、下载记录、通知、个人资料和登录注册。
- 技术栈为 React 19 + Vite 6 + React Router 7 + Tailwind 4，并复用 workspace 包如 `@valley/shared-request`、`@valley/shared-router`、`@valley/shared-format`。
- Web/Admin API 地址来自 `VITE_API_BASE_URL`，示例见 `.env.example`。

## 路由与代码入口

- 应用路由入口：`src/App.tsx`。
- 页面目录：`src/pages`；博客相关页面集中在 `src/pages/blog`。
- 布局入口：`src/layouts/WorkbenchLayout.tsx`、`src/layouts/Sidebar.tsx`。
- API 封装：`src/api`；请求工具：`src/utils/request.ts`。
- 登录状态：`src/stores/useAuthStore.ts`；主题状态：`src/stores/useThemeStore.ts`。
- 常用复用组件：`src/components`、`src/components/ui`、`src/components/blog`、`src/components/page`。

## 开发规范

- Web UI、主题、loading、列表分页、搜索、URL query 或浏览器回退行为发生变化时，必须启用 `web-ui-consistency-guard`。
- 新增页面前先检查 `src/App.tsx`、相邻 `src/pages/*`、`src/components/*` 和现有 hooks，优先复用已有布局、卡片、弹窗、上传、分页和 API 模式。
- 用户侧视觉采用纯 shadcn/ui 产品界面风格：以语义 token、默认组件变体和中性层级组织界面；不引入暖金、奶油色、纸感、装饰性渐变或单页独立色系。品牌表达仅可通过现有 Logo、内容资产与低频语义强调呈现。
- 路由标题由 `RouteTitle` 维护；新增前台路由时同步考虑页面标题。
- 需要权限的创作者/个人空间能力优先复用已有守卫、状态和请求封装，不绕过统一 request 层。
- 不在源码或示例配置中写真实密钥、真实 token 或个人账号凭据。

## 单元测试约定

### 交付前置约束（AI Coding 默认执行顺序）

- 行为改动（包括权限分支、请求参数映射、状态机、错误处理、列表/筛选排序分页、上传下载、保存/发布/删除等）默认按以下顺序执行：
  1. 编写或更新对应单元测试 / 组件测试（最小可复现行为）。
  2. 先运行受影响测试，确保失败到通过。
  3. 完成代码修改。
  4. 再次运行受影响测试并确认通过。
- 不能跳过“先补测试再改实现”的流程，除非该行为变化无可测试点（需在提交说明中写明“无对应测试边界”）。
- 每次改动涉及新行为时，优先补齐同目录同名 `*.test`；不能找到就地测试时，补齐当前目录内最邻近测试文件。

- 新增或修改功能时，默认同时新增或更新与改动风险相称的单元测试；测试应验证用户可观察的结果、数据契约或状态变化，而不是实现细节或无断言快照。
- 下列行为必须有测试：输入校验与数据转换、权限和状态分支、请求参数/响应映射、错误与重试处理、列表筛选/排序/分页、上传下载限制，以及会影响提交、保存、发布或删除结果的交互逻辑。
- 每个自研 React 组件（包括 `src/components`、页面和布局）都必须有对应的 `*.test.tsx` 组件测试；纯展示组件也不豁免，至少验证稳定的渲染内容、可访问语义或关键 props 契约。仅直接再导出、未改造的第三方组件可不单独测试。
- 组件测试从公开行为入手，覆盖关键加载、成功、失败、禁用和权限态；纯展示组件验证稳定契约即可。不要为了覆盖率堆叠脆弱快照，也不要为每个内部函数重复测试已有纯逻辑。
- 测试与被测模块就近放置，使用 `*.test.ts` / `*.test.tsx`；可复现线上缺陷时，先添加失败用例，再修复实现。
- 存量组件按全量补测目标治理：所有自研组件最终都必须具备组件测试；触及尚无测试的组件时，必须先补齐该组件测试再提交。未触及的存量组件应纳入独立覆盖治理任务，按组件清单分批补齐，不能永久以历史债为例外。
- 每次改动至少运行相关测试；影响 Web 功能行为时，运行 `pnpm --filter @valley/web test`，并继续执行本文件的类型、静态或浏览器验证要求。

### shadcn 组件优先

UI 组件优先使用 `src/components/ui/` 下的 shadcn 组件；当现有组件语义不匹配、第三方接口要求原生元素或需要专用交互时，可以在遵守 token 和可访问性的前提下使用更合适的实现：

- **交互控件**：使用 `Button`（variant/default/outline/ghost 等）、`Select`、`Checkbox`、`Input`、`Textarea`、`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`
- **状态反馈**：使用 `Skeleton` 替代自定义 loading 动画、`Badge` 替代自定义标签、`toast` 替代自定义错误提示
- **布局容器**：使用 `Card`/`CardHeader`/`CardContent`、`ScrollArea`、`Separator`
- **视觉基线**：优先沿用 shadcn 的默认圆角、间距、阴影、边框和语义色；页面骨架使用熟悉的应用栏、侧边栏、Tabs、表单和列表模式，不额外叠加纸张纹理、玻璃拟态、渐变背景或装饰性大色块。
- **使用边界**：
  - 常规动作优先使用 `Button`；无障碍语义、第三方 render prop 或特殊画布交互确实需要时可使用原生 `<button>`，但需复用现有焦点、禁用态和 token。
  - 紧凑尺寸优先使用组件已有 `size`；确需新尺寸时增加命名 variant，不在业务页面散落临时高度覆盖。
  - 内容占位优先使用 `Skeleton`；按钮提交、后台任务等需要表达进行中状态时可使用 spinner 或进度反馈。
  - 离散状态标签优先使用 `Badge`；说明性状态文本不必强行包装成 Badge。
  - 真正的标签页切换使用 `Tabs`；筛选、分段控制或工具栏动作按其交互语义选择 Toggle、Select 或 Button group。
  - 需要新的 UI 模式时先检查 `src/components/ui/`。确需从 shadcn 生成组件时，使用仓库已安装版本执行 `pnpm --filter @valley/web exec shadcn add <组件名>`，检查生成 diff；若会新增依赖，按根规则先取得确认。不要使用 `npx shadcn@latest`。

## 常用命令

```bash
cd apps/web && pnpm dev
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/web check
pnpm --filter @valley/web test
pnpm --filter @valley/web test:watch
pnpm --filter @valley/web build
```

## 本地 Preflight 约束（AI Coding 默认前置）

- 约定行为改动任务在进入实现前先跑：
  1. `pnpm --filter @valley/web check`（lint/format 前置）。
  2. `pnpm --filter @valley/web exec tsc --noEmit`（类型基础线）。
  3. 受影响行为测试：用最小范围先跑，要求先看到失败再改实现。
- 若改动了跨模块边界（如路由、状态共享、请求封装）再补跑一次完整 `pnpm --filter @valley/web test`。

## 校验要求

- AI Coding 约束：实现前必须先有“相关测试文件变更”，实现后至少跑一轮受影响的单元/组件测试。
- 默认以 `pnpm --filter @valley/web test:cov` 为“提测前最小可复验门槛”（允许在局部修复场景先跑定向测试）。
- 行为类高风险改动提测前，至少需通过：`pnpm --filter @valley/web exec tsc --noEmit` + `pnpm --filter @valley/web check` + `pnpm --filter @valley/web test`（或更小范围受影响测试）+ `pnpm --filter @valley/web test:cov`。

- 仅类型或逻辑改动：至少运行 `pnpm --filter @valley/web exec tsc --noEmit`。
- 样式、格式、lint 相关改动：运行 `pnpm --filter @valley/web check`。
- 页面交互、路由、登录态或上传下载链路改动：结合本地浏览器手动验证关键路径，并在最终回复说明验证范围。
- 新增或修改功能行为：运行相关单元测试；涉及多模块、共享工具或无法可靠缩小范围时，运行 `pnpm --filter @valley/web test`。
