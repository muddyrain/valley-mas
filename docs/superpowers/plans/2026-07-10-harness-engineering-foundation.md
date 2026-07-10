# Valley MAS Harness Engineering Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已批准的 Harness Engineering 设计落成可执行检查、CI 门禁、精简规则真源和按需 review/pitfall 文档。

**Architecture:** 以 `docs/PROJECT_GUIDE.md`、`.agents/skills/INDEX.md` 和 `docs/HARNESS_ENGINEERING.md` 分别承载项目命令、skill 路由与 Harness 设计；根 `AGENTS.md` 只保留导航、红线和完成标准。新增无第三方依赖的 Bash/Python 标准库检查器，并让本地脚本、GitHub Actions 与服务端部署共同复用确定性验证。

**Tech Stack:** Bash、Python 3 标准库、pnpm 9、Turbo、GitHub Actions、Go test、Markdown。

---

## 文件结构

| 路径 | 责任 |
|---|---|
| `scripts/check-agent-harness.sh` | 只读检查 skill 索引、软链接、核心文档、AGENTS 引用和根脚本 |
| `scripts/check-agent-harness.test.sh` | 在临时 fixture 中验证检查器成功与失败行为 |
| `package.json` | 暴露 `check:harness` 与 `check:harness:test` 命令 |
| `.github/workflows/quality.yml` | 前端、共享包、Harness 与 Go 的基础 CI 门禁 |
| `.github/workflows/deploy-server.yml` | 部署前远端执行 Go 测试 |
| `AGENTS.md` | 精简后的入口、任务路由、红线和完成标准 |
| `.agents/skills/INDEX.md` | 项目必需、项目可选、外部参考三类 skill 路由 |
| `docs/HARNESS_ENGINEERING.md` | 自动化资产、反馈闭环与浏览器证据规则 |
| `docs/PROJECT_GUIDE.md` | 验证命令唯一真源及 CI 入口 |
| `docs/README.md` | 新增长期 pitfalls 与 review 规则索引 |
| `docs/patterns/agent-pitfalls.md` | Valley 已确认的 Agent 失败模式 |
| `.code-review/README.md` | 按改动风险加载 review 规则的入口 |
| `.code-review/rules/*.md` | Security、correctness、Go、React 专项检查项 |

### Task 1: 建立 Harness 检查器的失败测试

**Files:**
- Create: `scripts/check-agent-harness.test.sh`

- [x] **Step 1: 写临时 fixture 测试**

测试脚本创建最小仓库 fixture，复制待测检查器，准备一个已登记 skill、四个兼容软链接、核心文档、子项目 AGENTS 和根脚本。断言健康 fixture exit 0；再新增未登记 skill，断言 exit 非 0 且输出包含 `not listed in INDEX.md`。

- [x] **Step 2: 运行测试确认 RED**

Run: `bash scripts/check-agent-harness.test.sh`

Expected: FAIL，原因是 `scripts/check-agent-harness.sh` 尚不存在。

### Task 2: 实现 Harness 检查器

**Files:**
- Create: `scripts/check-agent-harness.sh`
- Modify: `package.json`

- [x] **Step 1: 实现只读检查器**

检查器支持 `HARNESS_ROOT` 覆盖根目录，便于 fixture 测试；默认使用脚本所在仓库。检查失败累积输出，最后统一非零退出，不自动修复文件。

- [x] **Step 2: 运行测试确认 GREEN**

Run: `bash scripts/check-agent-harness.test.sh`

Expected: 两个场景通过，exit 0。

- [x] **Step 3: 暴露 pnpm 脚本并验证真实仓库**

在根 `package.json` 增加：

```json
"check:harness": "bash scripts/check-agent-harness.sh",
"check:harness:test": "bash scripts/check-agent-harness.test.sh"
```

Run: `pnpm check:harness && pnpm check:harness:test`

Expected: 两条命令均 exit 0。

### Task 3: 增加 CI 与部署测试门禁

**Files:**
- Create: `.github/workflows/quality.yml`
- Modify: `.github/workflows/deploy-server.yml`

- [x] **Step 1: 新增质量工作流**

工作流在 push 和 pull request 上运行，使用 Node 20、pnpm 9 和 frozen lockfile；前端 job 执行 `pnpm check:harness`、`pnpm check`、`pnpm build`，Go job 在 `server` 中执行 `go test ./...`。

- [x] **Step 2: 将 Go 测试放到远程部署 build 之前**

远程步骤调整为 sync、download、test、build、restart、status 六步。`set -euo pipefail` 保证测试失败后不继续重启。

- [x] **Step 3: 静态校验 YAML 与部署顺序**

