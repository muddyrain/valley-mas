# 图片资源整理与引用迁移记录

本页保留目录迁移完成当时的路径，供追溯；后续文件命名规范化的当前路径见 [命名迁移记录](ASSET_NAMING_2026-09-12.md)。

日期：2026-09-12。范围：当前图片、UI 素材、引用和来源记录；未重新制作素材，未修改 UI 布局、图片像素、玩法、数值或业务命名。

## 结果与目录

扫描得到 71 张图片（59 PNG、12 JPG）。移动 50 张 PNG 及其相邻 `.import`，移动 1 份来源清单；删除 5 张确认废弃 PNG 及其 `.import`。最终保留 66 张图片（54 PNG、12 JPG），其中 50 张移动、16 张原位保留，逐张 SHA-256 与迁移前一致。所有保留图片的 UID 和 `[params]` 导入参数均不变。

```text
assets/
├─ characters/
│  ├─ xia_zhiyao/{model,source}/
│  └─ su_wanxing/{model,source}/
├─ generated/                  # 保留既有 52 个 GLB 和生成清单
├─ items/{cards,illustrations}/
├─ skills/{cards,icons,illustrations}/
└─ ui/
   ├─ common/
   │  ├─ backgrounds/
   │  ├─ branding/
   │  ├─ buttons/
   │  ├─ cards/
   │  ├─ icons/
   │  ├─ panels/
   │  └─ progress/
   ├─ main_menu/
   └─ route_selection/
```

新增资源的判断规则见 [资源目录说明](../art/RESOURCE_LAYOUT.md)。`route_selection` 对应当前界面标题“选择你的专属路线”；保留业务脚本 `new_game_screen.gd` / `new_run_art.gd` 的命名。首页导航图标、社交入口与海报维持原位；共同背景、品牌和公共控件移入 common。具体道具和技能的卡面、插画、图标归领域目录。

角色已有对象目录和配套 GLB / JPG；52 个无独立贴图的生成模型由现有 manifest、动态加载器和 Blender 导出器共同管理，因此本轮不改写 3D 管线，不预建空的领域目录。`docs/`、`references/`、Blender 源文件和设计资料未删除。

## 逐项移动

下列路径均相对于 Godot 工程根目录（即加上 `res://`）；PNG 旁边的 `.import` 同步移动。

