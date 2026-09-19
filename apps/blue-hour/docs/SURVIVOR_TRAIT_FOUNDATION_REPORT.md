# SurvivorDefinition + Trait Runtime Foundation

2026-09-19。角色资料以用户提供的 [Survivor 数据表](SURVIVOR_DATA_TABLE.md)为唯一来源，只实现 SUR_001 / SUR_002。

## 架构与数据

- `data/survivor_definition.gd` 继承 SurvivorData，正式定义保持 `data/survivors/xia_zhiyao.tres`、`su_wanxing.tres`。新增 survivor_id 为 SUR_001/SUR_002，旧 id 保留作兼容存档模板键。
- background_title/background_description、model_resource/portrait、base_hp/base_move_speed 通过现有 profession_name/description、model_path/portrait_path、max_hp/move_speed 暴露，避免双份真源。Trait 名称/描述/levels 读取关联 Trait Resource。
- 身份、背景原文、推荐武器按数据表；苏身份采用详情段“活动物资管理 / 采购兼职”。推荐武器标签只有数据意义，没有装备限制或伤害加成。基础 HP=100、速度=2.8m/s。
- `core/trait_runtime.gd` 按 modifier_hook 派发，禁止角色身份分支。search_speed / loot_reward 已实现；damage/healing/interaction/aura/max_hp/loot_quality/damage_reduction/power_cooldown 为未激活扩展合同。
- `data/traits/search_instinct.tres`：12/15/18/21/25%；`resource_efficiency.tres`：8/10/12/14/16%。
- Trait Level 复用已有、可保存升级的 `campaign.data.roster[member_id].level`，默认1、上限5。`member_trait_level()` / `TraitData.at_level()` 读取 levels[level-1]；验证了训练、上限、JSON保存/恢复，不新增升级UI。

## Gameplay Hook

搜索：TraitRuntime.search_speed → TraitData.at_level().search_multiplier → 原 SearchTask.advance → effect_modifiers.search_seconds，采用 `base/(1+bonus)`。原有工具/Power的search_time乘数及0.2s安全下限保留。UI直接读取实际duration推进的site.progress，不另写计时器。

奖励：Mission._update_pickups → 实际拾取者talent → RunLedger.collect_resources → TraitRuntime.reward_amount → 原add_loot/settlement → search_loot_collected/notice HUD。新增resources_collected信号携带最终量。独立trait_rng不消耗原掉落生成RNG；每次正数同类资源grant判定一次，命中只+1，不按单位连抽、不递归触发；先计算原resource_yield再加精确1份。

`data/reward_definition.gd` 定义Category/Rarity/tags；`data/resources/food.tres`、`scrap.tres`登记RESOURCE + basic_resource。Trait内没有资源名称。Weapon/Equipment/Power/Unlock/Quest/Special即使误贴标签也排除，Rare/Epic/Legendary资源排除。未知资源名可以只凭合格分类和标签工作。

## 验收

- Trait数据/概率/保存44项PASS；正式搜索/拾取111项PASS；Town/HUD13项PASS。
- Camp → Mission Selection → Expedition原生流程28项PASS；双角色Spawn/Public Locomotion495项PASS；Survivor Command43项PASS。
- 499项资源扫描：Missing Resource=0、Invalid UID=0、旧生产引用=0。
- 107项冻结模型/骨架/动画/Skin/工具链/Ground/武器文件哈希未变，速度仍2.8m/s。
- 苏Lv1/Lv5各100,000次正式Ledger奖励，种子20260919，分别7932/16018次proc，即7.932%/16.018%，目标8%/16%。事件、账本、结算总量一致，已结算/已拾取奖励不重复。
- 排除测试将测试副本设为100%概率避免随机假通过；生产值不变。真实武器拾取只入库一次，不产生基础资源。
- 夏同目标Baseline/Lv1/Lv5均通过；120Hz完成误差最多一个tick，Reward同seed完全一致；Cancel/Move/进度UI/完成/入库正常。

Town seed4101正式A00_P00：8s → 7.142857s / 6.4s，半程HUD=50%，精确duration完成。Town装饰车辆尚未开放搜索，本轮未改；车辆测试使用现有FIXED_LEGACY正式车辆管线。第三种现有Searchable配置为大型仓库（18s），仍属建筑型搜刮点；当前没有独立非建筑/非车辆的第三种交互，本轮没有伪造目标来宣称覆盖。

扩展旧effect_system：324 checks、2个action_elapsed断言失败，并出现缺失corner站点的脚本错误；夹具使用lin/qiao/yan。未修改这些时钟/地图行为，也不声明全项目Runtime Error=0。Trait专项及生产流程日志无Runtime Error，旧扩展错误单列。

证据：`test-output/trait-foundation/` 下statistics.json、gameplay.json、town.json、flow.json、resources.json、frozen-check.json与日志。原生截图在`test-output/survivor-production/flow/`。Windows实际重新导出，隔离目录原生独立启动exit 0、stderr为空；证据见build-info.json。

## 结论

- SurvivorDefinition Foundation：PASS
- Trait Runtime Foundation：PASS
- SUR_001 搜寻直觉：PASS（覆盖现有三种搜索配置，没有新增第三类交互）
- SUR_002 精打细算：PASS

未修改SearchTask/UI、模型、动画、Ground、移动速度或武器系统。仅数据、Trait Runtime、Campaign等级访问、Ledger奖励修饰及Mission接线。run.ps1加入三项Trait检查。SUR_003～SUR_012未实现，完成后停止。

## 搜索计时明细

| 目标 | Baseline s | Lv1 理论 / 实测 s | Lv5 理论 / 实测 s |
|---|---:|---:|---:|
| 林荫住宅 A (house_a) | 8.0000 | 7.142857 / 7.1500 | 6.400000 / 6.4000 |
| 配送面包车 (van_south) | 4.0000 | 3.571429 / 3.5750 | 3.200000 / 3.2000 |
| 北街货站 (north_depot) | 18.0000 | 16.071429 / 16.0750 | 14.400000 / 14.4000 |
