# 任务列表 · TASKS

本文件追踪 Toy Climb Arena 的开发任务。  
完成的任务用 `[x]` 标记，待办用 `[ ]`，进行中用 `[~]`。

> 任务文档职责见 `docs/TASK_DOCS_INDEX.md`。本文件是当前唯一主任务入口；0.8 的详细拆解维护在 `docs/TOY_CLIMB_PLATFORM_REMAKE_TASKS.md`。

---

## 里程碑 0.1 — 工程迁移（当前）

- [x] 从 `packages/climber-game` 迁移源码到 `apps/toy-climb-arena`
- [x] 配置 Vite + TypeScript 独立工程
- [x] 保留角色模型（peach.glb / daisy.glb）
- [x] 保留 Mixamo idle/run/jump 动画逻辑（在 characterRig.ts 中）
- [x] 保留现有物理碰撞系统（climberPhysics.ts）
- [x] 保留现有控制逻辑（ClimberArcadeExperience）
- [x] 保留 setpieces 资源（barrel_tower, beam_hazard 等 11 个）
- [x] 初始化 docs/GAME_DESIGN.md
- [x] 初始化 docs/LEVEL_DESIGN_RULES.md
- [x] 初始化 docs/TASKS.md
- [x] 初始化 docs/ASSET_GUIDE.md
- [x] 添加 AGENTS.md

---

## 里程碑 0.2 — 玩具世界视觉改造

- [x] 替换场景背景颜色为暖白（#FFF9F0）+ FogExp2 轻雾
- [x] 为地面添加暖木色拼接地板（#C8934A / #B07D3A）
- [x] 调整 AmbientLight / DirectionalLight 为暖色调（暖黄光 + 冷蓝补光）
- [x] 为所有平台添加乐高凸点装饰（CylinderGeometry，按表面格数排列）
- [x] 添加 12 个彩色散落积木地面装饰（无碰撞）
- [x] HUD 界面玩具化改造（圆角、鲜艳配色、卡通字体）
- [x] 添加背景装饰元素（远景玩具城市轮廓/彩色积木堆）

---

## 里程碑 0.3 — 关卡机制

- [x] 移动平台（4个，sin 往复，碰撞体实时同步，凸点跟随）
- [x] 弹跳板（2个，粉色，boostVelocity，压缩-弹出动画）
- [x] 不稳定平台（3个，idle→shaking→falling→resetting 状态机）
- [x] 存档点系统（首次触达闪烁 + 重生位置更新）
- [x] 落地粒子（黄色，22颗，0.4s 淡出）
- [x] 存档点激活粒子（蓝色，30颗，球形爆发，0.6s 淡出）
- [x] **运行时浏览器全流程验收**（攀爬/弹跳/不稳定/存档/通关）
- [x] **核心方向定型：无存档点，掉落归零（《攀爬动物》风格）**
- [x] 去掉存档点，改为掉落归零重置（验收后依据体感调整平台间距/机制密度）
- [ ] 跳跃/落地/通关粒子进一步细化（拖尾、颜色多样化）

---

## 里程碑 0.4 — 音效与氛围

- [x] BGM 背景音乐循环（C大调合成循环，triangle 波，Web Audio API）
- [x] 补充音效：弹跳板弹起（playBounce）、不稳定平台坠落（playUnstableFall）
- [x] 存档点激活专属音效（playCheckpoint）
- [x] 通关庆典音效强化

---

## 里程碑 0.5 — 新角色与选择界面

- [ ] 调研玩具风格角色模型（CC0 授权）
- [ ] 制作或采购玩具人偶角色 GLB 模型
- [x] 集成新角色（木偶，程序化，无需 GLB，含跑/跳/落地动画）
- [ ] 新增角色选择界面（当前靠快捷键切换，待做独立 UI）

---

## 里程碑 0.6 — 多人框架

- [ ] 设计多人网络架构（WebSocket / WebRTC）
- [ ] 实现本地多人（同屏分屏）原型
- [ ] 实现远程玩家位置同步（幽灵模式）
- [ ] 房间系统：创建/加入房间
- [ ] 简单排行榜展示

---

## 里程碑 0.7 — 关卡编辑器

