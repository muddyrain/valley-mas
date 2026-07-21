# Plans 指南与索引

**治理规则：**
- 根目录 `docs/plans/*.md` 表示当前活跃计划。
- 历史完成计划必须移入 `docs/plans/archive/YYYY/`，在开头标注已完成状态。
- 新增计划如不再作为当前里程碑，务必在完成验收后归档，而非持续保留在根目录。
- 变更计划集合后建议执行：`pnpm check:plans-index`（CI 已在 `quality.yml` 挂钩）。

## 长期可持续治理规则

- 周期：每月固定一次归档回顾，原则上不留“历史验收完成但仍在根目录”的计划。
- 入库边界：`docs/plans/*.md` 只保留当前激活、可复用、或未完成的计划。
- 归档触发：
  1. 任务验收完成（包括手工验收/浏览器验收）；
  2. 风险与排期同步完成；
  3. 该计划不再作为当期协作入口。
- 执行动作（统一）
  1) 在计划正文顶部标注状态（如：`> [!DONE] 已验收完成并归档`）；
  2) 移动到 `docs/plans/archive/YYYY-MM/`（按完成月份命名）；
  3) 在 `docs/plans/README.md` 的当前清单中移除、在归档清单中补充；
  4) 检查引用来源文档，改为指向归档文件。
- 风险控制：若未来某个计划需要作为“后续参考”继续打开，不要移出归档；改为在对应路标文档新增“回看索引”。

## 当前活跃计划

- [2026-06-22-desktop-os-plush-control-migration.md](2026-06-22-desktop-os-plush-control-migration.md)
- [2026-06-23-desktop-os-motion-migration.md](2026-06-23-desktop-os-motion-migration.md)
- [2026-06-26-life-trace-calendar-selection.md](2026-06-26-life-trace-calendar-selection.md)
- [2026-06-30-pantry-drawer-ai-augment.md](2026-06-30-pantry-drawer-ai-augment.md)
- [2026-06-30-pantry-shelf-life-validation.md](2026-06-30-pantry-shelf-life-validation.md)
- [2026-06-30-server-ai-foundation-refactor.md](2026-06-30-server-ai-foundation-refactor.md)
- [2026-07-02-server-ai-agent-runtime.md](2026-07-02-server-ai-agent-runtime.md)
- [2026-07-10-life-trace-pantry-mobile-browsing.md](2026-07-10-life-trace-pantry-mobile-browsing.md)
- [2026-07-18-ai-workbench-next-roadmap.md](2026-07-18-ai-workbench-next-roadmap.md)

## 已归档（2026-07）

- [archive/2026-07/2026-07-11-ai-workflow-automation.md](archive/2026-07/2026-07-11-ai-workflow-automation.md)
- [archive/2026-07/2026-07-14-ai-app-editor-recovery.md](archive/2026-07/2026-07-14-ai-app-editor-recovery.md)
- [archive/2026-07/2026-07-14-ai-knowledge-pdf-ingestion.md](archive/2026-07/2026-07-14-ai-knowledge-pdf-ingestion.md)
- [archive/2026-07/2026-07-16-workflow-editor-ergonomics.md](archive/2026-07/2026-07-16-workflow-editor-ergonomics.md)
- [archive/2026-07/2026-07-14-ai-workbench-platform.md](archive/2026-07/2026-07-14-ai-workbench-platform.md)
- [archive/2026-07/2026-07-15-ai-app-public-api-p5.md](archive/2026-07/2026-07-15-ai-app-public-api-p5.md)
- [archive/2026-07/2026-07-17-ai-contextual-copilot-implementation.md](archive/2026-07/2026-07-17-ai-contextual-copilot-implementation.md)
- [archive/2026-07/2026-07-19-p13-knowledge-base-2.md](archive/2026-07/2026-07-19-p13-knowledge-base-2.md)
- [archive/2026-07/2026-07-19-p13-prompt-resources.md](archive/2026-07/2026-07-19-p13-prompt-resources.md)
- [archive/2026-07/2026-07-20-p13-switch-node.md](archive/2026-07/2026-07-20-p13-switch-node.md)
