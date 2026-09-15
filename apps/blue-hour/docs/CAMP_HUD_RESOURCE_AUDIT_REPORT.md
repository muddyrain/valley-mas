# CAMP HUD Resource Audit Report

## 审计范围

本次仅做只读审计；未修改 `.gd`、`.tscn`、资源文件或 manifest。审计对象为 `assets/ui/camp_hud_2_0/`、`ui/camp/` 引用和现有运行输出。

## 当前目录结构

```text
assets/ui/camp_hud_2_0/
├─ source/
│  ├─ Pack_A/   # 基础面板、时间轴、资源卡、旧槽位
│  ├─ Pack_B/   # 状态、按钮、旧 Roster 状态
│  └─ Pack_C/   # 图标
└─ runtime/
   ├─ buttons/
   ├─ icons/
   ├─ panels/
   ├─ slots/
   ├─ states/
   ├─ timeline/
   └─ final_d/
      ├─ camp_top_header_bg.png
      ├─ camp_loadout_panel_bg.png
      ├─ camp_loadout_slot_empty.png
      ├─ camp_lock_icon.png
      ├─ camp_skill_label_bg.png
      ├─ camp_esc_keycap.png
      ├─ camp_survivor_roster_panel_bg.png
      ├─ camp_survivor_slot_normal.png
      ├─ camp_survivor_slot_hover.png
      └─ camp_survivor_slot_selected.png
```

`final_d` 中上述 10 张 PNG 均实际存在；每张另有 Godot `.import` 文件。

## 220–229 映射

| ID | Manifest 当前路径 | 存在 | 预期实际文件 |
|---:|---|---|---|
| 220 | `.../camp_top_header_bg_top_header_bg.png` | 否 | `.../camp_top_header_bg.png` |
| 221 | `.../camp_loadout_panel_bg_loadout_panel_bg.png` | 否 | `.../camp_loadout_panel_bg.png` |
| 222 | `.../camp_loadout_slot_empty_loadout_slot_empty.png` | 否 | `.../camp_loadout_slot_empty.png` |
| 223 | `.../camp_lock_icon_lock_icon.png` | 否 | `.../camp_lock_icon.png` |
| 224 | `.../camp_skill_label_bg_skill_label_bg.png` | 否 | `.../camp_skill_label_bg.png` |
| 225 | `.../camp_esc_keycap_esc_keycap.png` | 否 | `.../camp_esc_keycap.png` |
| 226 | `.../camp_survivor_roster_panel_bg_survivor_roster_panel_bg.png` | 否 | `.../camp_survivor_roster_panel_bg.png` |
| 227 | `.../camp_survivor_slot_normal_survivor_slot_normal.png` | 否 | `.../camp_survivor_slot_normal.png` |
| 228 | `.../camp_survivor_slot_hover_survivor_slot_hover.png` | 否 | `.../camp_survivor_slot_hover.png` |
| 229 | `.../camp_survivor_slot_selected_survivor_slot_selected.png` | 否 | `.../camp_survivor_slot_selected.png` |

## 错误引用与根因

| 报错路径 | 触发文件/行 | 预期路径 | 根因 |
|---|---|---|---|
| `camp_lock_icon_lock_icon.png` | `ui/camp/camp_asset_manifest.gd:54` | `camp_lock_icon.png` | basename 已含语义后缀，生成/改名流程再次追加 suffix |
| `camp_loadout_slot_empty_loadout_slot_empty.png` | `...manifest.gd:53` | `camp_loadout_slot_empty.png` | 同上 |
| `camp_esc_keycap_esc_keycap.png` | `...manifest.gd:56` | `camp_esc_keycap.png` | 同上 |
| 其余 220–229 双后缀路径 | `...manifest.gd:51–60` | 对应单后缀 PNG | 同一自动拼接问题 |

代码侧 `camp_skin.gd:16` 仅执行 `load(Manifest.PATHS[id])`，未发现运行时再次拼接 basename/suffix。`art/import_camp_hud.py:27–82` 使用 ZIP entry 文件名和目标路径直接写入；未发现重复拼接逻辑。因此重复名称已在 manifest 生成/人工改名阶段产生。

## 当前区域资源使用

| 区域 | 当前调用 | 实际资源结果 |
|---|---|---|
| Top Header | `camp_hud.gd:117`, ID 220 | 失效双后缀路径 |
| 左上 Camp Info | `camp_hud.gd:100`, ID 220 | 同上（与 Header 共用） |
| Left Skill | `camp_hud.gd:260–300`, ID 30/209 | 仍是旧 Pack_A/C 资源；D2 skill label 未引用 |
| Loadout Panel | `camp_hud.gd:303`, ID 221 | 失效双后缀路径 |
| Loadout Slot | `camp_texture_button.gd:119`, ID 222 | 失效双后缀路径 |
| Lock Icon | `camp_hud.gd:281,321`, ID 223 | 失效双后缀路径 |
| Esc Prompt | `camp_hud.gd:52`, ID 225 | 失效双后缀路径 |
| Survivor Roster Panel | `camp_hud.gd:177`, ID 226 | 失效双后缀路径 |
| Slot Normal | `camp_texture_button.gd:120`, ID 227 | 失效双后缀路径 |
| Slot Hover | same, ID 228 | 失效双后缀路径 |
| Slot Selected | same, ID 229 | 失效双后缀路径 |

## 旧/新资源冲突

旧版 runtime 资源仍完整存在并继续被引用：IDs `1,10,11,20,30,40,42,80,81,90,209,213` 等。D2 与旧版并非同一路径覆盖；当前代码同时保留两套 manifest 资源，且 D2 节点通过错误路径加载失败后，旧版资源仍会显示，形成视觉回退/混用。`final_d` 目录本身只有新 PNG，没有发现与旧文件同名覆盖。

## 运行错误收集

现有运行尝试同时受工作区既有 `missions/mission.gd` parse error 阻断，未能进入完整 Camp HUD 初始化。静态证据确认 220–229 全部会在 `CampArt.texture()` 调用时命中不存在路径；未发现其他独立 Texture load error 日志。

## 建议修复顺序

1. 先修正 manifest 220–229 为 `final_d` 下实际单后缀文件名。
2. 重新导入/启动，确认 220–229 全部可加载后，再清理旧版区域引用。
3. 将 Left Skill 的 D2 label 背景接入，并核对锁图标与槽位的单一来源。
4. 在 1600×900、1920×1080 分别运行 Camp HUD 回归和截图，确认无双套 UI 叠加。
5. 最后再处理既有 `missions/mission.gd` 解析错误并重复完整运行审计。

