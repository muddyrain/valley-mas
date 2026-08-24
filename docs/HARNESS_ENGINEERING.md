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
| `CLAUDE.md` | 根协作规则；`AGENTS.md` 是兼容软链接 |
| `docs/PROJECT_GUIDE.md` | 项目定位、技术栈、模块地图、端口、环境变量和完整命令表 |
| `docs/ARCHITECTURE_GUIDE.md` | 共享模块、协议迁移和复杂状态协调的按需架构判断 |
| `.agents/skills/INDEX.md` | 项目 skills 分类、触发条件和组合上限 |
| `.agents/skills/*/SKILL.md` | Valley 专项流程与检查方法 |
| `apps/*/AGENTS.md`、`server/AGENTS.md` | 子项目局部规则和入口 |
| `docs/patterns/agent-pitfalls.md` | 已确认的 Agent 失败模式 |
| `.code-review/` | 按改动风险加载的 review 清单 |
| `docs/specs/`、`docs/plans/` | 经确认的一次性设计与实施产物，不替代长期产品计划 |

`.codex/skills`、`.claude/skills`、`.codebase/skills`、`.trae/skills` 通过软链接指向 `.agents/skills`，避免多份 skill 内容漂移。

## 3. 确定性 Harness 检查

`scripts/check-agent-harness.sh` 提供只读健康检查，统一入口为：

```bash
pnpm check:harness
```

当前检查：

- skill 目录与 `.agents/skills/INDEX.md` 双向一致。
- 四个工具兼容入口是指向 `../.agents/skills` 的软链接。
- `AGENTS.md -> CLAUDE.md` 兼容链接、根入口引用的子项目 AGENTS 文件均存在。
- 核心文档入口存在。
- 根 `package.json` 包含 Harness、check 和 build 脚本。

所有局部 `AGENTS.md` 的最小上下文入口由 `pnpm check:agents-context` 检查：上下文链必须以根 `CLAUDE.md` 开始、第二项指向当前局部 `AGENTS.md`，且链中声明的文件必须真实存在（可相对局部目录或仓库根）。fixture 回归入口为：

```bash
pnpm check:agents-context:test
```

检查器只报告可操作错误并返回非零状态，不自动修改文件。fixture 测试入口为：

```bash
pnpm check:harness:test
```

`pnpm check:docs-links` 覆盖根 `CLAUDE.md`、局部 `AGENTS.md` 与 `docs/**/*.md`：不可移植的 `file://` 或仓库绝对路径仍会失败；相对链接先以报告模式输出，待存量清零后再使用 `pnpm check:docs-links -- --strict` 将未解析链接升级为门禁。其 fixture 回归入口为 `pnpm check:docs-links:test`。

## 4. CI 与部署门禁

`.github/workflows/quality.yml` 在 push 和 pull request 上运行：

- `pnpm check:harness`
- `pnpm check:agents-context` 与 `pnpm check:agents-context:test`
- `pnpm check`
- `pnpm build`
- `cd server && go test ./...`

服务端部署工作流先执行 `go test ./...`，再构建服务与迁移程序、应用待执行的版本化迁移，最后重启服务。测试、构建或迁移任一步失败都会由 `set -euo pipefail` 中止部署，不会用不匹配的代码与数据库结构重启服务。

当前优先完整验证，不引入 changed-files 第三方 action 或复杂 job matrix。后续只有在 CI 时间形成稳定数据后再优化增量执行。

## 5. Review 与失败反馈

Code review 从 `.code-review/README.md` 进入，根据改动范围加载 Security、correctness、Go 或 React/UI 规则，不默认创建固定数量的审查 Agent。

已确认的 Agent 失败模式记录在 `docs/patterns/agent-pitfalls.md`。新条目必须来自真实事故或可证明的仓库问题。相同问题重复出现两次以上且可机械判断时，优先升级为：

1. 测试或静态分析规则。
2. Harness 检查脚本。
3. CI 门禁。
4. 最后才是新增文档或 skill 提示。

## 6. 浏览器与运行时证据

按任务选择浏览器与桌面调试工具，并在交付中清楚标注证据来源：

- 探索式 UI 调试、当前登录态、DevTools、控制台或网络检查，优先使用当前用户 Chrome 会话或等价交互工具。操作用户会话时，按需复用现有标签页；导航或执行可能产生外部副作用的操作前取得用户同意。
- 确定性复现、多步骤流程、回归测试、批量截图和 CI 浏览器验证，优先使用仓库已有的 Playwright 或其他确定性浏览器自动化。
- 轻量浏览器探索可使用当前环境已有的 agent-browser、Playwright CLI 或等价工具；浏览器外的桌面 GUI 可使用 Computer Use 或等价桌面自动化。
- 不为一次验证擅自新增浏览器依赖。真实设备权限、硬件、通知或真实外部服务无法由自动化代表时，补充手工验收。
- 不得把 headless、fixture 或模拟服务的结果表述为用户当前登录 Chrome 会话中的实机结果，反之亦然。

运行时证据记录（按风险采用，最短模板）：

```text
- 工具/模式：
- 目标 URL 或 fixture：
- viewport/设备：
- 断言：
- 截图或日志产物：
```

响应式、动画、Canvas、Three.js、拖拽、滚动、loading 和路由行为不能只凭 JSX、CSS、类型检查或 jsdom 结论宣称通过。永久 E2E 测试的取舍由 [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) 统一定义。

## 7. 暂缓能力

以下能力在有足够失败样本和运行数据前不引入：

- 固定三 Agent review 编排。
- 全仓统一覆盖率阈值。
- 基于启发式 file-tier 的自动测试要求。
- Edit 后自动改写源码的 hook。
- Agent read/edit ratio 等 session 指标。
- 自动创建 issue、MR、部署或外部文档。

后续评估优先看任务完成率、返工率、验证通过率、CI 耗时和重复 review 问题，而不是单独优化工具调用数量。