- [ ] 设计关卡编辑 DSL
- [ ] 实现可视化关卡编辑器（Three.js 内嵌）
- [ ] 支持关卡导出/导入 JSON
- [ ] 社区关卡分享功能

---

## 里程碑 0.8 — 玩具风平台与关卡重制

详细拆解见 `docs/TOY_CLIMB_PLATFORM_REMAKE_TASKS.md`。

- [x] 建立平台资产与机制字典（静态 / 动态 / 功能 / 攀爬辅助 / 主题组合）
- [~] 拆分并扩展程序化玩具平台模型生成器
- [~] 补齐静态基础平台资产变体（S1-S3 已完成，S4-S6 待做）
- [x] 建立平台实体 GLB 资产链路（S1-S3 已生成并接入主地图加载器）
- [~] 重制谷仓玩具区 0-26m 垂直切片（草垛 / 木箱 / 木桶 / 绳桥 / 拼图碎片 / 弹力垫）
- [~] 补齐摇晃 / 伸缩 / 倾斜 / 粘性 / 攀爬墙 / 绳索 / 梯子机制（摇晃、伸缩、倾斜、忽隐忽现第一批动态机关已接入）
- [~] 重构四大主题区域：谷仓玩具区、城堡积木区、高空岛屿区、奥林匹斯玩具云巅
- [~] 新建玩具风重制主地图并按 25m → 60m → 100m 切片验收
- [~] 大场景空间重排：把 0-60m 从单线跳点改成宽幅立体平台群，增加接落层、横向岛组和失败回收路径
- [~] 模型精修升级：把平台模块从单块模型升级为区域场景物件组合，优先优化谷仓和城堡区视觉丰富度
- [~] 功能平台第一批：传送带、冰块、粘性垫、小弹跳垫、崩塌变体已生成 GLB 并插入主地图

---

---

## 里程碑 0.9 — 大规模模型扩产 + 场景面积扩张

> 目标：将关卡总高度从 100m 扩展到 500m（第一阶段），最终达 800m+；  
> 横向范围随区域递增（谷仓±40m → 城堡±60m → 天空±90m → 奥林匹斯±120m）；  
> 消除"掉落直接到底"的问题，通过大型场景件 + 宽幅接落层实现立体化关卡空间。  
> 详细模型清单维护在 `docs/MODEL_PRODUCTION_TASKS.md`。

### 模型设计规范（所有新模型必须遵守）

- **整体风格**：玩具质感（Toy Style），类似高端收藏玩具；风格化卡通，细节精致，不低幼
- **材质**：PBR 材质；完整贴图 BaseColor / Normal / Roughness / Metallic；建议 2K～4K
- **表面质感**：轻微反光、柔和高光；避免廉价塑料感；增加细微表面变化与细节
- **输出**：单 GLB 文件；模型面向 Z 轴；无多余空节点、无脏数据；可直接用于游戏

### 批次 1 — 谷仓区扩产（优先）

**目标：谷仓区从 15 种增至 39 种（+24 个）**

小件踏台（+17）：

- [ ] `toy_barn_milk_bottle` — 牛奶瓶组台
- [ ] `toy_barn_carrot_bundle` — 胡萝卜把台
- [ ] `toy_barn_sunflower_disc` — 向日葵圆台
- [ ] `toy_barn_egg_tray` — 鸡蛋托盘台
- [ ] `toy_barn_pig_bank` — 小猪存钱罐台
- [ ] `toy_barn_flower_pot` — 花盆跳台
- [ ] `toy_barn_mushroom_pad` — 蘑菇垫台
- [ ] `toy_barn_corn_cob` — 玉米棒台
- [ ] `toy_barn_watering_can` — 水壶台
- [ ] `toy_barn_straw_hat` — 稻草帽盘台
- [ ] `toy_barn_apple_basket` — 苹果篮台
- [ ] `toy_barn_ladder_plank` — 木梯桥（长条）
- [ ] `toy_barn_spinning_wheel` — 纺车圆台（旋转机关）
- [ ] `toy_barn_bucket_stack` — 水桶堆台（崩塌机关）
- [ ] `toy_barn_swing_plank` — 荡秋千板（摆动机关）
- [ ] `toy_barn_beehive_dome` — 蜂巢圆台
- [ ] `toy_barn_cuckoo_clock` — 布谷钟台（升降机关）

