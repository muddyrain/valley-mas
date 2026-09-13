# 营地设计

营地是持续存在的 3D 场景，Camp UI 覆盖在主 Viewport 上。主站、工坊、温室、生活区和蓝时号泊位通过统一的 CampInteractable 描述节点触发面板。

- PartyPanel、SurvivorDrawer、库存、武器、效果和今日行动都读取 Campaign 与 Resource 真源。
- 角色详情、换装、转交、训练和商店购买使用一次保存事务，失败时回滚。
- 今日行动是营地内的临时草稿；确认后锁定行动 ID、地图 Resource 和出战名单。
- 出发阶段锁定破坏性操作，成员按 PartyPoint 集结、上车，车辆驶离后加载 Mission。
- 工坊、温室的正式玩法仍未开放；界面只显示现有能力或待开放状态。

## 视觉摆放约束

营地四个核心道具使用正式 Asset ID：`CAMP_PROP_001_workbench`、`CAMP_PROP_002_storage_shelf`、`CAMP_PROP_003_notice_board`、`CAMP_PROP_004_generator`。布局与仓储托盘位置由当前场景和 `camp/camp_dressing.gd` 维护，调整不得改变 GLB、HUD、Gameplay 或出发流程。
