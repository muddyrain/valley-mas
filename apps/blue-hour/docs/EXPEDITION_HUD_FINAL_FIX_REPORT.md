# Expedition HUD Final Fix Report

## 1. Summary

完成 Final Fix 八项小范围视觉修正，未新增或修改 PNG、未修改 Gameplay；当前可进入 HUD 冻结验收。

## 2. Scope

仅调整 Logo、时间组合、HP 显示、编号角标、Discovery、Action Cards、Return Bus 的显示层参数；Minimap 只做稳定性检查。

## 3. Logo Fix

Current → 新 Logo 偏大 → 显示盒缩至 264×99、alpha 0.94。Final：保持宽高比，左上安全区不变，未遮挡队伍。

## 4. Top Time HUD Fix

Current → 两张横向卡仍有接缝 → TopTimeRoot 间距降至 1px、同排同高 64px。Final：阶段与日期时间形成连续组合，仍读取真实时钟。

## 5. Survivor HUD Fix

Current → HP 槽厚重 → 仅在 HealthBar 外层缩放为 1.18×0.35、透明度 0.72，保留原比例裁切与数值；编号向内 3px、字号 13。Final：HP 更细更长，卡片数据和血量逻辑未变。

## 6. Discovery Fix

Current → 右侧列表偏紧 → 面板 308px 宽、行高 56px、列表间距 6px、内容边距增大。Final：真实地点、数量和秒数动态显示。

## 7. Action Bar Fix

Current → 独立卡偏小 → 四卡宽 132px、组整体上移 16px、间距 14px，托盘保持空白；X/F/L/1 badge 缩短与卡底距离。Final：四张米白卡独立悬浮，命令和状态不变。

## 8. Return Bus Fix

Current → 按钮略长、图标偏重 → 宽度 262px、整体 scale 0.94、图标上限 50px，E 仍在按钮下方居中。Final：短厚比例更接近 Target，三态与点击逻辑保留。

## 9. Minimap Stability

使用新 Frame overlay，地图、道路、街区、marker 和动态地区名继续由运行时绘制；未扩展 Dynamic Minimap V2。

## 10. 1080p / 1440p

原生专项覆盖 1920×1080 与 2560×1440，面板边界、按钮键位、时间同排、Logo/队伍不重叠均通过。

## 11. Regression Tests

Final Fix 原生专项 **257 checks, 0 failures**；新 EXE 菜单／营地／外出独立启动 **6/6**；Windows Release 直接导出通过。完整 build 仍有既有 Camp UI 86 checks / 2 failures。

## 12. Screenshots

[Final Fix 截图目录](../test-output/expedition_hud_final_fix)；包含 1080p、1440p、顶部、队伍、Action、Discovery、Return Bus、Minimap 和 Before。

## 13. Remaining Differences

Target 的城市背景、光照、道路密度与当前地图不同；不属于 HUD 显示层，本轮未修改。动态小地图是实际地图的简化平面图，不是静态 Target 插画。

## 14. Out-of-Scope Issues

Camp UI 两项既有断言失败仍单独记录；未修改 Camp、AI、Combat、Search、Mission、导航、模型或动画。

## 15. Freeze Recommendation

`Expedition HUD Final Fix completed — ready for user freeze approval.`

代码未自动提交，等待最终视觉验收。
