# Eon Vale 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/eon-vale/AGENTS.md` -> `CONTEXT.md` -> `docs/GAME_RULES.md` -> `docs/PLAN.md` -> `src/App.tsx` -> `src/render/EonValeEngine.ts`。

## 规则与架构真源

- `docs/GAME_RULES.md` 定义玩法语义、默认值、阈值、例外和验收；`docs/PLAN.md` 只记录交付状态、架构与性能基线。
- 世界规则从 `src/simulation/rules/worldLawCatalog.ts` 和 `src/simulation/core/worldSimulation.ts` 进入；渲染不得成为玩法状态的第二写入者。
- 触及渲染、Canvas、Worker、交互或存档时补 E2E/浏览器证据；性能热路径补 benchmark，并实测 100、500、1000 居民。具体命令见 `docs/PROJECT_GUIDE.md`。
