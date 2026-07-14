# Valley MAS 项目文档

本目录只沉淀长期有价值的项目级文档。普通问答、临时分析和一次性总结不要自动写入。

## 核心文档

- [项目指南](./PROJECT_GUIDE.md)：项目定位、技术栈、模块地图、开发命令、端口和环境变量。
- [AI 工作台知识库与 RAG 实施计划](./superpowers/plans/2026-07-14-ai-knowledge-rag.md)：私有资料库、ARK embedding、pgvector 检索和智能体引用的阶段状态。
- [Harness Engineering](./HARNESS_ENGINEERING.md)：AI coding agent 在本仓库中的上下文入口、工具边界、验证命令、评审回路和回归证据。
- [Agent 常见错误模式](./patterns/agent-pitfalls.md)：只记录 Valley 已确认的失败模式，并把重复问题导向脚本、测试或 CI。
- [Code Review 规则](../.code-review/README.md)：按 Security、correctness、Go、React/UI 风险加载的轻量 review 清单。
- [Agent 配置](./agents/)：Matt Pocock engineering skills 使用的 issue tracker、triage 标签和 domain docs 消费规则。

## 子项目文档

- Web 前台：`apps/web/AGENTS.md`。
- Admin 后台：`apps/admin/AGENTS.md`。
- Admin 运营后台入口：`apps/admin/src/pages/admin-ops`、`apps/admin/src/api/operations.ts`；覆盖运营列表、AI 调用审计和存储资产只读治理。
- Go 服务端：`server/AGENTS.md`、`server/README.md`、`server/migrations/README.md`。
- Life Trace：`apps/life-trace/README.md`、`apps/life-trace/docs/PLAN.md`。
- Desktop OS：`apps/desktop-os/AGENTS.md`、`apps/desktop-os/docs/PLAN.md`。
- AI Mind Arena：`apps/ai-mind-arena/AGENTS.md`、`apps/ai-mind-arena/README.md`、`server/internal/model/mind_arena.go`。
- WorldSim：`apps/world-sim/AGENTS.md`、`apps/world-sim/docs/*`。
- Toy Climb Arena：`apps/toy-climb-arena/AGENTS.md`、`apps/toy-climb-arena/docs/*`。
- Scratch Legend：`apps/scratch-legend/AGENTS.md`、`apps/scratch-legend/docs/*`。

## 维护规则

- 根入口优先更新 `README.md`、`QUICK_START.md` 和本索引。
- 项目级技术栈、端口、环境变量统一更新 [项目指南](./PROJECT_GUIDE.md)。
- 完整验证命令只在 [项目指南](./PROJECT_GUIDE.md#常用校验) 维护，其他入口只引用或补充局部规则。
- 子项目玩法、设计、局部协作规则放回对应 `apps/*` 目录。
- 过期的临时任务清单和流水账不要继续扩写；确实需要保留时，应标明“历史参考”。

---

保持项目整洁，从文档开始。
