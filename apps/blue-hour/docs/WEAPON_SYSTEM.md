# 第一阶段正式武器系统

2026-09-12。源码、专项验证、Windows build 与独立程序验证均已完成。此次范围是武器数据、实例库存、装备、界面、存档与战斗。地图和统一角色骨骼的并行改动不是本报告的交付内容。

## 架构与入口

- [WeaponDefinition](../data/weapon_data.gd)：独立 Resource，不属于 Item/Skill。基础数值、类型、图标/模型路径、动画分类、散布、穿透、击退与品质均在此声明。
- [WeaponRegistry](../data/weapon_registry.gd)：只注册八把正式模板，并集中处理四个旧 ID 的兼容映射。
- [WeaponInstance](../weapons/weapon_instance.gd)：真正持有的个体，含 `instance_id`、`weapon_definition_id`、`rarity`、`modifiers`。沿用旧存档键 `uid` / `kind` 序列化前两项，没有重复持久化两个 ID 来源。`affix` 仅保留旧档词条效果。
- [WeaponInventory](../weapons/weapon_inventory.gd)：复用 Campaign 的 `data.inventory`，提供 `add_weapon/remove_weapon/has_weapon/get_weapon/get_all_weapons`。拥有清单包含已装备个体，`get_all_weapons(true)` 返回可以分配的库存；不建立第二个 InventoryManager。
- [Campaign](../core/campaign.gd)：`data.equipment[member_id]` 是成员唯一主武器槽，值为个体 ID 或空字符串。`equip_weapon/unequip_weapon/get_equipped_weapon` 负责分配；旧 `equip` 是兼容入口。转交时释放原持有人，被替换的武器留在可用库存，同一个实例只能有一名持有人。夏知遥初始 P9，苏晚星初始短刀。
- [Equipment](../core/equipment.gd)：生成个体、校验字段、将实例词条应用到模板副本；旧词条继续按旧规则解释。普通/精良/稀有/特殊生成 0/1/2/3 个不重复词条，近战排除弹匣、换弹及精准词条。
- [WeaponModifiers](../weapons/weapon_modifiers.gd)：六条初始词条的数据表及 stat/factor 运算。弹匣乘算后向上取整、精准度封顶 1；道具/技能继续使用既有 EffectModifiers，在武器派生属性上叠加。

## 八把武器在哪里调整

以下文件是对应武器基础属性的唯一真源。ID 与文件主名一致（ID 大写）。默认普通品质。Phase 2A 已为短刀、P9、A21 填写 model_path，其余五把为空，详见 [模型与挂载报告](WEAPON_VISUALS.md)；图标是用户提供的原始 200×200 透明 PNG，没有重绘或品质染色。

| 名称 | 配置 | 伤害 | 每秒攻击 | 射程 m | 弹匣 | 换弹 s |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 拓荒短刀 | [wpn_001_survival_knife.tres](../data/weapons/wpn_001_survival_knife.tres) | 28 | 1.6 | 1.65 | 0 | 0 |
| P9 制式手枪 | [wpn_002_p9_pistol.tres](../data/weapons/wpn_002_p9_pistol.tres) | 18 | 2 | 14 | 15 | 1.5 |
| R6 左轮手枪 | [wpn_003_r6_revolver.tres](../data/weapons/wpn_003_r6_revolver.tres) | 34 | 1.15 | 15 | 6 | 2.1 |
| K9 冲锋枪 | [wpn_004_k9_smg.tres](../data/weapons/wpn_004_k9_smg.tres) | 7 | 6.5 | 12 | 30 | 1.8 |
| S12 泵动霰弹枪 | [wpn_005_s12_shotgun.tres](../data/weapons/wpn_005_s12_shotgun.tres) | 7/弹丸 | 0.9 | 8 | 6 | 2.6 |
| A21 突击步枪 | [wpn_006_a21_assault_rifle.tres](../data/weapons/wpn_006_a21_assault_rifle.tres) | 13 | 4.5 | 18 | 30 | 2 |
| H7 猎手步枪 | [wpn_007_h7_hunter_rifle.tres](../data/weapons/wpn_007_h7_hunter_rifle.tres) | 58 | 0.72 | 25 | 5 | 2.5 |
| L56 轻机枪 | [wpn_008_l56_lmg.tres](../data/weapons/wpn_008_l56_lmg.tres) | 10 | 6 | 17 | 60 | 3.6 |

