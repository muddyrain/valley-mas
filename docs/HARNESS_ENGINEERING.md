# Valley MAS Harness Engineering

> 版本：v0.3 · 日期：2026-07-23

Harness Engineering 是面向 AI coding agent 的工程环境层。它通过清晰入口、稳定真源、工具边界、确定性检查、运行时证据和反馈回路，提高 Agent 在真实仓库中完成任务的成功率。

它不是业务运行时模块，不替代测试、类型检查、lint 和人工产品判断，也不要求把 implementer、reviewer、architect 等视角包装成虚拟角色。

## 1. 核心原则

```text
任务执行 -> 验证与 review -> 发现重复失败 -> 转成文档、脚本、测试或 CI -> 再验证
```

优先把稳定、可机械判断的问题转成确定性门禁。提示词和 skill 只承载需要语境判断的流程，不能无限堆叠。

## 2. 分层真源

| 层级 | 唯一职责 |
|---|---|
| `AGENTS.md` | 任务入口、子项目路由、顶层红线和完成标准 |
| `docs/PROJECT_GUIDE.md` | 项目定位、技术栈、模块地图、端口、环境变量和完整命令表 |
| `docs/ARCHITECTURE_GUIDE.md` | 共享模块、协议迁移和复杂状态协调的按需架构判断 |
| `.agents/skills/INDEX.md` | 项目 skills 分类、触发条件和组合上限 |
| `.agents/skills/*/SKILL.md` | Valley 专项流程与检查方法 |
| `apps/*/AGENTS.md`、`server/AGENTS.md` | 子项目局部规则和入口 |
| `docs/patterns/agent-pitfalls.md` | 已确认的 Agent 失败模式 |
| `.code-review/` | 按改动风险加载的 review 清单 |
| `docs/specs/`、`docs/plans/` | 经确认的一次性设计与实施产物，不替代长期产品计划 |

`.codex/skills`、`.claude/skills`、`.codebase/skills`、`.trae/skills` 通过软链接指向 `.agents/skills`，避免多份 skill 内容漂移。

## 3. 标准工作流

### 3.1 任务进入

1. 读取根 `AGENTS.md` 和 `.agents/skills/INDEX.md`。
2. 按范围读取 `docs/PROJECT_GUIDE.md` 相关章节与子项目 `AGENTS.md`。
3. 定位相关代码、测试、文档、脚本和 `.env.example`。
4. 区分问答、分析、文档、实现、修复、review 和提交任务。
5. 只装载当前任务需要的上下文。

### 3.2 执行边界

- 修改前理解当前实现并优先复用现有模式。
- 不写真实密钥，不修改依赖和生成目录。
- 不回滚未知 dirty change。
- CJK/非 ASCII 文本使用 `encoding-guard` 定向检查。
- 功能、接口、依赖、数据模型和长期状态变化时同步指定计划文档；普通局部修复不要求机械更新或声明计划状态。
- 全局个人 skill 仅作增强；缺失时回退普通流程，不能阻塞仓库任务。

### 3.3 验证

完整命令以 `docs/PROJECT_GUIDE.md` 的“常用校验”为唯一真源。无法运行时，最终回复说明原因、影响范围和剩余风险。

完成证据至少包括：

- 实际修改的文件和行为。
- 实际运行的命令、退出状态和失败数量。
- 运行时可见行为的截图、几何、控制台、网络或交互结果。
- 未验证事项和人工验收标准。
- 改动涉及指定计划入口或长期状态时，计划文档的同步结果。

## 4. 确定性 Harness 检查

`scripts/check-agent-harness.sh` 提供只读健康检查，统一入口为：

```bash
pnpm check:harness
```

当前检查：

- skill 目录与 `.agents/skills/INDEX.md` 双向一致。
- 四个工具兼容入口是指向 `../.agents/skills` 的软链接。
- 根 `AGENTS.md` 引用的具体子项目 AGENTS 文件存在。
- 核心文档入口存在。
- 根 `package.json` 包含 Harness、check 和 build 脚本。

检查器只报告可操作错误并返回非零状态，不自动修改文件。fixture 测试入口为：

```bash
pnpm check:harness:test
```

## 5. CI 与部署门禁

`.github/workflows/quality.yml` 在 push 和 pull request 上运行：

- `pnpm check:harness`
- `pnpm check`
- `pnpm build`
- `cd server && go test ./...`

服务端部署工作流在 build 和 restart 之前执行 `go test ./...`。任何测试失败都会由 `set -euo pipefail` 中止部署，不得重启旧代码路径上的服务进程。

当前优先完整验证，不引入 changed-files 第三方 action 或复杂 job matrix。后续只有在 CI 时间形成稳定数据后再优化增量执行。

## 6. Review 与失败反馈

Code review 从 `.code-review/README.md` 进入，根据改动范围加载 Security、correctness、Go 或 React/UI 规则，不默认创建固定数量的审查 Agent。

已确认的 Agent 失败模式记录在 `docs/patterns/agent-pitfalls.md`。新条目必须来自真实事故或可证明的仓库问题。相同问题重复出现两次以上且可机械判断时，优先升级为：

1. 测试或静态分析规则。
2. Harness 检查脚本。
3. CI 门禁。
4. 最后才是新增文档或 skill 提示。

## 7. 浏览器与运行时证据

允许 Agent 使用当前环境可用的浏览器工具做本地运行时取证，优先复用用户当前 Chrome 会话；不可用时可使用仓库已有的 E2E、headless 浏览器或当前环境提供的等价工具，不为一次验证擅自新增浏览器依赖。响应式、动画、Canvas、Three.js、拖拽、滚动、loading 和路由行为不能只凭 JSX、CSS、类型检查或 jsdom 结论宣称通过。

不要求每个 UI 改动都新增永久 E2E 测试。是否沉淀测试由回归概率、核心路径和维护成本决定。用户手动验收用于补充主观视觉与真实业务环境，但不替代可自动执行的基础验证。

## 8. 暂缓能力

以下能力在有足够失败样本和运行数据前不引入：

- 固定三 Agent review 编排。
- 全仓统一覆盖率阈值。
- 基于启发式 file-tier 的自动测试要求。
- Edit 后自动改写源码的 hook。
- Agent read/edit ratio 等 session 指标。
- 自动创建 issue、MR、部署或外部文档。

后续评估优先看任务完成率、返工率、验证通过率、CI 耗时和重复 review 问题，而不是单独优化工具调用数量。
