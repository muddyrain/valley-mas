# Weapon Visual Audit WVA-0：武器与角色接入审计

日期：2026-10-19（Asia/Shanghai）。工程：`apps/blue-hour`。平台：**[Windows] Windows environment required**。本阶段为 READ-ONLY 审计，未实施修复。

**结论：Gameplay 层有可运行基础，8 武器的正式视觉与获取／换装闭环尚未完成。** 8 份正式 Definition、8 张图标中，仅 4 份绑定模型；另外 4 份不仅没有枪体，还不能进入 Rifle 状态。当前 Camp 装备入口被禁用，旧武器浏览器未接入正式界面。P9 有真实射击、弹药、命中与返营证据，但没有对应射击动作；A21 有可用模型和 Rifle 动作，静止时左手却离辅助握点约 9.35 cm。不能将旧专项 PASS 或 Debug 展示解释为整体 Visual PASS。

证据根 **E = [test-output/weapon-visual-audit/](../../test-output/weapon-visual-audit/)**。以下 E 相对路径均指本轮新增证据。总体清单另有 [CSV](../../test-output/weapon-visual-audit/eight-weapon-matrix.csv)、[JSON](../../test-output/weapon-visual-audit/eight-weapon-matrix.json)。

## A. 代码版本、Git 状态与范围

### 当前源码基线

- 起始 HEAD：`2eacc70f3770e8d1e5640e6e74a77b0d029809ea`，分支 `master`。以当时磁盘内容建立 **3,109 文件 SHA-256 快照**，逐文件核对隔离副本一致；见 [snapshot.json](../../test-output/weapon-visual-audit/snapshot.json)、[source-manifest.json](../../test-output/weapon-visual-audit/source-manifest.json)、[copy-verification.json](../../test-output/weapon-visual-audit/copy-verification.json)。原来已有暂存入口、R1/R2、动画、PLAN 等未提交成果，完整状态保存在 snapshot，未覆盖。
- 审计期间其他会话将 HEAD 推进到 `865edec300e01d64d015924b3e6f391567ba46be`，并更新 PLAN、增加 ANIM-A1 报告。本轮没有 add、commit、push、checkout、reset、stash 或清理。**Git 索引／HEAD 确实发生外部变化，不能宣称整仓 Git 状态未变。** 生产代码、Definition、GLB、角色、动画资源相对起始内容的哈希保持一致，故本轮运行结论仍适用于这些文件。保全差异见 [preservation.json](../../test-output/weapon-visual-audit/preservation.json)，最终检查见 [final-checks.json](../../test-output/weapon-visual-audit/final-checks.json)。
- 正式运行均在 `E/sandbox/project/`，复用既有隔离导入缓存；独立 `E/fresh-import/` 从空 `.godot` 重新导入 **4 正式 + 4 候选 GLB**。这证明这些武器资产可重新导入，不冒称全项目全新导入或完整构建通过。
- APPDATA、LOCALAPPDATA、TEMP、TMP 均指向 E/profile。正式流程使用 `user://test-runs/wva-player.json`；没有使用玩家存档。实际启动参数、PID、退出码见 `E/logs/*.result.json`。

### 规范及历史资料

已读根 AGENTS／CLAUDE、技能索引、PROJECT_GUIDE、Harness 运行证据规范、TESTING_STRATEGY、Blue Hour AGENTS／PROJECT_CONTEXT、游戏定位与时间契约、PLAN 当前入口。目标路径未发现更深层 AGENTS／override。使用 GitNexus／Godot、delivery-reporting、encoding-guard 相关流程；当前无可调用 GitNexus MCP，回退原生 Git 与源码调用点。没有修改生产符号，无需执行符号编辑 impact；未把未知图谱当作通过证据。

| 要求资料 | 当前工作区查阅结果 |
| --- | --- |
| `weapon_system_audit_w3_0.md` | 当前仓库文档中未找到，不能引用其完成结论。 |
| `weapon_system_w3_2_camp_inventory_equip_report.md` | 未找到；以实际 Camp UI、Campaign 和实例链重审。 |
| `weapon_system_w3_3_vehicle_loot_report.md` | 未找到；以 Mission 当前掉落分支及活动池重审。 |
| Survivor Animation V1 收口 | 指定标题没有独立匹配文件；已读 [Run／Death Phase 2.1](../archive/2026-10/reports/2026-09-24_survivor_animation_run_death_phase_2_1_report.md)、[Phase 3 Batch Reuse](../archive/2026-10/reports/2026-09-24_survivor_animation_phase_3_batch_reuse_report.md)，并对照更早 [Final Visual QA](../archive/2026-10/reports/2026-09-24_survivor_animation_phase_2_final_visual_qa_report.md) 的未通过记录。没有用早期结论覆盖当前验证。 |
| 2026-10-19 移动审计 | 已读 [ANIM-A0](2026-10-19_anim_a0_movement_audit.md)。审计期间新增的 [ANIM-A1](2026-10-19_anim_a1_animation_runtime_fix_report.md) 已补读；当前资源七个持续片已 Loop，Run／Rifle Run 1.45 已存在，不再重复报告 A0 的旧冻结状态为当前缺陷。 |
| 当前 R2 | 已读 [R2](../development/blue_hour_r2_time_contract_report.md)、[R2.1](../development/blue_hour_r2_1_animation_tailstep_fix_report.md)。Mission 唯一模拟时间、有界子步、局部暂停／倍率和技能边界保持，本轮原 Time Contract 173/0。 |

本轮只增加本报告和 E 中证据／隔离探针。生产代码、数值、GLB、Rig、动画、Run 1.45、玩法、存档结构均未改。PLAN 不新增完成勾选：本轮只审计，后续计划在本报告 I 中提出，尚未获实施授权。

## B. 八武器状态矩阵

