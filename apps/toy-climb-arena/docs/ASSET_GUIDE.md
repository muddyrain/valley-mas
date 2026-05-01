# 资源指南 · Asset Guide

本文件登记 Toy Climb Arena 所有游戏资源，包括模型、纹理、音效和动画。  
新增或修改资源时必须在本文件更新登记。

---

## 角色模型

| 文件 | 角色ID | 显示名 | 来源 | 版权状态 |
|---|---|---|---|---|
| `assets/models/characters/peach.glb` | `peach` | 碧姬 | 原创制作 | 项目内部 |
| `assets/models/characters/daisy.glb` | `daisy` | 黛西 | 原创制作 | 项目内部 |

### 角色动画（Mixamo）

当前角色模型包含以下 Mixamo 动画 clip（在 GLB 内嵌）：

| 动画状态 | 描述 |
|---|---|
| `idle` | 待机呼吸循环 |
| `run` | 跑步循环 |
| `stop` | 急停 |
| `jump` | 起跳 |
| `fall` | 空中下落 |
| `land` | 落地缓冲 |

> **注意：** Mixamo 动画用于非商业/原型开发阶段。商业上线前须替换为自有授权动画。

---

## 场景 Setpieces（障碍物单元）

| 文件 | ID | 描述 | 推荐使用阶段 |
|---|---|---|---|
| `assets/models/setpieces/stepping_stone.glb` | `stepping_stone` | 小型踏石 | 热身段 |
| `assets/models/setpieces/plank_long.glb` | `plank_long` | 长木板 | 全段 |
| `assets/models/setpieces/ramp_wedge_v2.glb` | `ramp_wedge_v2` | 斜坡楔块 | 挑战段 |
| `assets/models/setpieces/beam_hazard.glb` | `beam_hazard` | 横梁障碍 | 挑战段/冲刺段 |
| `assets/models/setpieces/barrel_tower.glb` | `barrel_tower` | 桶形塔 | 视觉遮挡 |
| `assets/models/setpieces/crate_tall.glb` | `crate_tall` | 高箱子 | 视觉遮挡 |
| `assets/models/setpieces/cliff_block.glb` | `cliff_block` | 悬崖块 | 挑战段 |
| `assets/models/setpieces/rock_slab.glb` | `rock_slab` | 石板 | 挑战段 |
| `assets/models/setpieces/container_long.glb` | `container_long` | 长集装箱 | 全段 |
| `assets/models/setpieces/container_short.glb` | `container_short` | 短集装箱 | 全段 |
| `assets/models/setpieces/pipe_long.glb` | `pipe_long` | 长管道 | 挑战段 |

---

## 音效（待规划）

目前无音效资源。音频系统位于 `src/prototypeAudio.ts`，待 v0.2 阶段集成。

计划音效类型：
- 跳跃音效（弹簧/弹力玩具风格）
- 落地音效（软落感）
- 背景音乐（轻松玩具风格 BGM）
- 胜利/失败音效

---

## 资源规范

- 模型格式：**GLB**（GLTF binary），推荐 Draco 压缩
- 纹理分辨率：最大 1024×1024（setpieces），角色最大 2048×2048
- 多边形预算：每个 setpiece ≤ 2000 tri，角色 ≤ 8000 tri
- 所有新资源须满足商用授权要求（CC0、CC-BY 或自有版权）

---

## 资源加载方式

```typescript
// 角色模型通过 characterAssets.ts 管理
import { CHARACTER_MODEL_URLS } from './characterAssets';

// Setpiece 通过 setpieceCatalog.ts 统一注册
import { getClimberSetPieceAsset } from './setpieceCatalog';
```
