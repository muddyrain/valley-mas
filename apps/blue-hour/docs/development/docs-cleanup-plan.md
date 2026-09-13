# Docs Governance 2.0 Cleanup Plan

本计划按内容用途分类；删除前检查未迁移 TODO、独有参数、当前代码约束、文档链接和自动化依赖。当前工作区已有大量未提交改动，所有删除仅限高置信的阶段执行记录。

## CANONICAL

长期事实来源：

- `docs/architecture/project-structure.md`
- `docs/architecture/asset-system.md`
- `docs/architecture/asset-naming.md`
- `docs/architecture/asset-manifest.md`
- `docs/design/game-design.md`
- `docs/design/camp.md`
- `docs/design/expedition.md`
- `docs/design/characters.md`
- `docs/design/enemies.md`
- `docs/design/combat.md`
- `docs/design/items-and-skills.md`
- `docs/design/ui-art-direction.md`
- `docs/reference/deadly-days-reference.md`
- `docs/development/roadmap.md`
- `docs/development/known-issues.md`
- `docs/adr/*.md`

## DISTILL_AND_DELETE

- `design/game-design.md` → `design/game-design.md`
- `design/items-and-skills.md` → `design/items-and-skills.md`
- `design/enemies.md` → `design/enemies.md`
- `design/game-design.md` → `design/game-design.md`
- `design/expedition.md` → `design/expedition.md`
- `design/combat.md` → `design/combat.md`
- `reference/deadly-days-reference.md`、`reference/deadly-days-reference.md` → `reference/deadly-days-reference.md`
- `design/camp.md`、`design/camp.md` → `design/camp.md`
- `design/combat.md`、`design/combat.md` → `design/combat.md`

## DELETE

高置信一次性执行报告：

- 所有 `*_REPORT.md`
- 所有 `*_IMPLEMENTATION_REPORT.md`
- 所有 `*_DELIVERY_REPORT.md`
- 所有 `*_FIX_REPORT.md`
- 所有 `*_REBUILD_REPORT.md`
- 所有 `*_POLISH_REPORT.md`
- 所有 `*_PHASE_*.md`
- 所有 `*_REVIEW.md`
- `architecture/asset-system.md`
- `architecture/asset-naming.md`

已执行：确认当前代码、Scene、Resource 与测试已有对应事实后，删除 54 份高置信一次性执行报告；其余未确认文件未删除。

## KEEP_REFERENCE

- `gameplay-audit.md`：保留为当前玩法审计参考。
- `VALIDATION.md`：保留为验证矩阵和历史证据入口。
- `PLAN.md`：保留为当前计划真源。
- `design/expedition.md`、`design/expedition.md`：保留地图资源参考。
- `design/combat.md`：保留当前武器视觉约束参考。

## UNKNOWN

- `design/camp.md`
- `CAMP_STORAGE_PALLET_CORRECTION.md`
- `design/camp.md`

这些文件仍需结合当前场景与代码确认是否含独有约束，再决定提炼或删除。

## 执行结果

- 治理前 Markdown：72
- 当前 Markdown：32
- 删除：54
- 提炼：13 个长期主题合并到 `design/` 与 `reference/`
- 保留：Canonical、ADR、玩法审计、验证矩阵、计划与地图/武器参考
- 未处理：当前工作区中新出现的阶段文件与未知报告

## 临时治理产物

以下文件在整个 Project Structure Governance 完成前暂保留，完成后再审阅：

- `development/project-structure-audit.md`
- `development/project-structure-governance-report.md`
- `development/runtime-baseline.md`
- `development/asset-audit.json`
- `development/audit-summary.json`
- `development/baseline/*`

普通 Codex 执行结果不再写入 `docs/`；临时报告统一写入仓库根 `.tmp/reports/`。