状态含义：**PASS** 为本列明确验证通过；**PARTIAL** 为部分成立但存在缺口；**MISSING** 为资源／能力缺失；**BROKEN** 为执行路径达不到预期；**UNVERIFIED** 为没有取得该项证据。Gameplay PASS 限定为控制器的命中／弹药及身份验证，绝不等于玩家获取闭环或 Visual PASS。

正式真源是 [WeaponRegistry.definitions](../../data/weapon_registry.gd:19)，不是目录扫描、旧别名或 Debug Preview。`weapon_type` 实际只有 `0 MELEE_SHORT / 1 SIDEARM / 2 LONG_GUN`，并没有独立的霰弹／狙击枚举。

| 正式 ID／名称 | type | Definition（`data/weapons/`） | 模型／重新导入 | 挂点／实际装配 | 动作连接 | Gameplay | Visual | 正式玩家链 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `WPN_001_SURVIVAL_KNIFE` 拓荒短刀 | 0 | `wpn_001_survival_knife.tres` | PASS | PASS | PARTIAL：Knife Idle／Attack；时序见 F6 | PASS | PARTIAL | PARTIAL：开局→Town→返营通过；本轮自然近战未触发，换装入口不可达 |
| `WPN_002_P9_PISTOL` P9 制式手枪 | 1 | `wpn_002_p9_pistol.tres` | PASS | PASS | PARTIAL：右臂姿势复用；Fire／Aim 缺口 | PASS | PARTIAL | PARTIAL：开局、HUD、射击、命中、返营 UID 通过；手动换装未通 |
| `WPN_003_R6_REVOLVER` R6 左轮手枪 | 1 | `wpn_003_r6_revolver.tres` | MISSING | MISSING | BROKEN：空手状态；无 Sidearm Fire | PASS（Diagnostic） | MISSING | BROKEN：当前池无此枪，Camp 无换装；实际获取 UNVERIFIED |
| `WPN_004_K9_SMG` K9 冲锋枪 | 2 | `wpn_004_k9_smg.tres` | PASS | PASS | PARTIAL：Rifle Idle／Run／Shoot；无 Reload 动画 | PASS（Diagnostic） | PARTIAL：稳定握点好，开放手形／转换见 D | BROKEN：在活动掉落池内，换装断链；本轮拾取获取 UNVERIFIED |
| `WPN_005_S12_SHOTGUN` S12 泵动霰弹枪 | 2 | `wpn_005_s12_shotgun.tres` | MISSING | MISSING | BROKEN：模型门槛阻断 Rifle | PASS（Diagnostic，7 pellets） | MISSING | BROKEN：非当前活动池／换装断链；获取 UNVERIFIED |
| `WPN_006_A21_ASSAULT_RIFLE` A21 突击步枪 | 2 | `wpn_006_a21_assault_rifle.tres` | PASS | PASS | PARTIAL：Rifle 复用；静止握点不适配 | PASS（Diagnostic） | PARTIAL | BROKEN：非当前活动池／换装断链；获取 UNVERIFIED |
| `WPN_007_H7_HUNTER_RIFLE` H7 猎手步枪 | 2 | `wpn_007_h7_hunter_rifle.tres` | MISSING | MISSING | BROKEN：模型门槛阻断 Rifle | PASS（Diagnostic） | MISSING | BROKEN：非当前活动池／换装断链；获取 UNVERIFIED |
| `WPN_008_L56_LMG` L56 轻机枪 | 2 | `wpn_008_l56_lmg.tres` | MISSING | MISSING | BROKEN：模型门槛阻断 Rifle | PASS（Diagnostic） | MISSING | BROKEN：非当前活动池／换装断链；获取 UNVERIFIED |

全部 8 个图标路径存在；原 Weapon System 专项逐个图标的 200×200／透明通道检查没有失败。4 个缺模型 Definition 的 `model_path` 是空字符串，属于**只有图标／数据、没有正式模型**；不是“有文件但这次加载碰巧失败”。4 个正式路径均为 `res://assets/weapons/models/<同名>.glb`。该目录没有额外未绑定正式 GLB。`crowbar/pistol/smg/shotgun` 只是四个 LEGACY_IDS 映射，不能再计四把完成武器。

## C. 资产结构、缺失与复用候选

### 正式四模型

[原始 GLB 检查](../../test-output/weapon-visual-audit/glb-source-inspection.json)、[Godot 节点与变换](../../test-output/weapon-visual-audit/diagnostic-stable/measurements.json)、[全新导入结果](../../test-output/weapon-visual-audit/fresh-import-result.json) 三层分别保留。8 个受查 GLB 均为内嵌 buffer、无外部 image URI；导入日志没有资源引用错误。正式四模型全部能实例化并挂到角色。

正式结构都是文件名导入根 → `WeaponRoot` → `Mesh / GripPoint_R / GripPoint_L / MuzzlePoint`。控制器剥去文件名根后使用 WeaponRoot；各节点局部缩放 `(1,1,1)`、basis determinant=1、变换有限，无负缩放／异常非均匀缩放。操作单位按 Godot 世界单位视为米；这里测的是导入后的实际尺寸，没有额外读取 Blender 场景单位。

| 模型 | Mesh AABB 宽×高×长（m） | GripPoint_R | GripPoint_L（WeaponRoot 局部） | MuzzlePoint（局部） |
| --- | --- | --- | --- | --- |
| Knife | .043 × .075 × .340544 | `(0,0,0)` | `(0,0,-.02)`；单手刀不消费该辅助点 | `(0,.023,-.26)`；刀尖占位标记，不代表开枪 |
| P9 | .042 × .261805 × .241077 | `(0,0,0)` | `(0,-.025,0)`；当前不接左手约束 | `(0,.0792,-.1456)` |
| K9 | .0695 × .307756 × .646 | `(0,0,0)` | `(.02,.047,-.184)` | `(0,.02,-.375)` |
| A21 | .0664 × .3204 × .7816 | `(0,0,0)` | `(0,.025,-.272)` | `(0,.0792,-.4776)` |

