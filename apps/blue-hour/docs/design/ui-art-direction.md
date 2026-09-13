# UI 与美术方向

UI 使用纸色、蓝灰和低饱和营地材质，优先语义化资源名。主菜单、Loading、营地、今日行动和 Expedition 共享统一主题脚本与真实数据，不建立平行状态源。

Loading、HUD、角色卡和任务卡的截图只作为开发基线，不是永久游戏素材；视觉迁移前后使用 `docs/development/baseline/` 对照。

## Loading

Loading 采用独立贴纸合成与无黑屏转场；坐标和 Continue 行为由 `tools/build_loading_artwork.gd` 与 `ui/loading_screen_v2.gd` 维护。