| 旧路径 | 新路径 |
| --- | --- |
| `assets/ui/effects/coffee.png` | `assets/items/cards/coffee.png` |
| `assets/ui/effects/map_heal.png` | `assets/skills/cards/map_heal.png` |
| `assets/ui/effects/rage.png` | `assets/skills/cards/rage.png` |
| `assets/ui/effects/shooting_target.png` | `assets/items/cards/shooting_target.png` |
| `assets/ui/main_menu/blue_button.png` | `assets/ui/common/buttons/blue_button.png` |
| `assets/ui/main_menu/brand_tagline.png` | `assets/ui/common/branding/brand_tagline.png` |
| `assets/ui/main_menu/home_background.png` | `assets/ui/common/backgrounds/home_background.png` |
| `assets/ui/main_menu/paper_panel.png` | `assets/ui/common/panels/paper_panel.png` |
| `assets/ui/new_run/01_logo.png` | `assets/ui/common/branding/01_logo.png` |
| `assets/ui/new_run/02_logo_tagline.png` | `assets/ui/common/branding/02_logo_tagline.png` |
| `assets/ui/new_run/03_handwritten_tagline.png` | `assets/ui/common/branding/03_handwritten_tagline.png` |
| `assets/ui/new_run/04_route_title.png` | `assets/ui/route_selection/04_route_title.png` |
| `assets/ui/new_run/05_compass.png` | `assets/ui/route_selection/05_compass.png` |
| `assets/ui/new_run/06_title_line_left.png` | `assets/ui/route_selection/06_title_line_left.png` |
| `assets/ui/new_run/07_title_line_right.png` | `assets/ui/route_selection/07_title_line_right.png` |
| `assets/ui/new_run/08_board.png` | `assets/ui/route_selection/08_board.png` |
| `assets/ui/new_run/09_tab_combat.png` | `assets/ui/route_selection/09_tab_combat.png` |
| `assets/ui/new_run/10_tab_scavenge.png` | `assets/ui/route_selection/10_tab_scavenge.png` |
| `assets/ui/new_run/11_tab_survey.png` | `assets/ui/route_selection/11_tab_survey.png` |
| `assets/ui/new_run/12_tab_locked.png` | `assets/ui/route_selection/12_tab_locked.png` |
| `assets/ui/new_run/13_icon_combat.png` | `assets/ui/route_selection/13_icon_combat.png` |
| `assets/ui/new_run/14_icon_scavenge.png` | `assets/ui/route_selection/14_icon_scavenge.png` |
| `assets/ui/new_run/15_icon_survey.png` | `assets/ui/route_selection/15_icon_survey.png` |
| `assets/ui/new_run/16_icon_lock.png` | `assets/ui/common/icons/16_icon_lock.png` |
| `assets/ui/new_run/17_tab_tape.png` | `assets/ui/route_selection/17_tab_tape.png` |
| `assets/ui/new_run/18_tab_progress_frame.png` | `assets/ui/route_selection/18_tab_progress_frame.png` |
| `assets/ui/new_run/20_card_paper.png` | `assets/ui/common/cards/20_card_paper.png` |
| `assets/ui/new_run/21_card_brush.png` | `assets/ui/common/cards/21_card_brush.png` |
| `assets/ui/new_run/22_card_name_strip.png` | `assets/ui/common/cards/22_card_name_strip.png` |
| `assets/ui/new_run/23_card_composite.png` | `assets/ui/common/cards/23_card_composite.png` |
| `assets/ui/new_run/25_card_printer.png` | `assets/items/cards/25_card_printer.png` |
| `assets/ui/new_run/26_card_speed.png` | `assets/skills/cards/26_card_speed.png` |
| `assets/ui/new_run/27_illustration_printer.png` | `assets/items/illustrations/27_illustration_printer.png` |
| `assets/ui/new_run/28_illustration_shoes.png` | `assets/skills/illustrations/28_illustration_shoes.png` |
| `assets/ui/new_run/29_icon_run.png` | `assets/skills/icons/29_icon_run.png` |
| `assets/ui/new_run/30_icon_tent.png` | `assets/ui/common/icons/30_icon_tent.png` |
| `assets/ui/new_run/31_tent_sticker.png` | `assets/ui/route_selection/31_tent_sticker.png` |
| `assets/ui/new_run/32_button_cancel.png` | `assets/ui/route_selection/32_button_cancel.png` |
| `assets/ui/new_run/33_button_confirm.png` | `assets/ui/route_selection/33_button_confirm.png` |
| `assets/ui/new_run/34_button_unlock.png` | `assets/ui/route_selection/34_button_unlock.png` |
| `assets/ui/new_run/35_icon_confirm_arrow.png` | `assets/ui/common/icons/35_icon_confirm_arrow.png` |
| `assets/ui/new_run/36_icon_small_arrow.png` | `assets/ui/common/icons/36_icon_small_arrow.png` |
| `assets/ui/new_run/38_tooltip_badge.png` | `assets/ui/route_selection/38_tooltip_badge.png` |
| `assets/ui/new_run/40_xp_track.png` | `assets/ui/common/progress/40_xp_track.png` |
| `assets/ui/new_run/41_xp_fill.png` | `assets/ui/common/progress/41_xp_fill.png` |
| `assets/ui/new_run/42_tab_combat_hover.png` | `assets/ui/route_selection/42_tab_combat_hover.png` |
| `assets/ui/new_run/43_tab_scavenge_hover.png` | `assets/ui/route_selection/43_tab_scavenge_hover.png` |
| `assets/ui/new_run/44_tab_survey_hover.png` | `assets/ui/route_selection/44_tab_survey_hover.png` |
| `assets/ui/new_run/45_tab_scavenge_selected.png` | `assets/ui/route_selection/45_tab_scavenge_selected.png` |
| `assets/ui/new_run/46_tab_survey_selected.png` | `assets/ui/route_selection/46_tab_survey_selected.png` |
| `assets/ui/new_run/sources.json` | `assets/ui/route_selection/sources.json` |

两份既有 `sources.json` 保持其原始素材批次记录，`file` 改为相对各自清单目录的新位置，删除已废弃图片的条目；保留原始外部来源名、尺寸、哈希和派生描述。共 50 条剩余记录均能定位到实存且哈希匹配的图片。4 张完整道具 / 技能卡面原先未登记于这两份清单，本轮只迁移文件，未虚构来源信息。

## 已删除资源与依据

