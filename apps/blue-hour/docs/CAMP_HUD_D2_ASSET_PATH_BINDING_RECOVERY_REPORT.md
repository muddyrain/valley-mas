# CAMP HUD D2 Asset Path + Binding Recovery Report

## 修改文件

- `ui/camp/camp_asset_manifest.gd`
- `ui/camp/camp_hud.gd`

未修改 `missions/mission.gd`、Camera、Environment、Ambient、Animation、Departure 或 PNG 资源。

## 220–229 路径恢复

| ID | 修复后路径 | `ResourceLoader` 静态存在性 |
|---:|---|---|
| 220 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_top_header_bg.png` | PASS |
| 221 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_loadout_panel_bg.png` | PASS |
| 222 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_loadout_slot_empty.png` | PASS |
| 223 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_lock_icon.png` | PASS |
| 224 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_skill_label_bg.png` | PASS |
| 225 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_esc_keycap.png` | PASS |
| 226 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_survivor_roster_panel_bg.png` | PASS |
| 227 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_survivor_slot_normal.png` | PASS |
| 228 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_survivor_slot_hover.png` | PASS |
| 229 | `res://assets/ui/camp_hud_2_0/runtime/final_d/camp_survivor_slot_selected.png` | PASS |

重复后缀路径已从 manifest 移除，D2 路径直接保存最终完整文件路径。

## 区域绑定

- Top Header：ID 220。
- 左上 Camp Info：恢复为旧版正式 Camp Info Card，ID 1；不再使用横向 Header ID 220。
- Loadout Panel：ID 221。
- Loadout Slot：ID 222。
- Lock Icon：ID 223，底部装备锁与左侧技能锁共用。
- Left Skill Label：新增 ID 224 的 D2 标签底条，技能图标和主框保持原有资源。
- Esc Prompt：ID 225。
- Survivor Roster Panel：ID 226。
- Survivor Slot Normal / Hover / Selected：ID 227 / 228 / 229。

动态 Roster 的 ScrollContainer + VBoxContainer 结构保持不变。

## 运行状态

静态路径检查 220–229 全部通过。真实 Runtime 仍被工作区既有 `missions/mission.gd` 解析错误阻断；本轮未修改该文件，因此未宣称 Runtime、截图或视觉验收通过。

## 未完成

待 `missions/mission.gd` 所属并行改动恢复可解析后，再运行真实 CAMP，确认 final_d 资源错误为 0，并生成：

- `camp_d2_recovery_A_entry.png`
- `camp_d2_recovery_B_loadout.png`
- `camp_d2_recovery_C_roster.png`
- `camp_d2_recovery_D_full_1600x900.png`

