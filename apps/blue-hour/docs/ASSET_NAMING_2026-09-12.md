# 资源文件命名规范化报告

本报告保留当时的完整迁移映射。两名角色后来按用户要求采用 canonical name 与 source/runtime 阶段目录，当前规则见 [角色替换报告](CHARACTER_REPLACEMENT_REPORT.md)；这里的角色路径不再代表当前加载配置。

日期：2026-09-12。在上一轮目录迁移完成后的工作区上进行命名规范化；本报告的“旧路径”是本轮开始时的路径。上一轮目录迁移记录保留原貌并链接到本报告。

## 数量与范围

| 项目 | 数量 |
| --- | ---: |
| 重命名现有正式资源 | **122**（54 PNG、12 JPG、56 GLB） |
| 同步重命名相邻 `.import` | 122（不重复计入素材数） |
| 跨目录移动 | **0** |
| 删除资源 | **0** |
| 保存已有角色材质为外部 `.tres` | 4（已有材质引用，不是新增美术内容） |
| 当前资源文件中的历史顺序／批次／临时名称 | **0** |
| 当前有效加载引用中的旧资源路径 | **0** |

122 个图片／模型文件逐一与本轮开始时的 SHA-256 比较，全部字节一致；UID 全部保留。118 个普通资源的导入参数不变；4 个角色 GLB 仅调整原生外部材质引用及内嵌纹理提取方式，详见下文。未修改图片、模型内容、UI 布局、玩法、数值、角色 ID、道具／技能 ID 或模型内部节点名。

## 命名与领域判断

- 全部资源文件采用 `lowercase_snake_case`。物品和技能使用 `<domain>_<object>_<asset_type>`；UI 使用 `<screen>_<element>_<state>`，共享 UI 使用 `ui_common_`。只对有交互状态的图片使用状态后缀，不为静态海报和标题虚构 normal。
- `catalog.gd` 将 `shooting_target`、`replicator`、`early_start` 列入 `passives`；`new_game_screen.gd` 将它们呈现为“起始道具”，因此射击目标、复印机和咖啡仍归 `items/`。`rage`、`sprint`、`aid` 属于 `powers`，归 `skills/`。本轮没有发现需要改换领域的文件。
- 同一对象共享词干：复印机使用 `item_replicator_`；疾行号令使用 `skill_sprint_`。咖啡和全地图治疗使用 `coffee`、`map_healing` 表达真实显示含义，对应历史数据 ID `early_start`、`aid`，不改写数据 ID。
- 旧 `42_tab_combat_hover.png` 实际用于选中态，改成 `route_selection_combat_tab_selected.png`。搜集／勘查的原始选中图使用 `tab_source_selected`，其派生运行图使用 `tab_selected`；`source` 表示原稿资产角色，两组图片都保留，来源关系同步更新。
- 模型文件使用 `environment_`、`vehicle_`、`weapon_`、`character_` 前缀，去掉 `BH_` 文件名前缀和 `_01`／`_02` 序号。单臂／双臂路灯分别使用 `single_arm`／`double_arm`，不丢失真实对象区别。
- 保留 `generated/` 这一现有生成管线边界和简洁领域目录，不因文件重命名拆分大量对象目录。内部 `BH_*` ID、GLB 节点／材质名与 `art/blender/sources/` 的源工程文件名保持稳定；这些不属于本轮 assets 文件命名，不能为消除文本命中而修改模型内容。

长期新增规则见 [资源目录说明](../art/RESOURCE_LAYOUT.md)。

## 逐项旧名 → 新名

以下路径相对 Godot 工程根目录，即可加 `res://`；相邻 `.import` 同名跟随。每行仅重命名，不跨目录。

