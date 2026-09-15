# Expedition HUD Final Match Report

## 1. Summary

按用户提供的 Target 完成 Final Match 布局。新 Logo、横向时间区、独立行动卡、新小地图 Frame 和下置 E 已接入。原生专项 257 项通过；Windows EXE 六组独立启动通过；包内检查 45 + 46 + 46 项通过。完整 build 仍因两个既有 Camp UI 断言失败，不能宣称全仓门禁通过。当前停止等待视觉验收。

## 2. Visual Reference

Target 为用户提供的 `codex-clipboard-74de2e87-8e77-4804-b252-cdf0fc5c1d3b.png`，已原字节保存为 [03_target_reference.png](../test-output/expedition_hud_final_match/03_target_reference.png)。

修改前重新运行 Phase 2.1 原生场景并通过 248 项检查，保存 [01_current_before.png](../test-output/expedition_hud_final_match/01_current_before.png)。同种子、同双角色、同战斗专精的最终场景见 [02_final_match_full.png](../test-output/expedition_hud_final_match/02_final_match_full.png)。Target 的第 2 天、18 食物、9 废料和已发现 2 是参考数据，本轮没有伪造这些值。

## 3. New Assets Imported

三张新 PNG 原样进入 `assets/ui/expedition/hud/final_match/`：Logo、Minimap Frame、可选 Region Label。原文件名及 SHA-256 见 [sources.json](../assets/ui/expedition/hud/final_match/sources.json)。三张均与 ZIP 逐字节一致；Lossless、无 Mipmap、无尺寸限制。旧 Expedition PNG 未改。

Logo 和 Frame 实际使用；Region Label 保留未用，继续动态显示当前地图名称。没有从 Target 裁素材，没有生成新 PNG；验收截图来自运行时。

## 4. Logo

Current：普通中文文字与 HOMEWARD 两行。Changed：替换为透明 Logo，300×112 显示盒，Keep Aspect，左上 24px 安全区。Final：品牌区更醒目，旧文字不再叠加，Logo 与角色区无重叠。

## 5. Top Time HUD

Current：阶段栏在上、日期卡在下。Changed：两个原底板放入 `TopTimeRoot` HBox，阶段栏 330px、日期卡 146px、间距 6px。Final：同一横排，整体位于顶部中央区域，右侧留出资源栏空间；日期、时间、阶段仍读真实时钟。原次级阶段提示与细进度条隐藏，避免双排视觉。

## 6. Resource HUD

Current：小图标与数字上下排列，资源区较窄。Changed：每卡 124×64，36px 图标在左，名称和数字在右；卡间 12px，菜单 168×64。Final：右上横向比例接近 Target，Food/Scrap 动态更新，Intel 仍为“—”。

## 7. Survivor HUD

Current：288px 卡片叠加 0.95 scale。Changed：304px 卡宽、88×106 头像、18px 姓名，角色区恢复 1.0 scale，卡间 14px，顶边 192px。Final：左侧与 Target 对齐为 Logo、留白、队伍两层结构；姓名、HP、装备、状态和编号仍绑定原数据。集合按钮随卡宽展开，保留 R。

## 8. Action Bar

Current：大型深蓝托盘包住四卡。Changed：仅将托盘 StyleBox 设为空，保留 HBox 与原生按钮；卡宽 120px，间距 12px，卡下显示原动态键位。Final：四张独立米白卡悬浮于底部，X/F/L/1、悬停、按压及技能激活有效。快捷键仍是按钮内的透明装饰子节点，视觉上处于底板下方，点击键位也能触发原按钮。

## 9. Fourth Action Slot Check

当前设计同时包含两种正式定义：[combat.tres](../data/specializations/combat.tres) 提供 `rage`，显示“狂怒”并使用 clean 火焰；[scavenge.tres](../data/specializations/scavenge.tres) 提供 `sprint`，显示“疾行号令”。不是同一技能改名，也不是错误图标绑定。

本轮 Target 对照使用真实战斗专精；包内另跑搜刮专精，确认疾行文案和原技能图标不变。若要求所有专精都固定狂怒，属于玩法决策，本轮未执行。

## 10. Discovery Panel

Current：0.85 scale 的较小列表。Changed：1.0 scale、右上 24px 安全区、顶部 136px、52px 行高和 40px CTA。Final：名称/秒数列留白保持，内容数量、排序、发现与展开仍动态更新。

## 11. World Interaction

Current：Compact 只显示标题。Changed：264×108 Compact 显示地点名、真实主要资源和预计搜索时间；资源文案读取现有 food/scrap 字段，不改掉落。Final：三行层次接近 Target，原世界锚点、投影和 pointer 保留。

