# Valley MAS AI 协作入口

默认使用中文沟通与输出。详细项目定位、技术栈、模块地图、环境变量、开发命令与完整验证矩阵以 `docs/PROJECT_GUIDE.md` 为唯一真源；文档索引见 `docs/README.md`；Harness 设计和自动化资产见 `docs/HARNESS_ENGINEERING.md`。

## 任务进入

1. 读取 `.agents/skills/INDEX.md`，确认项目 skill 路由。
2. 按任务范围读取 `docs/PROJECT_GUIDE.md` 的相关章节。
3. 进入子项目时先读对应 `AGENTS.md`，再读相关 README、环境变量示例、路由、处理器或包脚本。
4. 涉及 AI 协作流程、验证闭环或 Harness 本身时，读取 `docs/HARNESS_ENGINEERING.md`。
5. 涉及共享模块、跨应用复用、协议或 Provider 迁移、复杂状态协调时，按需读取 `docs/ARCHITECTURE_GUIDE.md`。
6. 以当前代码和文档为准，不凭旧记忆推断路径、命令或业务规则。

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

实现前按真实长期影响判断改动是否属于当前计划，不把临时调试和一次性总结写进长期计划。只有实际同步了计划、改动可能改变指定计划入口中的长期状态，或不说明会造成状态误解时，才需要在收尾说明计划同步情况；普通局部修复无需机械声明。

- Life Trace：`apps/life-trace/docs/PLAN.md`。
- Desktop OS：`apps/desktop-os/docs/PLAN.md`。
- WorldSim：按 `apps/world-sim/AGENTS.md` 同步 `docs/TDD.md` 或受影响的设计文档。
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
| C · 结构化计划 | 大型功能、新页面族、新接口族、新数据模型、新依赖、跨子项目重构、产品方向或验收标准变化；用户要求先计划 | 先形成精简 spec 和实施计划；只有存在关键未决方案、新增依赖、不可逆数据变化或用户要求先确认时才暂停等待确认。需求明确且用户已授权时可直接实施，最后做完整验证 |
| D · 系统化调试 | 复杂运行时 bug、间歇性失败或静态分析无法定位 | 先收集复现证据和根因，再修复并回到 B/C 档收尾 |

若环境中存在适用的 `brainstorming`、`writing-plans`、`systematic-debugging`、`karpathy-coder` 或 `verification-before-completion` 等全局 skill，可以用于增强对应阶段；它们不是仓库运行的硬依赖。

执行中发现范围升级时先说明并切换到对应档位。若新增范围仍明显属于用户已授权目标，可继续实施；只有需要新的用户决策、权限或明显扩大产品范围时才暂停确认。

## 项目 Skill 路由

- 发现重复 JSX、handler、弹窗、表单、上传或列表逻辑时，先定位既有组件、hooks、utils 和页面模式；确认存在稳定复用价值后，按所在子项目的目录约定就近收敛。
- 生成提交信息或执行提交：`conventional-commit-guard`。
- 多阶段汇报或长期文档、功能状态、接口、依赖、数据模型、产品方向、验收标准变化：`delivery-reporting`。
- 用户明确要求文档巡检、README 是否过时、文档与代码对齐：`documentation-freshness-audit`。
- 修改用户可见 UI 文案：`ui-copy-boundary-guard`。
- 用户明确要求性能 review、检查性能或评估 Web diff 性能风险：`web-performance-review`。
- 修改 CJK/非 ASCII 文本、Markdown、skill 或配置示例：`encoding-guard`。
- 实施任务跨 3 个以上文件、多轮落地或计划驱动，且存在完成状态误报风险：`task-completion-guard`；只读分析和普通问答不触发。
- 其他专项能力按 `.agents/skills/INDEX.md` 路由。

## 顶层红线

- 修改前先阅读相关代码和文档，遵循现有风格和边界。
- 必须运行与改动范围匹配的校验并读取结果；完整命令见 `docs/PROJECT_GUIDE.md`。
- 不在源码、文档或示例配置中写入真实密钥。
- 不修改 `node_modules`、`dist`、`.next`、`.turbo` 等依赖或生成目录，除非任务明确要求。
- 不执行 `git reset --hard`、`git checkout --`、大批量删除等破坏性操作，除非用户明确授权。
- 不回滚、覆盖或整理未知来源的工作树改动；未知 dirty change 默认属于用户。
- 发现无关改动会影响当前任务时先说明；不影响时忽略并继续。
- 新增仓库尚未使用的第三方依赖前，先说明依赖、解决的问题、取舍和替代方案，并取得用户确认。仅调用仓库已安装且不改变依赖清单的工具无需重复确认。
- 修改接口前检查路由、处理器、模型、服务和中间件；修改环境变量时检查对应 `.env.example`。

## 前端与运行时证据

- 维护现有页面时优先使用子项目设计系统、组件、hooks、API 封装和主题 token。
- 允许使用当前环境可用的浏览器工具做本地运行时取证。
- 查看或调试页面时，优先使用 `chrome:control-chrome` 复用用户当前已打开的 Chrome 会话。Chrome 不可用时，可使用仓库已有的 E2E、headless 浏览器或当前环境提供的等价工具；不要为一次验证擅自新增浏览器依赖或启动会干扰用户会话的重复 GUI 实例。仍无法取证时，再说明未验证项并提供人工验收标准。
- 响应式、动画、Canvas、Three.js、拖拽、滚动、loading 和路由行为不能只凭静态代码宣称已验证。
- 运行时证据可以是截图、关键元素几何、控制台错误、网络请求或明确交互结果。
- 不要求所有 UI 改动都新增永久 E2E 测试；是否沉淀测试按回归风险判断。
- 浏览器工具或真实环境不可用时，最终回复必须标记未验证项并给出人工验收标准。用户手动验收用于补充主观视觉和真实业务环境，不替代可自动执行的基础验证。

## 测试治理

- 项目级测试目标、历史测试债治理和例外边界以 `docs/TESTING_STRATEGY.md` 为准；完整测试命令仍以 `docs/PROJECT_GUIDE.md` 为唯一真源。
- 新增功能、bugfix 和会改变运行时行为的重构必须评估并新增或更新与风险相称的测试；无法测试时，在最终交付说明原因、替代验证和剩余风险。
- 不要求一次性补齐所有历史功能测试；按“随改补测、事故回归、高风险专题清债”推进，不能以历史债为由继续新增无测试债。

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
- 修改 `AGENTS.md`、Harness 文档、skills、兼容入口或相关检查脚本时，`pnpm check:harness` 通过；普通业务代码改动无需机械运行 Harness 检查。其他适用命令按 `docs/PROJECT_GUIDE.md` 运行并读取结果。
- 改动涉及指定计划入口或长期状态时，已完成计划同步判断，并在需要时说明结果。
- C 档产生的临时 spec/plan 路径在最终回复中列出，方便 owner 后续清理。
- 最终回复简洁说明改了什么、验证了什么、哪些未验证或仍有风险，以及本次使用的 skills。