| 旧文件路径 | 新文件路径 |
| --- | --- |
| `assets/characters/su_wanxing/model/su_wanxing.glb` | `assets/characters/su_wanxing/model/character_su_wanxing_model.glb` |
| `assets/characters/su_wanxing/model/su_wanxing_Image_0.jpg` | `assets/characters/su_wanxing/model/character_su_wanxing_albedo_texture.jpg` |
| `assets/characters/su_wanxing/model/su_wanxing_Image_1.jpg` | `assets/characters/su_wanxing/model/character_su_wanxing_metallic_roughness_texture.jpg` |
| `assets/characters/su_wanxing/model/su_wanxing_Image_2.jpg` | `assets/characters/su_wanxing/model/character_su_wanxing_normal_texture.jpg` |
| `assets/characters/su_wanxing/source/su_wanxing_meshy_50k.glb` | `assets/characters/su_wanxing/source/character_su_wanxing_source_model.glb` |
| `assets/characters/su_wanxing/source/su_wanxing_meshy_50k_Image_0.jpg` | `assets/characters/su_wanxing/source/character_su_wanxing_source_albedo_texture.jpg` |
| `assets/characters/su_wanxing/source/su_wanxing_meshy_50k_Image_1.jpg` | `assets/characters/su_wanxing/source/character_su_wanxing_source_metallic_roughness_texture.jpg` |
| `assets/characters/su_wanxing/source/su_wanxing_meshy_50k_Image_2.jpg` | `assets/characters/su_wanxing/source/character_su_wanxing_source_normal_texture.jpg` |
| `assets/characters/xia_zhiyao/model/xia_zhiyao.glb` | `assets/characters/xia_zhiyao/model/character_xia_zhiyao_model.glb` |
| `assets/characters/xia_zhiyao/model/xia_zhiyao_Image_0.jpg` | `assets/characters/xia_zhiyao/model/character_xia_zhiyao_albedo_texture.jpg` |
| `assets/characters/xia_zhiyao/model/xia_zhiyao_Image_1.jpg` | `assets/characters/xia_zhiyao/model/character_xia_zhiyao_metallic_roughness_texture.jpg` |
| `assets/characters/xia_zhiyao/model/xia_zhiyao_Image_2.jpg` | `assets/characters/xia_zhiyao/model/character_xia_zhiyao_normal_texture.jpg` |
| `assets/characters/xia_zhiyao/source/xia_zhiyao_meshy_50k.glb` | `assets/characters/xia_zhiyao/source/character_xia_zhiyao_source_model.glb` |
| `assets/characters/xia_zhiyao/source/xia_zhiyao_meshy_50k_Image_0.jpg` | `assets/characters/xia_zhiyao/source/character_xia_zhiyao_source_albedo_texture.jpg` |
| `assets/characters/xia_zhiyao/source/xia_zhiyao_meshy_50k_Image_1.jpg` | `assets/characters/xia_zhiyao/source/character_xia_zhiyao_source_metallic_roughness_texture.jpg` |
| `assets/characters/xia_zhiyao/source/xia_zhiyao_meshy_50k_Image_2.jpg` | `assets/characters/xia_zhiyao/source/character_xia_zhiyao_source_normal_texture.jpg` |
| `assets/generated/BH_AC_Outdoor.glb` | `assets/generated/environment_air_conditioner_outdoor_model.glb` |
| `assets/generated/BH_AR_01.glb` | `assets/generated/weapon_assault_rifle_model.glb` |
| `assets/generated/BH_AbandonedCar_01.glb` | `assets/generated/vehicle_abandoned_sedan_model.glb` |
| `assets/generated/BH_Awning.glb` | `assets/generated/environment_awning_model.glb` |
| `assets/generated/BH_Barricade_Metal.glb` | `assets/generated/environment_barricade_metal_model.glb` |
| `assets/generated/BH_Barrier_Concrete.glb` | `assets/generated/environment_barrier_concrete_model.glb` |
| `assets/generated/BH_Bench_01.glb` | `assets/generated/environment_bench_model.glb` |
| `assets/generated/BH_Building_Pharmacy_01.glb` | `assets/generated/environment_building_pharmacy_model.glb` |
| `assets/generated/BH_Building_Supermarket_01.glb` | `assets/generated/environment_building_supermarket_model.glb` |
| `assets/generated/BH_Building_Warehouse_01.glb` | `assets/generated/environment_building_warehouse_model.glb` |
| `assets/generated/BH_Car_Hatchback_01.glb` | `assets/generated/vehicle_car_hatchback_model.glb` |
| `assets/generated/BH_Car_Sedan_01.glb` | `assets/generated/vehicle_car_sedan_model.glb` |
| `assets/generated/BH_Crosswalk.glb` | `assets/generated/environment_crosswalk_model.glb` |
| `assets/generated/BH_Curb.glb` | `assets/generated/environment_curb_model.glb` |
| `assets/generated/BH_Door_Normal.glb` | `assets/generated/environment_door_standard_model.glb` |
| `assets/generated/BH_Door_Shop.glb` | `assets/generated/environment_door_shop_model.glb` |
| `assets/generated/BH_EvacBus_01.glb` | `assets/generated/vehicle_evacuation_bus_model.glb` |
| `assets/generated/BH_Fence.glb` | `assets/generated/environment_fence_model.glb` |
| `assets/generated/BH_Fence_Broken.glb` | `assets/generated/environment_fence_broken_model.glb` |
| `assets/generated/BH_GarbageBag_Set.glb` | `assets/generated/environment_garbage_bags_model.glb` |
| `assets/generated/BH_Infected_Basic_Placeholder.glb` | `assets/generated/character_infected_basic_model.glb` |
| `assets/generated/BH_MetalCrate.glb` | `assets/generated/environment_metal_crate_model.glb` |
| `assets/generated/BH_Pallet.glb` | `assets/generated/environment_pallet_model.glb` |
| `assets/generated/BH_Pistol_01.glb` | `assets/generated/weapon_pistol_model.glb` |
| `assets/generated/BH_RoadSign.glb` | `assets/generated/environment_road_sign_model.glb` |
| `assets/generated/BH_Road_Corner.glb` | `assets/generated/environment_road_corner_model.glb` |
| `assets/generated/BH_Road_Cross.glb` | `assets/generated/environment_road_cross_model.glb` |
| `assets/generated/BH_Road_Straight.glb` | `assets/generated/environment_road_straight_model.glb` |
| `assets/generated/BH_Road_TJunction.glb` | `assets/generated/environment_road_tjunction_model.glb` |
| `assets/generated/BH_Roller_Shutter.glb` | `assets/generated/environment_roller_shutter_model.glb` |
| `assets/generated/BH_Roof_Edge.glb` | `assets/generated/environment_roof_edge_model.glb` |
| `assets/generated/BH_Roof_Flat.glb` | `assets/generated/environment_roof_flat_model.glb` |
| `assets/generated/BH_SMG_01.glb` | `assets/generated/weapon_submachine_gun_model.glb` |
| `assets/generated/BH_Searchable_CarTrunk.glb` | `assets/generated/environment_searchable_car_trunk_model.glb` |
| `assets/generated/BH_Searchable_Crate.glb` | `assets/generated/environment_searchable_crate_model.glb` |
| `assets/generated/BH_Searchable_Dumpster.glb` | `assets/generated/environment_searchable_dumpster_model.glb` |
| `assets/generated/BH_Searchable_VendingMachine.glb` | `assets/generated/environment_searchable_vending_machine_model.glb` |
| `assets/generated/BH_Shotgun_01.glb` | `assets/generated/weapon_shotgun_model.glb` |
| `assets/generated/BH_Sidewalk_Corner.glb` | `assets/generated/environment_sidewalk_corner_model.glb` |
| `assets/generated/BH_Sidewalk_Straight.glb` | `assets/generated/environment_sidewalk_straight_model.glb` |
| `assets/generated/BH_Storefront_Frame.glb` | `assets/generated/environment_storefront_frame_model.glb` |
| `assets/generated/BH_StreetLamp_01.glb` | `assets/generated/environment_street_lamp_single_arm_model.glb` |
| `assets/generated/BH_StreetLamp_02.glb` | `assets/generated/environment_street_lamp_double_arm_model.glb` |
| `assets/generated/BH_TrafficCone.glb` | `assets/generated/environment_traffic_cone_model.glb` |
| `assets/generated/BH_TrashBin_01.glb` | `assets/generated/environment_trash_bin_model.glb` |
| `assets/generated/BH_Van_01.glb` | `assets/generated/vehicle_van_model.glb` |
| `assets/generated/BH_VendingMachine.glb` | `assets/generated/environment_vending_machine_model.glb` |
| `assets/generated/BH_Wall_Brick.glb` | `assets/generated/environment_wall_brick_model.glb` |
| `assets/generated/BH_Wall_Concrete.glb` | `assets/generated/environment_wall_concrete_model.glb` |
| `assets/generated/BH_Window_Large.glb` | `assets/generated/environment_window_large_model.glb` |
| `assets/generated/BH_Window_Small.glb` | `assets/generated/environment_window_small_model.glb` |
| `assets/generated/BH_WoodCrate.glb` | `assets/generated/environment_wood_crate_model.glb` |
| `assets/items/cards/25_card_printer.png` | `assets/items/cards/item_replicator_card.png` |
| `assets/items/cards/coffee.png` | `assets/items/cards/item_coffee_card.png` |
| `assets/items/cards/shooting_target.png` | `assets/items/cards/item_shooting_target_card.png` |
| `assets/items/illustrations/27_illustration_printer.png` | `assets/items/illustrations/item_replicator_illustration.png` |
| `assets/skills/cards/26_card_speed.png` | `assets/skills/cards/skill_sprint_card.png` |
| `assets/skills/cards/map_heal.png` | `assets/skills/cards/skill_map_healing_card.png` |
| `assets/skills/cards/rage.png` | `assets/skills/cards/skill_rage_card.png` |
| `assets/skills/icons/29_icon_run.png` | `assets/skills/icons/skill_sprint_icon.png` |
| `assets/skills/illustrations/28_illustration_shoes.png` | `assets/skills/illustrations/skill_sprint_illustration.png` |
| `assets/ui/common/backgrounds/home_background.png` | `assets/ui/common/backgrounds/ui_common_background.png` |
| `assets/ui/common/branding/01_logo.png` | `assets/ui/common/branding/ui_common_logo.png` |
| `assets/ui/common/branding/02_logo_tagline.png` | `assets/ui/common/branding/ui_common_logo_tagline_compact.png` |
| `assets/ui/common/branding/03_handwritten_tagline.png` | `assets/ui/common/branding/ui_common_handwritten_tagline.png` |
| `assets/ui/common/branding/brand_tagline.png` | `assets/ui/common/branding/ui_common_logo_tagline.png` |
| `assets/ui/common/buttons/blue_button.png` | `assets/ui/common/buttons/ui_common_blue_button_normal.png` |
| `assets/ui/common/cards/20_card_paper.png` | `assets/ui/common/cards/ui_common_card_paper.png` |
| `assets/ui/common/cards/21_card_brush.png` | `assets/ui/common/cards/ui_common_card_brush.png` |
| `assets/ui/common/cards/22_card_name_strip.png` | `assets/ui/common/cards/ui_common_card_name_strip.png` |
| `assets/ui/common/cards/23_card_composite.png` | `assets/ui/common/cards/ui_common_card_background.png` |
| `assets/ui/common/icons/16_icon_lock.png` | `assets/ui/common/icons/ui_common_lock_icon.png` |
| `assets/ui/common/icons/30_icon_tent.png` | `assets/ui/common/icons/ui_common_camp_icon.png` |
| `assets/ui/common/icons/35_icon_confirm_arrow.png` | `assets/ui/common/icons/ui_common_confirm_arrow_icon.png` |
| `assets/ui/common/icons/36_icon_small_arrow.png` | `assets/ui/common/icons/ui_common_small_arrow_icon.png` |
| `assets/ui/common/panels/paper_panel.png` | `assets/ui/common/panels/ui_common_paper_panel.png` |
| `assets/ui/common/progress/40_xp_track.png` | `assets/ui/common/progress/ui_common_experience_track.png` |
| `assets/ui/common/progress/41_xp_fill.png` | `assets/ui/common/progress/ui_common_experience_fill.png` |
| `assets/ui/main_menu/icons_hover.png` | `assets/ui/main_menu/main_menu_navigation_icons_hover.png` |
| `assets/ui/main_menu/icons_normal.png` | `assets/ui/main_menu/main_menu_navigation_icons_normal.png` |
| `assets/ui/main_menu/poster.png` | `assets/ui/main_menu/main_menu_poster.png` |
| `assets/ui/main_menu/social_entries.png` | `assets/ui/main_menu/main_menu_social_entries.png` |
| `assets/ui/route_selection/04_route_title.png` | `assets/ui/route_selection/route_selection_title.png` |
| `assets/ui/route_selection/05_compass.png` | `assets/ui/route_selection/route_selection_compass_decoration.png` |
| `assets/ui/route_selection/06_title_line_left.png` | `assets/ui/route_selection/route_selection_title_divider_left.png` |
| `assets/ui/route_selection/07_title_line_right.png` | `assets/ui/route_selection/route_selection_title_divider_right.png` |
| `assets/ui/route_selection/08_board.png` | `assets/ui/route_selection/route_selection_board_panel.png` |
| `assets/ui/route_selection/09_tab_combat.png` | `assets/ui/route_selection/route_selection_combat_tab_normal.png` |
| `assets/ui/route_selection/10_tab_scavenge.png` | `assets/ui/route_selection/route_selection_scavenge_tab_normal.png` |
| `assets/ui/route_selection/11_tab_survey.png` | `assets/ui/route_selection/route_selection_survey_tab_normal.png` |
| `assets/ui/route_selection/12_tab_locked.png` | `assets/ui/route_selection/route_selection_tab_locked.png` |
| `assets/ui/route_selection/13_icon_combat.png` | `assets/ui/route_selection/route_selection_combat_icon.png` |
| `assets/ui/route_selection/14_icon_scavenge.png` | `assets/ui/route_selection/route_selection_scavenge_icon.png` |
| `assets/ui/route_selection/15_icon_survey.png` | `assets/ui/route_selection/route_selection_survey_icon.png` |
| `assets/ui/route_selection/17_tab_tape.png` | `assets/ui/route_selection/route_selection_tab_tape.png` |
| `assets/ui/route_selection/18_tab_progress_frame.png` | `assets/ui/route_selection/route_selection_tab_progress_frame.png` |
| `assets/ui/route_selection/31_tent_sticker.png` | `assets/ui/route_selection/route_selection_unlock_tent_sticker.png` |
| `assets/ui/route_selection/32_button_cancel.png` | `assets/ui/route_selection/route_selection_cancel_button_normal.png` |
| `assets/ui/route_selection/33_button_confirm.png` | `assets/ui/route_selection/route_selection_confirm_button_normal.png` |
| `assets/ui/route_selection/34_button_unlock.png` | `assets/ui/route_selection/route_selection_unlock_button_normal.png` |
| `assets/ui/route_selection/38_tooltip_badge.png` | `assets/ui/route_selection/route_selection_tooltip_skill_badge.png` |
| `assets/ui/route_selection/42_tab_combat_hover.png` | `assets/ui/route_selection/route_selection_combat_tab_selected.png` |
| `assets/ui/route_selection/43_tab_scavenge_hover.png` | `assets/ui/route_selection/route_selection_scavenge_tab_source_selected.png` |
| `assets/ui/route_selection/44_tab_survey_hover.png` | `assets/ui/route_selection/route_selection_survey_tab_source_selected.png` |
| `assets/ui/route_selection/45_tab_scavenge_selected.png` | `assets/ui/route_selection/route_selection_scavenge_tab_selected.png` |
| `assets/ui/route_selection/46_tab_survey_selected.png` | `assets/ui/route_selection/route_selection_survey_tab_selected.png` |