大型场景件（+7，20-60m 量级）：

- [ ] `toy_barn_house_big` — 玩具农舍主体（40×30×35m），侧壁含踏点
- [ ] `toy_barn_silo_tower` — 粮仓圆筒塔（φ12×45m），螺旋外梯可攀
- [ ] `toy_barn_hay_stack_xl` — 巨型草垛（18×18×22m），多层跳台
- [ ] `toy_barn_tractor_toy` — 玩具拖拉机（25×15×20m），车身踏台+轮子跳板
- [ ] `toy_barn_fence_wall` — 农场长围栏（60×2×5m），横向移动轨道
- [ ] `toy_barn_water_tank` — 木质水塔（φ10×25m），跨越空洞必经踏台
- [ ] `toy_barn_windmill` — 玩具风车（φ20×40m，含叶片），旋转叶片为动态阻碍

### 批次 2 — 城堡区扩产

**目标：城堡区从 15 种增至 42 种（+27 个）**

小件踏台（+20）：

- [ ] `toy_castle_sword_tile` — 宝剑台
- [ ] `toy_castle_candle_pillar` — 蜡烛柱台
- [ ] `toy_castle_magic_ball` — 魔法水晶球台
- [ ] `toy_castle_chess_king` — 国王棋子台
- [ ] `toy_castle_chess_pawn` — 士兵棋子台（窄）
- [ ] `toy_castle_scroll_bridge` — 卷轴桥
- [ ] `toy_castle_flag_pole` — 旗帜柱台（窄高）
- [ ] `toy_castle_goblet_stand` — 圣杯台
- [ ] `toy_castle_armor_stand` — 骑士盔甲台
- [ ] `toy_castle_catapult_arm` — 投石臂台（旋转机关）
- [ ] `toy_castle_portcullis_gate` — 闸门横梁（升降机关）
- [ ] `toy_castle_torch_disc` — 火把圆台
- [ ] `toy_castle_anvil_block` — 铁砧台
- [ ] `toy_castle_spell_book` — 魔法书台（忽隐机关）
- [ ] `toy_castle_poison_bottle` — 毒瓶台（崩塌机关）
- [ ] `toy_castle_cage_platform` — 铁笼台（移动机关）
- [ ] `toy_castle_mirror_tile` — 镜面冰砖台（滑动）
- [ ] `toy_castle_bone_bridge` — 骨头桥（长条）
- [ ] `toy_castle_crown_disc` — 皇冠圆盘（旋转机关）
- [ ] `toy_castle_knight_shield_xl` — 大盾牌跳台

大型场景件（+7）：

- [ ] `toy_castle_tower_xl` — 城堡主楼（20×20×60m），螺旋外墙踏台
- [ ] `toy_castle_wall_segment` — 城墙段（50×4×15m），墙顶为横向通路
- [ ] `toy_castle_drawbridge_xl` — 巨型吊桥（30×6×4m），伸缩/摆动动态
- [ ] `toy_castle_gate_arch` — 城门拱门（16×4×20m），穿越点+悬挂踏台
- [ ] `toy_castle_barrel_stack` — 巨型桶堆（15×15×25m），不规则踏台群
- [ ] `toy_castle_dragon_toy` — 玩具龙雕像（30×20×35m）★标志性地标，背/翅可站
- [ ] `toy_castle_catapult_big` — 大型投石机（20×8×18m），踩臂弹射

### 批次 3 — 高空岛屿区扩产

**目标：天空区从 5 种增至 26 种（+21 个）**

小件踏台（+15）：

- [ ] `toy_sky_balloon_disc` — 气球圆台
- [ ] `toy_sky_cloud_puff_small` — 小云朵台
- [ ] `toy_sky_gear_platform` — 飞行齿轮台
- [ ] `toy_sky_compass_dial` — 罗盘圆台（旋转）
- [ ] `toy_sky_kite_plank` — 风筝形窄台
- [ ] `toy_sky_propeller_disc` — 螺旋桨圆台（旋转）
- [ ] `toy_sky_parachute_drop` — 降落伞悬台（移动）
- [ ] `toy_sky_lightning_tile` — 闪电形台（忽隐）
- [ ] `toy_sky_thundercloud_crumble` — 积雨云崩塌台
- [ ] `toy_sky_moon_tile` — 月牙形台
- [ ] `toy_sky_rainbow_step` — 彩虹台阶段
- [ ] `toy_sky_wind_turbine_blade` — 风叶旋转台
- [ ] `toy_sky_ice_comet` — 冰彗星台（滑动）
- [ ] `toy_sky_energy_ring` — 能量光环台（旋转）
- [ ] `toy_sky_star_cluster` — 星团小台

