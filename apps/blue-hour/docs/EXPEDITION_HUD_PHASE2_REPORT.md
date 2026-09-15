# Expedition HUD Phase 2 Report

## 1. Summary

Phase 2 已接入正式 Expedition HUD，等待用户视觉验收，不进入下一阶段。保留当前未提交的 Phase 1 底板、布局、资源卡构造和组件结构；本轮只调整细节层、尺寸、间距及资源加载。未修改 AI、伤害、掉落、时钟、任务、导航或撤离规则。

Godot 4.7.2 Compatibility 原生专项 **243 项通过**；1920×1080、2560×1440 截图完成。Windows 验收包已导出并通过六组独立启动和 81 项包内检查。完整 `run.ps1 -Mode build` 仍在两个 Camp UI 断言处停止，不宣称全仓门禁通过。

## 2. Batch 2 Assets Imported

41 张 PNG 与用户 ZIP 原件逐字节 SHA-256 一致，没有重新裁切、修图、降采样、合并或覆盖源图片。39 张已在任务开始时进入工作区，本轮核验并复用；补入缺失的 `vehicle_bus.png` 和 `misc_decorations.png`。

正式目录：[assets/ui/expedition/hud](../assets/ui/expedition/hud)。完整原文件名、语义归档路径和哈希见 [batch2_sources.json](../assets/ui/expedition/hud/docs/batch2_sources.json)。用户 README、manifest 和 QA 图原样保存在 `art/ui/expedition/batch2/`，由既有 `art/.gdignore` 排除运行时导入。Phase 1 资源未删除。

## 3. Assets Actually Used

| 区域 | clean ZIP 文件名 |
| --- | --- |
| 顶栏 | resource_food, resource_scrap, resource_intel, menu_icon |
| 队伍 | weapon_ranged_pistol, weapon_melee_knife, status_combat_warning, status_follow, hp_friendly_bg/fill, party_index_badge |
| 敌人 | hp_enemy_bg/fill |
| 动作 | action_stop, action_focus_fire, action_locate, action_frenzy, hotkey_badge_normal/active |
| 世界/发现 | location_house_large/small, vehicle_van, vehicle_bus, arrow_right, chevron_down, search_time_clock, panel_pointer, location_pin_micro |
| 小地图 | minimap_player_arrow, minimap_house_marker, minimap_target_marker |
| 返回巴士 | return_bus_button_normal/hover/pressed, return_bus_icon_normal/highlight |

共 36 张运行时使用；以上文件均为 PNG。语义映射继续由 [hud_skin.gd](../ui/expedition/hud_skin.gd) 管理。狂怒 `rage` → `icon_rage` → `icons/actions/icon_action_rage.png`，该文件 SHA-256 与 ZIP 的 `action_frenzy.png` 完全一致；未误替换 `scavenge_frenzy` 或 `sprint` 的技能含义。

## 4. Reserved / Unused Assets

5 张保留未用：`resource_intel_highlight.png`、`hotkey_badge_large.png`、`cooldown_wedge.png`、`portrait_frame_accent.png`、`misc_decorations.png`。没有新增高亮业务、冷却逻辑、强行头像覆盖或额外装饰。

## 5. Top Resource HUD

继续复用原资源卡循环与 Phase 1 底板。Food / Scrap 读实际 Ledger，新增资源后即时更新；情报目前没有数值数据源，保留“—”，未伪造数字。菜单图标进入现有菜单底板，文案简化为“菜单”以保留清晰图标位置。

## 6. Survivor HUD

武器图标绑定实际装备的 `melee` 属性，不绑定角色职业。战斗/自卫和受伤使用 warning，跟随使用 follow；状态文案仍由 Label 渲染。编号由队伍索引动态生成，Badge 和所有装饰忽略鼠标事件。

[health_bar.gd](../ui/expedition/health_bar.gd) 保留 Range 值接口，按 current/max 比例裁切 fill 的源区域，背景与 fill 按同一像素比例居中；验证了 43.25% 与零 HP，不挤压 fill 端帽，也不修改血量。保留原头像显示，未加可选 accent。

