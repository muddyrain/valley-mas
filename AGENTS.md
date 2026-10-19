# Valley MAS — Codex 仓库入口

本文件使用普通 Markdown，负责指引 Codex 读取共享规则及目标子项目约束。

## 必须读取的规则

1. 开始仓库任务前，完整读取并遵守根 [CLAUDE.md](./CLAUDE.md)。它是 Codex 与 Claude 共用的 Monorepo 规则正文，包含 Skills 路由、工作区保护、GitNexus、验证与交付要求；链接本身不等于已读取正文。
2. 按任务范围读取目标子项目的局部 `AGENTS.md`，并检查目标路径上更深层的 `AGENTS.override.md` / `AGENTS.md`。同层优先使用 override，局部约束补充共享规则；用户本次明确要求优先于仓库的一般规定。
3. 涉及 **Blue Hour / 蓝时归航 / `apps/blue-hour/`** 的任务，在分析或修改前必须读取 [apps/blue-hour/AGENTS.md](./apps/blue-hour/AGENTS.md)，再按其中入口读取项目上下文。即使 Codex 从 Monorepo 根目录启动，也必须执行这一步，不能假定子目录规则已自动加载。

Blue Hour 读取链：`AGENTS.md` → `CLAUDE.md` → `apps/blue-hour/AGENTS.md` → `apps/blue-hour/PROJECT_CONTEXT.md`。其他子项目的入口按共享规则选择。

## Monorepo 边界

- 保留已有工作成果，只修改本次授权范围；不自动暂存、提交、切换分支、重置或清理。
- 将计划与历史报告作为上下文，按当前代码和实际验证判断实现状态；未经本次授权不继续历史任务。
- 验证按实际变更选择，交付时分别说明已验证、未验证和遗留问题。完整规则与命令以共享正文及局部入口为准。
