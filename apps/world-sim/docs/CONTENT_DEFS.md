# WorldSim - 内容定义规范

> 版本：v0.1 · 日期：2026-05-15  
> 这份文档定义“可配置内容”如何写，目标是后续加内容尽量只改数据。

## 1. 内容范围

- 种族
- 职业
- 建筑
- 神力
- 地形
- 事件
- 世界阶段

## 2. 配置原则

- 内容定义和系统逻辑分开
- 所有数值字段尽量集中
- 同一类内容使用统一字段名
- 允许扩展，不要把字段写死在 UI 文案里

## 3. 建议结构

### 3.1 Race

- `id`
- `name`
- `color`
- `baseStats`
- `behaviorTags`
- `growthModifiers`

### 3.2 Job

- `id`
- `name`
- `unlockConditions`
- `priority`
- `speedModifier`

### 3.3 Building

- `id`
- `name`
- `size`
- `cost`
- `hp`
- `unlockConditions`
- `territoryRadius`

### 3.4 GodPower

- `id`
- `name`
- `cost`
- `targetType`
- `cooldown`
- `effect`

### 3.5 EventTemplate

- `id`
- `weight`
- `triggers`
- `payload`
- `effects`
- `logText`

## 4. 数据校验

- 所有配置都要过校验
- 缺字段应在启动时暴露，而不是运行到一半再报错
- 数值范围要有上限和下限

v0.1 约束：

- 配置以 TypeScript object 形式放入 `src/config/`
- 每类配置都要有同名 schema 校验文件
- 推荐优先使用 `zod` 或等价运行时 schema 库
- `raceDefs`、`buildingDefs`、`godPowerDefs`、`terrainDefs` 必须在启动时统一 validate
- 校验失败时阻止进入游戏主场景，并输出可读错误

示例结构：

```txt
src/config/
├── races.ts
├── buildings.ts
├── godPowers.ts
├── terrains.ts
└── validators.ts
```

示例原则：

```ts
const raceDefs = {
  human: {
    name: "人类",
    baseStats: { hp: 100, vitality: 100, speed: 1 },
    behaviorTags: ["balanced", "diplomatic"],
  },
};
```

## 5. 本地化

- 文本展示和内容 ID 分离
- 文案可以改，ID 不要随便改
- 面向 UI 的显示名不要作为逻辑判断依据

## 6. 迁移规则

- 新增内容优先加配置
- 删除内容必须标记弃用期
- 改字段名时优先保留旧别名

## 7. 禁止事项

- 不在 Scene、State、System 内硬编码种族、建筑、神力数值
- 不用显示文案作为逻辑 ID
- 不在多个文件重复定义同一数值
