# Valley MAS Skill Index

本索引用于快速确认当前项目级 skills 的职责边界。新增、删除、合并或迁移 skill 后，应同步更新这里，并避免在 `AGENTS.md` 中重复维护完整清单。

## 使用约定

- 任务开始前，先按场景判断是否需要启用 `.codex/skills/*/SKILL.md` 中的项目 skills。
- 只要本回合启用了任何 skill，就按 `skill-usage-disclosure` 简短说明使用了哪些以及原因。
- 涉及中文、Markdown、skill、配置示例或任何非 ASCII 文本改动时，使用 `encoding-guard` 做前后检查。
- 不要引用已经不存在的 skill；以本索引和实际 `.codex/skills/*/SKILL.md` 为准。

## Skills

| Skill | 触发场景 |
|---|---|
| `skill-usage-disclosure` | 只要本回合启用了任何 skill，就简短说明使用了哪些以及原因。 |
| `encoding-guard` | 修改中文、Markdown、skill、配置示例或任何非 ASCII 文本前后必须使用，防止乱码和文本丢失。 |
| `task-completion-guard` | 多步骤任务、计划后实施、需要验证或容易停在口头承诺的任务。 |
| `component-reuse-guard` | 发现重复 JSX、重复 handler、重复弹窗/表单/上传/列表逻辑时，先复用或抽取。 |
| `conventional-commit-guard` | 生成 commit message、执行 `git commit`，或用户说“提交/提交吧/提交代码/帮我提交”。 |
| `delivery-reporting` | 用户要求分阶段汇报“本次完成、影响范围、已验证、下一步”，或改动需要判断/同步计划文档时。 |
| `gsap-core` | 使用或评审 GSAP 基础动画、tween、stagger、ease、响应式与 reduced-motion 动画时。 |
| `gsap-react` | 在 React/Next.js 中接入 GSAP 动画、`useGSAP`、refs、scope 和组件卸载清理时。 |
| `gsap-timeline` | 需要多个动效步骤按时间轴编排、暂停、反转或复用动画序列时。 |
| `gsap-scrolltrigger` | 需要滚动触发、滚动进度驱动或 pinning 动画时。 |
| `gsap-performance` | 评估 GSAP 动画性能、低端设备体验、合成层、重排和 reduced-motion 风险时。 |
| `gsap-utils` | 使用 `gsap.utils` 做 clamp、mapRange、random、snap、toArray、wrap 等动画辅助计算时。 |
| `gsap-plugins` | 使用 GSAP 插件，例如 Flip、Draggable、ScrollTo、SplitText、MorphSVG、CustomEase 等时。 |
| `gsap-frameworks` | 在 Vue、Svelte、Astro 或非 React 框架中接入 GSAP 动画时。 |
| `worldbox-alignment-guard` | **仅 `apps/world-sim`**：调整玩法、数值、模拟规则、神力、文明、战争、叛乱或可读性 UI 前，先分析并对齐 WorldBox 式机制体验。 |
| `game-doc-sync-guard` | **仅 `apps/world-sim`**：游戏玩法/参数/架构变更时，强制同步设计文档。其他子项目忽略。 |
