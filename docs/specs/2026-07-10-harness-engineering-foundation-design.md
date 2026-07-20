# Valley MAS Harness Engineering 基建改进设计

> **状态**：已实施，等待后续 CI 运行记录验证。
> **性质**：临时设计产物，不作为长期规则真源；实施完成后的长期约定仍以根 `AGENTS.md`、`docs/PROJECT_GUIDE.md`、`docs/HARNESS_ENGINEERING.md` 与 `.agents/skills/INDEX.md` 为准。

## 1. 背景

Valley MAS 已具备根 `AGENTS.md`、子项目 `AGENTS.md`、项目级 skills、跨工具软链接、Lefthook 和分项目验证命令。当前主要问题不是缺少规则，而是规则在多个文档中重复维护、验证门禁没有完整进入 CI、项目级 skills 混入通用参考能力，以及前端可见行为缺少可重复的运行时证据。

本轮目标是把 Harness 从“主要依靠 Agent 记住约定”推进到“关键约定可以被脚本和 CI 检查”，同时减少根入口的上下文负担。

## 2. 目标

1. 让根 `AGENTS.md` 回归导航与红线入口，减少与项目指南、技能索引、验证矩阵的重复。
2. 建立机器可执行的 Harness 健康检查，验证 skill 索引、兼容软链接、文档入口和验证命令的一致性。
3. 在 GitHub Actions 中为代码变更提供基础质量门禁，避免未经测试的服务端代码直接部署。
4. 建立只记录真实事故的精简 Agent pitfalls 文档，以及适配 Valley 技术栈的轻量 code review 规则。
5. 将前端验收规则从“禁止 Agent 浏览器验收”调整为“允许受控的运行时取证，用户手动验收仍作为补充”。
6. 保留现有计划文档同步、未知脏改动保护、编码检查和子项目局部规则。

## 3. 非目标

- 不迁移 Nexus 的 BITS、Meego、Slardar、Tea、飞书 Wiki、部署和 MR 自动化流程。
- 不引入新的第三方依赖。
- 不建立固定三 Agent 并行审查流程。
- 不在本轮引入统一覆盖率阈值、file-tier、TDD 自动生成、on-edit 自动修复或 Agent session 指标采集。
- 不修改业务代码、产品功能、接口、数据模型或子项目长期产品计划。
- 不要求一次性把所有通用 skills 从仓库删除；本轮先明确分类和迁移策略，避免破坏现有使用入口。

## 4. 方案选择

### 方案 A：仅精简文档

只调整 `AGENTS.md` 和 Harness 文档。改动最小，但无法阻止后续验证矩阵、skill 索引和软链接再次漂移，也不能解决 CI 缺少测试门禁的问题。

### 方案 B：文档真源 + 轻量自动化门禁（采用）

精简文档，同时新增标准库脚本和 GitHub Actions 质量门禁。脚本只检查稳定、可机械判断的约束，不尝试理解业务语义。该方案能形成最小闭环，且不增加依赖。

### 方案 C：完整复制 Nexus Harness

迁移 file-tier、on-edit/on-commit、覆盖率分级、Ship 状态机、多 Agent CR 和探针指标。该方案与 Valley 当前团队规模、测试覆盖和外部工具环境不匹配，维护成本过高。

## 5. 设计

### 5.1 文档职责边界

| 文件 | 唯一职责 |
|---|---|
| `AGENTS.md` | 必读入口、任务路由、顶层红线、完成标准 |
| `docs/PROJECT_GUIDE.md` | 项目定位、技术栈、模块地图、端口、环境变量、开发与验证命令 |
| `.agents/skills/INDEX.md` | 项目 skills 分类、触发条件、组合上限 |
| `docs/HARNESS_ENGINEERING.md` | Harness 架构、反馈闭环、自动化资产与演进原则 |
| `apps/*/AGENTS.md`、`server/AGENTS.md` | 子项目局部入口、约束和验证补充 |

根 `AGENTS.md` 不再复制完整仓库地图、环境变量说明和逐子项目验证表，而是链接到真源。工作流分级保留，但全局 skills 必须标记为“可选增强”；不可用时回退到等价的普通分析、计划、实施和验证流程，不能阻塞任务。

### 5.2 Harness 健康检查

新增 `scripts/check-agent-harness.sh`，使用 Bash、Git、Python 标准库及系统命令完成以下检查：

1. `.agents/skills/*/SKILL.md` 与 `.agents/skills/INDEX.md` 双向一致，不允许漏登记或悬空条目。
2. `.claude/skills`、`.codex/skills`、`.codebase/skills`、`.trae/skills` 均为指向 `../.agents/skills` 的软链接。
3. 根 `AGENTS.md` 声明的子项目 `AGENTS.md` 路径真实存在。
4. 核心文档入口存在：`docs/README.md`、`docs/PROJECT_GUIDE.md`、`docs/HARNESS_ENGINEERING.md`。
5. 根 `package.json` 中 Harness 和质量门禁所依赖的脚本存在。

脚本只输出可操作错误并以非零状态退出，不自动修改文件。新增 `pnpm check:harness` 作为统一入口，并在 CI 与本地验证中复用。

### 5.3 CI 质量门禁

