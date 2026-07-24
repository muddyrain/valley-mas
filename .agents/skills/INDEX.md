# Valley MAS 技能索引

本索引是项目级 skill 分类、触发条件和组合上限的唯一真源。新增、删除、迁移 skill 后必须更新本文件，并运行 `pnpm check:harness`。

## 使用约定

- 每个任务按需选择 0 或 1 个主 skill；没有明确触发条件时不强行套用 skill。只有触发条件明确时再叠加最多 2 个业务辅助 skill。
- `encoding-guard` 是文本风险检查，不计入业务辅助 skill 上限。
- 使用任何 skill 时，在开始阶段简短说明名称和原因；这是一条输出约定，不需要再递归启用 `skill-usage-disclosure`。
- `task-completion-guard` 只用于跨 3 个以上文件、多轮实施、计划驱动或完成状态容易误报的实施任务；只读分析和普通问答不触发。
- `delivery-reporting` 只用于用户要求阶段汇报，或长期文档、功能状态、接口、依赖、数据模型、产品方向、验收标准可能变化的任务。
- CJK/非 ASCII 文本、Markdown、skill、配置示例或批量文本改写使用 `encoding-guard` 做定向检查。
- 外部参考 skill 不参与默认路由，不能覆盖根 `AGENTS.md`、子项目规则和现有设计系统。
- `.codex/skills`、`.claude/skills`、`.codebase/skills`、`.trae/skills` 只作为兼容软链接，不维护副本。

## 项目必需

这些 skills 表达 Valley MAS 特有的工程边界或稳定协作契约，命中触发条件时直接使用。

| 技能 | 状态 | 触发场景 |
|---|---|---|
| `encoding-guard` | 风险触发 | 修改非 ASCII 用户文本、Markdown、skill、配置示例或批量文本时检查乱码和文本丢失 |
| `task-completion-guard` | 风险触发 | 跨 3 个以上文件、多轮实施、计划驱动或完成状态容易误报的实施任务；不含只读分析 |
| `conventional-commit-guard` | 日常启用 | 生成提交信息或用户明确要求执行 `git commit` |
| `delivery-reporting` | 风险触发 | 分阶段汇报，或长期状态、接口、依赖、数据模型、产品方向、验收标准变化 |
| `documentation-freshness-audit` | 范围限定 | 用户明确要求文档巡检、README 是否过时、文档与代码对齐，或重构后核对文档事实 |
| `ui-copy-boundary-guard` | 日常启用 | 修改用户可见标题、按钮、说明、空状态、副标题或设置文案 |
| `web-performance-review` | 范围限定 | 用户明确要求性能 review、检查性能、评估性能回归或审查 Web diff 性能风险 |
| `web-ui-consistency-guard` | 范围限定 | Web 页面主题、loading、列表、URL query、刷新和回退行为变化 |

## 项目可选

这些 skills 保留兼容入口，但不参与普通任务的默认流程。

| 技能 | 状态 | 触发场景 |
|---|---|---|
| `setup-matt-pocock-skills` | 一次性配置 | 初始化外部工程 skills 所需的问题追踪、标签和领域文档配置 |
| `skill-usage-disclosure` | 兼容保留 | 旧会话显式点名时可读取；新流程直接遵守根输出约定，不主动启用 |

## 外部参考

这些 skills 来自通用方法或外部设计/动画能力。只在用户明确点名或任务明确需要时使用，后续可迁到个人或插件层；本轮不删除以避免破坏已有入口。

| 技能 | 状态 | 触发场景 |
|---|---|---|
| `grill-me` | 手动触发 | 用户明确要求 `/grilling` 或高强度追问计划 |
| `grill-with-docs` | 手动触发 | 用户明确要求追问并同步 ADR、术语表等文档 |
| `improve-codebase-architecture` | 外部参考 | 用户明确要求架构深度审查时使用；依赖 `CONTEXT.md`、`docs/adr/` 与外部架构辅助能力，缺失时不自动启用 |
| `gsap-core` | 外部参考 | GSAP tween、ease、stagger、matchMedia 和 reduced-motion |
| `gsap-react` | 外部参考 | React/Next.js 中的 `useGSAP`、refs、scope 和清理 |
| `gsap-timeline` | 外部参考 | 多步骤动画时间轴、嵌套、暂停和反转 |
| `gsap-scrolltrigger` | 外部参考 | 滚动触发、scrub、pinning 和进度驱动动画 |
| `gsap-performance` | 外部参考 | 动画重排、合成层、低端设备和 reduced-motion 性能 |
| `gsap-utils` | 外部参考 | clamp、mapRange、random、snap、toArray、wrap 等工具 |
| `gsap-plugins` | 外部参考 | Flip、Draggable、ScrollTo、SplitText、MorphSVG 等插件 |
| `gsap-frameworks` | 外部参考 | Vue、Svelte、Astro 等非 React 框架中的 GSAP 生命周期 |
| `web-design-engineer` | 外部参考 | 用户明确要求完整视觉原型、dashboard、slide、动效 demo 或 UI mockup |
| `ui-ux-pro-max` | 外部参考，需确认 | 用户明确要求设计方案、风格、配色、字体或 UX 评审 |

## UI 组合上限

普通 UI 维护通常以 `web-ui-consistency-guard` 或子项目规则为主；涉及用户文案时叠加 `ui-copy-boundary-guard`。发现重复 UI 或处理器时，按所在子项目现有组件、hooks 与 utils 就近收敛，不继续堆叠外部设计 skills。
