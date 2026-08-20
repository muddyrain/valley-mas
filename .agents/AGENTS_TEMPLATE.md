# 子项目 AGENTS 模板

> 仅记录该子项目不可从 `CLAUDE.md`、`docs/PROJECT_GUIDE.md` 或 `docs/TESTING_STRATEGY.md` 推得的信息。

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/<project>/AGENTS.md` -> `<primary-entry>`；按任务再读取局部 README、设计文档或调用方。

## 局部边界

- 写明关键代码入口、协议/安全/平台/玩法等不可替代约束。
- 写明哪些变化必须联查哪些调用方、配置或领域文档。
- 仅列出项目特有的运行时或平台验收；完整命令引用 `docs/PROJECT_GUIDE.md`。
