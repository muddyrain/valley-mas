# Scratch Legend 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/scratch-legend/AGENTS.md` -> `docs/scratch-legend-task.md` -> `docs/scratch-legend-design.md` -> `lib/game-store.ts`。

## 局部边界

- 玩法、数值、概率、奖励、解锁、Prestige 和阶段状态以设计与任务文档为准；普通 bugfix 不制造任务文档 churn。
- 状态从 `lib/game-config.ts`、`lib/game-save.ts` 与 `lib/game-store.ts` 进入；存档变更必须保持迁移和旧数据恢复路径。
- 刮卡、解锁、动画、响应式与本地持久化改动需取得运行时证据；具体检查命令见 `docs/PROJECT_GUIDE.md`。
