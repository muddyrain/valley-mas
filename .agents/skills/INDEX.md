# Valley MAS 技能索引

本索引用于快速确认当前项目级技能的职责边界。新增、删除、合并或迁移技能后，应同步更新这里，并避免在 `AGENTS.md` 中重复维护完整清单。

## 使用约定

- 任务开始前，先按场景判断是否需要启用 `.agents/skills/*/SKILL.md` 中的项目技能。
- 只要本回合启用了任何技能，就按 `skill-usage-disclosure` 简短说明使用了哪些技能以及原因。
- 实际修改 CJK/非 ASCII 用户可见文本、Markdown、技能、配置示例，或进行批量文本改写 / 提交前 diff 含非 ASCII 文本时，使用 `encoding-guard` 做定向检查；只读分析和纯 ASCII 代码改动不启用。
- 不要引用已经不存在的技能；以本索引和实际 `.agents/skills/*/SKILL.md` 为准。
- `.codex/skills`、`.claude/skills`、`.codebase/skills`、`.trae/skills` 仅作为兼容入口，均应软链接到 `.agents/skills`，不要维护多份副本。

## 技能清单

状态说明：

- `日常启用`：满足触发条件时可直接启用。
- `手动触发`：只在用户明确点名、斜杠命令或任务明确要求时启用。
- `范围限定`：只在指定子项目或技术范围内启用。
- `一次性配置`：用于初始化或迁移配置，不作为普通开发默认流程。
- `外部/实验`：来自外部通用能力或设计增强能力，不参与默认路由；启用前必须确认不会覆盖 Valley MAS 现有 `AGENTS.md`、子项目规则和设计系统。

组合规则：

- 强流程优先准确性，但不能无上限叠加技能。
- 每个任务先选 1 个主技能；主技能负责当前任务的主要流程和完成标准。
- 可再选最多 2 个业务辅助技能；只有触发条件明确时才叠加。
- `skill-usage-disclosure` 和 `encoding-guard` 是横切技能，不计入 2 个业务辅助技能上限。
- `task-completion-guard` 只在多步骤、计划后实施、跨文件或需要验证闭环时启用；不要因为"改了文件"本身自动启用。
- `delivery-reporting` 只在用户要求详细汇报，或改动可能影响计划文档、长期文档、功能状态、接口、依赖、数据模型、产品方向或验收标准时启用。
- 维护现有产品 UI 时，子项目 `AGENTS.md`、本地设计系统和既有组件优先级高于外部/实验类设计 skill；外部设计 skill 只在用户明确要求视觉原型、设计方案或 UX 评审时介入。
- 普通 UI 改动的业务技能上限为 3 个：通常以 `web-ui-consistency-guard` 或子项目 UI 规则为主技能；涉及用户可见文案时叠加 `ui-copy-boundary-guard`；发现重复 UI 或处理器时再叠加 `component-reuse-guard`。其余需求优先靠主技能清单收敛，不继续扩散。

| 技能 | 状态 | 触发场景 |
|---|---|---|
| `skill-usage-disclosure` | 日常启用 | 只要本回合启用了任何技能，就简短说明使用了哪些以及原因。 |
| `encoding-guard` | 风险触发 | 实际修改 CJK/非 ASCII 用户可见文本、Markdown、技能、配置示例，或进行批量文本改写 / 提交前 diff 含非 ASCII 文本时启用；优先传入具体文件路径，防止乱码和文本丢失。 |
| `task-completion-guard` | 风险触发 | 任务跨 3 个以上文件、多轮实施、计划文档驱动，或容易把计划误报为完成时启用；普通单轮改动不因"需要验证"自动启用。 |
| `component-reuse-guard` | 日常启用 | 发现重复 JSX、重复处理器、重复弹窗/表单/上传/列表逻辑时，先复用或抽取。 |
| `conventional-commit-guard` | 日常启用 | 生成提交信息、执行 `git commit`，或用户说"提交/提交吧/提交代码/帮我提交"。 |
| `delivery-reporting` | 风险触发 | 用户要求分阶段汇报，或改动会影响计划文档、长期文档、功能状态、接口路径、依赖策略、数据模型、产品方向或验收标准时。 |
| `ui-copy-boundary-guard` | 日常启用 | 修改用户可见 UI 文案、设置说明、按钮、副标题、空状态或总览描述时，防止把开发者分析、实现解释或页面说明写进界面。 |
| `ai-capability-orchestration` | 范围限定 | 涉及 Go 服务端火山 ARK AI 能力、模型环境变量、提示词、多模态输入、响应解析、降级和错误映射时。 |
| `web-ui-consistency-guard` | 范围限定 | Web 页面、共享组件、用户可见文案或页面样式变化时，检查主题 token、品牌色、loading 态、URL query 状态同步和列表刷新一致性。 |
| `worldbox-alignment-guard` | 范围限定 | **仅 `apps/world-sim`**：调整玩法、数值、模拟规则、神力、文明、战争、叛乱或可读性 UI 前，先分析并对齐 WorldBox 式机制体验。 |
| `game-doc-sync-guard` | 范围限定 | **仅 `apps/world-sim`**：游戏玩法/参数/架构变更时，强制同步设计文档。其他子项目忽略。 |
| `gsap-core` | 范围限定 | 使用或评审 GSAP 基础动画、tween、stagger、ease、响应式与 reduced-motion 动画时。 |
| `gsap-react` | 范围限定 | 在 React/Next.js 中接入 GSAP 动画、`useGSAP`、refs、scope 和组件卸载清理时。 |
| `gsap-timeline` | 范围限定 | 需要多个动效步骤按时间轴编排、暂停、反转或复用动画序列时。 |
| `gsap-scrolltrigger` | 范围限定 | 需要滚动触发、滚动进度驱动或 pinning 动画时。 |
| `gsap-performance` | 范围限定 | 评估 GSAP 动画性能、低端设备体验、合成层、重排和 reduced-motion 风险时。 |
| `gsap-utils` | 范围限定 | 使用 `gsap.utils` 做 clamp、mapRange、random、snap、toArray、wrap 等动画辅助计算时。 |
| `gsap-plugins` | 范围限定 | 使用 GSAP 插件，例如 Flip、Draggable、ScrollTo、SplitText、MorphSVG、CustomEase 等时。 |
| `gsap-frameworks` | 范围限定 | 在 Vue、Svelte、Astro 或非 React 框架中接入 GSAP 动画时。 |
| `grill-me` | 手动触发 | 用户主动触发（说出 `Use Skill: grill-me` 或 `/grilling`）时，对当前计划/设计做高强度追问，逼出隐含假设和未覆盖分支。`disable-model-invocation: true`，禁止自动启用。 |
| `grill-with-docs` | 手动触发 | 与 `grill-me` 同源，但在追问过程中同步生成 ADR、术语表等文档产物。`disable-model-invocation: true`，仅用户显式触发。 |
| `setup-matt-pocock-skills` | 一次性配置 | 初始化 Matt Pocock 工程技能依赖的问题追踪、分诊标签和领域文档配置；普通开发不默认启用。 |
| `web-design-engineer` | 外部/实验 | 仅在用户明确要求视觉原型、完整页面设计、dashboard、slide、动效 demo 或 UI mockup 时启用；普通现有页面开发优先使用 `web-ui-consistency-guard`。 |
| `ui-ux-pro-max` | 外部/实验，需用户确认 | 仅在用户明确要求设计建议、风格方案、配色字体或 UX 评审时启用；不因普通 `fix`、`improve`、页面小修自动触发，也不替代项目现有设计系统和实现约束。 |
