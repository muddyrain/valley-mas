# 首个正式普通感染者

2026-09-12。修改现有 `core/main.tscn → 专属路线 → 营地 → missions/mission.gd` 链路，无新增测试地图或替代游戏场景。`scenes/enemies/enm_001_infected_basic_a.tscn` 是实际刷怪实例化的敌人场景。

## 资源与定义

- 模型：`assets/characters/infected_basic_a/model/ENM_001_infected_basic_a.glb`。
- 场景：`scenes/enemies/enm_001_infected_basic_a.tscn`。
- 结构：`data/enemy_data.gd`，现有 Resource 扩充为 `class_name EnemyDefinition`。
- 配置：`data/enemies/enm_001_infected_basic_a.tres`；唯一注册入口仍为 `data/catalog.gd`。
- 来源及哈希：[infected_source.json](../art/infected_source.json)。项目内 GLB 与用户提供的 `Meshy_AI_Lost_Little_Zombie_0912034938_texture.glb` 字节完全一致。

模型实测高度 1.6499998569 米，底部 Y=0；敌人场景根节点和模型保持单位缩放，误差来自浮点表示。模型朝向统一在场景内校准为玩法使用的 -Z，血条锚点为 1.82 米，碰撞高度为 1.65 米。模型 10,270 三角形，三张内嵌贴图提取为语义命名文件并由唯一外部材质引用，保留 Godot 自动 LOD。没有骨骼或动画，本次不制作替代模型或动作。

## 唯一基础配置

| 字段 | 值 |
| --- | --- |
| id | ENM_001_infected_basic_a |
| display_name | 普通感染者 |
| enemy_type | COMMON |
| max_hp | 30 |
| move_speed | 2.0 米/秒 |
| attack_damage | 8 |
| attack_range | 0.9 米 |
| attack_cooldown | 1.20 秒，两次起手之间 |
| attack_windup | 0.35 秒 |
| detection_range / lose_target_range | 12.0 / 18.0 米 |
| collision_radius | 0.32 米，点击碰撞与指向射击共同读取 |
| knockback_resistance | 0.10 |
| xp_reward | 1 |

保留原普通敌人 Food/Scrap 掉落概率 0.08 / 0.18；`threat_rank=0` 继续供既有重点打击技能选择目标。当前没有击退系统和击杀经验分配系统，因此 resistance / xp 作为可编辑字段预留；不把击杀经验自动塞入现有食物训练成长规则。

## 现有时钟与最终属性

复用 `time/mission_clock.gd`，不新增 Threat 或昼夜管理器。现有临时警戒 `threat_level()` 在白昼/蓝时为 0，在入夜时为 1，之后每 `night_threat_seconds=25` 秒增加一级；HUD 语义保留。战斗等级 `L=max(1, threat_level())`，每次新出勤的原时钟重新从白昼开始。当前没有已实施的长期城市侵蚀等级，不把日数额外叠加为第二套威胁。

```text
最终 max_hp = 30 × [1 + (L - 1) × 0.08] × 当前阶段 hp
最终 attack_damage = 8 × [1 + (L - 1) × 0.05] × 当前阶段 damage
```

| 阶段 | HP 倍率 | 伤害倍率 | 刷怪倍率 | Level 1 HP / 伤害 |
| --- | ---: | ---: | ---: | ---: |
| DAY | 1.00 | 1.00 | 1.00 | 30 / 8 |
| BLUE_HOUR | 1.05 | 1.10 | 1.35 | 31.5 / 8.8 |
| NIGHT | 1.15 | 1.25 | 1.80 | 34.5 / 10 |

例如 Night Level 3 为 40.02 HP / 11 伤害；Level 5 为 45.54 HP / 12 伤害。保持浮点，不提前取整；角色原有天赋、护甲等承伤减免仍在角色端应用一次。

所有倍率配置在原 `data/map_data.gd`：`threat_hp_step`、`threat_damage_step`、`enemy_phase_hp`、`enemy_phase_damage`、`enemy_phase_spawn`，地图 `.tres` 可直接覆盖。敌人自己的 `max_hp` / `attack_damage` 是运行时值。阶段切换与夜间升级更新活跃实例，保留当前 HP 比例；不会回满血、复活或改写共享 EnemyDefinition。对象池重生重新计算当时属性并恢复满血、碰撞与计时器。

第一版移动速度全阶段保持 2.0，移除旧版夜间额外加速。现有刷怪器保留每批 DAY=1、BLUE_HOUR=2、NIGHT=min(8, 2+临时警戒) 和 85 只上限；刷怪间隔为 `max(1.8, 原时段间隔 / spawn_multiplier)`。原时段间隔分别为 26、13、`7/(1+临时警戒×0.22)` 秒，因此 Level 1 时约为 26 / 9.63 / 3.19 秒。初始地图遭遇不额外乘倍率。

继续沿用原 AStar 路径与墙体检测。12 米内获取目标，追逐到 18 米才丢失；夜间也尊重这两个定义值。攻击起手锁定目标，在 0.35 秒后复核存活、0.9 米距离与墙体；离开范围可躲过该次攻击。死亡、清除和对象池重生都会清除未结算攻击，不会把前一次实例状态带给新出生敌人。

## 旧资源引用