新增字段改 WeaponDefinition；单把武器平衡改上述 .tres；品质词条改 WeaponModifiers；掉落池和商店价格改 [day_loop.tres](../data/day_loop.tres)；开局装备改 [new_run.tres](../data/new_run.tres)。八把都可通过已有商店或行动装备掉落获得，基地 F1 可给予指定武器与品质。

## 战斗语义

[WeaponCombatController](../weapons/weapon_combat_controller.gd) 持有弹匣、冷却、换弹和命中解析。[Survivor](../survivors/survivor.gd) 继续负责移动/任务状态及选择目标；[Mission.attack](../missions/mission.gd) 和 [AimFire.fire](../survivors/aim_fire.gd) 最终都调用同一个 `try_attack`。两种入口都经过冷却、工作/死亡/登车状态、弹药与射程检查，不能通过指向接口绕过冷却。

- 远程每次攻击扣一发。最后一发消耗后立即自动换弹，换弹时不能射击；计时结束填满，无备用弹药库存。行动重新出发时满弹，当前弹数不作为跨行动经济保存。
- 近战无弹药、无换弹，超出 1.65m 不出刀。
- 命中使用当前项目 XZ 平面的 hitscan 与敌人碰撞半径，复用 City.line_clear 的墙体/阻挡规则。普通弹丸停止于首个目标。
- S12 每次产生七条独立散布射线，每颗只造成 7 点基础伤害；各自可以命中不同目标或落空。先完成全部弹丸命中采样，再应用伤害和击退，避免同一发弹丸被自己的击退改变目标位置。
- S12 初始全散布角为 24°，数值 accuracy=0.70 是 `shotgun_spread` 的内部基准，UI 显示散射角；精准词条收窄散布。其他枪使用全角 `spread_angle × (1 - accuracy)`，精准度影响弹道偏移。
- H7 每弹最多两个目标，第二目标为 58×0.60=34.8 点基础伤害；第三目标不受伤，不能穿墙。
- LIGHT/MEDIUM/HIGH 初始位移为 0.25/0.55/1.0m，乘敌人既有击退抗性。位移受地图阻挡约束。普通感染者配置与 HP=30 保持原样。
- 装备的移动百分比与既有道具/技能乘数合并。卸装后角色照常移动、搜索、撤离，停止武器攻击。
- 控制器发出 fired、reload_started、reload_finished 信号，供后续表现层订阅。

## 玩家界面

安全屋底部 **武器** → 图鉴（八把武器）/武器库存 → 点击条目看图标和完整属性。S12 显示弹丸/散射/高击退，H7 显示额外穿透，L56 显示大容量弹匣。品质通过条目边框与文字表达，PNG 不染色。

选中成员后，可以使用既有下拉换装，也可以从武器库存详情点击 **装备给 / 转交给**；当前装备可 **卸下武器**。界面与 [main.gd](../core/main.gd) 的保存成功/失败回滚流程衔接。实现文件为 [weapon_browser.gd](../ui/weapon_browser.gd)、[shelter_screen.gd](../ui/shelter_screen.gd)。行动 HUD [squad_card.gd](../ui/expedition/squad_card.gd) 保留并行任务提供的图标布局，补充空手状态安全处理。

## 旧 Demo 与存档

移除已经没有消费者的 `data/weapons/{pistol,smg,shotgun,crowbar}.tres`；四个旧 ID 在 Registry 分别指向 P9、K9、S12、拓荒短刀。旧程序生成的 3D 武器资产与展示场景保留，正式角色装备不再自动把这些 Demo 武器放到 Rig 下。

没有建立第二套角色数据、库存、CombatController 管理器或 SaveSystem。原 Survivor 的弹药计时和 Mission/AimFire 两套伤害实现收敛至武器控制器。原来的武器属性名 cooldown/attack_range/magazine/reload_seconds 是正式字段的计算别名，避免同步两份数值。

存档升级 v4；v1/v2/v3 继续可读，沿既有 SaveStore 生成 .v1/.v2/.v3 原档备份。库存、装备、每日固定奖励、商店、待结算与历史中的武器数据一并规范化，保留实例身份及旧词条。加载不重抽奖励、不复活成员。所有自动验收只写 `user://test-runs/`，未打开或覆写玩家 run.json。

## 第一阶段骨骼边界（历史记录）

本次没有编辑任何角色 GLB、Skeleton3D、骨骼层级、Rig、AnimationTree；没有创建 Hand_R/Hand_L Socket、BoneAttachment3D、双手 IK 或持枪/换弹/射击动画。Survivor 保留原移动/受击表现，移除旧装备逻辑附带的几何枪和射击缩放。

