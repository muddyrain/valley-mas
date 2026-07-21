> [!HISTORICAL] 该计划已迁移为历史参考，不作为当前可执行计划

# Pantry 保质期合理性校验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Pantry 编辑抽屉与拍照入库页里,基于本地规则库判断「保质期是否超出常识范围」(例如鲜奶保质期 365 天),在过期日期字段下方显示黄色软提示,允许用户继续保存。

**Architecture:**
- 纯前端规则库:`lib/pantry.ts` 内置「品类/关键词 → 合理保质期范围」表 + `validatePantryShelfLife` 校验函数,无副作用,无网络调用。
- 组件改造:`PantryExpiryDateField` 接受可选 `warning?: { message: string } | null` prop,在「过期日期」下方渲染黄色 (`life-health`) 警告卡;`PantryItemDrawer` 与 `PhotoItemAnalysisPage` 通过 `useMemo` 计算 warning 并传入,共用同一套 UI。
- 哲学:软提示,不阻塞保存;最终决策权在用户手里(沿用上一轮 AI 字段补全的「AI 建议 + 人工最后决策」)。

**Tech Stack:** TypeScript / React 19 / Tailwind 4 (`life-health` token) / Vitest / lucide-react `AlertTriangle`。

---

## File Structure

| 路径 | 责任 | 改动类型 |
|---|---|---|
| `apps/life-trace/src/lib/pantry.ts` | 新增规则库常量 + `validatePantryShelfLife` 纯函数 | Modify |
| `apps/life-trace/tests/pantryShelfLifeValidation.test.ts` | 校验函数单元测试(关键词命中、品类兜底、边界、缺字段) | Create |
| `apps/life-trace/src/components/PantryExpiryDateField.tsx` | 新增可选 `warning` prop + 黄色提示卡渲染 | Modify |
| `apps/life-trace/src/components/PantryItemDrawer.tsx` | `useMemo` 计算 warning 并传入 `PantryExpiryDateField` | Modify |
| `apps/life-trace/src/pages/PhotoItemAnalysisPage.tsx` | 同上 | Modify |
| `apps/life-trace/docs/PLAN.md` | 在「已稳定接入」追加一条「库存保质期合理性提示」 | Modify |

---

## Task 1:写规则库与校验函数的失败测试

**Files:**
- Create: `apps/life-trace/tests/pantryShelfLifeValidation.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, expect, it } from 'vitest';
import { validatePantryShelfLife } from '../src/lib/pantry';

const today = new Date('2026-06-30T00:00:00');

describe('validatePantryShelfLife', () => {
  it('鲜奶保质期超过 30 天应返回 warning', () => {
    const result = validatePantryShelfLife({
      name: '鲜奶 1L',
      category: '食品',
      expiresAt: '2027-06-30',
      now: today,
    });
    expect(result?.severity).toBe('warning');
    expect(result?.message).toContain('鲜奶');
  });

  it('鲜奶保质期 14 天应通过校验', () => {
    const result = validatePantryShelfLife({
      name: '鲜奶 1L',
      category: '食品',
      expiresAt: '2026-07-14',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('未填名称时不校验', () => {
    const result = validatePantryShelfLife({
      name: '',
      category: '食品',
      expiresAt: '2030-06-30',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('未填过期日期时不校验', () => {
    const result = validatePantryShelfLife({
      name: '鲜奶',
      category: '食品',
      expiresAt: '',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('已过期物品不再提示合理性', () => {
    const result = validatePantryShelfLife({
      name: '鲜奶',
      category: '食品',
      expiresAt: '2026-06-01',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('酸奶 60 天应 warning(酸奶上限 45 天)', () => {
    const result = validatePantryShelfLife({
      name: '原味酸奶',
      category: '食品',
      expiresAt: '2026-08-29',
      now: today,
    });
    expect(result?.severity).toBe('warning');
  });

  it('面包 365 天应 warning', () => {
    const result = validatePantryShelfLife({
      name: '全麦面包',
      category: '食品',
      expiresAt: '2027-06-30',
      now: today,
    });
    expect(result?.severity).toBe('warning');
  });

  it('鸡蛋 7 天应通过', () => {
    const result = validatePantryShelfLife({
      name: '土鸡蛋',
      category: '食品',
      expiresAt: '2026-07-07',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('未匹配关键词时按品类兜底:食品超过 730 天应 warning', () => {
    const result = validatePantryShelfLife({
      name: '某种零食',
      category: '食品',
      expiresAt: '2030-06-30',
      now: today,
    });
    expect(result?.severity).toBe('warning');
  });

  it('未匹配关键词且品类为日用品,2 年内 OK', () => {
    const result = validatePantryShelfLife({
      name: '抽纸',
      category: '日用品',
      expiresAt: '2028-06-30',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('药品 5 年应 warning(药品上限 3 年)', () => {
    const result = validatePantryShelfLife({
      name: '感冒灵',
      category: '药品',
      expiresAt: '2031-06-30',
      now: today,
    });
    expect(result?.severity).toBe('warning');
  });
});
```

