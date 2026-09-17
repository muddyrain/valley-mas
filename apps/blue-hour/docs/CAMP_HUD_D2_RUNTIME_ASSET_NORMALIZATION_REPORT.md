# CAMP HUD D2 Runtime Asset Normalization Report

## 交付结论

CAMP HUD D2 已完成 source/runtime 分层与运行时素材归一化。`source/` 保留原始高清 PNG；`runtime/final_d/` 现在使用按控件尺寸 1.5x 输出的 PNG，Godot 绑定继续统一指向 runtime。未改 Camera、Environment、Ambient、Departure、Expedition HUD、角色动画或玩法数值。

## 素材审计与处理

| 资源 | 原始尺寸 | 处理方式 | runtime 输出 |
|---|---:|---|---:|
| camp_top_header_bg | 2172×724 | Alpha 裁切后高质量缩放 | 1030×132 |
| camp_loadout_panel_bg | 2172×724 | Alpha 裁切后高质量缩放 | 765×155 |
| camp_loadout_slot_empty | 1254×1254 | Alpha 裁切后高质量缩放 | 132×132 |
| camp_lock_icon | 1254×1254 | Alpha 可见区已居中，缩放至槽位 1.5x | 60×60 |
| camp_skill_label_bg | 2172×724 | Alpha 裁切后高质量缩放 | 185×42 |
| camp_esc_keycap | 1536×1024 | Alpha 裁切后高质量缩放 | 63×45 |
| camp_survivor_roster_panel_bg | 887×1774 | 保持纵向面板比例并缩放 | 183×360 |
| camp_survivor_slot_normal | 1254×1254 | 统一画布与中心后缩放 | 162×162 |
| camp_survivor_slot_hover | 1254×1254 | 与 Normal 同画布/中心后缩放 | 162×162 |
| camp_survivor_slot_selected | 1254×1254 | 与 Normal 同画布/中心后缩放 | 162×162 |

背景、面板与标签属于直接缩放类；锁图标、空槽与 roster 三态属于先按 Alpha 可见边界裁切/统一中心，再缩放类。三态输出像素规格完全一致，因此状态切换只改变外观高亮，不改变控件几何尺寸。

## Godot 绑定与显示策略

- `ui/camp/camp_asset_manifest.gd` 的 220–229 全部指向 `runtime/final_d/*.png` 单后缀路径。
- `camp_hud.gd` 使用固定运行时 token：技能按钮 109×109、技能标签 123×28、装备槽 88×88、Roster 槽 108×108、ESC 42×30。
- 图标与锁槽使用居中 stretch，Roster Button 使用固定尺寸与 `SIZE_SHRINK_CENTER`；ScrollContainer 保留并在超出 360px 时滚动。
- `CampTextureButton` 的 selected-hover 保持 selected 素材，仅叠加 hover 反馈，避免 Normal/Selected 互换造成跳变。

## 验证

- 静态素材检查：10 个 D2 runtime PNG 均存在，尺寸与控件 token 匹配。
- `tests/camp_hud_2.gd`：既有报告记录 53 checks、0 failures。
- 编码检查：`check_mojibake.py` 通过。
- 当前工作区仍存在与本任务无关的既有 `missions/mission.gd` 解析错误；本机未发现可调用的 Godot CLI，因此无法在本环境重跑原生窗口截图。交付截图需在具备 Godot 4.7 的环境执行 1600×900 与 1920×1080 Camp 场景验收。

## 截图验收清单

在 Godot 原生运行后至少保存：营地全屏、作战装备区、左侧技能区、右侧幸存者列表；重点确认锁图标居中、技能标签居中、Roster 三态无尺寸跳变。
