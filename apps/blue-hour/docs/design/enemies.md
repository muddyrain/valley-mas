# 敌人设计

当前唯一正式普通敌人为 `ENM_001_infected_basic_a`。

- 数据：`data/enemies/enm_001_infected_basic_a.tres`
- 场景：`scenes/enemies/enm_001_infected_basic_a.tscn`
- 正式运行模型：`assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k.glb`
- 动画：`Zombie_Idle`、`Zombie_Walk`、`Zombie_Chase`

基础属性和昼夜倍率由 EnemyDefinition 与地图数据驱动。夜间提高生命、伤害和刷怪倍率；不创建第二套威胁管理器。旧敌人定义不再注册，legacy 资产仅作历史参考。