四模型导入后 +Y 向上、模型前向为 -Z；Muzzle basis 未额外旋转，枪口位于枪身前端。正式 Attachment 使用 profile 的 `hand_basis.inverse × yaw(PI)` 校正，不能拿 Blender 原轴直接判断实际枪口。几何结构 PASS 与手指真正闭合握住模型是两件事。

### 缺失清单与候选

R6、S12、H7、L56 的正式模型均 MISSING，四者无正式握点／枪口可供验证。`assets/generated/` 有以下旧模型，均**没有 WeaponRoot、GripPoint_R/L、MuzzlePoint**，不能将路径直接填入 Definition 就声称接入成功；当前控制器会因找不到 WeaponRoot 而丢弃。

| 候选文件（`assets/generated/`） | 长度 | 可复用判断 |
| --- | --- | --- |
| `weapon_shotgun_model.glb` | 1.117 m | S12 最直接的几何候选；仍需单独审批后做标准化、握点／枪口、尺寸和实际动作适配。本轮未加工。 |
| `weapon_assault_rifle_model.glb` | .977 m | 通用步枪几何候选；已有正式 A21，不能仅改名冒充 H7 或 L56 已完成。 |
| `weapon_pistol_model.glb` | .301346 m | 普通手枪几何，不能当作具有左轮结构的 R6 正式成品。 |
| `weapon_submachine_gun_model.glb` | .646 m | 旧 SMG 几何参考，正式 K9 已存在；不作为缺失长枪的直接替身。 |

候选没有绑定任何正式 WeaponDefinition；它们存在并可导入只证明“可评估复用”。本轮未发现独立的正式 R6／H7／L56 模型。报告不以展示资产、旧 ID、预览缩放或旧生成目录计算完成率。

## D. 身份链、角色挂载与双手握持

正式执行链实际为：

```text
Campaign.data.equipment[crew ID] = UID
 → Campaign.item / WeaponInventory.get_weapon(UID)
 → Equipment.resource(item) 派生 Definition（实例词条／升级）
 → Mission.setup → Survivor.setup(spec, trait, definition, instance)
 → Survivor.equip → Combat.equip(definition, instance, UID)
                     → Visual.set_weapon(同一 definition)
 → 正式 Skeleton3D.RightHand → 动态 BoneAttachment3D WeaponSocket_R
 → WeaponRoot，transform = profile.attachment_transform × GripPoint_R.inverse
 → ExpeditionAnimationController.bind_weapon
 → combat state / Aim Modifier / Support Grip Modifier / AnimationTree
```

源码入口：[Campaign](../../core/campaign.gd:254)、[Mission](../../missions/mission.gd:199)、[Survivor.equip](../../survivors/survivor.gd:106)、[Visual](../../weapons/weapon_visual_controller.gd:44)。实例 UID 不存在 GLB 内；模型通过本次派生 Definition 与 Combat 共用资源来绑定身份，这一设计本身没有要求为每个实例复制模型。

### 自动检查

- 正式 12 人全部成功加载模型／Expedition 控制器；都是 23 骨，骨名、父级、Rest 完全一致，Rig scale=1，均有 RightHand、LeftHand 和动态 WeaponSocket_R。未出现某一角色必须独立建武器系统的证据。
- 本轮 **96 次装备采样（12×8）**：四模型均加载，四空模型均安全无模型；Visual／Survivor／Combat Definition 一致；前一模型正确卸载。空模型远程武器仍创建 Socket 下 fallback 枪焰；不是残留上一个枪体。
- 12 人卸下装备后的稳定样本：model=null、Socket 无子节点、pose profile=null、回 IDLE。**但挥刀后立即切换／卸下存在残留，见 F7，不能将稳定样本外推为全部中断场景通过。**
- [原 Batch](../../tests/survivor_animation_batch.gd) 本轮重跑 1,408/0，涵盖 12 人共用库、骨架、K9 握持与事件状态。自建近景 fixture 中其余十人隐藏，只用于结构／装配；不把隐藏角色的握点数值当视觉证据。其余十人的玩家操作与逐人近景 Visual 仍为 UNVERIFIED。

| ID | 角色 | 骨架／Socket／8 次装配 | 本轮原生近景 |
| --- | --- | --- | --- |
| SUR_001 | 夏知遥 | PASS | 8 武器 Diagnostic；正式开局 P9 |
| SUR_002 | 苏晚星 | PASS | 8 武器 Diagnostic；正式开局 Knife |
| SUR_003 | 林见月 | PASS | UNVERIFIED，自动化批量 |
| SUR_004 | 陆清禾 | PASS | UNVERIFIED，自动化批量 |
| SUR_005 | 沈砚川 | PASS | UNVERIFIED，自动化批量 |
| SUR_006 | 唐栀 | PASS | UNVERIFIED，自动化批量 |
| SUR_007 | 顾予安 | PASS | UNVERIFIED，自动化批量 |
| SUR_008 | 程茉 | PASS | UNVERIFIED，自动化批量 |
| SUR_009 | 周野 | PASS | UNVERIFIED，自动化批量 |
| SUR_010 | 许昭宁 | PASS | UNVERIFIED，自动化批量 |
| SUR_011 | 贺临川 | PASS | UNVERIFIED，自动化批量 |
| SUR_012 | 宋时雨 | PASS | UNVERIFIED，自动化批量 |

两位近景角色表现一致，未观察到只属于其中一人的异常；以下是武器／公共状态的问题。

### 握点、轴与视觉判定

右手标记距离 Socket 原点约 **.05025 m**，符合既有 `grip_offset=(0,.05,.005)` 的长度；这个数是预设掌心偏移，不能单凭“非零”判脱手。四模型稳定采样变换有限，切换未累积多个枪体。实拍手指呈张开／平掌，故挂点 PASS 仍不代表紧握手柄的完整 Visual PASS。

