# CAMP Survivor Selection / Detail Startup Hotfix

## 改动

- 方形底板来源按 Survivor wrapper 的实际运行时节点统一处理：Camp Actor 在创建 Survivor visual 后递归禁用所有 `QuadMesh` / `PlaneMesh` 的 `MeshInstance3D`，保留正式 `world_select_ring`。不按角色 ID 做特殊分支。
- Camp 仍复用 `survivor.gd` 创建的 Expedition `world_select_ring`，挂在 Survivor world root，偏移保持 `Vector3(0, 0.065, 0)`，默认尺寸保持 `1.25`。
- `shelter_screen.gd::_build()` 不再调用 `show_survivor()`；进入 Camp 只建立 Party/Roster，详情面板保持隐藏，inspection 由点击角色触发。
- `close_context()` 清除详情时同步调用 `view.select("")`，保证 Roster、Detail、World Ring 一起清理。

## 验证

- `tests/camp_hud_2.gd`: 53 checks, 0 failures。
- 角色移动仍由现有 `CampActor` world root 驱动，selection ring 作为 Survivor 子节点跟随移动；未修改 Ambient、Departure、AnimationTree 或 Expedition ring 资源。

## 验收截图

截图脚本可将以下四个状态输出到 `apps/blue-hour/test-output/camp-selection-hotfix/`：

- `camp_selection_hotfix_A_entry.png`
- `camp_selection_hotfix_B_xia_selected.png`
- `camp_selection_hotfix_C_su_selected.png`
- `camp_selection_hotfix_D_closed.png`