Run:

```bash
python3 - <<'PY'
from pathlib import Path

quality = Path('.github/workflows/quality.yml').read_text()
deploy = Path('.github/workflows/deploy-server.yml').read_text()
assert 'pnpm check:harness' in quality
assert 'pnpm check' in quality
assert 'pnpm build' in quality
assert 'go test ./...' in quality
assert deploy.index('go test ./...') < deploy.index('go build') < deploy.index('systemctl restart')
PY
```

Expected: exit 0。

### Task 4: 收敛文档职责和 skill 分类

**Files:**
- Modify: `AGENTS.md`
- Modify: `.agents/skills/INDEX.md`
- Modify: `docs/HARNESS_ENGINEERING.md`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `docs/README.md`

- [x] **Step 1: 精简根 AGENTS**

删除完整仓库地图、环境变量、开发命令和逐项目验证清单，改为指向 `PROJECT_GUIDE.md`。保留子项目路由、计划同步、A/B/C/D 分级、顶层红线、Git 规则和完成标准。全局 skill 不可用时必须退回等价普通流程，不得阻塞任务。

- [x] **Step 2: 调整浏览器验收规则**

允许受控浏览器运行时取证；可见 UI、动画、Canvas、Three.js、拖拽和路由行为没有运行证据时必须明确标记未验证。用户手动验收保留为主观体验补充。

- [x] **Step 3: 重组 skill 索引**

将 skill 表拆成项目必需、项目可选、外部参考；`skill-usage-disclosure` 改为普通输出约定，不再要求递归启用。保留现有 skill 文件，避免破坏兼容入口。

- [x] **Step 4: 同步 Harness 与项目指南**

在 Harness 文档记录检查器、CI、pitfalls、review 和证据闭环；在项目指南维护完整验证命令并加入 Harness 命令；在文档索引加入新入口。

### Task 5: 建立精简 pitfalls 和 code review 规则

**Files:**
- Create: `docs/patterns/agent-pitfalls.md`
- Create: `.code-review/README.md`
- Create: `.code-review/rules/security.md`
- Create: `.code-review/rules/correctness.md`
- Create: `.code-review/rules/go-server.md`
- Create: `.code-review/rules/react-ui.md`

- [x] **Step 1: 写 Valley pitfalls**

每条必须包含场景、错误行为、正确做法和检测方式；只记录 spec 中确认的五类问题，不复制 Nexus 的内部平台事故。

- [x] **Step 2: 写按风险加载的 review 入口和规则**

默认加载 security + correctness；Go 改动追加 go-server；React/UI 改动追加 react-ui。输出要求 findings 优先、带文件行号、按严重级别排序；没有问题时说明测试缺口和残余风险。

### Task 6: 全量验证和状态收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-07-10-harness-engineering-foundation-design.md`
- Modify: `docs/superpowers/plans/2026-07-10-harness-engineering-foundation.md`

- [x] **Step 1: 运行 Harness 与文本检查**

Run:

```bash
pnpm check:harness
pnpm check:harness:test
git diff --check
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
  AGENTS.md .agents/skills/INDEX.md docs/HARNESS_ENGINEERING.md \
  docs/PROJECT_GUIDE.md docs/README.md docs/patterns/agent-pitfalls.md \
  .code-review/README.md .code-review/rules/*.md \
  docs/superpowers/specs/2026-07-10-harness-engineering-foundation-design.md \
  docs/superpowers/plans/2026-07-10-harness-engineering-foundation.md
```

Expected: 全部 exit 0。

- [x] **Step 2: 运行代码质量验证**

Run:

```bash
pnpm check
pnpm build
(cd server && go test ./...)
```

Expected: 全部 exit 0；若存在与本轮无关的基线失败，记录原始错误和影响范围，不修改无关业务代码。

- [x] **Step 3: 更新临时产物状态**

将 spec 状态改为“已实施”，在 plan 中勾选实际完成步骤；没有真实执行的步骤不得勾选。

- [x] **Step 4: Karpathy 自检**

检查假设是否显式、实现是否保持无依赖和最小范围、每个改动是否能追溯到 spec、每项完成声明是否有对应验证证据。

## 计划自审

- Spec 六项目标分别由 Task 2 至 Task 5 覆盖，Task 6 提供统一证据。
- 计划没有新增第三方依赖、业务功能、产品接口或自动提交行为。
- Harness 脚本遵循 TDD：先创建并运行失败测试，再实现检查器。
- 配置与 Markdown 属于 TDD 例外，但均安排静态检查、编码检查和真实命令验证。
- 当前工作树仅有本任务新建 spec；实施过程不得回滚或整理其他来源改动。
