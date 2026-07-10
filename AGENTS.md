# Valley MAS AI 协作入口

默认使用中文沟通与输出。详细项目定位、技术栈、模块地图、环境变量、开发命令与完整验证矩阵以 `docs/PROJECT_GUIDE.md` 为唯一真源；文档索引见 `docs/README.md`；Harness 设计和自动化资产见 `docs/HARNESS_ENGINEERING.md`。

## 任务进入

1. 读取 `.agents/skills/INDEX.md`，确认项目 skill 路由。
2. 按任务范围读取 `docs/PROJECT_GUIDE.md` 的相关章节。
3. 进入子项目时先读对应 `AGENTS.md`，再读相关 README、环境变量示例、路由、处理器或包脚本。
4. 涉及 AI 协作流程、验证闭环或 Harness 本身时，读取 `docs/HARNESS_ENGINEERING.md`。
5. 以当前代码和文档为准，不凭旧记忆推断路径、命令或业务规则。

只装载当前任务需要的上下文。普通任务不要求全文读取所有长期文档或所有 skills。

## 子项目路由

| 子项目 | 局部协作入口 | 适用范围 |
|---|---|---|
| Life Trace | `apps/life-trace/AGENTS.md` | Today、计划、AI、踪迹、Pantry、提醒、家庭空间和个人设置 |
| Web 前台 | `apps/web/AGENTS.md` | 用户侧页面、创作者空间、资源、博客、个人空间和 Web API |
| Admin 后台 | `apps/admin/AGENTS.md` | 管理后台、审核流程、Ant Design 组件和 Admin API |
| Desktop OS | `apps/desktop-os/AGENTS.md` | 毛毡桌面、窗口系统、内置应用和 Mini Apps |
| AI Mind Arena | `apps/ai-mind-arena/AGENTS.md` | Next.js 前端、人格辩论 UI、SSE 和分享体验 |
| WorldSim | `apps/world-sim/AGENTS.md` | 沙盒文明模拟、玩法参数和设计文档 |
| Scratch Legend | `apps/scratch-legend/AGENTS.md` | 刮刮卡成长游戏和阶段任务 |
| Toy Climb Arena | `apps/toy-climb-arena/AGENTS.md` | Three.js 攀爬游戏、关卡、资源和物理验证 |
| Go 服务端 | `server/AGENTS.md` | Gin/GORM API、认证、模型、AI 与业务服务 |

## 计划文档同步

每次实现前判断改动是否属于当前计划；每次收尾说明计划文档是否同步。按真实长期影响判断，不把临时调试和一次性总结写进长期计划。

- Life Trace：`apps/life-trace/docs/PLAN.md`。
- Desktop OS：`apps/desktop-os/docs/PLAN.md`。
- WorldSim：按 `apps/world-sim/AGENTS.md` 和 `game-doc-sync-guard` 同步对应设计文档。
- 根长期文档索引：`docs/README.md`。
- 必须同步：功能状态、页面入口、接口路径、依赖策略、数据模型、产品方向、长期文档索引或验收标准发生变化。
- 通常无需同步：临时调试、格式化、拼写、注释、局部样式微调和不改变长期状态的协作规则收敛。
- 不适用或没有指定计划入口时，不临时创造长期计划；最终说明判断依据。

## Skill 使用

项目 skills 的分类、触发条件和组合上限只在 `.agents/skills/INDEX.md` 维护。

- 命中项目 skill 时，读取对应 `.agents/skills/<name>/SKILL.md` 并按其流程执行。
- `.codex/skills`、`.claude/skills`、`.codebase/skills`、`.trae/skills` 是指向同一目录的兼容入口，不维护副本。
- 全局或个人 skills 是可选增强；当前环境缺失时，使用等价的普通分析、计划、实施和验证流程继续，不能仅因此阻塞任务。
- 本回合使用了 skill 时，在开始阶段简短说明名称和原因；这是一条输出约定，不要求递归启用披露 skill。

## 工作流分级

| 档位 | 触发条件 | 流程 |
|---|---|---|
| A · Vibe | 单文件不超过 30 行的 typo、文案、注释或纯解释；用户明确要求快速处理 | 直接执行，不写 plan，完成后做定向验证 |
| B · Vibe + 自检 | 多文件或超过 30 行的 bugfix、组件抽取、重复逻辑收敛和不改变产品计划的重构 | 直接执行；收尾按“假设、简单、聚焦、可验证”四项自检 |
| C · 结构化计划 | 大型功能、新页面族、新接口族、新数据模型、新依赖、跨子项目重构、产品方向或验收标准变化；用户要求先计划 | 先形成 spec 和实施计划，经确认后实施，最后做完整验证 |
| D · 系统化调试 | 复杂运行时 bug、间歇性失败或静态分析无法定位 | 先收集复现证据和根因，再修复并回到 B/C 档收尾 |

