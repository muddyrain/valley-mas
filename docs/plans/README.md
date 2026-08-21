# Plans 指南与索引

**治理规则：**
- 根目录 `docs/plans/*.md` 表示当前活跃计划。
- 历史完成计划必须移入 `docs/plans/archive/YYYY/`，在开头标注已完成状态。
- 新增计划如不再作为当前里程碑，务必在完成验收后归档，而非持续保留在根目录。
- 变更计划集合后提交前执行：`pnpm check:plans-index`（Lefthook 提交钩子与 CI 均会自动检查）。

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

- [2026-08-20-yuji-dom-webgl-public-stage.md](2026-08-20-yuji-dom-webgl-public-stage.md)：以圆角倒角 GLB `yuji` 字标、真实进度加载门、动态光场、原创信号贴纸、DOM / WebGL 文章索引、点阵路由转场和安静阅读层重构雨迹公共站；第六轮完成全画布流体纠偏，第七轮完成首屏排版与贴纸交互，第八轮将 WebGL 信号物收敛为冰青—淡紫连续曲面玻璃光体，并通过本地 Chrome 桌面 / 移动首轮验收，待 Safari / iOS 与 owner 最终观感验收。
- [2026-08-15-yuji-liquid-rain-brand-homepage.md](2026-08-15-yuji-liquid-rain-brand-homepage.md)：液态雨膜历史实现已被 ADR 0017 的 DOM 主导 WebGL 公共站方向取代；待新舞台完成 owner 最终验收后归档。
- [2026-08-15-eon-vale-core-rearchitecture.md](2026-08-15-eon-vale-core-rearchitecture.md)：Eon Vale 单运行时核心重构、保护/删除清单、固定 Tick、Worker/存档边界与四重退出门禁。
- [2026-08-15-yuji-gallery-import-workspace.md](2026-08-15-yuji-gallery-import-workspace.md)：公共图库追加稳定列分配、可恢复的本地未导入工作区、单次视觉元数据识别与创作室完整图片库。
- [2026-08-14-yuji-public-experience-polish.md](2026-08-14-yuji-public-experience-polish.md)：雨迹作者文章库、公共内容状态机、响应式瀑布图库与单图共享过渡的二次打磨。
- [2026-08-04-workflow-collaboration-agent.md](2026-08-04-workflow-collaboration-agent.md)：工作流固定协作智能体、单时间线、后台直接修改、冲突合并与持久撤销。
- [2026-07-28-auth-security-hardening.md](2026-07-28-auth-security-hardening.md)：会话失效、持久化验证码、频率限制与密码哈希升级。
- [2026-07-28-standard-agent-skills.md](2026-07-28-standard-agent-skills.md)：标准技能包导入、分类与智能体/工作流复用。
- [2026-07-26-workflow-node-catalog.md](2026-07-26-workflow-node-catalog.md)：服务端驱动的节点目录、Valley 内容/图片/知识节点扩展与后续通用节点对齐。
- [2026-07-23-ai-image-studio.md](2026-07-23-ai-image-studio.md)：AI 图片对话页、任务历史与资源保存；`/workbench/canvas` 已移除，旧数据与接口仅保留兼容。
- [2026-07-22-ai-knowledge-pdf-multimodal.md](2026-07-22-ai-knowledge-pdf-multimodal.md)：知识库 PDF 的页面渲染、视觉解析、表格与图片摄取。
- [2026-07-22-ai-workflow-p14-production-runtime.md](2026-07-22-ai-workflow-p14-production-runtime.md)：P14.1 工作流异步运行、定时触发与持久化调度底座。
- [2026-07-21-blog-excerpt-model-catalog.md](2026-07-21-blog-excerpt-model-catalog.md)：博客编辑器摘要生成接入模型目录。
- [2026-07-21-interactive-ai-model-catalog-migration.md](2026-07-21-interactive-ai-model-catalog-migration.md)：交互式 AI 功能迁移到模型目录。

## 已归档（2026-08）

