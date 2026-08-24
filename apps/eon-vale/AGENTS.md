# Eon Vale 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/eon-vale/AGENTS.md` -> `CONTEXT.md` -> `docs/GAME_RULES.md` -> `docs/MAP_ARCHITECTURE.md` -> `docs/PLAN.md` -> `src/App.tsx` -> `src/map/session/MapSession.ts`。

## 局部边界

- 地图事实、生成、视觉目录、投影、渲染与会话状态分别从 `src/map/model`、`src/map/generation`、`src/map/visual`、`src/map/projection`、`src/map/render`、`src/map/session` 进入；Pixi 渲染不得成为地图事实的第二写入者。
- 玩法语义与验收规则以 `docs/GAME_RULES.md` 为准；地图架构与替换边界以 `docs/MAP_ARCHITECTURE.md` 为准；长期产品状态记录在 `docs/PLAN.md`。
- 触及 Canvas、Worker、地图交互、渲染或资源图集时补受影响的 Vitest 与浏览器 E2E 证据；性能热路径补 `benchmark`。具体命令见 `docs/PROJECT_GUIDE.md`。
