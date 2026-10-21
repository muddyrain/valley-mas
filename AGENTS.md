# Valley MAS 协作规则

本文件是仓库共同规则的唯一正文；`CLAUDE.md` 只引用本文件。子项目规则补充本地约束。

开始仓库任务前完整读取本文件及根 [CLAUDE.md](CLAUDE.md)，再读取目标子项目的局部规则；同层 `AGENTS.override.md` 优先。涉及 Blue Hour 时必须依次读取 [局部入口](apps/blue-hour/AGENTS.md) 和 `apps/blue-hour/PROJECT_CONTEXT.md`，不能假定已自动加载。用户本次明确要求优先于仓库一般规定。

## 从任务进入

先读取目标范围的局部入口，再按其中的任务表选择文档和代码；无需预读全仓指南、全部 skills 或完整历史计划。

| 范围 | 局部入口 |
|---|---|
| Web / Admin | [Web](apps/web/AGENTS.md)、[Admin](apps/admin/AGENTS.md) |
| API | [Server](server/AGENTS.md) |
| Life Trace | [Life Trace](apps/life-trace/AGENTS.md) |
| Electron | [Screen Recorder](apps/screen-recorder/AGENTS.md)、[Port Warden](apps/port-warden/AGENTS.md) |
| Godot | [Aeon Vale](apps/aeon-vale/AGENTS.md)、[Blue Hour](apps/blue-hour/AGENTS.md) |
| 实验应用 | [World Sim](apps/world-sim/AGENTS.md)、[Toy Climb Arena](apps/toy-climb-arena/AGENTS.md)、[Scratch Legend](apps/scratch-legend/AGENTS.md)、[Ambient Forge](apps/ambient-forge/AGENTS.md) |

跨项目任务读取两侧入口。共享包先核对包的公开入口、README 和实际调用方。

## 按需参考

- 环境、启动或验证命令：[项目指南](docs/PROJECT_GUIDE.md)；具体版本以包配置为准。
- 产品术语、玩法或权限边界：目标项目的 CONTEXT、设计或接口文档。
- 共享抽象、协议迁移或复杂状态取舍：[架构指南](docs/ARCHITECTURE_GUIDE.md)。
- 测试层级或运行时证据取舍：[测试策略](docs/TESTING_STRATEGY.md)。
- AI 工具、规则或检查器：[Harness](docs/HARNESS_ENGINEERING.md)；明确命中专项流程时再查 [skills 索引](.agents/skills/INDEX.md)。
- 既有计划或近期决策会影响实现时，运行 `pnpm context:recent -- <相关目录>`，按结果选择资料。

## 共同边界

- 以当前代码、配置、测试和项目指定文档核对事实，保护未知工作树改动、真实密钥和用户数据。
- 接口变化联查路由、处理器、服务/模型、权限与调用方；环境变量变化同步 `.env.example`。
- 新增第三方依赖前说明取舍并取得确认；启停服务先核实进程归属，本轮启动的服务交付时说明并关闭，用户要求保留的除外。
- 共享接口、跨模块调用、重命名或结构重构前，使用 GitNexus `impact` 核对 upstream 影响；HIGH/CRITICAL 风险先说明。局部小修直接核对调用方并验证，工具缺口见 Harness。

## 验证与交付

- 行为变化先建立能复现问题或约束的验证，再实现并复跑受影响检查。可逆的小改动采用相称验证，不为复述实现而新增测试。
- 交互、动画、Canvas、Three.js、设备能力及平台行为取得对应运行时证据，区分当前会话、无头测试、fixture 和人工验收。
- 修改中文、Markdown 或批量文本时按 `encoding-guard` 定向检查；修改规则、skills 或检查器时运行 Harness、上下文入口和文档链接检查，计划集合变化再检查计划索引。
- 用户可见文案表达任务、状态和必要后果；实现说明写在文档或交付中。
- 交付说明实际改动、验证结果和剩余事项；普通任务在回复中报告，不自动新增长期执行报告。

## 文档与 Git

- 当前规则更新对应主题文档；产品边界更新 CONTEXT；剩余工作更新项目指定计划；稳定决策按需要记录 ADR。索引只维护入口。
- 临时截图、日志、构建和调试报告进入项目输出目录或 `.tmp/`；已完成计划和被替代设计进入 `archive/YYYY-MM/`，保留独有约束和引用关系。
- 新建局部规则使用 [模板](.agents/AGENTS_TEMPLATE.md)，只记录差异和任务入口。
- 用户要求提交信息或提交时使用 `conventional-commit-guard`，区分只读建议和操作授权；图分析按变更风险执行，平时不自动提交。