- [ ] **Step 2: 运行测试确认全部 fail**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryShelfLifeValidation.test.ts`
Expected: 全部 FAIL,因为 `validatePantryShelfLife` 尚未导出。

---

## Task 2:在 lib/pantry.ts 实现规则库与校验函数

**Files:**
- Modify: `apps/life-trace/src/lib/pantry.ts`(在文件末尾追加)

- [ ] **Step 1: 在 lib/pantry.ts 末尾新增规则库与函数**

```typescript
type PantryShelfLifeRule = {
  keywords: string[];
  category?: PantryCategory;
  maxDays: number;
  label: string;
};

const pantryShelfLifeRules: PantryShelfLifeRule[] = [
  { keywords: ['鲜奶', '低温奶', '巴氏奶'], category: '食品', maxDays: 30, label: '鲜奶' },
  { keywords: ['酸奶', '老酸奶'], category: '食品', maxDays: 45, label: '酸奶' },
  { keywords: ['鸡蛋', '鸭蛋', '鹅蛋'], category: '食品', maxDays: 60, label: '鲜蛋' },
  { keywords: ['豆腐', '豆浆'], category: '食品', maxDays: 14, label: '豆制品' },
  { keywords: ['面包', '吐司', '蛋糕'], category: '食品', maxDays: 30, label: '烘焙食品' },
  { keywords: ['卤味', '熟食', '凉拌'], category: '食品', maxDays: 7, label: '熟食/卤味' },
  { keywords: ['鲜肉', '冷鲜肉'], category: '食品', maxDays: 7, label: '冷鲜肉' },
  { keywords: ['冷冻肉', '速冻'], category: '食品', maxDays: 365, label: '冷冻食品' },
  { keywords: ['绿叶菜', '青菜', '生菜', '菠菜'], category: '食品', maxDays: 14, label: '叶菜' },
  { keywords: ['草莓', '蓝莓', '樱桃'], category: '食品', maxDays: 14, label: '浆果' },
];

const pantryCategoryFallbackMaxDays: Record<PantryCategory, number> = {
  食品: 730,
  日用品: 1825,
  药品: 1095,
  宠物: 1095,
  其他: 1825,
};

export type PantryShelfLifeWarning = {
  severity: 'warning';
  message: string;
};

export function validatePantryShelfLife(input: {
  name: string;
  category: PantryCategory;
  expiresAt: string;
  now?: Date;
}): PantryShelfLifeWarning | null {
  const trimmedName = input.name?.trim();
  if (!trimmedName) {
    return null;
  }
  const expiry = parsePantryDate(input.expiresAt);
  if (!expiry) {
    return null;
  }
  const now = input.now ?? new Date();
  const today = startOfDay(now);
  const days = Math.round((expiry.getTime() - today.getTime()) / DAY_IN_MS);
  if (days <= 0) {
    return null;
  }

  const matchedRule = pantryShelfLifeRules.find(
    (rule) =>
      (!rule.category || rule.category === input.category) &&
      rule.keywords.some((keyword) => trimmedName.includes(keyword)),
  );

  if (matchedRule) {
    if (days <= matchedRule.maxDays) {
      return null;
    }
    return {
      severity: 'warning',
      message: `${matchedRule.label}通常保质期不超过 ${matchedRule.maxDays} 天,当前填写为 ${days} 天,请确认日期是否正确。`,
    };
  }

  const fallbackMax = pantryCategoryFallbackMaxDays[input.category];
  if (days <= fallbackMax) {
    return null;
  }
  return {
    severity: 'warning',
    message: `${input.category}类商品保质期通常不超过 ${fallbackMax} 天,当前填写为 ${days} 天,请确认日期是否正确。`,
  };
}
```

- [ ] **Step 2: 运行测试确认全部 PASS**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryShelfLifeValidation.test.ts`
Expected: 11 passed。

