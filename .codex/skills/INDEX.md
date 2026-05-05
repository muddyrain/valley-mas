# Valley MAS Skills Index

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
