# Blue Hour 通用 UI 状态过渡组件

2026-09-19。本轮建立公共 `StateButton`，并迁移 Camp M06 与 Main Menu 的现有 Normal/Hover PNG 按钮。布局、尺寸、素材内容和业务回调保持原样。

## 公共组件

路径：`ui/components/state_button.gd`

- `StateButton` 继承 Godot `Button`；Button 本体是固定 HitArea，视觉内容集中在 `VisualRoot`。
- `NormalTexture`、`HoverTexture`、可选 `SelectedTexture`、`DisabledTexture` 使用 alpha 权重 Cross Fade，禁止在输入事件中直接切换 `texture`。
- `hover_duration` 默认 0.12 秒，`selected_duration` 默认 0.15 秒，`pressed_duration` 默认 0.08 秒；每次状态改变都会终止旧 Tween。
- Hover 默认不缩放；Pressed 只缩放 `VisualRoot`，HitArea 的位置和尺寸不变。视觉节点递归设置为 `mouse_filter=IGNORE`。
- 公共接口 `set_state_textures(normal, hover, selected_state, disabled_state)` 不包含具体页面资源路径。

## 实际迁移

- Camp M06：`TemporaryBuff`、`MedicalSupport` 继承 `StateButton`，保留 `LockedAction` 的禁用占位。M06 使用 `HoverTexture` 作为 0.58 强度覆盖高光，继续支持 Q/E 与鼠标本地回调。
- Main Menu：`开始游戏`、`继续`、`角色图鉴`、`营地档案`、`设置`、`退出` 六个 `MenuEntry` 继承 `StateButton`。每个入口从现有 Normal/Hover 图集创建独立 `AtlasTexture`，文字、箭头、纸张绘制和原有动作回调不变。

## 验证

- M06 专项：365 项检查，0 失败；覆盖慢速 Hover、快速边缘进出、固定 HitArea、VisualRoot Pressed、Q/E、四种分辨率和三张 1600×900 截图。
- Main Menu 状态探针：6/6 入口继承 `StateButton`，Normal/Hover 图层和图集区域有效；设置项 Hover 平滑过渡，其他入口无残留 Hover。
- 现有 `menu_runtime.gd` 仍有两个与本轮无关的旧时序问题：菜单转场原本异步 0.27 秒，而测试在一个输入帧后立即断言新页面；失败后继续访问旧页面的 `tabs`。该测试同时会暴露工作区中既有的 Expedition 重复成员解析错误，本轮未修改这些并行文件。
- M06 日志未出现本轮新增的 Script Error、Missing Resource 或 Invalid UID。独立 Main Menu 探针以 1600×900 运行通过。

本轮停止于公共组件、M06 和 Main Menu 迁移，不自动迁移其他页面。