## 最终 assets 目录树

下列列出源资源与配置，省略与每个图片／GLB 配套的 `.import`，不展示 Godot 缓存。

```text
assets/
├─ characters/
│  ├─ su_wanxing/
│  │  ├─ model/
│  │  │  ├─ character_su_wanxing_albedo_texture.jpg
│  │  │  ├─ character_su_wanxing_material.tres
│  │  │  ├─ character_su_wanxing_metallic_roughness_texture.jpg
│  │  │  ├─ character_su_wanxing_model.glb
│  │  │  └─ character_su_wanxing_normal_texture.jpg
│  │  └─ source/
│  │     ├─ character_su_wanxing_source_albedo_texture.jpg
│  │     ├─ character_su_wanxing_source_material.tres
│  │     ├─ character_su_wanxing_source_metallic_roughness_texture.jpg
│  │     ├─ character_su_wanxing_source_model.glb
│  │     └─ character_su_wanxing_source_normal_texture.jpg
│  └─ xia_zhiyao/
│     ├─ model/
│     │  ├─ character_xia_zhiyao_albedo_texture.jpg
│     │  ├─ character_xia_zhiyao_material.tres
│     │  ├─ character_xia_zhiyao_metallic_roughness_texture.jpg
│     │  ├─ character_xia_zhiyao_model.glb
│     │  └─ character_xia_zhiyao_normal_texture.jpg
│     └─ source/
│        ├─ character_xia_zhiyao_source_albedo_texture.jpg
│        ├─ character_xia_zhiyao_source_material.tres
│        ├─ character_xia_zhiyao_source_metallic_roughness_texture.jpg
│        ├─ character_xia_zhiyao_source_model.glb
│        └─ character_xia_zhiyao_source_normal_texture.jpg
├─ generated/
│  ├─ character_infected_basic_model.glb
│  ├─ environment_air_conditioner_outdoor_model.glb
│  ├─ environment_awning_model.glb
│  ├─ environment_barricade_metal_model.glb
│  ├─ environment_barrier_concrete_model.glb
│  ├─ environment_bench_model.glb
│  ├─ environment_building_pharmacy_model.glb
│  ├─ environment_building_supermarket_model.glb
│  ├─ environment_building_warehouse_model.glb
│  ├─ environment_crosswalk_model.glb
│  ├─ environment_curb_model.glb
│  ├─ environment_door_shop_model.glb
│  ├─ environment_door_standard_model.glb
│  ├─ environment_fence_broken_model.glb
│  ├─ environment_fence_model.glb
│  ├─ environment_garbage_bags_model.glb
│  ├─ environment_metal_crate_model.glb
│  ├─ environment_pallet_model.glb
│  ├─ environment_road_corner_model.glb
│  ├─ environment_road_cross_model.glb
│  ├─ environment_road_sign_model.glb
│  ├─ environment_road_straight_model.glb
│  ├─ environment_road_tjunction_model.glb
│  ├─ environment_roller_shutter_model.glb
│  ├─ environment_roof_edge_model.glb
│  ├─ environment_roof_flat_model.glb
│  ├─ environment_searchable_car_trunk_model.glb
│  ├─ environment_searchable_crate_model.glb
│  ├─ environment_searchable_dumpster_model.glb
│  ├─ environment_searchable_vending_machine_model.glb
│  ├─ environment_sidewalk_corner_model.glb
│  ├─ environment_sidewalk_straight_model.glb
│  ├─ environment_storefront_frame_model.glb
│  ├─ environment_street_lamp_double_arm_model.glb
│  ├─ environment_street_lamp_single_arm_model.glb
│  ├─ environment_traffic_cone_model.glb
│  ├─ environment_trash_bin_model.glb
│  ├─ environment_vending_machine_model.glb
│  ├─ environment_wall_brick_model.glb
│  ├─ environment_wall_concrete_model.glb
│  ├─ environment_window_large_model.glb
│  ├─ environment_window_small_model.glb
│  ├─ environment_wood_crate_model.glb
│  ├─ manifest.json
│  ├─ vehicle_abandoned_sedan_model.glb
│  ├─ vehicle_car_hatchback_model.glb
│  ├─ vehicle_car_sedan_model.glb
│  ├─ vehicle_evacuation_bus_model.glb
│  ├─ vehicle_van_model.glb
│  ├─ weapon_assault_rifle_model.glb
│  ├─ weapon_pistol_model.glb
│  ├─ weapon_shotgun_model.glb
│  └─ weapon_submachine_gun_model.glb
├─ items/
│  ├─ cards/
│  │  ├─ item_coffee_card.png
│  │  ├─ item_replicator_card.png
│  │  └─ item_shooting_target_card.png
│  └─ illustrations/
│     └─ item_replicator_illustration.png
├─ skills/
│  ├─ cards/
│  │  ├─ skill_map_healing_card.png
│  │  ├─ skill_rage_card.png
│  │  └─ skill_sprint_card.png
│  ├─ icons/
│  │  └─ skill_sprint_icon.png
│  └─ illustrations/
│     └─ skill_sprint_illustration.png
└─ ui/
   ├─ common/
   │  ├─ backgrounds/
   │  │  └─ ui_common_background.png
   │  ├─ branding/
   │  │  ├─ ui_common_handwritten_tagline.png
   │  │  ├─ ui_common_logo.png
   │  │  ├─ ui_common_logo_tagline.png
   │  │  └─ ui_common_logo_tagline_compact.png
   │  ├─ buttons/
   │  │  └─ ui_common_blue_button_normal.png
   │  ├─ cards/
   │  │  ├─ ui_common_card_background.png
   │  │  ├─ ui_common_card_brush.png
   │  │  ├─ ui_common_card_name_strip.png
   │  │  └─ ui_common_card_paper.png
   │  ├─ icons/
   │  │  ├─ ui_common_camp_icon.png
   │  │  ├─ ui_common_confirm_arrow_icon.png
   │  │  ├─ ui_common_lock_icon.png
   │  │  └─ ui_common_small_arrow_icon.png
   │  ├─ panels/
   │  │  └─ ui_common_paper_panel.png
   │  └─ progress/
   │     ├─ ui_common_experience_fill.png
   │     └─ ui_common_experience_track.png
   ├─ main_menu/
   │  ├─ main_menu_navigation_icons_hover.png
   │  ├─ main_menu_navigation_icons_normal.png
   │  ├─ main_menu_poster.png
   │  ├─ main_menu_social_entries.png
   │  └─ sources.json
   └─ route_selection/
      ├─ route_selection_board_panel.png
      ├─ route_selection_cancel_button_normal.png
      ├─ route_selection_combat_icon.png
      ├─ route_selection_combat_tab_normal.png
      ├─ route_selection_combat_tab_selected.png
      ├─ route_selection_compass_decoration.png
      ├─ route_selection_confirm_button_normal.png
      ├─ route_selection_scavenge_icon.png
      ├─ route_selection_scavenge_tab_normal.png
      ├─ route_selection_scavenge_tab_selected.png
      ├─ route_selection_scavenge_tab_source_selected.png
      ├─ route_selection_survey_icon.png
      ├─ route_selection_survey_tab_normal.png
      ├─ route_selection_survey_tab_selected.png
      ├─ route_selection_survey_tab_source_selected.png
      ├─ route_selection_tab_locked.png
      ├─ route_selection_tab_progress_frame.png
      ├─ route_selection_tab_tape.png
      ├─ route_selection_title.png
      ├─ route_selection_title_divider_left.png
      ├─ route_selection_title_divider_right.png
      ├─ route_selection_tooltip_skill_badge.png
      ├─ route_selection_unlock_button_normal.png
      ├─ route_selection_unlock_tent_sticker.png
      └─ sources.json
```