## 7. Enemy HP HUD

复用现有 Enemy `HealthAnchor` 和 HP 更新点，替换为 [enemy_health_bar.gd](../ui/expedition/enemy_health_bar.gd) 的相机朝向 Sprite3D。背景固定，fill 使用 `region_rect` 从左到右裁切；更新血量、威胁属性和重置时只更新显示比例。血量、伤害、目标和 AI 算法不变；实际伤害后半血验证通过。

## 8. Action Bar

停止、集火、定位使用 clean 图标。`rage`（狂怒）使用火焰正式 PNG；保留真实 power 激活和每日状态。X / F / L / 1 / R / E 使用动态文字 Badge；普通与 active/hover 的背景和字色同步。图标分别设置视觉尺寸，保持宽高比。

狂怒专项截图清楚显示火焰，非鞋子；集火文件与清理 ZIP 哈希一致。所有按钮保持原命令，点击 Badge 仍可触发对应按钮。

## 9. World Interaction

大房屋/车辆图标用于世界搜索卡，搜索时间加时钟，底部增加朝向世界锚点的 pointer。保留原卡片投影、显示规则和搜索入口。对原搜索条做局部修正：其 11px 高纹理不能使用通用 12px 切片边距；改为 2px 并恢复 10px 显示高度，取消按钮向上移入卡片。搜索进度取消整数步进，避免显示值与真实进度不一致。原生验证搜索、进度与取消点击通过。

## 10. Discovery UI

列表采用 small 房屋和 van 图标，预计秒数旁显示时钟；标题采用 micro pin，展开/收起使用 PNG 箭头。保持原发现状态、排序、滚动与展开逻辑，没有新增发现规则。

## 11. Minimap

替换玩家、房屋与目标标记；巴士使用 vehicle_bus 图标。使用等比绘制，并降低玩家标记视觉尺寸。原世界坐标转换、发现状态和相机关系保持原样。

## 12. Return Bus

仍为原生 `ActionIcon` 按钮，保持右下锚点；横向背景按素材比例显示，图标、动态“返回巴士”、E 分别排列。Normal / Hover / Pressed 映射到三张对应素材；Hover / Active 使用 highlight icon。真实鼠标移动、按住和松开产生三态截图；E、点击、全员抵达、撤离完成均通过专项检查。

## 13. Texture Import Configuration

41 张 PNG 导入参数逐一检查：`compress/mode=0`（Lossless）、`mipmaps/generate=false`、`process/size_limit=0`、Alpha border fix 保留。HUD 采用 Linear filter、Repeat Disabled；TextureRect 使用 Keep Aspect Centered，Sprite3D 采用线性过滤。源 PNG 和透明留边不变。

包内验收发现原 HUD 用 `FileAccess.file_exists()` 判断导入 PNG，导出后会返回缺失。已改用 `ResourceLoader.exists()` 支持 Godot 的导入映射；重新导出后 36 项实际资源全部可从 EXE 加载，原生 HUD 与独立外出启动通过。

## 14. Regression Tests

| 检查 | 最终结果 |
| --- | --- |
| Phase 2 原生专项 | 243 checks, 0 failures |
| Rules | 19 checks, 0 failures |
| Search dispatch | 56 checks, 0 failures |
| Encounter combat / clock | 10 / 7 checks, 0 failures |
| Weapon system | 428 checks, 0 failures |
| EXE 包内 Headless / Native | 40 / 41 checks, 0 failures |
| 独立主菜单、营地、外出 Headless / Native | 6/6 PASS |
| PNG 哈希和导入配置 | 41/41 PASS |
| Encoding guard / diff whitespace | PASS |
| 完整 build | 未通过：Camp UI 两项断言，详见第 17 节 |