左掌按 `LeftHand attachment × (0,.045,0)` 测量，单位米；两位结果基本一致：

| 武器 | 稳定 Idle 左掌误差 | Run 左掌误差 | 跑→停＋Fire 早期采样 | 判断 |
| --- | --- | --- | --- | --- |
| K9 | 约 .0007 | 约 .00004 | 约 .0368 | 稳态几何贴合好；转换短暂离点，需后续连续量测再判是否超视觉容差 |
| A21 | 约 .0935 | 约 .0001 | 约 .0420 | 静止握持不适配，不能因跑动 IK 对齐而整体判 PASS |
| P9 | 单手 profile；左手不跟握点 | 不适用双手约束 | 无 Sidearm Shoot | 当前是单手 ready 姿势复用，未实现双手手枪持握 |

原因：[Grip Modifier](../../survivors/survivor_expedition_grip_modifier.gd:20) 仅 moving=true 且 long gun 时增权，停下归零；Idle 依赖现有 baked Rifle 姿态。A21 与 K9 的辅助点差约 9 cm，公共静止姿态没有自动适配两把枪。不能把同骨架兼容推导成所有枪型握持兼容。

前向与角色默认前向的 dot：稳定 Rifle Idle 约 .962、Rifle Run 约 .999，Fire 转换约 .935；它们含俯仰，**不是对任意目标的水平瞄准误差**。P9 停止时不走 long-gun 朝向／Aim Modifier，精确枪口－目标角度未量测，不能宣称全方向瞄准 PASS。

有模型远程武器的 MuzzleFlash 父节点是正式 `WeaponRoot/MuzzlePoint`，Tracer 取其世界位置。空 model_path 远程分支改挂 Socket，局部 `(0,0,-.65)`，在空手动作中落到腿／脚附近，原生 [S12 诊断图](../../test-output/weapon-visual-audit/diagnostic-stable/screenshots/WPN_005_S12_SHOTGUN-fire-event.png) 可见。这不是“从正确枪口发射”。伤害射线则从 member.position 的平面原点计算，视觉枪口不参与命中，二者目前是独立路径。

## E. 动画状态机与 Gameplay 事件

正式 12 人选用 [survivor_expedition_animation_controller.gd](../../survivors/survivor_expedition_animation_controller.gd)，经 [survivor_animation_pipeline.gd](../../survivors/survivor_animation_pipeline.gd) 创建 manual AnimationTree：Locomotion StateMachine → Rate → Rifle Shoot OneShot → Hit OneShot → output。还加载 Public 库，但正式状态映射使用 Survivor 库；不能用旧 `survivor_weapon_animation_bridge.gd` 推断当前状态。

| 动作／状态 | 当前实接 | 分类与边界 |
| --- | --- | --- |
| Idle | IDLE→survivor_idle；卸下装备亦走此状态 | 已接入。`unarmed_idle` 已加载／循环，却没有进入正式 STATES 映射，不等于单独空手动画被使用。 |
| Walk | `_camp_style` 下移动→WALK | Camp 动作复用；Expedition 正速度超过 .08 就 RUN，没有按低速另选 WALK。 |
| Run | RUN→survivor_run；RIFLE_RUN→rifle_run | 已接入，实际速度比×**1.45**；本轮未修改，稳定诊断为 1.45。 |
| Armed Idle | 有模型 long gun→RIFLE_IDLE；有模型刀→KNIFE_IDLE | 模型存在是门槛；Sidearm 没有专用 Armed Idle 状态，依赖 pose modifier。 |
| Rifle Shoot | fired→pending→OneShot | K9/A21 已接入；过滤仅 Spine／Chest／UpperChest，复用现有射击片，无各枪独立 recoil 动画。 |
| P9/R6 Fire | Gameplay／音效／Tracer／Flash 可执行 | **只有事件／特效，无 Sidearm Shoot 动画分支**。P9 实机 shoot_requests 恒为 0。 |
| Reload | reload_started/finished→bridge.reloading bool | **仅逻辑事件**；没有 Reload clip／state，bool 不驱动换弹动作。P9 HUD“换弹”仍正常。 |
| Melee | damage 立即结算后 fired→ATTACK→knife_attack | 动作已接入，但命中未等动作接触帧；4.266667s 动作可能每 .625s 被重启。 |
| Aim | long gun 目标方向→Spine yaw；静止角色转向也只判断 uses_long_gun | 有模型长枪已接入；手枪与缺模型长枪缺少这一路跟随。 |
| Switch／Unarmed | Visual 及时卸旧模型；清 pending Shot／aim | 只清部分事件；未清 `_knife_left`，切枪／卸下后 ATTACK 可持续，见 F7。 |

实读 11 片：survivor_idle 8.333333、survivor_walk 2.066667、survivor_run 5.133333、rifle_idle 8.333333、rifle_run 1.366667、rifle_shoot 1.9、unarmed_idle 3.833333、knife_idle 8.333333、knife_attack 4.266667、hit_reaction .9、death 6.066667 秒。七个持续片 loop=1，四个事件片 loop=0；无 reload 或 sidearm_shoot。完整字段在 measurements.json/clips。

模型为空时 `uses_long_gun=false`，且 Visual 在应用 profile 前返回，因此 S12／H7／L56 的逻辑类型虽为 LONG_GUN，实际进入 IDLE／RUN、不会请求 Rifle Shoot。**这是模型门槛和表现接入缺失，不是 Gameplay 不会射击。** 将来仅补文件仍必须测长枪长度、肩托、静止左手和长弹匣的适配，不能默认套用 K9 已完成。

刀的 damage→动画顺序由 [Combat.try_attack](../../weapons/weapon_combat_controller.gd:58) 直接证实：先 resolve／apply_hit，再发 fired。Diagnostic 首次命中 28，`_knife_left` 同步设 4.266667；不是动画内事件驱动伤害。此处只记录当前时序，不授予改变伤害、攻速或动画资源的授权。

