# 计划索引

`docs/plans/` 用于存放仍在执行、需要跨模块协作的临时实施计划；各子项目保留已有状态文件，由局部入口指定，不统一重命名。

## 当前活跃计划

- 暂无。

## 已归档

- [技能与开发流程精简](archive/2026-10/skill-simplification.md)
- [协作规则与文档收敛](archive/2026-10/agent-docs-simplification.md)

## 维护规则

- 新增活跃计划时，将 Markdown 文件置于本目录，并在“当前活跃计划”中添加相对链接。
- 完成后，将计划移动至 `archive/YYYY-MM/`，在正文标注完成状态，并将链接移至对应“已归档”章节。
- 计划集合发生变化后运行 `pnpm check:plans-index`。

## 子项目状态入口

| 项目 | 当前入口 |
|---|---|
| Web | [产品规格](../../apps/web/docs/YUJI_PRODUCT_SPEC.md) |
| Life Trace | [计划](../../apps/life-trace/docs/PLAN.md) |
| Ambient Forge | [计划](../../apps/ambient-forge/docs/PLAN.md) |
| Aeon Vale | [计划](../../apps/aeon-vale/docs/PLAN.md) |
| Blue Hour | [当前计划](../../apps/blue-hour/docs/PLAN.md) |
| Scratch Legend | [任务](../../apps/scratch-legend/docs/scratch-legend-task.md) |
| Toy Climb Arena | [任务职责](../../apps/toy-climb-arena/docs/TASK_DOCS_INDEX.md) |
| World Sim | [设计与阶段记录](../../apps/world-sim/docs/TDD.md) |

普通修复无需新增计划；已完成检查点归档，未完成项保持证据状态，不因归档自动变为完成。