## Godot 引用与导入处理

| 文件 | 修改内容 |
| --- | --- |
| `ui/menu_art.gd` | 共用背景、品牌、面板、按钮 preload；Theme／StyleBox 继续使用同一图片内容。 |
| `ui/menu_entry.gd` | 主菜单 normal／hover 导航图标路径。 |
| `ui/new_run_art.gd` | 道具、技能、路线页及公共组件的 37 个 preload 路径。 |
| `ui/title_screen.gd` | 品牌、海报和社交入口图片路径。 |
| `vfx/generated_assets.gd` | 动态加载从 `catalog()[id].path` 读取文件位置，保持内部 ID，停止用 ID 拼接 GLB 文件名。 |
| `scenes/camp/camp_main.tscn` | 夏知遥、苏晚星与归航巴士三个 ext_resource 路径。 |
| `data/survivors/xia_zhiyao.tres`、`su_wanxing.tres` | 角色 `model_path`，其他数据字段不变。 |
| `tests/new_run_runtime.gd` | normal／selected 标签与道具／技能卡面路径断言。 |
| `tests/verify_character_models.gd` | 两个角色的模型存在性检查路径。 |
| `tests/architecture_report.gd`、`character_system_test.gd` | 未来角色资源的示例路径遵循新命名；测试逻辑不变。 |
| `assets/ui/main_menu/sources.json`、`route_selection/sources.json` | 所有 `file` 路径，以及项目内派生 `source` 路径；原始外部来源名称、哈希、尺寸与编辑说明保留。 |
| `assets/generated/manifest.json` | 52 个 `path` 字段；模型 ID、分类、几何、哈希、来源和用途不变。 |
| `art/blender/asset_specs.py` | 登记稳定 ID 对应的语义文件名／path，供后续导出使用。 |
| `art/blender/utils/export.py` | 输出到登记 path，避免以后重新生成旧文件名；本轮未运行模型生成。 |
| `art/blender/validate_assets.py` | 校验登记文件路径与实际目录一致；保留原有几何、内容和命名 ID 检查。 |
| 122 个 `.import` | 连同资源重命名，Godot 自行更新 source_file 与导入路径；UID 保持不变。 |

