# CAMP HUD 2.0 Final Fidelity Pass

## 素材接入

第四批 D V2 PNG 已导入 `assets/ui/camp_hud_2_0/runtime/final_d/`，通过 `camp_asset_manifest.gd` 的 220–229 资源 ID 使用。

- 220：顶部 CAMP Header 背景
- 221：作战装备主底板
- 222：装备槽统一空槽底板
- 223：装备与技能锁图标
- 224：技能标签底条（资源已接入清单，技能图标仍由既有逻辑提供）
- 225：左下 Esc 按键提示
- 226：Roster 面板背景
- 227/228/229：Roster 普通、Hover、Selected 三态

## HUD 改动

- 顶部主栏和营地信息面板切换到 D V2 Header 素材；CAMP 仍使用动态 Day 数据。
- 作战装备切换到 D V2 主底板和统一空槽，移除 `READY / 整备完成` 展示。
- 锁图标统一改为 D V2 独立锁纹理并使用居中 TextureRect。
- 左下返回入口改为 D V2 Esc keycap + 动态“返回主菜单”文字。
- Roster 背景改为 D V2 Panel；列表继续由动态 `ScrollContainer + VBoxContainer` 生成，数量不写死。
- Roster 普通、Hover、Selected 使用 D V2 三态资源；Detail / Roster / World Ring 的既有同步逻辑保持不变。

## 验证状态

- Godot 编辑器扫描能读取新增 PNG 与脚本资源。
- `camp_hud_2.gd` 当前无法完成运行回归，因为工作区已有未提交的 `missions/mission.gd` 解析错误；该错误不来自本轮文件。
- Camera、Environment、Ambient、Departure、Expedition HUD、角色动画和玩法数值未修改。

## 未完成项

正式截图需在工作区既有 `mission.gd` 解析错误修复后重新运行 Camp HUD 测试生成。