## F. 正式游戏测试与证据

### 本轮正式流程

仅实例化正式 `core/main.tscn`，屏幕外原生 Godot Compatibility 1600×900，Viewport 合成鼠标／按键（device42），按引擎自然调度；没有传送、加血、无敌、Debug 装备／刷敌、手动推进 Mission 或内部结算调用。

实际路径：**Main Menu → 开始游戏 → 作战 → 确认创建 → Camp → 夏知遥详情“装备”（disabled，0 pressed connections）→ 今日行动 → 商业街 → MEDIUM_TOWN_V1 → 待机／移动／停止／Ctrl 射击 → 自然接敌 → E 归航 → 等全部存活成员到站、准备、关门 → 确认结算 → 第 2 天 Camp**。地图 seed `59640561`，本次自然击杀 1；两人 HP 均为 100，未改血量。

Camp→WeaponSelector **BROKEN**，所以在记录断点后继续使用正常开局装备：苏晚星 `initial:crew:0` Knife，夏知遥 `initial:crew:1` P9。没有用注入库存替代换装验收。

Formal telemetry 有 **2,120 个成员身份采样**，weapon_uid=combat_uid=instance_uid，weapon_id=visual_definition.id 全部一致。HUD 从同一 Survivor 读 ammo／reload／weapon_type，原生画面出现 15→0、换弹、补满及移动后的攻击；HUD 本身不展示 UID，不能声称用户能在 HUD 上读出 UID。P9 自然命中两次，每次 22.5，HitEvent UID 均 `initial:crew:1`；本次作战被动加成作用后的伤害与模板 18 区分。最终 Campaign／保存 payload 的装备 UID 相同，day=2，payload SHA-256 核对通过。见 [summary.json](../../test-output/weapon-visual-audit/summary.json)、[trace.json](../../test-output/weapon-visual-audit/trace.json)、[telemetry.json](../../test-output/weapon-visual-audit/telemetry.json)。

此次没有搜得新武器；正式掉落池只是源码核对。三份 `data/today_actions/*.tres:28` 均只含 Knife／P9／K9；Mission.reward_for_site 优先消费 mission_profile.weapon_pool（mission.gd:1082–1095）。旧 day_loop 的 8 枪商店／depot 池存在，不能据此宣称当前 Town 玩家能获得 8 枪。R6／S12／A21／H7／L56 不在当前活动池；K9 即便搜得，也缺正式换装入口。

### 录像与截图

全部视频来自真实 Viewport PNG，H.264、1600×900，无插帧／重绘。七段正式片按原始帧写入时间连续编码、可变帧率；两段 Diagnostic 按约每3个诊断步采一帧，以每采样 .1s 编排，武器之间准备／等待动作结束的未采集区间直接切过，**不是连续墙钟录像或模拟速度测量**。另保留带准备间隔的初版 `*-with-preparation-gaps.mp4`，不作为流畅度证据。采集降低运行速度，不能拿视频时长测 FPS／平衡；Dummy 音频，**没有音频验收**。9 段交付视频均 ffprobe 及完整解码 exit0，见 [metadata.json](../../test-output/weapon-visual-audit/videos/metadata.json)。正式片与 Diagnostic 文件名及画内标识分开。

| 视频 | 时长 | 类型与覆盖 |
| --- | --- | --- |
| [formal-camp-equip-blocker.mp4](../../test-output/weapon-visual-audit/videos/formal-camp-equip-blocker.mp4) | 5.12s | 正式 Camp；装备入口禁用，不伪造 Selector 成功 |
| [formal-departure.mp4](../../test-output/weapon-visual-audit/videos/formal-departure.mp4) | 24.88s | 正式今日行动→Town Ready Gate |
| [formal-held-idle-run.mp4](../../test-output/weapon-visual-audit/videos/formal-held-idle-run.mp4) | 9.60s | 正式 P9／Knife 持握、移动、停止对照 |
| [formal-p9-directed-fire.mp4](../../test-output/weapon-visual-audit/videos/formal-p9-directed-fire.mp4) | 22.72s | 正式 Ctrl 指向变更、P9 弹药与通用射击 VFX；不是 Sidearm 动画 PASS |
| [formal-fire-ground-input.mp4](../../test-output/weapon-visual-audit/videos/formal-fire-ground-input.mp4) | 14.56s | 正式进一步射击／换弹观察 |
| [formal-natural-contact.mp4](../../test-output/weapon-visual-audit/videos/formal-natural-contact.mp4) | 65.68s | 正式地面指令接近自然敌人、P9 命中与击杀；包含路程，不是刷敌片 |
| [formal-extraction-return.mp4](../../test-output/weapon-visual-audit/videos/formal-extraction-return.mp4) | 89.04s | 正式归航、准备／关门、结算、确认、第 2 天 Camp |
| [DIAGNOSTIC-eight-weapons-stable.mp4](../../test-output/weapon-visual-audit/videos/DIAGNOSTIC-eight-weapons-stable.mp4) | 28.04s | **Diagnostic**；8 枪双角色稳定待机／跑动、两个观察角度、受控 fired／flash。所有缺模型枪也保留画面；准备间隔切过 |
| [DIAGNOSTIC-sequential-switch-residual.mp4](../../test-output/weapon-visual-audit/videos/DIAGNOSTIC-sequential-switch-residual.mp4) | 28.04s | **Diagnostic**；顺序切换，刀→P9 残留 ATTACK。不能拿该 P9 初始段当独立稳定跑姿；准备间隔切过 |

