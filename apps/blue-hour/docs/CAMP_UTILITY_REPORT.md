# Camp M09 Utility

M09 替换 `ui/camp_hud/utility.tscn`，新增局部 `utility_button.gd`，无新增图片。保留外层骨架与 Entry 名称。最终小修另调整 M03 菜单输入节点及 CampHUDRoot 信号连接；其他 HUD、公共 StateButton、Camp 3D 与 main.gd 未修改。

## 视觉与输入

- Entry 在 1600×900 下为 `(30,850,150,30)`，左侧 30px、底部 20px。
- HBoxContainer：34×24 Esc Keycap，9px 间距，15px“返回主菜单”；键帽为透明 StyleBoxFlat、1px 白色描边、3px 圆角，文字有轻微阴影。
- 无整体背景板；视觉节点全部 IGNORE，仅 Entry 接收输入。
- 继承 StateButton 的 0.12s Tween 和新状态替换机制。局部 `_apply_weights` 渐变键帽边框与文字 0.85→1.0 透明度，无缩放或位移。StyleBox 是场景实例私有资源，避免跨实例共享修改。
- 点击沿用 `Entry.pressed → CampHUDRoot.menu_requested → main.show_main_menu()`；Camp Esc 原有分支直接调用同一个 `show_main_menu()`。现有 Camp 无返回确认弹窗，本轮不新增。Mission Selection、Expedition 和 departure 对 Esc 的原有处理保持不变。

```text
M09_Utility
└─ Entry (StateButton subclass, fixed HitArea)
   └─ VisualRoot
      ├─ 公共组件的空 Texture 层（无图片）
      └─ Content (HBoxContainer)
         ├─ EscKeycap
         │  └─ EscLabel
         └─ ReturnLabel
```

## 验证

`tests/camp_utility_runtime.gd` 使用真实 Camp、原生鼠标/键盘事件、隔离 `user://test-runs/camp-utility.json`。

- 最终修正后 87 项检查零失败：几何/间距、无 PNG、子节点 IGNORE、Hover 中间透明度与完成态、20 次快速进出与 Tween 替换、无位移缩放、无 Hover 残留、禁用点击、鼠标与 Esc 返回主菜单、Campaign 不变、四档分辨率。
- 原生 1600×900 截图：`test-output/camp-final-fix/normal.png`、`hover.png`、`camp-overall.png`。最终运行日志无 Script Error / Missing Resource / Invalid UID。
- Windows release 导出成功；复制至隔离目录的独立 Headless 与 1600×900 原生 Camp 启动均退出 0，无脚本/资源错误，使用 `user://test-runs/m09-standalone.json`。完整测试链此前被旧 Camp `member_buttons` / 旧能力栏断言阻断，本轮未重复该全量链。

停止于 M09，等待用户视觉验收。

97 个受保护文件哈希一致。Windows EXE SHA-256：`31e5e7d6d5f9ab46139835501317b56eca8f5cd9ac232ddf823d3105d99d99ca`。编码检查通过，计划已同步。


## 最后一轮修正

M09 背景 alpha=0，Esc / 返回主菜单字体纯白；边框和返回文字 Normal alpha=0.85，Hover 用原 0.12s Tween 到 1.0。位置、HitArea 和导航不变。

右上角失效根因：M03 的 MenuButton 是仅展示的 Control，mouse_filter=IGNORE，没有 Button pressed 信号和回调连接。改为原位置、原 116×56 的 Button，全部视觉子节点保持 IGNORE，六种原生 StyleBox 透明以保持既有 PNG 外观。在 CampHUDRoot 将 pressed 接至原 menu_requested，继续由 main.show_main_menu 打开现有主菜单；出发锁定时同步禁用。未修改 main.gd 或新增菜单。

原生鼠标验证按钮中心及左上角有效，无上层遮挡，菜单 visible；截图 `test-output/camp-final-fix/top-menu-open.png`。96 个其他受保护文件哈希一致。Windows 导出及独立启动结果记录在同目录。

本轮独立 Headless / 1600×900 原生启动均退出 0、无脚本或资源错误；构建产物已更新。完整构建链的既有旧 Camp 测试阻断保持记录，未重复运行。