若环境中存在适用的 `brainstorming`、`writing-plans`、`systematic-debugging`、`karpathy-coder` 或 `verification-before-completion` 等全局 skill，可以用于增强对应阶段；它们不是仓库运行的硬依赖。

执行中发现范围升级时先说明。例如 B 档发现必须新增接口、依赖或数据模型，应先升级到 C 档，不能按低档流程继续扩张。

## 项目 Skill 路由

- 重复 JSX、handler、弹窗、表单、上传或列表逻辑：`component-reuse-guard`。
- 生成提交信息或执行提交：`conventional-commit-guard`。
- 多阶段汇报或长期文档、功能状态、接口、依赖、数据模型、产品方向、验收标准变化：`delivery-reporting`。
- 修改用户可见 UI 文案：`ui-copy-boundary-guard`。
- 修改 CJK/非 ASCII 文本、Markdown、skill 或配置示例：`encoding-guard`。
- 跨 3 个以上文件、多轮实施或计划驱动：`task-completion-guard`。
- 其他专项能力按 `.agents/skills/INDEX.md` 路由。

## 顶层红线

- 修改前先阅读相关代码和文档，遵循现有风格和边界。
- 必须运行与改动范围匹配的校验并读取结果；完整命令见 `docs/PROJECT_GUIDE.md`。
- 不在源码、文档或示例配置中写入真实密钥。
- 不修改 `node_modules`、`dist`、`.next`、`.turbo` 等依赖或生成目录，除非任务明确要求。
- 不执行 `git reset --hard`、`git checkout --`、大批量删除等破坏性操作，除非用户明确授权。
- 不回滚、覆盖或整理未知来源的工作树改动；未知 dirty change 默认属于用户。
- 发现无关改动会影响当前任务时先说明；不影响时忽略并继续。
- 评估新增第三方依赖前，先说明依赖、解决的问题、取舍和替代方案，并取得用户确认。
- 修改接口前检查路由、处理器、模型、服务和中间件；修改环境变量时检查对应 `.env.example`。

## 前端与运行时证据

- 维护现有页面时优先使用子项目设计系统、组件、hooks、API 封装和主题 token。
- 允许使用当前环境可用的浏览器工具做本地运行时取证。
- 响应式、动画、Canvas、Three.js、拖拽、滚动、loading 和路由行为不能只凭静态代码宣称已验证。
- 运行时证据可以是截图、关键元素几何、控制台错误、网络请求或明确交互结果。
- 不要求所有 UI 改动都新增永久 E2E 测试；是否沉淀测试按回归风险判断。
- 浏览器工具或真实环境不可用时，最终回复必须标记未验证项并给出人工验收标准。用户手动验收用于补充主观视觉和真实业务环境，不替代可自动执行的基础验证。

## 工作方式

- 优先用 `rg` / `rg --files` 定位文件、符号和引用。
- 优先复用现有组件、hooks、utils、API 封装和服务端模式。
- 结构化数据优先使用解析器或结构化 API，不使用脆弱的字符串拼接。
- 改动保持聚焦；不顺手重构、不清理无关代码、不制造额外元数据变更。
- 测试范围与风险匹配：窄改动做定向验证，共享契约和跨模块行为扩大验证。
- 可见行为结论优先基于运行证据；已知失败模式按 `docs/patterns/agent-pitfalls.md` 相关条目检查。
- Code review 按 `.code-review/README.md` 根据改动范围加载规则。

## Git 规则

- 不自动提交；只有用户明确要求提交时才进入 commit 流程。
- 提交前查看最近 5 条提交风格。
- 提交信息使用 `conventional-commit-guard`，默认采用 emoji + Conventional Commit 的简短中文 summary。
- 不自动添加长正文或 trailers，除非用户明确要求。

## 完成标准

- 核心改动已真实落地，不把 spec、plan 或下一步误报为完成。
- 引用、入口和文档没有指向已删除的 skill、过期路径或旧模块名。
- `pnpm check:harness` 通过；其他适用命令按 `docs/PROJECT_GUIDE.md` 运行并读取结果。
- 已判断计划文档同步需求；同步或不适用的理由在最终回复中说明。
- C 档产生的临时 spec/plan 路径在最终回复中列出，方便 owner 后续清理。
- 最终回复简洁说明改了什么、验证了什么、哪些未验证或仍有风险，以及本次使用的 skills。
