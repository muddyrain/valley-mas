# 蓝时归航文档入口

从命中任务的主题进入；当前契约、剩余工作与历史证据分别维护，不需要先读全部文档。

| 任务 | 当前入口 |
|---|---|
| 产品与术语 | [CONTEXT](../CONTEXT.md)、[玩法](design/game-design.md)、[长期方向](design/vision.md) |
| 营地、开局与跨日 | [营地](design/camp.md)、[开局](design/new-run.md)、[跨日及保存](design/day-loop.md) |
| 行动、搜索与输入 | [行动](design/expedition.md)、[搜索与输入](architecture/search-and-input.md) |
| 角色、武器与效果 | [角色](design/characters.md)、[战斗](design/combat.md)、[道具与技能](design/items-and-skills.md)、[效果契约](design/effects.md) |
| UI、资源与结构 | [UI 方向](design/ui-art-direction.md)、[资源身份](architecture/resource-binding.md)、[项目结构](architecture/project-structure.md)、[资源系统](architecture/asset-system.md) |
| 状态、优先级与验证 | [当前计划](PLAN.md)、[已知问题](development/known-issues.md)、[验证入口](VALIDATION.md) |
| 参考与决策 | [Deadly Days 参考](reference/deadly-days-reference.md)、[ADR](adr/) |
| 历史追溯 | [归档说明和路径映射](archive/2026-10/README.md) |

## 更新方式

- 产品用语更新 CONTEXT；功能规则更新对应 design；实现契约更新 architecture；决策理由按需要记录 ADR。
- 当前计划只记录待办、完成条件和证据缺口；完成记录进入归档，不继续追加执行流水。
- 普通任务在交付回复中报告；截图、日志、临时审计与构建进入 `test-output/` 或仓库 `.tmp/`，不进入正式文档。
- 历史报告完整保留，引用已重定位；旧失败需复现，旧通过不能作为当前源码验证。资产审计 JSON 与 baseline 仅作历史证据，不替代当前代码、Resource 和测试。
- `PROJECT_CONTEXT.md` 与公共 Locomotion 报告旧路径仅为兼容入口；新增规则写入上述主题。
