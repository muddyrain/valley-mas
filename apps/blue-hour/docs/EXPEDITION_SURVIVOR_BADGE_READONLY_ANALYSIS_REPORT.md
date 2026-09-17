# Expedition 幸存者编号 UI 只读分析报告

## 分析范围

本报告只分析 Expedition 幸存者卡片左上角编号 `1 / 2` 与圆形元素的来源、节点结构和布局问题。本轮未修改代码、资源或场景。

## 实际资源链

Expedition HUD 没有独立的幸存者卡片 `.tscn`。卡片由运行时创建：

- [mission_hud.gd](../ui/mission_hud.gd) 通过 `SquadCard.new()` 创建卡片。
- [squad_card.gd](../ui/expedition/squad_card.gd) 创建 `PanelContainer`、头像、头像框、选择按钮、编号节点和信息区。
- 卡片背景使用 `hud_survivor_card_bg_normal.png`。
- [hud_skin.gd](../ui/expedition/hud_skin.gd) 将 `hud_party_card` 映射到 `panels/hud_survivor_card_bg_normal`。
- 主题字体和颜色来自 [expedition_theme.gd](../ui/expedition_theme.gd)。
- 编号圆形贴图使用 `panels/party_index_badge.png`。
- 头像框使用 `legacy/hud_compat/portraits/hud_portrait_frame.png`。
- `hud_survivor_index.png` 存在，但当前运行时代码没有引用。

## 两个圆圈的来源

1. 大圆圈来自卡片背景 PNG：
   `assets/ui/expedition/hud/panels/hud_survivor_card_bg_normal.png`。

2. 小圆圈来自运行时动态 Badge：
   `assets/ui/expedition/hud/panels/party_index_badge.png`。

当前确实存在“背景 PNG 自带圆圈 + 运行时额外 Badge”两套圆形元素。

## 实际节点结构

```text
SquadCard (PanelContainer)
└── column (VBoxContainer)
    └── row (HBoxContainer)
        ├── portrait (TextureRect)
        │   ├── hud_portrait_frame
        │   ├── select_button
        │   └── NumberBadgeRoot (Control)
        │       ├── BadgeTexture (TextureRect)
        │       └── NumberLabel (Label)
        └── info
```

`NumberBadgeRoot` 当前为 `24×24`，挂在 `portrait` 下，并通过 `position = Vector2(12, 8)` 定位。

`NumberLabel` 使用 Full Rect，offset 为 0，水平和垂直均居中，且 `mouse_filter = IGNORE`。

## 编号位置异常的根因

根因不是 `NumberLabel` 的文字对齐，而是 Badge 所属坐标系错误：

- Badge 位于头像的局部坐标系。
- 背景圆圈位于整个 `PanelContainer` 背景纹理坐标系。
- `PanelContainer` 的内容边距、`VBoxContainer/HBoxContainer` 的布局位置和背景九宫格绘制共同造成坐标差异。
- 固定 `Vector2(12, 8)` 只对头像局部有效，无法保证与卡片背景圆圈的视觉中心重合。
- `party_index_badge.png` 自身包含透明外圈和右下角蓝色斜纹，视觉重心也不完全等于矩形中心。

未发现 Container 在 Badge 内部重新布局，也未发现 `_process()`、Tween 或其他运行时代码持续重写编号位置。编号内容由 `set_index(i + 1)` 动态生成，顺序逻辑本身正确。

## 最小修复方案

不修改 PNG，不新增资源：

1. 保留 `NumberBadgeRoot → BadgeTexture + NumberLabel` 结构。
2. 将 `NumberBadgeRoot` 放到 `SquadCard` 的固定叠加层，而不是 `portrait` 内容层。
3. 使用固定尺寸 Badge 容器，并按卡片背景圆圈的视觉中心定位。
4. `BadgeTexture` 与 `NumberLabel` 均使用 Full Rect，offset 全为 0。
5. 继续使用 `set_index(i + 1)` 动态生成编号。
6. 不再通过单独调整 `NumberLabel` 像素偏移修正位置。

## 下一步修改范围

运行时代码最小修改范围：

- [squad_card.gd](../ui/expedition/squad_card.gd)

如需补充自动化验收断言，再修改：

- [expedition_hud_phase2.gd](../tests/expedition_hud_phase2.gd)

本报告生成过程中未修改运行时代码、资源或场景。
