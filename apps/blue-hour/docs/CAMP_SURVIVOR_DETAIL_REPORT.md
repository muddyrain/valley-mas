# Camp HUD M04 Hover + M05-A Survivor Detail

2026-09-18。本轮按用户新授权增加 M04 交互及 M05 详情骨架，覆盖旧 M04「默认首项选中、不连接详情」规则。M04 位置、尺寸、PNG 与 Selected 效果继续冻结；停止于结构和展示数据，不进入 M05 正式美术。

## 实现

- `portrait_slot.gd` 管理 Normal / Hover / Selected / Pressed。普通框沿用 RGB 0.78；Hover 使用同一普通框，RGB 0.90/0.93/0.94、头像 1.06、Scale 1.02；颜色过渡 0.12 秒、缩放 0.10 秒。按下缩至 0.98，松开恢复；Selected 保持原 PNG、白色调制、无叠加强光。指针为可点击手形，隐藏时清除瞬时状态。
- `survivor_roster.gd` 初始 selected_index=-1，点击后发出 selection_changed(index)。`camp_hud_root.gd` 初始 selected_survivor_id=null 且隐藏 M05；收到选中事件后刷新现有面板并显示，不重新实例化。今日行动覆盖层关闭后仅恢复已选详情，重新进入 Camp 重置选择。
- `survivor_detail.tscn` 与 `survivor_detail.gd` 保留 (1100,278)、354×452 外框，整理五个区。沿用半透明调试视觉，无 M05 正式背景、图标或按钮美术。
- `survivor_detail_fixtures.gd` 独立存放四个展示角色。前两项苏晚星 / 夏知遥的姓名、职业、头像、武器、战力和属性不同，后两项为临时角色并复用两张已有头像。固定 4/4 不代表实际 Campaign 队伍；不读取或写入真实角色成长系统。
- ActionBar 的切换 / 装备 / 升级按钮禁用，本轮不接玩法。

## 节点与几何

```text
M05_SurvivorDetail (354×452)
├─ HeaderPanel (8,8; 338×164)
│  ├─ SurvivorName / SurvivorNameEn
│  ├─ RoleIcon / RoleLabel / Tags / Quote
│  └─ HalfPortrait
├─ CombatPanel (8,178; 338×64)
│  └─ WeaponIcon / WeaponName / WeaponType / PowerValue / PowerLabel
├─ AttributesPanel (8,248; 338×96)
│  └─ Survival / Firepower / TeamSupport / Mobility
│     └─ Label / Bar / Value
├─ TraitPanel (8,350; 338×60)
│  └─ TraitIcon / TraitName / TraitDescription
└─ ActionBar (8,416; 338×28)
   └─ SwitchButton / EquipmentButton / UpgradeButton
```

M04 仍为 (1466,126)、118×436；Slot 仍为 (12,42/138/234/330)、94×94，头像 78×78。轻微缩放以 Slot 中心为原点。

## 验证与证据

- `tests/camp_survivor_detail_runtime.gd`：原生 Godot 渲染和鼠标事件，407 项检查零失败。覆盖初始隐藏、Hover/Pressed、选中后无额外增亮、两角色数据变化、反复切换保留实例、覆盖层往返、重新进入重置、四种分辨率文字适配、Campaign 与相机不变。
- `tests/camp_survivor_roster_runtime.gd`：更新初始选择与过渡等待规则，473 项回归零失败；新输出目录 `test-output/camp-survivor-roster-interaction/`，不覆盖旧冻结证据。
- 66 个受保护文件 SHA-256 全部不变，包括其他 HUD 场景、HUD 根场景、全部 Camp PNG/import、Camp 3D 及 core/main.gd。M01～M03、M06～M09 截图区与此前冻结截图逐像素一致。
- Godot import、专项运行、Windows release 导出及独立 EXE 原生启动通过；退出码 0，日志无 Script Error / Missing Resource / Invalid UID。使用 `user://test-runs/` 隔离存档。
- Windows 产物：`build/BlueHourHomeward.exe`。本轮直接执行 Godot Windows export，未运行历史全量 build 测试链；专项通过不表示全项目测试通过。
- 编码检查通过。实际视觉证据为原生引擎自动化截图，不代替用户实机验收。

截图位于 `test-output/camp-survivor-detail/`：

- `camp-initial-1600x900.png`：初始隐藏 M05。
- `camp-hover-1600x900.png`：首项 Hover，无选中。
- `camp-selected-first-1600x900.png`：首项选中与苏晚星详情。
- `camp-selected-and-hover-1600x900.png`：首项 Selected、第二项 Hover、其余 Normal，同屏对比。
- `camp-1600x900.png`：切换为夏知遥后的详情。

计划状态已同步。下一步仅等待本轮人工验收，不主动进入 M05 正式美术。
