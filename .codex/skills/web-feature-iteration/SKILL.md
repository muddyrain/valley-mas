---
name: web-feature-iteration
description: 在 Valley MAS Web 端管理持续迭代型功能任务。适用于盘点 Web 还能加什么、确定下一批版本任务、开始做其中一项、删除已完成旧任务并继续推进下一项的场景。
---

# Web 功能迭代
这个 skill 关注的是 Web 端功能如何持续往前推，而不是只列一份越堆越长的待办清单。目标是让活跃任务始终保持短、小、可执行：做完一项就把它移出活跃 backlog，再把下一项顶上来。

## 适用场景

- 用户想盘点当前 Web 还能叠加哪些功能
- 用户让你按建议开始做下一项
- 用户说“继续”“接着做”“下一步做什么”
- 某个旧任务已经失去优先级，需要从当前活跃计划里删掉
- 一批推荐方向里，需要挑出最值得先做的 1 到 3 项

## 核心规则

1. 活跃 backlog 只保留少量真正要做的任务，优先控制在 3 到 5 项。
2. 任务完成后，不要继续把它留在“当前计划”里；要明确移出，并补上新的下一项。
3. 新任务优先从现有能力延长，而不是平地再起一条完全独立的功能线。
4. 判断优先级时，优先看：
   - 是否能把已有接口、页面、导航入口串成完整闭环
   - 是否直接提升留存、分发、创作者经营感或内容消费效率
   - 是否和当前 Web 信息架构自然贴合
5. 如果用户临时换了方向，就更新活跃 backlog，不要死守旧计划。
6. 任何实际开做的 Web 页面或组件，都要同步考虑主题一致性与中文产品文案质量。

## 推荐工作顺序

1. 先盘点现有 Web 里已经有一半能力、但还没闭环的地方。
2. 给出短版任务列表，并明确“现在就做哪一项”。
3. 用户确认后直接落地，不停留在只写建议。
4. 做完后刷新当前活跃 backlog：
   - 删除已完成项
   - 标记新的下一项
   - 如有必要补充新发现的高价值任务

## 和其他 skill 的协作

- 涉及 Web 页面、共享组件、Banner、空状态、卡片、按钮时，联动 [$web-theme-consistency](/D:/my-code/valley-mas/.codex/skills/web-theme-consistency/SKILL.md)。
- 涉及用户可见中文文案时，联动 [$product-copy-cn](/D:/my-code/valley-mas/.codex/skills/product-copy-cn/SKILL.md)。
- 涉及产品行为边界、资源/创作者/博客链路时，联动 [$valley-mas-product-guard](/D:/my-code/valley-mas/.codex/skills/valley-mas-product-guard/SKILL.md)。
- 当新的迭代方式已经稳定下来，或已有 skill 的描述已经过期时，联动 [$skill-sync-guard](/D:/my-code/valley-mas/.codex/skills/skill-sync-guard/SKILL.md)。

## 当前仓库里的优先切入点

- 顶部导航里已经出现局部能力，但还没有独立页面闭环的模块
- 个人中心与创作者空间附近可以继续增强留存的能力
- 搜索、通知、合集、推荐、数据看板这类能够串起现有内容资源的功能
- 已有后端接口但 Web 端尚未交付页面或交互的地方

## 输出要求

当使用这个 skill 时，最终说明里应明确写出：

- 当前活跃 backlog 现在剩哪些项
- 这次完成的任务是否已经从活跃 backlog 移除
- 下一项建议接什么
- 本次实际联动了哪些 Web 相关 guard skill

## 校验

1. 如果这次真的开始做 Web 功能，运行对应前端类型检查，例如 `pnpm --filter web exec tsc --noEmit`
2. 如果编辑了中文页面或 skill，联动 [$encoding-guard](/D:/my-code/valley-mas/.codex/skills/encoding-guard/SKILL.md)
3. 如果新建或更新了 skill，至少检查一次 `SKILL.md` 和 `agents/openai.yaml` 是否一致
