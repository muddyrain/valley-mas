# Camp HUD M07 Loadout Panel

2026-09-19。仅替换 M07 占位模块；外层仍为 1600×900 下 `(624,776)`、`316×82`。M01～M06、M08～M09、公共 StateButton 与 Camp 3D 不变。

## 资源与结构

用户 `Blue_Hour_M07_Loadout_Assets.zip` 的六张 PNG 原字节接入 `assets/ui/camp/m07/`，文件名沿用包内规范命名。Godot 生成 Lossless import；AtlasTexture 只选择原图有效图形区域并保持比例，未重绘、裁写或重新生成 PNG。

| 文件 | 原始尺寸 | 用途 |
| --- | --- | --- |
| m07_loadout_panel_bg.png | 2172×724 | 紧凑双槽面板 |
| m07_slot_empty.png | 1254×1254 | 已解锁空槽 |
| m07_slot_locked.png | 1254×1254 | 锁定槽 |
| m07_slot_item_bg.png | 1254×1254 | 已装备底板 |
| m07_slot_hover.png | 1254×1254 | 透明度 0→0.32 的叠加高亮 |
| m07_icon_loadout.png | 1254×1254 | 望远镜标题图标 |

```text
M07_LoadoutPanel
├─ PanelBG
├─ Header
│  ├─ LoadoutIcon
│  ├─ TitleLabel
│  └─ CountLabel
├─ SlotContainer
│  ├─ SlotLeft (StateButton)
│  └─ SlotRight (StateButton)
│     └─ VisualRoot
│        ├─ NormalTexture / HoverTexture / SelectedTexture / DisabledTexture
│        └─ Content / ItemIcon
└─ Pagination
   ├─ PrevButton
   ├─ PageLabel
   └─ NextButton
```

两槽共用 `loadout_slot.tscn` 与 `loadout_slot.gd`，HitArea 为 64×62，局部位置 `(161,10)`、`(235,10)`，间隔 10。标题 13px、数量 23px，道具图标 40×40。

布局收尾：望远镜控件改为 34×34、局部 `(24,24)`，相对纸张可见左缘留白约 16px；标题/数量位于 x=69，图文间隔 11px，两行控件间隔 3px，整体垂直居中。分页 Footer 为 116×26、局部 `(100,86)`，主面板底部间隔 4px、水平居中；两个按钮 HitArea 为 22×22，箭头线形轮廓 10×10（含描边约 12px），页码 15px，按钮与页码间隔 9px。

`loadout_page_button.tscn` 直接复用公共 StateButton 与现有 M07 装备底板/高亮 PNG；Normal/Hover 两层含同位置的原生 Line2D 箭头，0.12 秒交叉淡入，不缩放；末页/首页禁用按钮降低箭头对比。Footer 使用原生 StyleBoxFlat 底板，无新增 PNG。单页隐藏规则与 `loadout_panel.gd`、`loadout_slot.gd` 数据逻辑原字节保留。

## 数据与交互

`loadout_panel.gd` 提供 `show_loadout(items: Array[Dictionary], unlocked_count: int, total_count: int = 0)`；数组下标是全局槽位索引，空字典表示空槽，非空项包含 `id`、`name`、`icon: Texture2D`。输入数据复制到展示层，不写 Campaign。

- 默认 `equipped_items=[]`、`unlocked_slot_count=1`、`page_index=0`；显示 0/1、EMPTY / LOCKED。
- `slots_per_page=2` 是视图分页大小；总槽数至少覆盖已解锁容量，可显式传入更大的 `total_count` 展示后续锁槽。无系统最大槽数常量。
- 页数为 `ceil(total_slot_count / 2.0)`；解锁数不超过 2 时隐藏分页并回到首页。容量减少时自动限制页码。
- 每次翻页仅更新两个既有 Slot 的数据和图标；数量统计全部已解锁槽位，非当前页数量。
- 可用槽点击发出 `slot_requested(global_slot_index, item)`；锁定槽禁用，不发请求。不实现装备管理弹窗或实际换装。
- 复用 StateButton 覆盖层模式、0.12 秒 Tween 替换；Normal 保留在下层，Hover 只改变透明度。Hover 与 Pressed 均不缩放，视觉节点 IGNORE，HitArea 固定。

## 验证证据

`tests/camp_loadout_runtime.gd` 从真实 Main 进入 Camp，使用隔离存档。覆盖 A 0/1、B 1/1、C 1/2、D 2/4 两页、7 槽稀疏数据、奇数末页、缩减容量、原生鼠标分页与槽位点击、快速 Hover 反复进出、图层中间透明度、同中心/固定矩形和四档分辨率。

截图均为原生 1600×900，输出到 `test-output/m07/`：

- `default-0-of-1.png`
- `one-of-two.png`
- `two-of-four-page-1.png`
- `two-of-four-page-2.png`
- `empty-hover.png`

- 布局收尾后 M07 专项 119 项零失败，包含 Footer 渐变中间值/固定 HitArea/无缩放、2/3、4/4、连续点击与四种分辨率；最新 `test-output/m07-layout/runtime.log` 无 Script Error / Missing Resource / Invalid UID。83 个受保护文件哈希未变，包含六张源 PNG、M07 数据脚本、槽位场景、其他 HUD 与公共组件。
- 完整 `run.ps1 -Mode build`：导入、Search Gameplay 72、Expedition HUD 258、Survivor Command 45、Search Active Card 157、Settings 14 项通过；随后被旧 `camp_ui_runtime.gd` 访问已移除 `member_buttons` 及旧能力栏断言阻断。未修改旧测试或将完整构建标记通过，日志在 `test-output/m07/build.log`。
- 布局收尾后单独 Windows release 导出到 `build/BlueHourHomeward.exe` 成功；复制到独立目录后，Headless 与 1600×900 原生 Camp 启动均退出 0，错误日志为空。使用 `user://test-runs/m07-layout-standalone.json` 隔离存档，证据位于 `test-output/m07-layout/`；本次未重复上轮已记录失败的完整测试链。EXE SHA-256：`1503857E78423DC19EEC830BBF4786BDEE3A173B4612C17AE052CC68D7A8CF64`。
- 编码检查与定向 diff 检查通过。截图是 Godot 原生自动化 fixture 验证，等待用户视觉验收。

本轮停止于 M07，不进入 M08。
