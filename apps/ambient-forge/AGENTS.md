# Ambient Forge · AI 协作入口

## 最小上下文入口

- `AGENTS.md` -> `apps/ambient-forge/AGENTS.md` -> `apps/ambient-forge/docs/PLAN.md` -> `apps/ambient-forge/src/App.tsx`
- 项目指南与完整验证命令以 `docs/PROJECT_GUIDE.md` 为唯一真源。

## 项目边界

- Ambient Forge 是 React 19 + Vite 6 + TypeScript + 直接 Three.js 的独立程序化 3D 环境应用。
- 包名为 `@valley/ambient-forge`，开发端口 `5181`，预览端口 `4181`。
- React 只处理低频产品状态和控制面板；Three.js 与 Web Audio 高频状态留在各自引擎内。
- 第一版只实现同一连续世界内可聚焦、可巡游的“浮空群岛天气世界”，不做场景选择平台，也不接服务端、真实天气、外部模型、纹理、字体或音频资产。
- 用户本地音频不得上传、持久化文件内容或持久化 Object URL。

## 代码边界

- `src/core`：可测试的输入、昼夜、天气、频谱、质量、偏好与录制状态纯逻辑。
- `src/engine`：Three.js 场景、逐帧更新、可见性降频与完整资源清理。
- `src/audio`：本地媒体、程序化环境声、分析与录制音轨的 Web Audio 生命周期。
- `src/components`：Canvas 挂载、控制面板、调试层与浏览器能力反馈。

## AI Coding 约束（行为改动默认顺序）

1. 先补齐或更新同目录 Vitest。
2. 先运行受影响测试并确认可观测失败。
3. 再实现行为。
4. 重新运行受影响测试并确认通过。
5. 纯 Three.js 外观用当前 Chrome 会话提供截图、几何、控制台与交互证据。

## 本地 Preflight 约束

- `pnpm --filter @valley/ambient-forge check`
- `pnpm --filter @valley/ambient-forge typecheck`
- `pnpm --filter @valley/ambient-forge test`
- 行为或视觉改动再运行 `pnpm --filter @valley/ambient-forge build` 和当前 Chrome 运行时验收。

## 提测前最小门禁

- 静态检查、类型检查、全量单元测试和生产构建通过。
- 1440×900、1024×768、390×844 无横向溢出，控制面板可操作。
- 复核昼夜、四种天气、音乐三频响应、环境声、全屏、WebM 录制和卸载清理。
- 长期产品状态变化同步 `docs/PLAN.md`；新增项目入口同步根文档。