代表性原生截图：[Camp 装备禁用](../../test-output/weapon-visual-audit/screenshots/03-equipment-no-response.png)、[正式跑动](../../test-output/weapon-visual-audit/screenshots/07-formal-running.png)、[射击／换弹](../../test-output/weapon-visual-audit/screenshots/11-directed-fire-verified.png)、[自然接敌](../../test-output/weapon-visual-audit/screenshots/12-natural-contact.png)、[返回 Camp](../../test-output/weapon-visual-audit/screenshots/14-returned-camp.png)。近景按 `E/diagnostic-stable/screenshots/<WPN_ID>-idle-front/run-front/run-side/fire-event.png` 保留，共 33 图；两角度是诊断相机观察，不冒充正式相机可自由旋转。正式镜头只支持既有 pan／zoom。

**不能交付全部四模型的正式换装录像的原因**：现有 Camp 入口断链、A21 不在当前正式活动池。本轮 K9／A21 的完整持枪／Rifle 画面严格标为 Diagnostic。不能交付缺失四模型的实际持枪画面：没有正式模型，诊断如实显示空手与 fallback VFX。其余十人未发现特异性异常，仅批量自动化，不补造逐人玩家流程录像。

### 自动化与测试限制

| 本轮实际执行 | 结果 | 解释 |
| --- | --- | --- |
| 8 GLB 空缓存 import | PASS，exit0，8 个 `.scn` | 4 正式＋4 旧候选，武器范围；不是整项目 build |
| 原 weapon_visuals.gd | **1,789/0** | 两人几何／切换专项，headless；不代表细部视觉正确 |
| 原 survivor_animation_batch.gd | **1,408/0** | 12 人共用 Rig／K9／事件状态，headless |
| 原 weapon_combat_phase1a.gd | **11/0** | AttackSpec／HitEvent 保留实例身份 |
| 原 time_contract.gd | **173/0** | R2 有效时间契约回归；没有改 Run 1.45 |
| 原 weapon_system.gd | **474 checks／1 failure** | `:100` 仍要求 K9.model_path 为空，已与现有正式模型冲突；没有放宽或修测试 |
| 本轮 Diagnostic Gameplay | 8/8 实际 try_attack 成功 | uid／Definition／HitEvent 一致；伤害依次 28、18、34、7、49（7×7）、13、58、10；远程每次扣一发。目标手动生成／高 HP，非玩家闭环 |
| 两套 Native Diagnostic | exit0，正式运行 exit0 | 控制事件／合成输入分类明确；稳定版等上一次刀动作结束后再采下一枪，原顺序版保留残留问题 |

日志 `E/logs/` 保留 stderr／stdout／engine／result，不只依赖 exit0。首次 native-main 漏加 `--test-menu`，落到旧三人回归 fixture；已退出，**不作为正式玩家证据**。下一次 native-player 因上一条 quit 命令残留而提前退出，未开始流程；重置 E 内命令后，以 native-player-final 完成上述正式流程。首次 stable 生成命令有引号语法错误／脚本不存在，日志保留；有效 stable-final 正常完成。汇总脚本曾遇保存 envelope／变量顺序错误，修正的是 E 中统计工具，没有修改游戏或原始数据。

## G. 按优先级的问题清单

**P0：本轮没有证实崩溃、存档损坏或战斗整体无法运行的 P0。** 下列优先级针对 Weapon Visual 完成目标；“未发现”不外推为全游戏无 P0。

### F1 — P1：四把正式武器缺模型，模型门槛同时阻断持枪状态

- 源码：[R6:12](../../data/weapons/wpn_003_r6_revolver.tres:12)、[S12:12](../../data/weapons/wpn_005_s12_shotgun.tres:12)、[H7:12](../../data/weapons/wpn_007_h7_hunter_rifle.tres:12)、[L56:12](../../data/weapons/wpn_008_l56_lmg.tres:12)；[Visual:56](../../weapons/weapon_visual_controller.gd:56)、[uses_long_gun:30](../../survivors/survivor_expedition_animation_controller.gd:30)。
- 复现：运行 E 的 diagnostic_stable.gd，依次装备 R6／S12／H7／L56，推进 Idle、Run、fired。期望：对应枪体／枪口和类型姿态；实际：model=null、profile=null，长枪 uses_rifle=false、IDLE／RUN，无 Rifle Shoot；fallback 枪焰位于空手 Socket 下偏低位置。
- 证据：measurements.json、四枪 `*-fire-event.png`、Diagnostic stable 视频、Gameplay JSON。Gameplay 能命中不消除视觉 MISSING。

### F2 — P1：Camp 换装／库存入口未接入正式流程

- 源码：[Main.show_shelter:266](../../core/main.gd:266)、[RosterAdapter:115](../../ui/camp_hud/survivor_roster_adapter.gd:115)、[Detail:223](../../ui/camp_hud/survivor_detail.gd:223)、[旧浏览器](../../ui/weapon_browser.gd:1)。活动池见 `data/today_actions/*.tres:28` 与 [Mission:1095](../../missions/mission.gd:1095)。
- 复现：主菜单新游戏→Camp→夏知遥头像→装备；期望：进入 WeaponSelector、按 UID 装备已有物品；实际：按钮 disabled=true、pressed connections=0，无 Selector。Camp 菜单只有继续／设置／主菜单／退出，旧 browser 无正常调用入口；Main 保留 `--test-weapons` 对 `screen.show_weapons` 的旧调用也不能当玩家入口。
- 影响：K9 可在活动池配置中出现，但无法验证获得后换装；另外五枪不在活动池。旧 shop 字典不等于商店可访问。本轮没有声称完成拾取→换枪→出勤。
- 证据：formal-camp-equip-blocker 视频、截图03、trace 按钮 disabled／连接数、最终 UID 保持初始值。

### F3 — P1：P9／R6 没有 Sidearm 射击动作，Aim 跟随不完整

