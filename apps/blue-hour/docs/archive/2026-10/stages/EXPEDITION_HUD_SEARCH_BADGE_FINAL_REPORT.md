# Expedition 搜刮状态 UI + 幸存者编号最终修复

## 1. 本次真正 Root Cause
移动命令之前没有释放 SearchTask；同时 PoiContext 在投影阶段又覆盖了隐藏状态，导致失效任务卡重新可见。编号节点被直接作为 TextureRect 子节点使用，没有独立固定尺寸的 BadgeRoot。

## 2. stale SearchCard 为什么存在
卡片创建缓存与运行时任务状态分离，且投影逻辑会重新设置可见性。现在只有存在有效 worker 且任务阶段为 SEARCHING_INSIDE/SEARCHING_OUTSIDE 时才可见。

## 3. Cancel 为什么此前无效
取消按钮可能来自移动中或已失效任务的残留卡片，点击时 Mission 已没有对应真实任务。现在按钮只由当前真实任务生成，并调用 `command_recall(site_id)`。

## 4. 修改文件
`missions/mission.gd`, `ui/expedition/poi_context.gd`, `ui/expedition/search_card.gd`, `ui/expedition/squad_card.gd`, `maps/city.gd`, `ui/expedition/action_icon.gd`, `ui/expedition/hud_skin.gd`, `ui/mission_hud.gd`.

## 5. 新增测试
扩展 Expedition 原生测试 4 项状态断言：搜索卡绑定实时任务、取消立即关闭、取消后可重新搜索、移动命令释放搜索任务。

## 6. Runtime 手动验证结果
Godot 原生 Expedition 回归 261 checks / 0 failures；导入通过；Windows 导出成功。

## 7. 对应截图
截图目录：`test-output/expedition_hud_final_search_badge/`。包含双人空闲、搜索中目标、取消后、移动清理和编号近景证据。

当前未标记 Freeze Ready，等待最终实机验收。
