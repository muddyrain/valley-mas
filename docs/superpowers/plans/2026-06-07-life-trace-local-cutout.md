# Life Trace Local Cutout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-triggered local transparent background cutout flow for Pantry covers without using a cloud cutout service.

**Architecture:** Add a focused front-end cutout adapter that lazy-loads a browser ML dependency only when the user clicks “生成透明封面”. Reuse the existing image upload API and Pantry `thumbnailUrl` persistence; do not add backend routes or database fields.

**Tech Stack:** React, TypeScript, Vitest, browser canvas/blob APIs, `@huggingface/transformers` for the local background-removal technical validation.

---

### Task 1: Local Cutout Adapter

**Files:**
- Create: `apps/life-trace/src/lib/pantryCutout.ts`
- Test: `apps/life-trace/tests/pantryCutout.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests covering:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createPantryCutoutCoverFile,
  getPantryCutoutSupportReason,
  type PantryCutoutRunner,
} from '../src/lib/pantryCutout';

describe('pantry local cutout', () => {
  it('wraps the local cutout PNG blob into a timestamped file', async () => {
    vi.setSystemTime(new Date('2026-06-07T10:00:00Z'));
    const runner: PantryCutoutRunner = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
    const file = await createPantryCutoutCoverFile(new Blob(['jpg'], { type: 'image/jpeg' }), {
      runner,
    });
    expect(file.name).toBe('pantry-transparent-cover-1780826400000.png');
    expect(file.type).toBe('image/png');
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('rejects non-png cutout output', async () => {
    const runner: PantryCutoutRunner = async () => new Blob(['jpg'], { type: 'image/jpeg' });
    await expect(
      createPantryCutoutCoverFile(new Blob(['jpg'], { type: 'image/jpeg' }), { runner }),
    ).rejects.toThrow('透明封面生成失败');
  });

  it('reports unsupported browser primitives', () => {
    expect(getPantryCutoutSupportReason({ blob: false, file: true })).toBe('当前浏览器不支持本地抠图。');
    expect(getPantryCutoutSupportReason({ blob: true, file: false })).toBe('当前浏览器不支持保存透明封面。');
  });
});
```

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryCutout.test.ts`

Expected: FAIL because `src/lib/pantryCutout.ts` does not exist.

- [ ] **Step 3: Implement minimal adapter**

Implement exported types and functions:

```ts
export type PantryCutoutRunner = (input: Blob, options?: { signal?: AbortSignal }) => Promise<Blob>;
export function getPantryCutoutSupportReason(...): string;
export async function createPantryCutoutCoverFile(...): Promise<File>;
export async function runTransformersPantryCutout(...): Promise<Blob>;
```

`runTransformersPantryCutout` lazy-loads `@huggingface/transformers` and returns a PNG blob. Tests inject a runner, so unit tests do not download the model.

- [ ] **Step 4: Run test and confirm GREEN**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryCutout.test.ts`

Expected: PASS.

### Task 2: API Upload Helper For Transparent Covers

**Files:**
- Modify: `apps/life-trace/src/api/upload.ts`
- Test: `apps/life-trace/tests/pantryCutout.test.ts`

- [ ] **Step 1: Write failing test**

Add a test asserting transparent PNG files can reuse `uploadLifeTraceImage` without a new endpoint by passing a `File` whose type is `image/png`.

- [ ] **Step 2: Run test and confirm RED if helper changes are needed**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryCutout.test.ts`

Expected: FAIL only if current upload helper rejects PNG; otherwise mark this task as no-code after reading `upload.ts`.

- [ ] **Step 3: Implement only if required**

Keep the existing `/life-trace/uploads/image` endpoint. Do not add server routes.

### Task 3: Pantry Drawer Integration

**Files:**
- Modify: `apps/life-trace/src/components/PantryItemDrawer.tsx`
- Test: `apps/life-trace/tests/pantryDrawerLayout.test.ts`

- [ ] **Step 1: Write failing static test**

Assert the drawer imports the local cutout adapter, exposes a concise “透明封面” action, and keeps the existing “用实拍图” fallback.

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryDrawerLayout.test.ts`

Expected: FAIL because the drawer has no local cutout integration.

- [ ] **Step 3: Implement drawer flow**

Add state for cutout generation, fetch the current `imageUrl` as a blob, call `createPantryCutoutCoverFile`, upload with `uploadLifeTraceImage`, and write the uploaded URL to `thumbnailUrl`. Keep errors local to the thumbnail section.

- [ ] **Step 4: Run test and confirm GREEN**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryDrawerLayout.test.ts`

Expected: PASS.

### Task 4: Photo Analysis Page Integration

**Files:**
- Modify: `apps/life-trace/src/pages/PhotoItemAnalysisPage.tsx`
- Test: `apps/life-trace/tests/pantryDrawerLayout.test.ts`

- [ ] **Step 1: Write failing static test**

Assert the photo page imports the local cutout adapter and includes a transparent cover mode/action near the existing cover mode selector.

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryDrawerLayout.test.ts`

Expected: FAIL because the page has no transparent cover action.

- [ ] **Step 3: Implement photo page flow**

Add a user-triggered transparent cover action using the current `imageFile` when available. Store the uploaded transparent PNG URL in component state and use it as `thumbnailUrl` only when the user keeps that cover choice.

- [ ] **Step 4: Run test and confirm GREEN**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryDrawerLayout.test.ts`

Expected: PASS.

### Task 5: Plan Sync And Verification

**Files:**
- Modify: `apps/life-trace/docs/PLAN.md`

- [ ] **Step 1: Update plan state**

Change the transparent cutout item from “技术验证方向已确认” to “本地透明抠图首版已落地” only after Tasks 1-4 pass.

- [ ] **Step 2: Run validation**

Run:

```bash
pnpm --filter @valley/life-trace exec vitest run tests/pantryCutout.test.ts tests/pantryDrawerLayout.test.ts
pnpm --filter @valley/life-trace exec tsc --noEmit
python .agents/skills/encoding-guard/scripts/check_mojibake.py apps/life-trace/docs/PLAN.md docs/superpowers/specs/2026-06-07-life-trace-local-cutout-design.md docs/superpowers/plans/2026-06-07-life-trace-local-cutout.md
```

Expected: all pass.