删除前扫描 GDScript、Scene、Resource、Shader / Theme、项目设置、Autoload、导出配置、字符串路径、`load` / `preload`、目录枚举、动态路径拼接、UID 和来源清单。项目没有单独的外部 Theme 文件；纹理 Theme 由 `ui/menu_art.gd` 构造。没有 Autoload 配置项。动态模型加载仅访问 `assets/generated/` 与角色 Resource 的 `model_path`；没有按目录动态枚举这些 UI PNG 的生产代码。

| 删除的源图片（同时删除同名 `.import`） | 确认依据 |
| --- | --- |
| `assets/ui/main_menu/logo.png` | UI 素材说明已明确标注为旧版未使用图；当前品牌使用 `brand_tagline.png` 和 `02_logo_tagline.png`。无加载、UID 或派生依赖。 |
| `assets/ui/new_run/19_tab_selected.png` | 通用旧选中覆盖图已被三条路线的 `42` / `45` / `46` 专属底图替代，无有效引用或派生依赖。 |
| `assets/ui/new_run/24_card_selected.png` | 当前卡片使用 `paper_card_hover.gd` 与透明轮廓 Shader。测试中的文件名仅用于断言禁止出现旧矩形覆盖图，并不加载它；保留该防回归断言。 |
| `assets/ui/new_run/37_tooltip.png` | 当前提示纸张由 `Polygon2D`、轮廓线与原生布局绘制，不再加载固定底图；无 UID 或派生依赖。 |
| `assets/ui/new_run/39_tooltip_rule.png` | 当前提示框无这条分隔图片；测试仅断言它不出现，并不加载。无其他有效引用或派生依赖。 |

这里的“被替代”均是任务开始前已有实现，本轮没有新增替代逻辑，也没有删除以上断言或清理无关函数。

## 未直接加载但保留的素材

以下 9 张 PNG 没有当前生产加载引用，但不能把源素材或分层组件判为废弃，已按用途迁移并保留：

| 当前路径 | 保留原因 |
| --- | --- |
| `assets/ui/common/branding/01_logo.png` | 独立品牌层，当前使用组合版；保留品牌源组件。 |
| `assets/ui/common/branding/03_handwritten_tagline.png` | 独立标语层，当前使用组合版；保留品牌源组件。 |
| `assets/ui/common/cards/20_card_paper.png` | 空白卡纸组件，未确认停止使用。 |
| `assets/ui/common/cards/21_card_brush.png` | 独立笔刷底色组件，未确认停止使用。 |
| `assets/ui/common/cards/22_card_name_strip.png` | 独立名称纸条组件，未确认停止使用。 |
| `assets/items/illustrations/27_illustration_printer.png` | 独立道具插画，当前展示完整卡面，仍可复用。 |
| `assets/skills/illustrations/28_illustration_shoes.png` | 独立能力插画，当前展示完整卡面，仍可复用。 |
| `assets/ui/route_selection/43_tab_scavenge_hover.png` | 清单明确记录为 `45_tab_scavenge_selected.png` 的原图。 |
| `assets/ui/route_selection/44_tab_survey_hover.png` | 清单明确记录为 `46_tab_survey_selected.png` 的原图。 |

角色的 12 张配套 JPG 同样保留：`assets/characters/{xia_zhiyao,su_wanxing}/{model,source}/*_Image_{0,1,2}.jpg`。GLB 内嵌图像、现有 `gltf/embedded_image_handling=1` 导入设置与相邻贴图必须整体判断，不能只依据 GDScript 无文件名命中进行删除。本轮没有改变这套布局。

`29_icon_run.png`、`30_icon_tent.png` 及 `menu_art.gd` 的旧辅助接口仍有预加载引用，按通用领域保留，没有趁迁移删除接口。生成模型即使未进入行动地图，也被展示场景和 manifest 动态加载，不属于废弃文件。

## 引用修改范围

