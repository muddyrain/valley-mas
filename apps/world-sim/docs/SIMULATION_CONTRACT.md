# WorldSim - 模拟合同

> 版本：v0.1 · 日期：2026-05-15  
> 这份文档定义 tick、命令、事件、确定性和系统执行顺序。

## 1. 基本原则

- 单一主循环
- 先收命令，后统一结算
- 规则执行和 UI 渲染解耦
- 同一输入在同一 seed 下应尽量可复现

## 2. Tick 顺序

v0.1 固定顺序：

1. 读取玩家输入和神力命令
2. 收集 AI 决策命令
3. 统一执行命令队列
4. 运行系统 tick
5. 产出事件
6. 刷新可视层投影

M0/M1 实现必须遵守这个顺序。后续如果要调整，先更新本文件，再改 `SimLoop`。

## 3. 命令模型

命令应描述“想做什么”，不是“已经发生什么”。

- `Move`
- `Build`
- `Attack`
- `Harvest`
- `Spawn`
- `CastPower`
- `ChangeTerrain`
- `DeclareWar`

命令必须能被拒绝、延迟或降级。

v0.1 最小命令字段：

```ts
type SimCommand = {
  id: string;
  type: string;
  actorId?: string;
  targetId?: string;
  payload: Record<string, unknown>;
  issuedAtTick: number;
};
```

## 4. 事件模型

事件用于记录和传播结果。

- 事件不直接作为规则真源
- 事件可以驱动日志、音效、动画、统计
- 事件应带时间戳、来源、目标、结果摘要

v0.1 最小事件字段：

```ts
type SimEvent = {
  id: string;
  type: string;
  tick: number;
  sourceId?: string;
  targetId?: string;
  payload: Record<string, unknown>;
};
```

## 4.1 Projection 模型

Projection 是模拟状态给渲染层看的只读快照。

- `WorldScene` 只读 Projection，不直接改领域对象
- UI 交互只能产生 Command
- Projection 可以丢帧刷新，但模拟 tick 不能丢
- Projection 字段不进入存档，存档只保存领域状态

## 5. 确定性规则

- 随机数统一走可控随机源
- 同一局的关键系统尽量使用同一 seed
- Worker 输出若影响结果，必须可重放
- 不确定的外部输入要显式隔离

## 6. 系统执行顺序

v0.1 固定系统顺序：

1. `TimeSystem`
2. `ResourceSystem`
3. `BuildSystem`
4. `ReproductionSystem`
5. `CombatSystem`
6. `DiplomacySystem`
7. `EventSystem`

后续如果要调整顺序，先更新本文件，再改对应系统实现。

## 7. 失败处理

- 命令失败必须可观察
- 系统异常必须降级而不是悄悄吞掉
- 重要失败要落事件日志
- 与存档有关的失败要同步写入版本信息

## 8. 变更要求

当下列任一内容变化时，优先改这份文档：

- tick 顺序
- 命令类型
- 事件字段
- 随机源策略
- 系统间依赖
