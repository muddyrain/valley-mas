# Valley MAS AI 协作入口

`CLAUDE.md` 是根协作规则的唯一正文；`AGENTS.md` 仅为指向本文件的兼容软链接。

## 任务进入

1. 读取 `.agents/skills/INDEX.md`，按触发条件选择 skill。
2. 按任务范围读取 `docs/PROJECT_GUIDE.md` 的相关事实与验证矩阵，再进入目标 `apps/*/AGENTS.md` 或 `server/AGENTS.md`。
3. 改动跨模块、涉及既有计划或近期上下文可能影响实现时，运行 `pnpm context:recent -- <相关目录>`，再按输出读取关联资料。
4. AI 协作/Harness、架构决策、测试取舍分别读取 `docs/HARNESS_ENGINEERING.md`、`docs/ARCHITECTURE_GUIDE.md`、`docs/TESTING_STRATEGY.md`；只装载命中的资料。

## 真源与边界

- [文档索引](./docs/README.md)只负责导航；[项目指南](./docs/PROJECT_GUIDE.md)负责仓库事实、环境、端口与验证命令；[计划索引](./docs/plans/README.md)负责计划状态与归档。
- 子项目 `AGENTS.md` 只补充局部入口、不可替代的业务/平台约束与专项验收；不得复制本文件、完整命令表或通用测试策略。
- 新建局部 `AGENTS.md` 时，以 `.agents/AGENTS_TEMPLATE.md` 为起点，再填入真实的局部入口与约束。
- 先读相关代码、测试、配置和局部文档，复用既有模式；不凭旧记忆推断实现或业务规则。
- 不覆盖未知工作树改动，不改依赖或生成目录，不写入真实密钥；新增第三方依赖前说明取舍并取得确认。
- 接口改动联查路由、处理器、模型、服务、中间件与调用方；环境变量改动同步检查 `.env.example`。
- 启停长驻服务前核实端口与进程归属；本轮启动的服务在交付中报告并关闭，除非用户要求保留。

## 实施与验证

- 行为改动先建立或更新可观测验证，再实现并复跑受影响验证；纯文案、纯样式或不可测边界可说明豁免与替代验证。
- 浏览器调试与运行时验证按任务选择工具，并清楚区分用户当前会话中的实机验收与自动化或 fixture 证据；具体政策见 [Harness 的浏览器与运行时证据](./docs/HARNESS_ENGINEERING.md#6-浏览器与运行时证据)。可见交互、响应式、动画、Canvas、Three.js、拖拽、滚动、loading 和路由按风险取得运行时证据。
- 通过 Chrome 验收本地 Web 页面时，先检查并接管用户已打开的目标标签，保持原始 origin；`localhost` 与 `127.0.0.1` 的会话彼此隔离。只有没有匹配标签或明确需要独立未登录场景时才新开标签；刷新前先确认该标签没有未保存输入。
- 测试范围、覆盖率门槛与平台验收以 `docs/TESTING_STRATEGY.md`、局部入口及 `docs/PROJECT_GUIDE.md` 为准。
- 修改 Markdown、skill、配置示例或其他非 ASCII 文本时，运行 `encoding-guard` 定向检查。

## 文档、Git 与完成

- 长期状态、接口、依赖、数据模型、产品方向或验收标准变化时，按 `docs/plans/README.md` 和目标子项目文档同步；临时调试与局部修复不制造计划文档。
- 不自动提交。用户要求提交时，先查看近期提交风格并使用 `conventional-commit-guard`。
- 修改本文件、局部 `AGENTS.md`、skills、Harness 或文档约束脚本时，运行 `pnpm check:harness`、`pnpm check:agents-context` 和 `pnpm check:docs-links`；计划集合变化再运行 `pnpm check:plans-index`。
- 交付只报告实际改动、实际验证、未验证范围与风险；不可把计划或分析表述为已完成实现。
