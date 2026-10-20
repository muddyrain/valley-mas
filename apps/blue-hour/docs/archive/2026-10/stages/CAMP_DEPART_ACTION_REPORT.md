# Camp M08 Depart Action

## 实现范围

只替换 `ui/camp_hud/depart_action.tscn` 的 M08 占位视觉，新增同名脚本与专项原生验证。M01～M07、M09、Camp 3D、公共 StateButton、Mission Selection 和导航脚本均未修改。86 个受保护文件哈希一致。

四张原图从用户提供的 `Blue_Hour_M08_Depart_Assets_Final.zip` 原字节复制到 `assets/ui/camp/m08/`，保留原文件名，Godot import 使用无损压缩：

- `m08_depart_bg_normal.png`：500×144
- `m08_depart_bg_hover.png`：500×144
- `m08_depart_bg_disabled.png`：500×144
- `m08_icon_depart.png`：80×80

## 布局与交互

尺寸收尾后，外层仍保持原 M00 `(1264,744,320,112)`，固定 Entry HitArea 为 `(1284,784,300,86)`，距屏幕右侧 16px、底部 30px。三张背景控件统一 300×86；本轮 Normal / Hover / Disabled 均使用 AtlasTexture Region `(0,8,500,117)`，并以 STRETCH_SCALE 铺满原控件，减少上下透明留白。统一裁切与映射保证三态完全同中心；不修改源 PNG。图标 46×46，局部 `(16,16)`；文字区 x=78，图文间隔 16px。标题“出发”26px，副标题“前往今日行动”13px，均由 Godot Label 渲染。尺寸收尾后本轮仅调整背景 Region 和填充方式，HitArea、位置、文字、图标、M08 脚本、三态逻辑和导航未改动。

```text
M08_DepartAction (Control, depart_action.gd)
└─ Entry (Button + StateButton，固定 HitArea)
   └─ VisualRoot
      ├─ NormalTexture
      ├─ HoverTexture
      ├─ SelectedTexture（公共组件保留的空层）
      ├─ DisabledTexture
      └─ Content
         ├─ DepartIcon
         ├─ TitleLabel
         └─ SubtitleLabel
```

复用公共 StateButton 的 0.12s Cross Fade 与 Tween 替换；Hover、Pressed 均无缩放。视觉子节点均 IGNORE，只有 Entry 接收输入。`set_depart_enabled(enabled: bool)` 修改原生 disabled 属性；禁用背景淡入时 Content 透明度同步降至 0.45。既有 `lock_departure()` 直接设置 `Entry.disabled` 时同样生效。

保留原 `Entry.pressed → CampHUDRoot.depart_requested → main.show_today_action` 连接；不加入导航接口、Loading 或新玩法条件。用户在原 Mission Selection 确认任务后才进入原巴士出营地流程。

## 验证

`tests/camp_depart_action_runtime.gd` 使用真实 Main/Camp、原生鼠标事件和 `user://test-runs/camp-depart-action.json` 隔离存档。

- Region 修正后 97 项检查零失败：三态尺寸/中心、动态文字宽度、46×46 图标、Hover 中间透明度、20 次快速进出与 Tween 替换、禁用点击、重复打开/取消、Camp/Camera 保留、既有 departure 锁定及巴士进入 Mission。97 个受保护文件哈希未变，包含全部 PNG、冻结 HUD、公共组件和导航。
- 1600×900、1280×720、1024×640、1920×1080 下 HitArea 在屏内，图层保持对齐。
- 最终专项日志无 Script Error / Missing Resource / Invalid UID。首次采样受同步截图保存后的长帧影响；验证在截图后等待五帧再采样，未改动画时长或公共组件。
- 最新 `test-output/m08-region/normal.png`、`hover.png`、`disabled.png`、`camp-overall.png` 均为原生 1600×900 截图。属于自动化 fixture 证据，尺寸视觉等待用户验收；功能和三态已由用户确认通过。

上轮完整 `run.ps1 -Mode build` 已执行：Search Gameplay 72、Expedition HUD 258、Survivor Command 45、Search Active Card 157、Settings 14 项通过；既有 `camp_ui_runtime.gd` 的 `member_buttons` 访问及旧能力栏断言阻断后续构建链。未修改旧测试，完整构建未标记通过。

Region 修正后单独 Windows release 导出成功，`build/BlueHourHomeward.exe` 已更新。复制到独立目录后，Headless 与 1600×900 原生 Camp 启动均退出 0，无脚本/资源错误，使用 `user://test-runs/m08-region-standalone.json`。EXE SHA-256：`2d6a8ba2e4b8daa52f00e8c17747ccc6a6c50850c852986c1d262bd5983575b0`。最新日志在 `test-output/m08-region/export.log`、`runtime.log` 和 `standalone/`。本轮仅调整背景 Region / 填充，未重复上轮已记录失败的完整测试链；BUILD-INFO 保留该限制。

编码检查与定向 diff 检查通过；`docs/PLAN.md` 已同步。

停止于 M08，不进入 M09。
