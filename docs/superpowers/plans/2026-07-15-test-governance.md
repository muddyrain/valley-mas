# Valley MAS 测试治理实施计划

**Goal:** 将项目测试目标落为可追溯的长期规则，避免新增无测试债，并规定历史无测试功能的风险驱动治理方式。

**Architecture:** `docs/TESTING_STRATEGY.md` 作为测试目标和取舍真源；根 `AGENTS.md` 提供任务入口；`docs/README.md` 提供长期索引。完整命令不复制，仍由 `docs/PROJECT_GUIDE.md` 维护。

## Task 1：建立长期测试策略

**Files:**
- Create: `docs/TESTING_STRATEGY.md`

- [x] 写明新改动的最低测试要求、UI 运行时证据边界、测试放置原则和可审计例外。
- [x] 采用“止血 + 风险清债”，明确不一次性补齐历史测试，也不允许未来功能持续新增测试债。
- [x] 明确前端 CI 和覆盖率阈值须在测试基线稳定后单独实施。

## Task 2：接入项目协作入口

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/README.md`

- [x] 在根协作规则中链接长期测试策略，要求每次行为改动评估测试并说明例外。
- [x] 在文档索引中登记测试策略。

## Task 3：验证与状态收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-test-governance-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-test-governance.md`

- [x] 运行 `pnpm check:harness`、Markdown 空白检查和编码检查。
- [x] 确认未覆盖或改写已有未知工作树改动。
