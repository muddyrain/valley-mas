# Toy Climb Arena 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/toy-climb-arena/AGENTS.md` -> `docs/TASKS.md` -> `src/main.tsx`。

## 局部边界

- 玩法与关卡任务从 `docs/TASKS.md` 进入；资源、关卡规则和总地图再按需读取 `docs/ASSET_GUIDE.md`、`docs/LEVEL_DESIGN_RULES.md`、`docs/GRAND_MAP_DESIGN.md`。
- 新关卡先检查 `src/climberLevels.ts`、`src/levels/`、`src/level/LevelBuilder.ts` 与对应状态、HUD、测试；不得把物理或关卡规则写入纯表现层。
- 资源生成、物理或关卡改动补实际游玩验证；具体检查命令见 `docs/PROJECT_GUIDE.md`。
