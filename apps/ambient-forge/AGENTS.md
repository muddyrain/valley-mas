# Ambient Forge 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/ambient-forge/AGENTS.md` -> `docs/PLAN.md` -> `src/App.tsx`。

## 局部边界

- 场景状态与输入映射位于 `src/core`，Three.js 生命周期位于 `src/engine`，音频生命周期位于 `src/audio`。
- 昼夜、天气、音乐响应、环境声或 WebM 导出改动需取得对应浏览器运行证据；长期产品状态才同步 `docs/PLAN.md`。
- 具体检查命令见 `docs/PROJECT_GUIDE.md`。