- [ ] **Step 3: 提交**

```bash
git add apps/life-trace/src/lib/pantry.ts apps/life-trace/tests/pantryShelfLifeValidation.test.ts
git commit -m "feat(life-trace): 新增库存保质期合理性校验"
```

---

## Task 3:`PantryExpiryDateField` 接受 warning prop 并渲染黄色提示卡

**Files:**
- Modify: `apps/life-trace/src/components/PantryExpiryDateField.tsx`

- [ ] **Step 1: 扩展 props 类型**

把 `PantryExpiryDateFieldProps` 改为:

```typescript
type PantryExpiryDateFieldProps = {
  idPrefix: string;
  expiresAt: string;
  disabled?: boolean;
  initialBaseDate?: string;
  className?: string;
  warning?: { message: string } | null;
  onBaseDateChange?: (value: string) => void;
  onExpiresAtChange: (value: string) => void;
};
```

并在函数签名解构里加上 `warning`。

- [ ] **Step 2: 在组件最末(`{!baseDate ? ... : null}` 之后)追加 warning 卡**

```tsx
{warning ? (
  <div className="flex items-start gap-2 rounded-2xl border border-life-health/40 bg-life-health/10 p-3 text-xs leading-5 text-life-health">
    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
    <p className="min-w-0 break-words">{warning.message}</p>
  </div>
) : null}
```

并在文件顶部的 `lucide-react` 导入里追加 `AlertTriangle`:

```typescript
import { AlertTriangle, Calendar, X } from 'lucide-react';
```

---

## Task 4:`PantryItemDrawer` 计算并传入 warning

**Files:**
- Modify: `apps/life-trace/src/components/PantryItemDrawer.tsx`

- [ ] **Step 1: import**

把第 30 行附近 `lib/pantry` 的 import 追加 `validatePantryShelfLife`:

```typescript
import {
  applyPantryAiFieldSuggestions,
  buildPantryAiFieldDiff,
  formatPantryReminderSummary,
  getPantryPersistedStatus,
  validatePantryShelfLife,
  type PantryAiFieldKey,
  type PantryAiFieldSuggestion,
} from '@/lib/pantry';
```

- [ ] **Step 2: 在 `reminderSummary` useMemo 之后追加 warning 计算**

```typescript
const shelfLifeWarning = useMemo(
  () =>
    validatePantryShelfLife({
      name: form.name,
      category: form.category,
      expiresAt: form.expiresAt,
    }),
  [form.name, form.category, form.expiresAt],
);
```

- [ ] **Step 3: 把 warning 传给 `PantryExpiryDateField`**

找到 `PantryItemDrawer` 里 `<PantryExpiryDateField ... />` 的渲染处(参考 PhotoItemAnalysisPage 写法),在已有 props 之外追加:

```tsx
warning={shelfLifeWarning}
```

---

## Task 5:`PhotoItemAnalysisPage` 同步接入

**Files:**
- Modify: `apps/life-trace/src/pages/PhotoItemAnalysisPage.tsx`

- [ ] **Step 1: 追加 import**

在已有 `from '@/lib/pantry'` 的 import 上(若无,新增一条;若有,合并)追加 `validatePantryShelfLife`。

- [ ] **Step 2: 在 `<PantryExpiryDateField>` 渲染前用 `useMemo` 计算 warning**