- [archive/2026-08/2026-08-02-ai-agent-operations-files.md](archive/2026-08/2026-08-02-ai-agent-operations-files.md)：智能体后台任务、工具人工确认、知识检索引用和成果文件（功能已随智能体应用移除）。
- [archive/2026-08/2026-08-08-ai-motion-stickers.md](archive/2026-08/2026-08-08-ai-motion-stickers.md)：参考图驱动的 owner 私有动态表情、AMUX 视频任务、MP4/GIF 双资产与共享工具契约（功能已移除）。
- [archive/2026-08/2026-08-08-creator-agent-tool-cards.md](archive/2026-08/2026-08-08-creator-agent-tool-cards.md)：智能体澄清、工具进度、图片/文件转换卡片、临时产物与写操作确认（功能已随智能体应用移除）。

## 已归档（2026-06）

- [archive/2026-06/2026-06-26-life-trace-calendar-selection.md](archive/2026-06/2026-06-26-life-trace-calendar-selection.md)
- [archive/2026-06/2026-06-30-pantry-drawer-ai-augment.md](archive/2026-06/2026-06-30-pantry-drawer-ai-augment.md)
- [archive/2026-06/2026-06-30-pantry-shelf-life-validation.md](archive/2026-06/2026-06-30-pantry-shelf-life-validation.md)
- [archive/2026-06/2026-06-30-server-ai-foundation-refactor.md](archive/2026-06/2026-06-30-server-ai-foundation-refactor.md)

## 已归档（2026-07）

- [archive/2026-07/2026-07-24-workflow-http-node.md](archive/2026-07/2026-07-24-workflow-http-node.md)：工作流 HTTP 请求节点的受控配置、执行与画布交互。
- [archive/2026-07/2026-07-26-ai-image-version-lineage.md](archive/2026-07/2026-07-26-ai-image-version-lineage.md)
- [archive/2026-07/2026-07-26-ai-image-history-management.md](archive/2026-07/2026-07-26-ai-image-history-management.md)
- [archive/2026-07/2026-07-26-ai-image-variations.md](archive/2026-07/2026-07-26-ai-image-variations.md)
- [archive/2026-07/2026-07-23-workflow-loop-node.md](archive/2026-07/2026-07-23-workflow-loop-node.md)
- [archive/2026-07/2026-07-26-ai-image-generation-reliability.md](archive/2026-07/2026-07-26-ai-image-generation-reliability.md)
- [archive/2026-07/2026-07-11-ai-workflow-automation.md](archive/2026-07/2026-07-11-ai-workflow-automation.md)
- [archive/2026-07/2026-07-14-ai-app-editor-recovery.md](archive/2026-07/2026-07-14-ai-app-editor-recovery.md)
- [archive/2026-07/2026-07-02-server-ai-agent-runtime.md](archive/2026-07/2026-07-02-server-ai-agent-runtime.md)
- [archive/2026-07/2026-07-02-remove-resource-tag-table.md](archive/2026-07/2026-07-02-remove-resource-tag-table.md)
- [archive/2026-07/2026-07-14-ai-knowledge-pdf-ingestion.md](archive/2026-07/2026-07-14-ai-knowledge-pdf-ingestion.md)
- [archive/2026-07/2026-07-16-workflow-editor-ergonomics.md](archive/2026-07/2026-07-16-workflow-editor-ergonomics.md)
- [archive/2026-07/2026-07-14-ai-workbench-platform.md](archive/2026-07/2026-07-14-ai-workbench-platform.md)
- [archive/2026-07/2026-07-15-ai-app-public-api-p5.md](archive/2026-07/2026-07-15-ai-app-public-api-p5.md)
- [archive/2026-07/2026-07-17-ai-contextual-copilot-implementation.md](archive/2026-07/2026-07-17-ai-contextual-copilot-implementation.md)
- [archive/2026-07/2026-07-19-p13-knowledge-base-2.md](archive/2026-07/2026-07-19-p13-knowledge-base-2.md)
- [archive/2026-07/2026-07-19-p13-prompt-resources.md](archive/2026-07/2026-07-19-p13-prompt-resources.md)
- [archive/2026-07/2026-07-10-life-trace-pantry-mobile-browsing.md](archive/2026-07/2026-07-10-life-trace-pantry-mobile-browsing.md)
- [archive/2026-07/2026-07-18-ai-workbench-next-roadmap.md](archive/2026-07/2026-07-18-ai-workbench-next-roadmap.md)
- [archive/2026-07/2026-07-20-p13-switch-node.md](archive/2026-07/2026-07-20-p13-switch-node.md)
