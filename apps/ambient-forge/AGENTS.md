# Ambient Forge · AI 协作入口

## 最小上下文入口

- `AGENTS.md` -> `apps/ambient-forge/AGENTS.md` -> `apps/ambient-forge/docs/PLAN.md` -> `apps/ambient-forge/src/App.tsx`
- 项目指南与完整验证命令以 `docs/PROJECT_GUIDE.md` 为唯一真源。

## 项目边界

- Ambient Forge 是 React 19 + Vite 6 + TypeScript + 直接 Three.js 的独立程序化 3D 环境应用。
- 包名为 `@valley/ambient-forge`，开发端口 `5181`，预览端口 `4181`。
- React 只处理低频产品状态和控制面板；Three.js 与 Web Audio 高频状态留在各自引擎内。
- 当前版本是在七个连续街区中控制固定主角“岚”的第三人称开放小镇；刷新后直接进入角色视角，18 名居民始终保持 NPC 身份，主角可步行、互动并驾驶 9 辆车中的空车。NPC 可自主步行取车、驾驶、泊车、下车并接回职业路线；昼夜、天气、音乐响应和摄影能力收进暂停菜单，不做全镇俯瞰、居民附身或场景选择平台，也不接服务端或真实天气。
- 允许使用免登录、免付费且授权清晰的 CC0 外部 3D 模型与纹理；必须把实际使用文件、来源、版本和许可记录在资产同目录，不提交来源不明素材。
- v0.18 桌面优先；建筑只做外墙与实体碰撞，不做室内、生命值、战斗、联机或刷新后的世界状态持久化。
- 用户本地音频不得上传、持久化文件内容或持久化 Object URL。

## 代码边界

- `src/core`：可测试的输入、昼夜、天气、频谱、质量、偏好、录制、控制权状态机与城镇导航纯逻辑。
- `src/engine`：Three.js 场景、城镇装配、居民/车辆模拟、逐帧更新、可见性降频与完整资源清理。
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
- 1440×900、1024×768 无横向溢出，控制面板与玩家 HUD 可操作；移动端不属于 v0.3 验收范围。
- 复核昼夜、四种天气、音乐三频响应、环境声、全屏、WebM 录制和卸载清理。
- 长期产品状态变化同步 `docs/PLAN.md`；新增项目入口同步根文档。
