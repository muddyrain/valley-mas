# Toy Climb Arena · AI 协作入口

本文件是 AI 在 `apps/toy-climb-arena` 目录内工作的局部协作入口。  
全局规则、skill 选择和 Git 约定仍以根目录 `AGENTS.md` 为准。

## ⚠️ 强制阅读要求

**在修改本 app 内任何代码或文档之前，AI 必须先阅读以下文件：**

1. `docs/GAME_DESIGN.md` — 游戏定位、美术主题、阶段规划
2. `docs/LEVEL_DESIGN_RULES.md` — 关卡设计约束和技术规格
3. `docs/TASKS.md` — 当前任务状态和里程碑列表

不阅读上述文件直接修改代码属于**违反协作约定**。

---

## 项目概述

- **名称：** 玩具世界攀爬（Toy Climb Arena）
- **类型：** Vite + TypeScript + Three.js 独立 app
- **端口：** `5175`（开发模式）
- **启动：** `pnpm dev`（在本目录下）或 `pnpm --filter @valley/toy-climb-arena dev`

---

## 目录结构

```
apps/toy-climb-arena/
├── src/                        # 游戏源码（由旧游戏包迁移而来）
│   ├── main.tsx                # Vite 入口
│   ├── ClimberArcadeExperience.tsx  # 主游戏组件（Three.js + React）
│   ├── characterAssets.ts      # 角色模型 URL 注册
│   ├── characterRig.ts         # 角色动画状态机
│   ├── climberLevels.ts        # 关卡定义
│   ├── climberPhysics.ts       # 物理/碰撞系统
│   ├── createClimberPrototype.ts    # 游戏控制器创建
│   ├── setpieceCatalog.ts      # 障碍物资源目录
│   ├── types.ts                # TypeScript 类型定义
│   ├── levels/                 # 关卡数据
│   └── prototype/              # 碰撞、运行时工具
├── assets/
│   └── models/
│       ├── characters/         # 角色 GLB 模型
│       └── setpieces/          # 障碍物 GLB 模型
├── docs/
│   ├── GAME_DESIGN.md          # ← 必读
│   ├── LEVEL_DESIGN_RULES.md   # ← 必读
│   ├── TASKS.md                # ← 必读
│   └── ASSET_GUIDE.md          # 资源登记
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 局部规则

### 代码修改
- 修改游戏逻辑前，先确认 `docs/TASKS.md` 中对应里程碑是否已就绪
- 不要在未完成 v0.1 工程稳定前添加 v0.2+ 的复杂视觉/网络功能
- 主游戏组件 `ClimberArcadeExperience.tsx` 已经超过 1500 行，修改前优先考虑拆分

### 资源修改
- 新增或删除模型文件必须同步更新 `docs/ASSET_GUIDE.md`
- 新增 setpiece 必须在 `setpieceCatalog.ts` 中注册

### 关卡修改
- 所有关卡改动必须符合 `docs/LEVEL_DESIGN_RULES.md` 的规格
- 修改后需确认 `ClimberJumpClearanceReport` 无高风险问题

### 美术主题
- 所有视觉改动须符合玩具世界美术方向（详见 `docs/GAME_DESIGN.md`）
- 禁止复制其他游戏的模型或布局

---

## 校验命令

```bash
# 类型检查
pnpm --filter @valley/toy-climb-arena typecheck

# 代码检查
pnpm --filter @valley/toy-climb-arena check

# 构建
pnpm --filter @valley/toy-climb-arena build
```