```typescript
const shelfLifeWarning = useMemo(
  () =>
    validatePantryShelfLife({
      name: form.name,
      category: form.category,
      expiresAt: form.expiresAt,
    }),
  [form.name, form.category, form.expiresAt],
);
```

- [ ] **Step 3: 把 `warning={shelfLifeWarning}` 传入 `<PantryExpiryDateField>`**

---

## Task 6:全量校验 + 文档同步 + 提交

- [ ] **Step 1: TypeScript 类型检查**

Run: `pnpm --filter @valley/life-trace exec tsc --noEmit`
Expected: 0 errors。

- [ ] **Step 2: 运行单元测试**

Run: `pnpm --filter @valley/life-trace exec vitest run tests/pantryShelfLifeValidation.test.ts`
Expected: 11 passed。

- [ ] **Step 3: encoding-guard**

Run:
```bash
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
  apps/life-trace/src/lib/pantry.ts \
  apps/life-trace/tests/pantryShelfLifeValidation.test.ts \
  apps/life-trace/src/components/PantryExpiryDateField.tsx \
  apps/life-trace/src/components/PantryItemDrawer.tsx \
  apps/life-trace/src/pages/PhotoItemAnalysisPage.tsx \
  apps/life-trace/docs/PLAN.md
```
Expected: 无 mojibake。

- [ ] **Step 4: biome 检查(若改动有 lint warning 才需要)**

Run: `pnpm --filter @valley/life-trace check`
Expected: 通过或保持原有 lint 噪声基线。

- [ ] **Step 5: 更新 `apps/life-trace/docs/PLAN.md`**

在「已稳定接入」列表(73 行附近)合适位置追加一条:

```
- 库存保质期合理性提示:基于本地规则库识别鲜奶、酸奶、鸡蛋、豆制品、面包、熟食、冷鲜肉、冷冻肉、叶菜、浆果等关键词与品类兜底,过期日期超出合理范围时在抽屉内显示黄色软提示,不阻断保存。
```

- [ ] **Step 6: 提交**

```bash
git add apps/life-trace/src/components/PantryExpiryDateField.tsx \
        apps/life-trace/src/components/PantryItemDrawer.tsx \
        apps/life-trace/src/pages/PhotoItemAnalysisPage.tsx \
        apps/life-trace/docs/PLAN.md
git commit -m "feat(life-trace): 库存保质期填写显示合理性提示"
```

---

## Self-Review Notes

- **规则库覆盖度**:鲜奶(30 天)、酸奶(45 天)、鸡蛋(60 天)、豆制品(14 天)、烘焙(30 天)、熟食/冷鲜肉(7 天)、冷冻(365 天)、叶菜/浆果(14 天)、品类兜底(食品 730、药品 1095、日用品/其他 1825、宠物 1095)。鲜奶 6 个月(180 天) → 鲜奶规则 maxDays=30,180 > 30,触发 warning。符合用户原话"鲜奶超过 6 个月给黄色警告"。
- **测试 vs 用户原例核对**:用户说的"鲜奶超过 6 个月"对应 `2026-06-30 → 2027-01-01` 约 185 天 > 30,鲜奶规则会触发,与测试用例「鲜奶 365 天 warning」一致。
- **Tailwind token**:`life-health` 已在项目里(参考 `PantryExpiryDateField` 第 165 行 `border-life-health/35 bg-life-health/10 text-life-health`),无需新增 token。
- **不重复:已过期物品**:`days <= 0` 直接返回 null。已过期由 Pantry 状态体系单独处理,这里不重复提示。
- **关键词命中边界**:`includes` 子串匹配,「冷冻肉饼」会命中「冷冻肉」(maxDays=365)而非「鲜肉」,因为 keywords 数组按规则组定义,"冷冻肉"在前。规则数组顺序需保持「冷鲜肉」「鲜肉」在「冷冻肉」前的话会有歧义 — 实测「冷冻肉」字符串不包含「鲜肉」,「冷鲜肉」字符串不包含「冷冻肉」,互不串扰,放心。
- **类型安全**:`validatePantryShelfLife` 入参全部已存在的字段类型(`PantryCategory`, `string`),无新增类型。

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-30-pantry-shelf-life-validation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