- 源码：[事件分支:251](../../survivors/survivor_expedition_animation_controller.gd:251)、[Aim:14](../../survivors/survivor_expedition_aim_modifier.gd:14)、[Survivor 朝向:255](../../survivors/survivor.gd:255)、`data/weapon_poses/sidearm.tres`。
- 复现：正式开局夏知遥→Town→停止→Ctrl 指向两边并持续射击；期望：手枪、朝向、Fire 表现一致；实际：P9 扣弹／命中／VFX 有效，active_state 仍 IDLE／RUN，shoot_requests=0。Sidearm ready 是右臂静态 modifier，没有同目标的瞄准／射击状态分支。R6 还有 F1。
- 证据：两段正式射击视频、自然战斗视频、summary formal_states、Diagnostic P9 Idle／Run 两视角。任意方向精确夹角仍 UNVERIFIED，不以源码推断虚构一个实测角度。

### F4 — P1：A21 静止左手不贴合；公共 Rifle 静态姿势不能覆盖所有长枪

- 源码：[Grip:20](../../survivors/survivor_expedition_grip_modifier.gd:20)、`assets/weapons/models/wpn_006_a21_assault_rifle.glb/WeaponRoot/GripPoint_L`、现有 Rifle Idle 动画。
- 复现：两位角色装备 A21，等稳定 Idle，再 Run；期望：左右手在两状态都贴握点；实际：两人 Idle 约 .0935m、Run 约 .0001m。停止后 IK 权重归零，回到 K9 适配的静止姿势；不是模型没挂成功。
- 证据：[A21 Idle](../../test-output/weapon-visual-audit/diagnostic-stable/screenshots/WPN_006_A21_ASSAULT_RIFLE-idle-front.png)、[Run 侧面](../../test-output/weapon-visual-audit/diagnostic-stable/screenshots/WPN_006_A21_ASSAULT_RIFLE-run-side.png)、稳定 measurements。S12／H7／L56 因模型缺失，其同类风险待测，不能预先判其握持 PASS。

### F5 — P2：Reload 只有计时／HUD 与 bool，没有实际换弹动作

- 源码：[Combat:83](../../weapons/weapon_combat_controller.gd:83)、[动画控制器:260](../../survivors/survivor_expedition_animation_controller.gd:260)、pipeline.STATES／11 片库。
- 复现：正式 P9 射空一弹匣，或 Diagnostic 发 reload_started；期望：可辨认换弹动作并回到持枪；实际：弹药等待后补满、HUD“换弹”、reloading=true，但 Tree 仍原 locomotion／Rifle 状态，无 Reload clip。
- 证据：formal-fire-ground-input、截图11、measurements 的 reload_event。定义为表现缺失，不把当前无限后备弹机制当此次武器平衡缺陷。

### F6 — P1：刀伤害发生在动作开始前，完整挥刀与攻击频率不对应

- 源码：[Combat:58–78](../../weapons/weapon_combat_controller.gd:58)、[动画:257](../../survivors/survivor_expedition_animation_controller.gd:257)、刀 Definition attack_rate=1.6、现有 knife_attack 4.266667s。
- 复现：Diagnostic Gameplay 中让刀命中 1.5m 目标；或持续按 cooldown 调用真实攻击；期望：命中表现可对应一次挥刀的有效接触；实际：先 apply_hit，再 fired 启动 ATTACK，未通过动画 contact event；每 .625s 可重启长达4.266667s的动作，持续战斗不保证完整挥刀。
- 证据：gameplay.json 第一刀 damage=28、knife_left=4.266667，Combat源码顺序，Diagnostic knife Fire。自然玩家近战命中本轮没有触发，持续重启的完整实机序列仍 UNVERIFIED；上述数值／顺序是已证实事实，观感后果需下一阶段定点实录。

### F7 — P2：挥刀后换枪／空手保留 ATTACK 计时

- 源码：[weapon_changed:266](../../survivors/survivor_expedition_animation_controller.gd:266)、[状态优先级:216](../../survivors/survivor_expedition_animation_controller.gd:216)。换武器没有清 `_knife_left`。
- 复现：装备刀→fired→立即装备 P9，或 equip(null) 后 update_motion；期望：旧刀动作终止，新枪／空手进入正确状态；实际：旧模型已移除，ATTACK 仍优先。首顺序版 P9 的 Idle、Run 仍为 ATTACK；Gameplay 探针最终 model=null、unarmed_state=ATTACK。等计时结束后可恢复，不是永久卡死。
- 证据：Diagnostic sequential 视频／measurements；gameplay.json。稳定版等待150个诊断步后恢复，作为独立对照，没有修改生产控制器消除问题。

### F8 — P2：手掌几何张开，挂点接近不等于实际握住手柄

- 源码／资源：共用23骨 Rig（没有手指骨），`weapons/weapon_pose_modifier.gd`、`weapons/weapon_pose_profile.gd`；四模型装配公式只约束手骨／掌心。
- 复现：两位角色分别装备 P9／A21，近景侧面看 Idle／Run；期望：握枪轮廓可信，支持手包住对应部位；实际：可见展开手指／平掌；A21 Run 即使 marker gap≈0，手形仍像托平掌。不能据此把所有模型笼统判脱手，但完整 Visual 仍 PARTIAL。
- 证据：P9／A21 run-side 原图及稳定 Diagnostic 视频。属于共享模型／手形边界，未发现必须逐角色新建系统的证据；未做网格穿透体积量测。

### F9 — P2：旧武器专项硬编码 K9 无模型，测试契约过时

- 源码：[weapon_system.gd:97](../../tests/weapon_system.gd:97)。
- 复现：隔离运行原文件；期望：承认当前 Registry K9 正式模型，真实缺资源仍能被测出；实际：只允许 Knife／P9／A21 有模型，K9 触发 `Empty model allowed WPN_004_K9_SMG`，474/1。
- 证据：`E/logs/weapon-system.*`。本轮未修改断言；不能将该失败写成 K9 导入失败，也不能将旧1789/0写成全套武器门禁通过。

## H. 修复建议、文件及依赖（全部未实施）

先处理玩家能否选择武器和数据是否有正式表现，再细化动作。只批量生成 GLB 是较短的表面路径，不能解决 F2、Sidearm 状态或 A21 静止握持的根因。

