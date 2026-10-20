# CAMP HUD D2 Runtime Layout Normalization Report

## 修改文件

- `ui/camp/camp_hud.gd`
- `ui/camp/camp_texture_button.gd`

未修改 Camera、Environment、Ambient、Departure、Expedition HUD、角色动画或 D2 PNG。

## Runtime Size Tokens

`camp_hud.gd` 新增共享尺寸常量：

- Skill Button：`109 × 109`
- Skill Label：`123 × 28`
- Loadout Slot：`88 × 88`
- Roster Slot：`108 × 108`
- Esc Keycap：`42 × 30`（供后续 BackPrompt 容器统一使用）

Loadout、Skill、Roster 不再依赖 PNG 原始尺寸推导控件尺寸。Roster slot 使用固定尺寸并设置 `SIZE_SHRINK_CENTER`，ScrollContainer 在超过 `360px` 内容高度后滚动，避免单项拉伸成深蓝长块。

## Visual / State Normalization

- D2 Roster 状态资源继续使用 227 / 228 / 229，状态切换不改变 SlotRoot 尺寸。
- `CampTextureButton` 增加 `selected_hover` 逻辑：Selected 项悬停时仍保留 Selected 纹理，并通过轻微亮度反馈响应 Hover。
- Roster 子内容仍由外层 Button 接收鼠标，显示层不承担交互。
- D2 Skill Label 使用 `skill_label` 控件族，背景统一为 ID 224；不再把标签背景作为 VBox 独立行，避免额外深蓝块和布局跳动。
- Loadout 槽位统一为 88×88，装备图标按槽位比例缩放，锁槽与普通槽共用同一几何尺寸。

## 主要绑定与语义

- Top Header：220。
- Camp Info：恢复正式卡片 ID 1。
- Loadout：221 / 222 / 223。
- Skill Label：224；技能锁仍使用 223。
- Esc：225。
- Roster：226 / 227 / 228 / 229。
- 顶部阶段标签收束为营地语义“营地整备”，不再显示 Expedition 四阶段文字标签。

## 验证

- Godot editor headless scan：完成，无本轮脚本解析错误。
- `tests/camp_hud_2.gd`：53 checks，0 failures。
- 测试包含 Camp HUD 选择、详情、Roster 与响应式尺寸检查。

## 未完成项

- 本轮未生成最终交互截图；现有测试通过后仍需人工打开 1600×900 与 1920×1080 Runtime，核对 Alpha 可见边界的视觉中心，尤其是锁图标与 Esc Prompt。
- 未引入额外 Alpha Bounds 图像处理依赖；D2 原始 PNG 未修改。

