> [!HISTORICAL] 该计划已迁移为历史参考，不作为当前可执行计划

# Life Trace Calendar Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Life Trace plans calendar selectable and add reusable calendar/lunar logic to `@valley/calendar`.

**Architecture:** Add pure date utilities in `packages/calendar`, then wire `apps/life-trace` to consume them. Keep UI rendering in Life Trace and expose only stable logic from the shared package.

**Tech Stack:** TypeScript, React 19, Vite, Zustand store consumers, Vitest, pnpm workspace.

---

### Task 1: Calendar Package Utilities

**Files:**
- Create: `packages/calendar/src/lunar.ts`
- Modify: `packages/calendar/src/types.ts`
- Modify: `packages/calendar/src/utils.ts`
- Modify: `packages/calendar/src/index.ts`
- Test: `packages/calendar/src/utils.test.ts`
- Test: `packages/calendar/src/lunar.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for `formatDateKey`, `getCalendarWeekDays`, `parseDateKey`, and `getLunarDateInfo`.

- [ ] **Step 2: Implement date utilities**

Add stable date-key parsing, Monday week start, seven-day cell generation, and today/selected/current-month flags.

- [ ] **Step 3: Implement lunar utility**

Add a dependency-free 1900-2100 Chinese lunar conversion table and return concise month/day text.

- [ ] **Step 4: Export new utilities and types**

Export utilities from `packages/calendar/src/index.ts`.

- [ ] **Step 5: Verify package**

Run `pnpm --filter @valley/calendar test` and `pnpm --filter @valley/calendar typecheck`.

### Task 2: Life Trace Plans Page

**Files:**
- Modify: `apps/life-trace/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/life-trace/src/pages/PlansPage.tsx`

- [ ] **Step 1: Add workspace dependency**

Add `@valley/calendar: workspace:*` to Life Trace dependencies and refresh the lockfile.

- [ ] **Step 2: Replace local week logic**

Use `getCalendarWeekDays`, `formatDateKey`, and `getLunarDateInfo` from `@valley/calendar`.

- [ ] **Step 3: Add selection behavior**

Maintain `selectedDateKey` and `weekCursorKey`, add previous/next week and today controls, and pass `dateFrom/dateTo` for selected-day filters.

- [ ] **Step 4: Keep existing filters compatible**

Clear the selected date when switching to future; keep completed, search, type, reminder, weekend, and recurring filters working.

- [ ] **Step 5: Verify Life Trace**

Run `pnpm --filter @valley/life-trace exec tsc --noEmit`.

### Task 3: Product Plan Sync

**Files:**
- Modify: `apps/life-trace/docs/PLAN.md`

- [ ] **Step 1: Update current capability status**

Add that the plan page supports date selection and reuses `@valley/calendar`.

- [ ] **Step 2: Verify text encoding**

Run `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py` on changed Chinese files.

### Task 4: Final Verification

**Files:**
- Check: `git diff --stat`

- [ ] **Step 1: Run targeted verification**

Run calendar tests, calendar typecheck, Life Trace typecheck, and encoding checks.

- [ ] **Step 2: Review diff surgically**

Confirm changed lines trace to selectable plans calendar, calendar package utilities, dependency wiring, and plan sync.