| 建议 | 涉及文件／资源 | 前置及不变约束 |
| --- | --- | --- |
| 恢复一个 UID 驱动的正式库存／WeaponSelector 入口 | `core/main.gd`、`ui/camp_hud/*`、既有 `ui/weapon_browser.gd`、Campaign API | 复用实例事务／保存失败回退，不改存档结构；先确认现有 UI 入口设计，再实现 |
| 确认当前活动池与八正式武器的产品边界 | `data/today_actions/*.tres`、`data/day_loop.tres`、Mission.reward_for_site | 这涉及获取范围，须后续明确授权；不为拍视频擅自扩池／改概率 |
| 补齐资产适配规范，优先评估旧 S12 几何 | `assets/weapons/models/`、Definition.model_path、`art/blender/weapons/*` | 修改前按 Art Bible／Pipeline／Catalog；先审 Grip_R/L、Muzzle 与米制轴，不直接给缺枪套 K9 替身 |
| 定义缺模型时的一致表现／诊断策略 | Visual、Expedition CombatState、VFXResolver | Gameplay 可继续；避免依赖模型存在才能选武器姿态；不要用静默 fallback 掩盖缺资产 |
| 修 Sidearm 的 Aim／Fire 连接 | Expedition 控制器、Aim Modifier、Survivor 朝向、sidearm pose | 先评估现有动作复用是否可信；没有授权不新增／重烘动画；保持 Run1.45、武器数值 |
| 统一长枪静止与移动的辅助握点求解 | Grip Modifier、long_gun profile、各枪标记 | 先以 K9/A21 对照验证过渡，后测 S12/H7/L56；共用Rig，不按角色复制系统 |
| 刀／切换生命周期与事件时序 | Combat／Expedition 控制器／现有动作事件 | F7 可独立定点回归；F6 先确定接触点契约，不擅改 attack_rate、damage 或动画片长 |
| Reload 表现与手形 | 控制器／公共动作复用／手部资产 | 无现成 Reload 片，新增资源或手形变更单独授权；不把“设 bool”写成动画完成 |
| 更新真实资源验收，去除旧名单假设 | `tests/weapon_system.gd`、weapon_visuals、batch／正式 UI 回归 | 保留空模型降级测试，增加模型／挂点／视觉状态分列断言，失败日志不得吞掉 |

依赖关系：F2 正式入口 → 真实 UID 换装验证；资产规范 → 缺枪正式 GLB → 各长枪静止／移动适配；F7 生命周期 → 切枪中断／空手；Sidearm／Melee／Reload 各自事件契约 → 动作适配 → Native 视觉复核。最终再合并验证 R2 三倍率／暂停、正式拾取归航和 Windows 发布门禁。

## I. WVA-1 以后实施建议

| 阶段 | 建议范围 | 完成门槛 |
| --- | --- | --- |
| WVA-1：正式入口与身份闭环 | 连接唯一库存／Selector；确认当前活动池范围；修过时测试契约 | 玩家点选实际 UID→保存→Camp 显示→Town HUD／模型／HitEvent→返营同 UID；不靠 Debug 注入 |
| WVA-2：缺模型与挂点规范 | 评估复用候选，完成经授权的四枪资产／绑定；建立结构验收 | 八枪各自真实文件、空缓存导入、WeaponRoot／Grip／Muzzle、12Rig装配；资源存在与 Visual 分列 |
| WVA-3：公共持枪、瞄准与中断 | Sidearm 分支、A21静止握持、F7切枪／空手生命周期 | 双角色两视角 Idle／Run／Fire／转向／切换；余十人批量；保持 Run1.45、Rig和武器数值 |
| WVA-4：攻击／Reload 表现 | 确定近战contact、射击与Reload契约；若需新资源，先另行授权 | 伤害／弹药事件与动作时序可解释，逐枪受控和正式可获取样本分别录像 |
| WVA-5：正式回归与发布复核 | 全部可获武器的获取→换装→行动→归航；R2与Windows门禁 | 不绕旧失败导出；区分专项、完整build、独立EXE与人工视觉通过；仍不可获取的武器明确Diagnostic |

阶段顺序可将 F7 的独立修复提前到 WVA-1，但必须另获下一阶段授权。本报告不更新生产实现状态，不宣布这些计划已执行。

## 交付边界与环境

已交付：8 武器矩阵、资产／挂点清单、12 人结构装配、两位角色原生两角度诊断、真实菜单→Town战斗→撤离→第2天营地记录、9段录像、日志与测量、问题复现及后续依赖。没有把 Headless 或受控事件片替代视觉验收。

未验证：全部八枪的玩家获取／换装闭环、其余十人的玩家近景、自然近战命中、长时间／全部方向的枪口瞄准误差、每帧瞬态与手指穿透体积、全部seed／效果／升级组合、五日通关、音频、性能、磁盘故障／迁移、macOS。Windows完整build／新EXE未运行：本轮纯只读审计，不绕过既有失败门禁或覆盖旧build。既有发布阻断继续成立，不能借此次专项通过抹去。

| 环境 | 记录 |
| --- | --- |
| [Windows] Godot | `4.7.2.stable.official.ed1daf0bf`；Compatibility／OpenGL；RTX3060／NVIDIA591.86；原生1600×900，Dummy音频；窗口(-3000,-3000)、unfocusable |
| [Windows] 工具 | Python3.13.5、Node26.4.0（未调整为仓库22.x）、Git2.39.1.windows.1；ffmpeg／ffprobe用于编码和解码 |
| Blender | 未使用；PATH未找到，未打开Editor／新增美术 |
| [macOS] | 无可访问环境，未运行、未验证 |

定向编码／报告链接／生产文件哈希和本轮进程退出检查见 final-checks.json。E 下隔离源码副本是为了可重放和只读保全，不是第二套生产武器系统。**WVA-0 到此停止，等待下一阶段授权。**
