# 蓝时归航 Expedition UI 素材包 V1

基于已确认的 Expedition UI 目标稿制作，全部为透明 PNG，可直接用于 Godot。

## 原则
- PNG 中不烘焙中文文字、动态数字、角色名称、HP、任务时间、搜索百分比等。
- 角色头像沿用项目内正式头像资源，不从概念图硬裁。
- 小地图内部道路/建筑/幸存者位置由 Godot 实时渲染，本包只提供外框与 Marker。
- 面板/按钮建议使用 NinePatchRect 或 StyleBoxTexture；切片边距见 `manifest.json`。

## 文件夹
- `panels/`：时间栏、资源卡、角色卡、任务卡、Hover/Search 卡、HP 条等。
- `buttons/`：菜单、集合、通用操作、取消、返航等多状态按钮。
- `icons/`：资源、阶段、操作图标。
- `minimap/`：小地图外框、区域条、幸存者/巴士/POI/目标 Marker。
- `world/`：搜索进度条等世界交互 UI。
- `feedback/`：冷却遮罩、危险角标。
- `docs/`：清单和接入说明。

## 小地图多人规则
- 当前选中幸存者：`map_player_marker.png`
- 其他幸存者：`map_teammate_marker.png`
- 危险/倒地：`map_teammate_danger.png`
- 搜索中：叠加 `map_search_marker.png`
- 多人重叠：Godot 侧聚合为 `×N`
- 蓝时号：`map_bus_marker.png`

## 动态内容
以下不要使用图片文字，直接由 Godot Label/RichTextLabel 渲染：
食物/废料/情报数值、天数、时间、角色名、HP、弹药、任务名称、建筑名称、资源倾向、搜索时间、百分比、快捷键。

## 推荐基准画布
本套尺寸按 1672×941 的目标稿比例制作。