四个旧内容定义 `shambler.tres`、`runner.tres`、`hound.tres`、`siren.tres` 已删除，正式数据、初始遭遇和运行时脚本不再注册或生成旧敌人。没有为旧 ID 增加兼容映射。

旧 `assets/generated/character_infected_basic_model.glb` 及 Blender 源仍保留在既有生成资产库，manifest 和既有美术展厅/全资产验证仍会引用它。它不参与正常新游戏、营地、外出或刷怪。原几何拼装工具保留给尚未替换的幸存者，敌人代码已不再调用它。

## 实际验证

专项入口 `tests/infected_basic.gd` 使用正式 Mission 和敌人场景；`tests/infected_runtime.gd` 复用现有完整街区流程与原生合成输入，所有存档隔离于 `user://test-runs/`。不将自动化的时间压缩流程表述为人工试玩或平衡定稿。

| 实际执行 | 结果 |
| --- | --- |
| 正式感染者专项 | 74 项通过：模型高度/接地、全部基础值、三阶段与 Threat 3/5、受伤比例、探测/丢失、前摇/冷却、离开范围/墙体复核、死亡及对象池重置 |
| 玩法 Headless 总计 | 842 项通过，含上述专项；三条专属路线均完成五日真实战斗与结算，单人生存、搜刮自卫和全员撤离通过 |
| 地图与资产 | world_assets 131、world_map 1074、art_integration 187 项通过，既有 52 项资产实际加载通过 |
| 正式流程原生专项 | 189 项通过；1440×900、Godot 4.7.2 Compatibility / RTX 3060，实际新游戏→搜集路线→营地→外出→搜索→蓝时→夜晚→撤离→结算→营地；合成输入和时间压缩，无无敌、瞬移或强制结算 |
| 既有原生输入专项 | 53 项通过，含模型点击集火、敌人伤害、搜索暂停/恢复、调试刷怪、昼夜与返航 |
| 完整构建内的原生街区回归 | 41 项通过 |
| Windows 单文件 EXE | 已交付，主菜单/营地/外出和既有展厅共 8 项独立 Headless / 原生启动通过，展厅内 52 项资源打包后全部可加载 |

首次搜刮/单人回归沿用了 0.2 秒受伤假设，现按接近距离与 0.35 秒前摇验证；保留并实测双方实际扣血，没有移除自卫断言。打包末尾发现既有 `debug/art_showcase.gd` 未声明新灯光接口的 `lamp_materials`，补齐空列表后，源场景 `--art-showcase` 启动与 52 资产加载无错误。

交付文件 `build/BlueHourHomeward.exe`，406,546,760 bytes，SHA-256：`8A25D33F3F7258EAD30BDDACD3BCD57ED19AB9E2404A91D9BF1B2DD2CE7DDA05`。最后一次批量构建已通过所有源程序检查并生成相同文件，但用户已从资源管理器打开 EXE，Windows 拒绝替换运行中的文件。实测现有 EXE 与这次生成的临时文件哈希完全一致；保留用户窗口，将该 EXE 复制到独立目录后重新执行全部 8 项启动验证，均通过。没有用历史版本冒充本次产物，也没有关闭用户游戏。

实际截图与报告位于本机 `test-output/infected-*.png`、`infected-runtime.json`、`infected-controls.log`、`infected-build-release.log` 和 `infected-release-verification.json`。中文编码检查通过；Git Bash 执行根文档链接严格检查通过，定向复查 146 个本地文档链接全部可解析。部分 Headless 退出仍偶发既有 ObjectDB 释放警告，运行检查没有脚本错误；不声称这些退出警告或人工手感验收已解决。

## 本次修改文件

- 运行时：`data/enemy_data.gd`、`data/catalog.gd`、`data/map_data.gd`、`enemies/enemy.gd`、`time/mission_clock.gd`、`missions/mission.gd`、`missions/threat_selector.gd`、`survivors/aim_fire.gd`、`maps/generation/enemy_spawner.gd`。
- 新定义与场景：`data/enemies/enm_001_infected_basic_a.tres`、`scenes/enemies/enm_001_infected_basic_a.tscn`。
- 模型目录：`assets/characters/infected_basic_a/model/` 内 1 个 GLB、3 张 JPG、1 个材质 `.tres`，以及 4 个 `.import`。
- 删除旧定义：`data/enemies/{shambler,runner,hound,siren}.tres`。
- 测试与构建：`tests/infected_basic.gd`、`tests/infected_runtime.gd` 及其 UID；更新 `tests/rules.gd`、`tests/mission_flow.gd`、`tests/search_dispatch.gd`、`tests/parallel_commands.gd`、`tests/day_loop_flow.gd`、`tests/effect_system.gd`、`tests/runtime.gd` 中的旧敌人 ID / 数值假设；`run.ps1` 增加正式感染者检查；`debug/art_showcase.gd` 补齐共享灯光字段以恢复完整构建验收。
- 资源登记与文档：`art/infected_source.json`、`art/RESOURCE_LAYOUT.md`、`art/ART_BIBLE.md`、`art/MODEL_CATALOG.md`、`docs/PLAN.md`、本文件。

工作区中并行的街区/巴士资产、营地、HUD 等改动不计入本次感染者交付清单；在现有文件中只追加本任务需要的修改。