项目设置、Autoload、导出配置、Theme、脚本动态加载、字符串路径、Scene、Resource、数据配置均已扫描；没有额外旧加载路径需要修复。`project.godot`、`export_presets.cfg`、`ui/new_game_screen.gd`、`missions/mission.gd` 与所有道具／技能数值资源，相对本轮开始的工作区逐字节不变。

角色 GLB 内部图片叫 `Image_0`／`Image_1`／`Image_2`，普通重命名旁边的 JPG 会在再次导入时生成旧风格名字。根据 GLB 材质槽确认：`Image_0` 是底色、`Image_1` 是金属度／粗糙度、`Image_2` 是法线。使用 Godot 原生 ResourceSaver 保存现有四份材质，再以导入器的 `use_external` 设置绑定：

- `assets/characters/xia_zhiyao/model/character_xia_zhiyao_material.tres`
- `assets/characters/xia_zhiyao/source/character_xia_zhiyao_source_material.tres`
- `assets/characters/su_wanxing/model/character_su_wanxing_material.tres`
- `assets/characters/su_wanxing/source/character_su_wanxing_source_material.tres`

四个 GLB 的 `gltf/embedded_image_handling` 从 1 改为 0，仅停止导出内嵌图片；材质通过规范命名的原有 JPG 保持完整纹理。材质 `.tres` 与保存前的材质内容比较，仅纹理路径不同；所有材质参数及原贴图 mipmap 保留。实测四个导入模型确实使用上述外部材质。GLB 原始内容没有修改，也没有新增导入插件、替换运行逻辑或手工维护 `.godot/imported/`。这是 Godot 提供的[原生外部材质绑定机制](https://github.com/godotengine/godot/blob/master/editor/import/3d/resource_importer_scene.cpp)，不是自定义导入系统。

## 旧路径和历史名称检查

- `assets/` 中 122 个图片／模型与 4 个材质文件名均符合小写蛇形规范，无历史数字段、`final`、`new`、`temp`、`test` 或 `copy` 文件名。
- 生产和测试 GDScript、`.tscn`、`.tres`、`.import`、`.godot` 配置、`.cfg`、`.json`、`.py`、`.ps1` 中，旧资源完整路径为零；所有有效字面量资源路径指向实存资源。
- 50 条用户图片来源记录能解析到哈希一致的源文件，两个项目内选中图派生来源也能正确解析。
- 历史目录迁移报告、本报告的旧名列和外部来源名有意保留历史字符串。`new_run_runtime.gd` 中的 `24_card_selected.png`／`39_tooltip_rule.png` 是禁止旧覆盖图出现的断言，并不加载已删除图片；没有为消除字面命中而删掉防回归断言。
- 当前内部模型 ID 仍有 `BH_*_01`；它们不是文件名，重命名它们会扩大到模型内容和业务引用，故保持稳定。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| Godot 4.7.2 原生导入和启动 | 成功，Compatibility 渲染 |
| 全资源加载 | 169 个资源成功加载，61 个 PackedScene 成功实例化，0 失败 |
| 图片／模型源字节 | 122 个文件 SHA-256 与改名前一致 |
| UID／导入 | 122 个 UID 不变；118 个普通资源参数不变；4 个角色模型正确绑定原参数材质及贴图 mipmap |
| 静态模型管线检查 | 52 个模型，0 失败，未重新生成模型 |
| 主菜单与专属路线原生检查 | 836 项，0 失败 |
| 道具／技能卡面、提示、创建、基地与能力 | 164 项，0 失败 |
| 当前营地原生检查 | 102 项，0 失败 |
| 模型展厅原生检查 | 22 项，0 失败 |
| 战斗／搜刮／撤离原生检查 | 51 项，0 失败 |
| 跨日原生检查 | 41 项，0 失败 |
| 操作与并行派遣原生检查 | 36 项，0 失败 |
| 原生检查合计 | **1252 项，0 失败** |
| 本轮新采集前后截图 | **37 对 PNG 逐字节一致**：菜单／路线 18、营地 1、模型展厅 18 |
| Windows build | 52 模型检查、84 美术集成、436 玩法 Headless 全部通过 |
| 独立 EXE | 基地、主菜单、52 模型展厅分别通过 Headless／原生启动，共 6 项 |
| Missing Resource／Resource not found／脚本错误 | 未发现 |

构建中的 `new_run.gd` 退出时仍有 `2 ObjectDB instances were leaked at exit` 警告，断言全部通过；未扩大到对象生命周期修复。原生截图和输入证据来自隔离的屏幕外窗口及合成输入，不等于人工长时试玩。玩家存档未被覆盖，本轮测试进程已退出。

构建：[BlueHourHomeward.exe](../build/BlueHourHomeward.exe)，187,522,728 字节，时间 `2026-09-12T02:01:27.4241106+08:00`，SHA-256 `2B5646972E03A19E358D21A80646D3046B236962CE91129BA17F3BE5882523F8`。

证据保存在忽略提交的 `test-output/asset-naming/`：`before.json`、`plan.json`、`verification.json`、`materials.json`、`before-images/`、`image-comparison.json`、`load-all.json`、`before-native.log`、`after-native.log`、`import.log` 与 `build.log`。没有把旧截图混入本轮对照，也没有修改上一轮验证产物来冒充本轮结果。

README、UI 素材说明、模型目录、角色资源路径说明、资源目录规则、生成管线说明和 VALIDATION 已同步。既有功能计划没有被迁移的具体路径或需改变的功能状态，本轮不新增里程碑，不改写玩法计划。未执行 Git 提交。