大型场景件（+6）：

- [ ] `toy_sky_floating_island_xl` — 浮空大岛（50×8×40m）★地标，含小树/石头装饰
- [ ] `toy_sky_cargo_crate_stack` — 金属集装箱堆（12×12×30m），多层跳台
- [ ] `toy_sky_crystal_tower` — 水晶塔楼（φ8×50m），螺旋踏点+内部空洞
- [ ] `toy_sky_satellite_dish` — 科幻天线盘（φ30×15m），弧面滑坡+中心高点
- [ ] `toy_sky_airship_toy` — 玩具飞艇（40×14×18m）★地标，气囊顶跑道+舱体侧台
- [ ] `toy_sky_chain_bridge` — 悬链桥（60×4×2m），摆动动态长桥

### 批次 4 — 奥林匹斯区扩产

**目标：奥林匹斯区从 4 种增至 23 种（+19 个）**

小件踏台（+14）：

- [ ] `toy_olympus_laurel_disc` — 月桂叶圆台
- [ ] `toy_olympus_column_cap` — 柱头台
- [ ] `toy_olympus_shield_disc` — 雅典娜盾台（旋转）
- [ ] `toy_olympus_lightning_step` — 闪电踏台
- [ ] `toy_olympus_nectar_cup` — 神酒杯台（弹跳）
- [ ] `toy_olympus_olive_branch` — 橄榄枝桥（窄）
- [ ] `toy_olympus_sun_disc` — 太阳神圆盘（旋转+移动）
- [ ] `toy_olympus_pegasus_wing` — 飞马翅膀台
- [ ] `toy_olympus_amphora_vase` — 双耳陶瓮台（崩塌）
- [ ] `toy_olympus_harp_plank` — 竖琴形桥（忽隐）
- [ ] `toy_olympus_trident_post` — 三叉戟柱台（窄）
- [ ] `toy_olympus_moon_chariot` — 月神战车台（移动）
- [ ] `toy_olympus_thunder_drum` — 雷鼓台（弹跳）
- [ ] `toy_olympus_victory_star` — 胜利星台（终点特效）

大型场景件（+5）：

- [ ] `toy_olympus_temple_xl` — 希腊神庙主体（40×25×30m）★地标，台阶+柱廊+屋顶踏台
- [ ] `toy_olympus_colosseum_ring` — 竞技场环形墙（φ60×20m）★地标，环形外墙踏台
- [ ] `toy_olympus_pegasus_toy` — 玩具飞马（25×15×28m），翅膀跳板+背部平台
- [ ] `toy_olympus_lightning_bolt` — 巨型闪电柱（4×4×80m），垂直穿越核心
- [ ] `toy_olympus_cloud_palace` — 云端宫殿群（80×40×30m）★终点地标

### 模型总量统计

| 批次 | 区域 | 已有 | 新增 | 完成后合计 |
|---|---|---|---|---|
| 批次1 | 谷仓区 | 15 | 24 | 39 |
| 批次2 | 城堡区 | 15 | 27 | 42 |
| 批次3 | 高空区 | 5 | 21 | 26 |
| 批次4 | 奥林匹斯 | 4 | 19 | 23 |
| 通用/功能 | — | 9 | 0 | 9 |
| **总计** | | **48** | **91** | **139** |

---

## 已知技术债务

- [x] createClimberPrototype.ts 拆分：particleSystem.ts + groundScene.ts（2485→2156 行）
- [ ] setpieceCatalog.ts 硬编码资源路径，需改为动态注册
- [ ] characterAssets.ts 中 fallback URL 列表需清理
- [x] 音频系统（prototypeAudio.ts）音效内容待丰富（不稳定平台晃动音效）
