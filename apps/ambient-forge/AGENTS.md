# Ambient Forge 协作入口

适用于 `apps/ambient-forge`，交互环境与音频实验。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 范围或当前计划 | [说明](README.md)、[计划](docs/PLAN.md) |
| 场景状态或输入 | [应用](src/App.tsx)、[场景状态](src/core) |
| Three.js 渲染或生命周期 | [引擎](src/engine) |
| 音乐、环境声或生命周期 | [音频](src/audio) |

## 关键约束

场景状态、渲染与音频保持各自生命周期；停止和切换场景时释放对应资源。

## 验证与文档

昼夜、天气、音乐响应、环境声和 WebM 导出验证对应浏览器行为；命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。长期产品范围或状态变化更新计划。
