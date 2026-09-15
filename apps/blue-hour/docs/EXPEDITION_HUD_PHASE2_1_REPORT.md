# Expedition HUD Phase 2.1 Visual Polish Report

## 1. Summary

完成 Expedition HUD 的局部视觉精修；不新增或替换 PNG，不改 Gameplay。

## 2. Scope

仅调整尺寸、间距、留白、对齐、按钮内容区和 marker 显示尺寸。

## 3. Top HUD Adjustments

资源图标由 20px 提至 24px，数字列略加宽；菜单图标与文字增加间距。

## 4. Survivor Card Adjustments

HP 条提高至 30px；武器/状态行增加间距；编号角标向内收 2px，避免压住头像。

## 5. Action Bar Adjustments

停止、集火、定位、狂怒采用差异化 optical icon 尺寸；文字和快捷键 badge 重新留出呼吸空间。

## 6. Discovery Panel Adjustments

列表行高提升至 50px，时间列预留固定右侧空间；标题与箭头增加间距。

## 7. World Interaction Adjustments

搜索卡信息区下移，进度条提高到 12px，取消按钮提高到 36px；卡片展开高度同步为 184px。

## 8. Minimap Adjustments

巴士 marker 缩至 24px；普通 POI marker 缩至 19px，选中/搜索状态保留 22px。

## 9. Return Bus Adjustments

保留三态与 E 键行为，调整图标、标题和 badge 的内部留白。

## 10. Mouse / Layer Safety Check

原生专项新增血条边界、行间隔和取消按钮高度检查；装饰节点仍为 `MOUSE_FILTER_IGNORE`。

## 11. Screenshots

截图位于 [expedition_hud_phase2_1](../test-output/expedition_hud_phase2_1)。原生专项输出 1080p、1440p、行动栏、发现列表、世界交互、小地图和返回巴士三态截图。

## 12. Known Issues

Phase 2.1 原生专项 **248 checks, 0 failures**。ObjectDB 清理警告仍为引擎退出时提示，不计为脚本失败。完整仓库 build 仍受两个既有 Camp UI 断言影响。

## 13. Out-of-Scope Issues

未修改营地、AI、伤害、掉落、时间、任务、导航、模型或动画；既有 `PLAN.md` 历史失效链接仍待单独文档清理。
