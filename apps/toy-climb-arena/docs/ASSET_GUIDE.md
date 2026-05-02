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

### 运行时平台模型

| 生成器 | 适用对象 | 描述 | 版权状态 |
|---|---|---|---|
| `src/prototype/toyPlatformVisuals.ts` | `level.platforms` | 原创程序化玩具平台模型：积木凸点、边框、拼接缝、机关标识、冰面高光、终点装饰 | 项目内部原创 |
| `src/platformCatalog.ts` | `level.platforms[].toyProfile` | 平台资产与机制字典：类型、主题区域、难度层级、机制标签、视觉变体 | 项目内部原创 |
| `src/platformModelAssets.ts` | `assets/models/platforms/*.glb` | 第一批可复用平台实体模型登记：S1 方形板、S2 圆盘、S3 窄踏板 | 项目内部原创 |
| `src/prototype/platformModelRuntime.ts` | `level.platforms` | 按平台类型加载 GLB 实体模型，并从模型部件生成复合碰撞体，避免空气墙和穿模 | 项目内部原创 |

> 当前主地图多数可攀爬平台来自 `level.platforms`，不是 GLB setpiece。GLB 平台会先使用原 `level.platforms` 盒体作为加载期 fallback，模型加载完成后切换到模型部件级复合碰撞体。

### 平台实体模型（GLB）

| 文件 | ID | 描述 | 推荐用途 |
|---|---|---|---|
| `assets/models/platforms/toy_square_plate_s1.glb` | `toy_square_plate_s1` | 谷仓玩具箱跳跃模块实体模型，含木箱侧板、稻草/软垫顶面、一体化边框和角钉 | 主路径平台、缓冲台 |
| `assets/models/platforms/toy_round_disc_s2.glb` | `toy_round_disc_s2` | 圆形纽扣盘实体模型，含圆柱主体、环形边、中心帽和径向凸点 | 精准落点、圆盘过渡 |
| `assets/models/platforms/toy_narrow_plank_s3.glb` | `toy_narrow_plank_s3` | 窄长踏板实体模型，含长条主体、护边、横档和节奏标记 | 连续窄桥、节奏跳 |
| `assets/models/platforms/toy_barn_hay_bale.glb` | `toy_barn_hay_bale` | 草垛跳跃模块，含捆绳、稻草纹路和柔软顶面 | 谷仓热身主路径 |
| `assets/models/platforms/toy_wood_crate_step.glb` | `toy_wood_crate_step` | 木箱阶梯跳跃模块，含双层箱体和木条边框 | 开局高度递进、喘息台 |
| `assets/models/platforms/toy_barrel_round_top.glb` | `toy_barrel_round_top` | 木桶圆顶落点模块，含桶箍、圆顶和侧向板条 | 精准圆形落点 |
| `assets/models/platforms/toy_rope_plank_bridge.glb` | `toy_rope_plank_bridge` | 绳索木桥踏板模块，含分段木板和两侧绳索 | 窄桥、移动平台、节奏跳 |
| `assets/models/platforms/toy_broken_puzzle_piece.glb` | `toy_broken_puzzle_piece` | 破碎拼图落点模块，含错位碎片和中心安全色块 | 不规则碎片、崩塌平台 |
| `assets/models/platforms/toy_crumble_cookie_tile.glb` | `toy_crumble_cookie_tile` | 酥饼碎裂倒计时平台，含饼干主体、警示裂纹和巧克力碎片 | 延迟下沉/消失平台 |
| `assets/models/platforms/toy_trampoline_pad.glb` | `toy_trampoline_pad` | 弹力垫跳跃模块，含软垫面、框架和角部弹簧 | 蹦床、弱弹跳垫 |

生成命令：`pnpm --filter @valley/toy-climb-arena generate:platform-assets`。

> 说明：这批 GLB 是文件级实体资产，已经通过 `platformModelRuntime.ts` 接入 S1-S3 静态平台渲染。后续新增 S4+ 或动态机关 GLB 时，应继续走同一登记与加载路径。

### GLB Setpieces

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