本轮复用了原生 Mission + HUD、固定 combat campaign、device-42 合成输入与原玩法的时间压缩；没有覆盖玩家存档，不是用户当前游戏窗口的手工验收。`run.ps1` 的 capture/build 已加入 Phase 2 专项。武器 UI 测试同步“HUD 显示装备类型”的新契约，保留实际装备核对。

早期 91/91 的 `expedition_visual.gd` 结果不作为最终完成证据：其中动作栏 124–132px 的旧高度断言与任务开始时 Phase 1 的 160px 框体冲突。本轮保留 Phase 1 高度，使用当前专项的真实面板/点击范围检查。

Windows 包：[BlueHourHomeward.exe](../build/BlueHourHomeward.exe)。这是单独 `--export-release` 得到的验收包；完整 build 失败状态没有被清除。六组独立启动均从只含 EXE 的目录执行，无源码或单独 PCK；包内 HUD 则由同版本引擎挂载该 EXE 进行断言。精确哈希、时间及检查状态见 `build/BUILD-INFO.json`。

## 15. Screenshots

[截图目录](../test-output/expedition_hud_phase2) 与 [逐图预览](../test-output/expedition_hud_phase2/index.html)。

- `01_full_hud.png`、`01_full_hud_2560x1440.png`
- `02_top_resources.png`、`03_survivor_cards.png`
- `04_action_bar.png`、`05_action_hover.png`
- `06_discovery_panel.png`、`07_world_interaction.png`、`08_minimap.png`
- `09_return_bus_normal.png`、`10_return_bus_hover.png`、`11_return_bus_pressed.png`
- `12_frenzy_binding_check.png`、`13_enemy_hp.png`
- `14_frenzy_active.png`、`15_friendly_hp_partial.png`、`16_embedded_hud.png`

截图均来自实际 Godot 渲染；局部图裁自该帧 Viewport，不是编辑器摆放素材。返回巴士的三态分别由真实合成鼠标输入触发。

## 16. Known Issues

用户视觉验收待完成。情报没有真实数值源，显示“—”。测试结束时有 2–4 个 ObjectDB 清理警告，未将其算作零警告；最终专项、包内检查和独立启动没有 SCRIPT ERROR。完整构建门禁仍有失败，见下一节。

任务过程中一次进程清理范围过宽，误结束了并行营地稳定性测试。已恢复其原命令并实际跑满 300.03 秒，`unsafe=[]`、`failures=[]`；恢复日志保存在本轮输出目录。之后仅按本轮已记录的进程处理。

## 17. Out-of-Scope Existing Issues

- `parallel_commands.gd` 的“All three survivors may search, leaving zero guards”在本轮前后隔离对照均为 3 checks / 1 failure。该测试不实例化 HUD；隔离副本将 Enemy 恢复成任务开始时干净 HEAD 的原文件，其他依赖保持相同，足以排除敌人血条改动。对照日志 `parallel_commands-before.log` 与 `parallel_commands.log`。
- 完整 build 停在 `camp_ui_runtime.gd`：关闭详情后预期节点释放、悬停能力说明两项断言；当前 86 checks / 2 failures。此链路属于营地，未被本轮修改。第一次构建还遇到并行营地任务的只读字典/导航错误，后续外部修复后这部分消失，仍留下上述两个 UI 断言。没有为通过门禁修改营地行为。
- 旧 `expedition_hud_2.gd` 最终 349 checks / 2 failures：旧选择环 Alpha 断言与车辆世界 marker 可见性断言。早期检查另有搜索卡越界、进度取整问题，本轮已修复；选择环和世界 marker 显示逻辑未改。没有保存完整 Phase 2 前的原生基准，因此这两项只记为遗留检查待独立诊断，不声称已完成完整前后归因。Phase 2 自身的图标、搜索、Minimap 和输入检查通过。

以上不扩展到 AI、地图密度、模型、动画或任务玩法修复。当前工作区还包含其他任务的未提交改动，验收包基于导出时的完整工作区；本轮未提交代码。
