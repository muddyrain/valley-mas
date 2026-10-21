# Valley MAS 文档索引

本页只负责导航；不要在此复制项目事实、执行规则、计划状态或子项目功能说明。

## 项目级真源

- [项目指南](PROJECT_GUIDE.md)：技术栈、模块边界、开发命令、端口、环境变量与验证矩阵。
- [测试治理策略](TESTING_STRATEGY.md)：测试优先级、例外与运行时证据。
- [Harness Engineering](HARNESS_ENGINEERING.md)：agent 文档、skills 与确定性检查的契约。
- [架构决策指南](ARCHITECTURE_GUIDE.md)：共享模块、协议迁移和复杂状态协调。
- [计划索引](plans/README.md)：当前计划、归档计划和计划生命周期；各项目的设计和规格从局部入口按任务读取。
- [Agent 常见错误模式](patterns/agent-pitfalls.md)：已证实且尚未自动化的失败模式。
- [Code Review 规则](../.code-review/README.md)：按风险加载 review 清单。

## 子项目入口

| 范围 | 首先读取 |
| --- | --- |
| Web 前台 | [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) |
| Admin 后台 | [`apps/admin/AGENTS.md`](../apps/admin/AGENTS.md) |
| Go 服务端 | [`server/AGENTS.md`](../server/AGENTS.md) |
| Life Trace | [`apps/life-trace/AGENTS.md`](../apps/life-trace/AGENTS.md) |
| 蓝时归航 · Blue Hour | [局部入口](../apps/blue-hour/AGENTS.md)、[文档职责](../apps/blue-hour/docs/README.md) |
| 纪元谷 · Aeon Vale | [局部入口](../apps/aeon-vale/AGENTS.md)、[运行与产品说明](../apps/aeon-vale/README.md) |
| Electron 应用 | [`apps/screen-recorder/AGENTS.md`](../apps/screen-recorder/AGENTS.md)、[`apps/port-warden/AGENTS.md`](../apps/port-warden/AGENTS.md) |
| 实验应用 | [`apps/world-sim/AGENTS.md`](../apps/world-sim/AGENTS.md)、[`apps/scratch-legend/AGENTS.md`](../apps/scratch-legend/AGENTS.md)、[`apps/toy-climb-arena/AGENTS.md`](../apps/toy-climb-arena/AGENTS.md)、[`apps/ambient-forge/AGENTS.md`](../apps/ambient-forge/AGENTS.md) |

长期文档的入口、状态或分类发生变化时更新本页；其他改动不需要同步本索引。
