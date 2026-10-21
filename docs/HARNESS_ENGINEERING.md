# AI 协作与检查机制

本页用于修改协作规则、工具策略和检查器；普通业务任务从目标项目 AGENTS 进入。

## 规则与文档职责

| 入口 | 职责 |
|---|---|
| [根 AGENTS](../AGENTS.md) | 仓库共同规则与项目导航；CLAUDE.md 仅包含 `@AGENTS.md` |
| 局部 AGENTS | 本地关键约束与按任务读取表；[模板](../.agents/AGENTS_TEMPLATE.md) |
| [项目指南](PROJECT_GUIDE.md) | 环境、运行和验证命令 |
| [测试策略](TESTING_STRATEGY.md) / [架构指南](ARCHITECTURE_GUIDE.md) | 需要作取舍时的专项参考 |
| 项目 CONTEXT / 主题文档 | 产品语言、当前行为和接口契约 |
| [计划索引](plans/README.md) | 跨模块计划生命周期及各项目状态入口 |
| [skills 索引](../.agents/skills/INDEX.md) | 明确命中专项流程时再加载 |

规则中只保留每次任务都需要的约束。特定任务通过“触发条件 → 主题入口”读取；配置、版本和脚本已经表达的事实直接查对应文件。当前状态不在多个文档中重复维护。

普通执行报告写在交付回复；截图、日志和一次性诊断进入项目输出目录或 `.tmp/`。需要长期保存的决策、契约和验收基线更新指定文档。已完成计划和历史证据进入 `archive/YYYY-MM/`，归档不意味着旧 TODO 已完成。

## 确定性检查

| 命令 | 检查范围 |
|---|---|
| `pnpm check:harness` | AGENTS 正文、CLAUDE 引用、局部入口导航、递归 skills 索引、工具兼容链接及 GitNexus 纯索引配置 |
| `pnpm check:agents-context` | 局部“按任务读取”有有效的本地链接；不规定阅读顺序或长链 |
| `pnpm check:docs-links -- --strict` | 根文档、apps/server/packages 文档、模板和索引中的正式文件链接 |
| `pnpm check:plans-index` | 根跨模块计划的活跃/归档集合与索引一致 |

前三项分别有同名 `:test` fixture 回归。检查器只报告并返回状态，不自动改文件。文档链接检查将 `test-output/`、`build/`、`dist/` 等生成证据缺失单独计数，不要求新检出仓库携带本地截图或 EXE；正式源文档、代码和资产的缺失在 strict 模式失败。链接检查不验证远端 URL、标题锚点和材料内容是否正确。

`AGENTS.md` 和 `CLAUDE.md` 都是普通文件，避免跨系统软链接检出造成规则正文缺失。skills 仍通过 `.claude/.codex/.codebase/.trae/skills` 引用 `.agents/skills`。

CI 的 Quality 工作流执行 Harness、上下文及其回归、严格文档链接及其回归、计划索引、workspace 检查和构建、Web 测试与覆盖率、Go 测试；以工作流文件为执行事实。

## 技能范围

仓库仅保留编码检查、文档审计、Web 性能审阅和提交规范四项，具体触发见索引。UI 与文案约束归对应应用和根规则；汇报、完成判断不再分别加载技能。

设计、GSAP、Godot、GitNexus、访谈等通用资料在个人层手动选用，Codex 通过技能的 `agents/openai.yaml` 中 `policy.allow_implicit_invocation: false` 控制自动调用。个人资料不是仓库运行或验证的依赖；相同技能只维护一个有效版本，不用索引文字代替宿主调用策略。

## GitNexus

按根 AGENTS 的风险条件使用图分析。先核对直接调用方与受影响流程，HIGH/CRITICAL 先说明；涉及共享接口、跨模块调用或结构重构的提交再用 `detect_changes` 核对范围，纯文档、格式化和局部小修无需图分析。

CLI 为 `node .gitnexus/run.cjs`，参数查命令帮助，repo 为 `valley-mas`。可选个人 GitNexus 技能提供进阶参考，不作为普通探索和修复的前置条件。

仓库 [.gitnexusrc](../.gitnexusrc) 将 `analyze.indexOnly` 设为 `true`，刷新索引只更新代码图谱，不向 AGENTS、CLAUDE 或技能目录注入文件。已有 runner 使用 `node .gitnexus/run.cjs analyze`；首次检出可运行 `npx gitnexus analyze --index-only`。Harness 检查此配置，避免精简后的规则和技能被重新安装。

脚本嵌入代码可能未被索引。UNKNOWN 或工具不可用时直接核对调用位置并执行对应回归，不能把目标未找到解释为无影响；只有确实需要图分析时才处理索引。

## 浏览器与运行时证据

- 探索本地 Web、当前登录态、控制台或网络时，使用可用浏览器控制工具连接用户现有 Chrome，优先复用目标标签并保留原 origin；localhost 与 127.0.0.1 的会话不同，刷新前核对未保存输入。
- 当前会话无法连接时说明限制，不将隔离浏览器表述为该会话验收。确定性复现、回归和 CI 使用已有无头自动化；独立可见浏览器需要用户授权。
- UI、响应式、动画、Canvas、Three.js、拖拽、滚动、loading 和路由验证可观察行为；设备权限、硬件和真实服务需要对应设备或明确手工验收。
- 按风险记录工具/模式、目标、viewport、断言和证据路径。当前用户会话、fixture、无头和平台验证分别如实标注；不为一次验证新增依赖。

## Review 与反馈

[Review 入口](../.code-review/README.md)按改动风险选规则，不默认编排固定数量的 Agent。已证实的重复问题进入 [失败模式](patterns/agent-pitfalls.md)；能机械判断的优先转成测试或检查，减少提示词堆叠。