搜索中仍使用 Phase 2.1 的头像、剩余时间、进度和取消按钮；实际派遣、进度与取消通过。示例站前住宅实际搜索为 38 秒，没有按 Target 写死为 5 秒。

## 12. Minimap

Current：旧重边框、示意线条、内容较暗。Changed：新透明 Frame 作为子节点覆盖层；底图读取当前地图的道路和街区数据，已发现建筑按现有尺寸绘制轮廓。Final：地图与 marker 随世界状态更新，透明 PNG 中没有地图内容。

保留以小队中心为中心、extent 34 和 0.46 比例的 world→minimap 换算；仅显示内边距、尺寸与颜色调整。普通队友先画、选中玩家最后画，降低重叠。建筑 marker 的发现条件保留。地区名读取当前 `map.display_name`，因此显示“东岸旧街”，不伪造 Target 的地区文案。

## 13. Return Bus

Current：约 0.85 scale，E 在内部右侧。Changed：1.0 scale、286px 宽、58px 巴士图标、24px 文案，E 在底板下方居中。Final：右下独立按钮比例更接近 Target，Normal/Hover/Pressed 继续使用原三态素材；按住与松开、点击、E、全员归航和撤离完成通过。

## 14. Global HUD Scale

以 1920×1080 为布局坐标，按视口统一等比缩放至 1440p，避免每块各自放大。左右安全区以 24px 为主，顶部 20px，Minimap 底部 48px 为框体装饰留空间。参考图 Logo、HP 和纸框自身比例与提供的素材存在差异，保留原素材宽高比。

## 15. 1080p / 1440p Validation

原生双分辨率检查面板边界、按钮与键位点击范围、Logo/队伍无重叠、横向时间共享容器与同排、托盘无背景。已实际查看两张最终全图及局部截图。此证据来自 Godot 4.7.2 Compatibility、固定场景和 device-42 合成输入；不是用户当前游戏窗口的手工验收。

## 16. Screenshots

[A/B 对比与逐图预览](../test-output/expedition_hud_final_match/index.html)。MD 要求的 01–11 文件全部存在，包括 Current、Target、1080p Final、顶部、队伍、行动、发现、Compact、小地图、归航及 1440p。额外保存搜索中、Hover/Pressed、狂怒激活、部分 HP 和包内战斗/搜刮截图。

## 17. Regression Tests

| 检查 | 结果 |
| --- | --- |
| 修改前 Phase 2.1 原生 | 248 checks, 0 failures |
| Final Match 原生 | 257 checks, 0 failures |
| 新 EXE 主菜单/营地/外出，Headless/Native | 6/6 PASS |
| 包内战斗 Headless/Native、搜刮 Native | 45 / 46 / 46 checks, 0 failures |
| 新素材字节与导入 | 3/3 PASS |
| Windows Release 单独导出 | PASS |
| 完整 build | FAIL：Camp UI 86 checks, 2 failures |

复现：`tests/expedition_hud_phase2.gd -- --final-match`；包内用 `--main-pack` 挂载 EXE 后运行 `tests/expedition_hud_pack.gd -- --final-match`，搜刮附加 `--scavenge`。测试不写入玩家存档。

交付 [BlueHourHomeward.exe](../build/BlueHourHomeward.exe)。确切哈希、导出时间及当前包验证状态见 `build/BUILD-INFO.json`；验证副本只带 EXE，未带源码或单独 PCK。

## 18. Remaining Visual Differences

Target 背景城市、光照、道路密度、人物画面比例与实际项目不同，本轮没有改地图、模型或相机玩法。现有阶段栏四分区仍不同于 Target 的细横向轨道；友军 HP 保留正式带端帽素材，头像保留当前原件；Logo 使用用户新包，因此形状也未强行改成参考图。小地图为真实地图的简化实时平面图，不是 Target 的静态等角插画。以上不宣称像素级匹配。

## 19. Out-of-Scope Issues

完整构建仍失败于 Camp UI 的关闭详情和悬停能力描述两个断言，与 Phase 2/2.1 记录相同。本轮没有修改营地或绕过原构建门禁；单独导出用于视觉验收。原生退出仍可能报告 4 个 ObjectDB 清理警告。

任务起点记录 696 个资产/玩法文件哈希；检查发现 `assets/world/materials/camp_ground.gdshader` 与 `camp/camp_dressing.gd` 在并行任务中变化，本轮未编辑这两处。其他受保护原文件未变，旧 Expedition PNG 未变。交付包包含导出时完整共享工作区，不能视作只含本轮改动的独立提交。未提交代码，不自动进入下一阶段。