以下为第一阶段当时的接入计划；其中三把模型、右手 Socket 和基础姿态已在 [Phase 2A](WEAPON_VISUALS.md) 完成：
1. 在 `assets/weapons/models/` 放入正式 GLB，填对应 WeaponDefinition.model_path。
2. 在 [WeaponVisualController.attach_weapon_visual](../weapons/weapon_visual_controller.gd) 对接已确认的外部 WeaponSocket；第一阶段交付时为安全空实现。
3. 表现层依据 animation_profile 切换动画，并订阅控制器的射击/换弹信号；MuzzlePoint/GripPoint 与双手 IK 由后续骨骼任务确定。
4. 重新验收视觉挂载与动画，不需要更改库存、存档、散弹/穿透规则。

## 文件清单（仅本任务）

修改：`core/{campaign,equipment,main,save_store}.gd`；`data/{weapon_data,catalog}.gd`；`data/{day_loop,new_run}.tres`；`data/maps/east_quay.tres` 的初始武器 ID 行；`survivors/{survivor,aim_fire}.gd`；`missions/mission.gd` 的武器调用/空手/移动系数；`ui/shelter_screen.gd`；`ui/expedition/squad_card.gd` 的空手处理；`run.ps1`；`tests/{rules,runtime,mission_flow,parallel_commands,day_loop,new_run,new_run_runtime,controls_runtime,effect_system}.gd` 的正式武器预期与冷却/散弹测试夹具。

新增：`data/weapon_registry.gd`；上表八份 .tres；`weapons/{weapon_instance,weapon_inventory,weapon_modifiers,weapon_combat_controller,weapon_visual_controller}.gd`；`ui/weapon_browser.gd`；`tests/{weapon_system,weapon_runtime}.gd`；`assets/weapons/icons/` 八张同名 PNG 及 Godot 导入元数据；`assets/weapons/models/.gitkeep`；本报告与 `art/weapon_icon_sources.json` 原始字节清单。新增 GDScript 的 .uid 由 Godot 生成。

删除：四份旧武器 .tres。未删除旧 3D 素材。文档同步：本报告、PLAN、VALIDATION、README、RESOURCE_LAYOUT。并行地图/骨骼/UI 任务的工作区差异不计入本任务文件清单。

## 验证

- 初始失败基线：目录只有四把 Demo，八把武器检查返回 exit 1。
- `tests/weapon_system.gd`：428 项通过（其中 424 项随 build 执行，4 项旧档备份检查随后补充通过），实际 Godot Headless；包括八套精确属性与透明图标、四品质与六词条、实例增删/转交/空槽、存档迁移、真实 Mission 中弹匣/换弹、短刀距离、七弹丸、多目标、距离衰减、H7 第二目标 60% 与第三目标免伤。
- `tests/weapon_runtime.gd`：43 项通过，实际原生渲染与合成鼠标；逐项选择八把、属性/图标、装备卸下与保存、窗口缩放、空手出勤。截图在本地 `test-output/weapon-{shelter,s12,unequipped,960,mission}.png`。
- 已运行受影响回归：rules、mission_flow、search_dispatch、parallel_commands、day_loop、day_loop_flow、new_run、new_run_flow、effect_system。
- Windows build 成功，2026-09-12 14:23:08 +08:00；独立复制后的基地、主菜单、行动、路线选择、武器页及 52 模型展厅，分别通过 Headless/原生启动，共 12 项。EXE 为 413,846,352 字节，SHA-256 `50DF5474D2ACC9F2556F6F222839C1E6351813AB91824DAB866B141603B2BA46`。以上为第一阶段历史构建记录；正式产物仍为 `build/BlueHourHomeward.exe`，当前模型版本见 [Phase 2A 报告](WEAPON_VISUALS.md)。
- 补跑原生回归：day_loop_runtime 49、controls_runtime 44、new_run_runtime 168、effect_runtime 60，全部通过。小队 HUD 的旧“纵向高于归航按钮”断言按当前并排布局改为真实边界/重叠检查，没有更改 HUD 布局。
- 定向编码检查通过；文档链接校验 25 个 Markdown、126 个本地链接、0 未解析。pnpm 的 Bash 入口因本机 WSL VHD 缺失失败，直接执行同一脚本内 Python 校验正文后通过。GitNexus 索引陈旧且未提供 GDScript 符号，最终依赖核对以当前源码、原生 git diff 与实际 Godot 运行结果为准。
- 构建中的既有原生/新开局测试出现 2 ObjectDB instances 的退出警告；无脚本错误，独立 EXE 启动及本次武器专项无此警告。试玩平衡、声音与人的操作手感未声称定稿。