新增独立的 GitHub Actions 质量工作流，覆盖 push 和 pull request：

- Harness 配置：运行 `pnpm check:harness`。
- Go 服务：变更涉及 `server/**` 时运行 `go test ./...`。
- 前端与共享包：运行根级 `pnpm check` 和 `pnpm build`，复用 Turbo 缓存与包依赖图。

同时修改服务端部署工作流，在远端 build 和 restart 之前执行 `go test ./...`。测试失败时不得重启服务。

首轮不做复杂的 changed-files job matrix，避免为了优化 CI 时间引入难维护的条件逻辑。现有仓库规模下优先保证正确性；后续有运行时数据后再优化。

### 5.4 Agent pitfalls

新增 `docs/patterns/agent-pitfalls.md`，只记录 Valley 已经能从当前仓库规则确认的失败模式：

- 多处手工维护验证命令导致漂移。
- 将临时 spec/plan 误写成长期产品状态。
- 把用户未知脏改动当作可清理内容。
- 只凭静态代码对可见 UI 行为下“已验证”结论。
- 全局 skill 不存在时错误地阻塞任务。

每条包含场景、错误行为、正确做法和检测方式。该文档按任务相关性读取，不设为所有任务的强制全文必读项。

### 5.5 Code review 规则

新增 `.code-review/README.md` 和按风险分类的轻量规则：

- `security.md`：密钥、鉴权、输入校验、SSRF、XSS、日志敏感信息。
- `correctness.md`：错误处理、幂等、状态一致性、分页、空值和时间边界。
- `go-server.md`：Gin/GORM 事务、上下文、超时、错误映射、迁移兼容性。
- `react-ui.md`：effect 清理、请求竞态、路由状态、可访问性、运行时视觉证据。

规则用于 review 时按改动范围加载，不默认启动多个审查 Agent。重复出现两次以上且可机械判断的问题，应优先转成 Biome、测试或 Harness 脚本，而不是继续堆文档条目。

### 5.6 浏览器验收边界

将当前“不要使用 Playwright 做自动验收”调整为：

- 允许 Agent 使用当前环境可用的浏览器工具做本地运行时取证。
- 可见 UI、响应式、动画、Canvas、Three.js、拖拽和路由行为不能只靠静态分析宣称通过。
- 运行时证据可以是截图、关键元素几何、控制台错误、网络请求或明确的交互结果。
- 不要求为所有 UI 改动新增永久 E2E 测试；是否沉淀测试按回归风险判断。
- 用户手动验收仍用于主观视觉和真实业务环境，但不能替代可自动执行的基础验证。

### 5.7 Skill 分类收敛

在 `.agents/skills/INDEX.md` 中明确三类：

- 项目必需：Valley 业务、文档同步、编码和提交约定。
- 项目可选：与当前仓库直接相关但非默认流程的专项能力。
- 外部参考：GSAP、通用设计、grilling 等，后续迁到个人或插件层；迁移前保持现有软链接兼容，不在本轮删除。

`skill-usage-disclosure` 不再作为需要递归启用的流程 skill，而改为根协作规则中的一条输出要求。`delivery-reporting` 与 `task-completion-guard` 本轮先收窄触发边界，不立即合并，避免同时修改规则和删除兼容入口。

## 6. 数据流与失败处理

```text
开发者或 Agent 修改配置/代码
  -> 本地 pnpm check:harness / 子项目验证
  -> Lefthook 保留 staged Biome 和 pre-push build
  -> GitHub Actions 运行 Harness、check、build、Go test
  -> 只有通过质量门禁的 server main/master 变更进入部署
```

Harness 检查失败必须输出具体文件、缺失项和修复方向。CI 不自动修复、不提交文件、不调用外部 AI 服务。浏览器工具不可用时，最终回复必须把对应可见行为标记为未验证，并给出人工验收标准。

## 7. 验证策略

实施完成后至少运行：

```bash
pnpm check:harness
pnpm check
pnpm build
cd server && go test ./...
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <本轮修改的中文文档与配置>
```

Harness 脚本还需要在临时目录或受控输入下验证至少一个失败场景，确认错误时返回非零状态；不得通过破坏当前仓库软链接来测试。

## 8. 验收标准

- 根 `AGENTS.md` 的重复项目地图和验证细节明显减少，所有长期信息都有唯一真源。
- `pnpm check:harness` 在当前仓库通过，并能对缺失 skill 索引项返回非零状态。
- GitHub Actions 对前端/共享包和 Go 服务提供质量门禁。
- 服务端部署在测试失败时不会执行 build/restart。
- pitfalls 和 code review 规则可以按任务范围读取，不要求固定多 Agent 审查。
- UI 规则允许运行时取证，并禁止无证据宣称可见行为已验证。
- 不新增第三方依赖，不修改业务功能，不自动提交或推送。

## 9. 后续候选

以下内容需要先积累 CI 时间、测试覆盖和 Agent 失败样本，再单独设计：

- 受影响包增量验证。
- 核心纯函数和共享包的覆盖率阈值。
- file-tier 与按风险推荐测试。
- Codex/Claude on-edit 只读探针。
- Agent eval 任务集与完成率、返工率、验证通过率指标。
- 自动文档新鲜度报告。