| 文件 / 类型 | 实际变化 |
| --- | --- |
| `ui/menu_art.gd` | 背景、品牌、公共纸板和蓝按钮共 4 个 preload 路径；Theme / StyleBox 构造逻辑不变。 |
| `ui/title_screen.gd` | 品牌 preload 路径 1 处。 |
| `ui/new_run_art.gd` | 37 个 preload 路径，分别指向路线专属、公共 UI、道具或技能目录。 |
| `tests/new_run_runtime.gd` | 6 个标签状态路径及 4 个道具 / 能力卡面路径断言，断言语义不变。 |
| `assets/ui/main_menu/sources.json` | 4 个共享资源位置与旧 Logo 条目清理。 |
| `assets/ui/route_selection/sources.json` | 来源清单从 new_run 搬入；公共 / 领域资源改为相对新目录的路径，清理 4 个废弃条目。 |
| 50 个移动的 `.import` | 连同源图移动，Godot 自行更新 source_file、导入产物路径；UID 和参数不变。 |
| `.tscn` / `.tres` / Project / Autoload / Export | 全部核查；没有指向本次移动 PNG 的引用，因此没有为迁移修改它们。 |
| 文档 | 更新 README、UI_ASSETS、VALIDATION，新增目录说明与本报告。 |

逐文件与任务开始时的工作区快照比对：上述 4 个 GDScript 文件仅有路径替换，没有布局、数值、逻辑或中文文案变化。保留用户已有未提交工作。期间另有 `scenes/camp/camp_main.tscn` 与 `tests/camp_runtime.gd` 的 V1.3 更新，本轮未编辑这两个文件；已补验当前营地版本。本报告不把这些并行修改计入资源迁移成果。

## 验证结果

- Godot 4.7.2 Compatibility 完成原生启动与资源重新导入；不手动移动或维护 `.godot/imported/`。
- 源文件检查：66 张保留图片字节一致、UID / 导入参数一致；50 条来源记录有效；生产与测试的旧资源加载路径为零；删除资源无残留加载 / UID 引用。
- Godot 逐项加载全部 165 个图片 / GLB / `.tscn` / `.tres`，61 个 PackedScene（含 56 个 GLB 与 5 个 `.tscn`）实例化成功，0 失败。
- 主菜单与路线页迁移前后均跑原生输入验证；本轮实际新采集的 18 对 PNG 文件逐字节一致，覆盖六种窗口尺寸、三条路线、锁定预览、悬停与续玩。截图目录另有 3 张历史文件，未计入本轮证据。

| 原生运行测试 | 检查数 | 失败数 |
| --- | ---: | ---: |
| `menu_runtime.gd`：主菜单、角色图鉴 / 营地档案、专属路线、公共控件、六种尺寸与输入 | 836 | 0 |
| `new_run_runtime.gd`：道具 / 技能卡面与提示、创建、基地、训练、能力 | 164 | 0 |
| `camp_runtime.gd`：当前 V1.3 营地、角色实例、碰撞与导航 | 102 | 0 |
| `art_runtime.gd`：52 模型展厅原生渲染 | 22 | 0 |
| `runtime.gd`：战斗、搜刮、撤离 | 51 | 0 |
| `day_loop_runtime.gd`：跨日与基地 | 41 | 0 |
| `controls_runtime.gd`：指向、镜头、暂停与并行操作 | 36 | 0 |
| 合计 | 1252 | 0 |

`run.ps1 -Mode build` 完成 52 模型资源检查、84 项美术集成、436 项玩法 Headless 检查，再导出 Windows 单文件。独立目录中的 EXE 通过基地、主菜单、52 模型展厅各自的 Headless / 原生启动（6 项），未报 Missing Resource、资源找不到或脚本错误。

`new_run.gd` 和 `controls_runtime.gd` 退出时各有 `2 ObjectDB instances were leaked at exit` 警告；断言全部通过，未出现资源加载错误。本轮没有修改对象生命周期代码或扩大到警告修复。原生截图和合成输入不等于人工长时试玩；本次未新增业务测试，因为没有行为改动，采用现有回归、全资源加载、哈希和截图对照验证。

构建：[BlueHourHomeward.exe](../build/BlueHourHomeward.exe)，187,493,216 字节；时间 `2026-09-12T01:35:17.0654757+08:00`，SHA-256 `34A1F4F9764992DB40B515629A54E501F448DA46A04E90B628BEF8008D571CF4`。

原始证据位于忽略提交的 `test-output/resource-migration/`：`before.json`、`plan.json`、`verification.json`、`load-all.json`、`screenshot-comparison.json`、`native-after.log`、`camp-current.log` 与 `build.log`。主菜单截图位于 `test-output/menu/`，当前营地截图为 `test-output/camp/camp-v1-3-16x9.png`。本轮启动的验证进程均已结束，未触碰玩家存档。

目录与验证文档已同步。现有 `docs/PLAN.md` 不包含被迁移路径，本次不改变功能范围、里程碑或验收标准，因此没有新增计划或改写计划状态。未执行 Git 提交。
