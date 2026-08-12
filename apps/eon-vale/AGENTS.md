# Eon Vale AI 协作入口

默认使用中文沟通。Eon Vale 是运行在浏览器中的单机正交俯视神明沙盒，默认开发端口为 `5184`，预览端口为 `4184`。产品状态与架构边界见 `docs/PLAN.md`，启动说明见 `README.md`。

## 关键入口

- React 壳层与低频 UI：`src/App.tsx`、`src/ui`。
- PixiJS 8 WebGL 2D 渲染与输入：`src/render/EonValeEngine.ts`。
- Worker 生命周期与协议：`src/worker`。
- 纯模拟核心：`src/simulation/core/worldSimulation.ts`。
- 地图、寻路、经济、王国和存档：`src/simulation/{map,navigation,systems,kingdoms,persistence}`。
- 浏览器验收：`e2e/game.spec.ts`。

## WorldBox 设计参照

- 设计或迭代玩法功能时，先说明 WorldBox 对应系统的实际规则、相关世界法则和关键边界，再明确 Eon Vale 是沿用、简化还是有意采用不同方案；若没有直接对应机制，也要明确说明。
- 需求访谈与方案选择题应包含“WorldBox 怎么做”、该做法解决的问题及其取舍，避免在缺少具体参照时直接决定产品方向。
- 涉及可能随版本变化的 WorldBox 事实时，优先核对官方更新记录或官方 Wiki，并区分已确认规则与基于资料的推断，不凭旧记忆下结论。
- WorldBox 只作为玩法方向参照，不覆盖 Eon Vale 当前计划、架构约束、性能目标和已确认的产品取舍。

## 架构约束

- 20 Hz 固定步长模拟运行在 Web Worker；React 不承载逐帧居民状态。
- Worker 通过可转移 TypedArray 快照向主线程发布状态；PixiJS 在主线程插值并批量提交像素 Sprite。
- 世界使用固定正北的 2D 像素相机；只允许有边界的平移和阶梯缩放，不恢复透视倾斜或自由旋转。
- 居民和建筑共享王国主色，无王国实体使用中性色；职业、建筑类型和动物种类通过局部色与轮廓继续区分。
- 周期地图同步只能增量更新；只有新建或载入完整世界时允许全量重建，避免可见闪烁。
- 导航地图按 `16 × 16` Chunk 组织，渲染地图按 `64 × 64` Chunk 组织。编辑地图时只更新受影响渲染 Chunk，并同步导航版本使旧路径失效。
- 居民、经济、王国、战争与存档逻辑保持纯 TypeScript，可在无 DOM 环境运行测试和性能基准。
- 群体远距离移动优先使用 Flow Field，个体路径使用带预算的 A* 队列；不得为每个单位每帧同步寻路。
- 用户可见文案只描述玩家目标、世界状态和操作结果，不暴露实现说明。

## AI Coding 约束（行为改动默认顺序）

- 行为改动默认按以下顺序执行：
  1. 先补齐或更新同目录测试。
  2. 先运行受影响测试，确认需求断言可观测失败。
  3. 实现改动。
  4. 再运行受影响测试并确认通过。
- 仅文案、纯样式且无可观测行为边界的改动可豁免；交付时说明未测原因与替代验证。

## 本地 Preflight 约束（AI Coding 默认前置）

- 行为改动进入实现前后按风险运行：
  1. `pnpm --filter @valley/eon-vale check`
  2. `pnpm --filter @valley/eon-vale typecheck`
  3. 受影响的 `vitest run <测试文件>`，要求先失败再通过。
- 触及渲染、Canvas、Worker、交互或存档后，补充 `pnpm --filter @valley/eon-vale test:e2e` 或真实 Chrome 验收。
- 触及性能热路径后，补充 `pnpm --filter @valley/eon-vale benchmark`，并至少实测 100/500/1000 居民三档。

## 校验要求 / 提测前最小门禁

- 至少通过 `check`、`typecheck`、`test`、`build`。
- 关键玩法行为需通过浏览器验收，不能仅凭静态代码或截图宣称完成。
- 新增地图、实体、文明或神力行为时，应有确定性种子测试；存档模型变化时必须更新版本校验和读写往返测试。
- 修改长期产品状态、架构、性能基线或验收标准时，同步 `docs/PLAN.md`。
