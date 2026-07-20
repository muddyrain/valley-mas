# Desktop OS Motion Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/desktop-os` 内 React 进出场 / layout 动画统一接入 `motion/react`,通过 4 个 Phase 递进迁移,确保每个 Phase 独立可 commit / 可 revert,不动 rAF 拖拽路径与装饰类 CSS keyframes。

**Architecture:** 新增 `src/ui/PlushMotion.tsx` 沉淀 4 个原语(`PlushPresence` / `PlushPop` / `PlushFade` / `PlushSlide`)+ `MOTION_TOKENS`,后续 Phase 只调用原语不直接 `import 'motion/react'`。reduced-motion 兜底由 motion 的 `useReducedMotion()` 单一来源处理,被迁组件配套 CSS 的同名 `@media (prefers-reduced-motion: reduce)` 分支同步删除。

**Tech Stack:** React 19、`motion@12.40.0`(`motion/react`)、Vite 6、TypeScript、vitest + @testing-library/react、Tailwind 4、zustand。

**Spec:** [docs/specs/2026-06-23-desktop-os-motion-migration-design.md](file:///Users/bytedance/Desktop/study/valley-mas/docs/specs/2026-06-23-desktop-os-motion-migration-design.md)

---

## File Structure

| 状态 | 路径 | 责任 |
|---|---|---|
| 新增 | `apps/desktop-os/src/ui/PlushMotion.tsx` | 4 motion 原语 + `MOTION_TOKENS` 常量,所有进出场动画唯一入口 |
| 新增 | `apps/desktop-os/tests/plushMotion.test.tsx` | P1 surface 单测 |
| 新增 | `apps/desktop-os/tests/windowPresence.test.tsx` | P2 Window 进出场单测 |
| 新增 | `apps/desktop-os/tests/spotlightPresence.test.tsx` | P2 Spotlight 单测 |
| 新增 | `apps/desktop-os/tests/dockMenuPresence.test.tsx` | P2 Dock 菜单单测 |
| 新增 | `apps/desktop-os/tests/panelSlide.test.tsx` | P3 ControlCenter / NotificationCenter 单测 |
| 新增 | `apps/desktop-os/tests/launchpadPresence.test.tsx` | P3 Launchpad 单测 |
| 新增 | `apps/desktop-os/tests/aiCommandPresence.test.tsx` | P4 AICommandCenter 单测 |
| 修改 | `apps/desktop-os/src/components/window/Window.tsx` | P2:删 `CLOSE_ANIM_MS=220` + setTimeout,改用 `PlushPop` |
| 修改 | `apps/desktop-os/src/components/window/Window.css` | P2:删 `@keyframes window-pop` + `is-closing` 相关 transition |
| 修改 | `apps/desktop-os/src/components/window/WindowManager.tsx` | P2:外层包 `PlushPresence` |
| 修改 | `apps/desktop-os/src/spotlight/Spotlight.tsx` | P2:换 `PlushPop` |
| 修改 | `apps/desktop-os/src/spotlight/Spotlight.css` | P2:删 `@keyframes spotlight-fade` / `spotlight-pop` + reduced-motion 分支 |
| 修改 | `apps/desktop-os/src/components/Dock.tsx` | P2:菜单 / 子菜单换 `PlushPop`(magnification rAF 不动) |
| 修改 | `apps/desktop-os/src/components/Dock.css` | P2:删 `@keyframes dock-menu-pop` / `dock-submenu-pop` + reduced-motion 分支 |
| 修改 | `apps/desktop-os/src/components/ControlCenter.tsx` | P3:换 `PlushSlide from="top"` |
| 修改 | `apps/desktop-os/src/components/ControlCenter.css` | P3:删 `@keyframes cc-pop` |
| 修改 | `apps/desktop-os/src/components/NotificationCenter.tsx` | P3:面板 `PlushSlide from="right"` + 单条 `PlushFade` |
| 修改 | `apps/desktop-os/src/components/NotificationCenter.css` | P3:删 `@keyframes nc-pop`(`widget-music-spin` 保留) |
| 修改 | `apps/desktop-os/src/components/Launchpad.tsx` | P3:删 `CLOSE_ANIMATION_MS=260` 路径,换 `PlushPresence`/`PlushPop`;P4:翻页换 `motion.div layout` |
| 修改 | `apps/desktop-os/src/apps/AICommandCenterWindow.tsx` | P4:消息流外层 `PlushPresence`,每条 `PlushFade`;`matchMedia` 改名为 `prefersReducedAutoScroll` |
| 修改 | `apps/desktop-os/src/apps/AICommandCenterWindow.css` | P4:删 5 处 `@keyframes ai-command-*-in` |
| 修改 | `apps/desktop-os/AGENTS.md` | P1 完成时:补「设计系统约束」一行 |
| 修改 | `apps/desktop-os/docs/PLAN.md` | P1 完成时:立条「动画统一迁移到 motion」 |

---

## Phase 1 · 基础设施(PlushMotion 原语 + 单测)

### Task 1.1: 新建 `PlushMotion.tsx` 原语 + tokens(TDD 红)

**Files:**
- Create: `apps/desktop-os/tests/plushMotion.test.tsx`

- [ ] **Step 1:** 先写失败测试

```tsx
// apps/desktop-os/tests/plushMotion.test.tsx
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlushFade, PlushPop, PlushPresence, PlushSlide } from '../src/ui/PlushMotion';

const reducedMotionMock = vi.hoisted(() => ({ value: false }));

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => reducedMotionMock.value,
  };
});

afterEach(() => {
  reducedMotionMock.value = false;
});

describe('PlushMotion 原语', () => {
  it('PlushPresence 透传 data-motion-presence 属性,mount 时渲染子节点', () => {
    const { getByTestId } = render(
      <PlushPresence>
        <PlushPop key="a" open data-testid="child">hello</PlushPop>
      </PlushPresence>,
    );
    expect(getByTestId('child').getAttribute('data-state')).toBe('enter');
  });

  it('PlushPop open=false 时 data-state 进入 exit', () => {
    const { rerender, queryByTestId } = render(
      <PlushPresence>
        <PlushPop key="a" open data-testid="child">hello</PlushPop>
      </PlushPresence>,
    );
    rerender(
      <PlushPresence>
        <PlushPop key="a" open={false} data-testid="child">hello</PlushPop>
      </PlushPresence>,
    );
    const node = queryByTestId('child');
    if (node) expect(node.getAttribute('data-state')).toBe('exit');
  });

  it('reducedMotion=true 时 PlushFade transition.duration 为 0', () => {
    reducedMotionMock.value = true;
    const { container } = render(
      <PlushFade open>
        <span>x</span>
      </PlushFade>,
    );
    const node = container.firstElementChild as HTMLElement;
    expect(node.dataset.motionDuration).toBe('0');
  });

  it('PlushSlide 透传 from 方向到 data-from 属性', () => {
    const { container } = render(
      <PlushSlide open from="right">
        <span>x</span>
      </PlushSlide>,
    );
    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute('data-from')).toBe('right');
  });
});
```

- [ ] **Step 2:** 跑测试确认 FAIL

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/plushMotion.test.tsx`
Expected: FAIL,提示 `Cannot find module '../src/ui/PlushMotion'`。

- [ ] **Step 3:** 创建 `apps/desktop-os/src/ui/PlushMotion.tsx`

```tsx
// apps/desktop-os/src/ui/PlushMotion.tsx
import { AnimatePresence, motion, type Transition, useReducedMotion } from 'motion/react';
import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';

export const MOTION_TOKENS = {
  pop: {
    type: 'spring' as const,
    stiffness: 320,
    damping: 26,
    mass: 0.9,
  } satisfies Transition,
  fade: {
    type: 'tween' as const,
    duration: 0.18,
    ease: [0.32, 0.08, 0.24, 1] as [number, number, number, number],
  } satisfies Transition,
  slide: {
    type: 'spring' as const,
    stiffness: 280,
    damping: 30,
    mass: 0.85,
  } satisfies Transition,
};

interface PresenceProps {
  children: ReactNode;
  mode?: 'sync' | 'wait' | 'popLayout';
}

export function PlushPresence({ children, mode = 'popLayout' }: PresenceProps) {
  return (
    <AnimatePresence mode={mode} initial={false}>
      {children}
    </AnimatePresence>
  );
}

interface BaseProps extends PropsWithChildren {
  open?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

export function PlushPop({ open = true, children, className, style, ...rest }: BaseProps) {
  const reduced = useReducedMotion();
  if (!open && reduced) return null;
  const duration = reduced ? 0 : undefined;
  return (
    <motion.div
      data-state={open ? 'enter' : 'exit'}
      data-motion-presence="pop"
      data-motion-duration={duration ?? ''}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
      transition={reduced ? { duration: 0 } : MOTION_TOKENS.pop}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function PlushFade({ open = true, children, className, style, ...rest }: BaseProps) {
  const reduced = useReducedMotion();
  const duration = reduced ? 0 : 0.18;
  return (
    <motion.div
      data-state={open ? 'enter' : 'exit'}
      data-motion-presence="fade"
      data-motion-duration={String(duration)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? { duration: 0 } : MOTION_TOKENS.fade}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type SlideFrom = 'top' | 'right' | 'bottom' | 'left';
interface SlideProps extends BaseProps {
  from: SlideFrom;
}

const SLIDE_OFFSET: Record<SlideFrom, { x: number; y: number }> = {
  top: { x: 0, y: -16 },
  right: { x: 16, y: 0 },
  bottom: { x: 0, y: 16 },
  left: { x: -16, y: 0 },
};

export function PlushSlide({ open = true, from, children, className, style, ...rest }: SlideProps) {
  const reduced = useReducedMotion();
  const offset = SLIDE_OFFSET[from];
  const duration = reduced ? 0 : undefined;
  return (
    <motion.div
      data-state={open ? 'enter' : 'exit'}
      data-motion-presence="slide"
      data-from={from}
      data-motion-duration={duration ?? ''}
      initial={reduced ? { opacity: 0 } : { opacity: 0, ...offset }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, ...offset }}
      transition={reduced ? { duration: 0 } : MOTION_TOKENS.slide}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4:** 跑测试确认 PASS

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/plushMotion.test.tsx`
Expected: 4 passing。

- [ ] **Step 5:** 跑全量校验

Run:
```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
```
Expected: 全绿,89 + 4 = 93 用例通过(若现有用例数有变,以基线数 + 4 为准)。

- [ ] **Step 6:** 跑 build 记录基线

Run: `pnpm --filter @valley/desktop-os build`
Expected: build 成功;把 `dist/` 体积(`du -sh apps/desktop-os/dist`)写入 [本 plan](file:///Users/bytedance/Desktop/study/valley-mas/docs/plans/2026-06-23-desktop-os-motion-migration.md) 末尾「实施后记 · P1 体积基线」。

- [ ] **Step 7:** 跑 mojibake 检查

Run: `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/src/ui/PlushMotion.tsx apps/desktop-os/tests/plushMotion.test.tsx`
Expected: PASS。

- [ ] **Step 8:** Commit

```bash
git add apps/desktop-os/src/ui/PlushMotion.tsx apps/desktop-os/tests/plushMotion.test.tsx
git commit -m "feat(desktop-os): motion P1 - PlushMotion primitives"
```

### Task 1.2: 同步 AGENTS.md 与 PLAN.md

**Files:**
- Modify: `apps/desktop-os/AGENTS.md`
- Modify: `apps/desktop-os/docs/PLAN.md`

- [ ] **Step 1:** 在 [apps/desktop-os/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/AGENTS.md) 「设计系统约束」段落末尾追加一条:

```markdown
- 进出场 / layout 动画统一通过 `PlushMotion`(`PlushPresence` / `PlushPop` / `PlushFade` / `PlushSlide`)接入,业务组件不直接 `import 'motion/react'`。装饰类 `@keyframes`(loading / shimmer / spin / cloud-drift / 控件 pop)与 rAF 拖拽缩放路径不在 motion 治理范围内。
```

- [ ] **Step 2:** 在 [apps/desktop-os/docs/PLAN.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/docs/PLAN.md) 立条「动画统一迁移到 motion」(只记长期能力状态,不抄具体 task):

```markdown
## 动画统一迁移到 motion

- 目标:`apps/desktop-os/src/**/*.tsx` 内 React 进出场 / layout 动画统一通过 `PlushMotion` 原语接入。
- 边界:rAF 直驱 transform(Window 拖动 / Dock magnification / ResizeHandles)与装饰类 `@keyframes` 不动。
- reduced-motion:被迁组件统一走 `useReducedMotion()`,同名 CSS `@media (prefers-reduced-motion: reduce)` 分支同步删除。
- Phase:P1 PlushMotion 原语 ✅ / P2 窗口层(Window / Spotlight / Dock 菜单)/ P3 面板层(ControlCenter / NotificationCenter / Launchpad)/ P4 业务列表(AICommandCenter / Launchpad 翻页)。
- 工作流档位：C 档，spec 与 plan 临时存放在 `docs/{specs,plans}/2026-06-23-desktop-os-motion-migration*.md`。
```

(注:Phase 进度条按完成情况更新 ✅。)

- [ ] **Step 3:** 跑 mojibake 检查

Run: `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/AGENTS.md apps/desktop-os/docs/PLAN.md`
Expected: PASS。

- [ ] **Step 4:** Commit

```bash
git add apps/desktop-os/AGENTS.md apps/desktop-os/docs/PLAN.md
git commit -m "docs(desktop-os): motion P1 - sync AGENTS / PLAN"
```

---

## Phase 2 · 窗口层(Window / Spotlight / Dock 菜单)

> **rAF 块只读不改**:[Window.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/window/Window.tsx) 的 `startDrag` / `flushMove` / `onMove` 块、[Dock.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/Dock.tsx) 的 magnification rAF 块、[ResizeHandles.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/ui/ResizeHandles.tsx) 的 resize rAF 块,本 Phase 一律不修改。

### Task 2.1: Window 关闭 / 最小化进出场(TDD 红)

**Files:**
- Create: `apps/desktop-os/tests/windowPresence.test.tsx`
- Modify: `apps/desktop-os/src/components/window/Window.tsx`
- Modify: `apps/desktop-os/src/components/window/WindowManager.tsx`(若不存在,改为修改 windowStore 列表渲染入口,见 Step 3)
- Modify: `apps/desktop-os/src/components/window/Window.css`

- [ ] **Step 1:** 先看 WindowManager 入口在哪

Run: `rg -n "WindowManager|<Window " apps/desktop-os/src --type tsx`
确认列表渲染入口位置(可能是 `WindowManager.tsx` 或直接在 [App.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/App.tsx) 内 map),记下文件 + 行号供 Step 4 使用。

- [ ] **Step 2:** 写失败测试

```tsx
// apps/desktop-os/tests/windowPresence.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWindowStore } from '../src/store/windowStore';

// 仅 surface 断言,不依赖具体 App 渲染结果
describe('Window AnimatePresence', () => {
  it('关闭窗口后 DOM 中残留 data-state="exit" 节点', () => {
    // 实际渲染入口若是 WindowManager,改为渲染 WindowManager;
    // 若是 App.tsx 直接渲染列表,以最小渲染窗口的子树替换。
    const { container, rerender } = render(<WindowList />);
    useWindowStore.getState().openApp('finder');
    rerender(<WindowList />);
    useWindowStore.getState().closeWindow(useWindowStore.getState().activeAppIds[0]);
    rerender(<WindowList />);
    expect(container.querySelector('[data-motion-presence="pop"][data-state="exit"]')).not.toBeNull();
  });
});

function WindowList() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Manager = require('../src/components/window/WindowManager').default;
  return <Manager />;
}
```

(若 WindowManager 不存在,把 `WindowList` 替换为直接渲染列表的最小入口。)

- [ ] **Step 3:** 跑测试确认 FAIL

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/windowPresence.test.tsx`
Expected: FAIL(关闭即卸载,无 exit 快照)。

- [ ] **Step 4:** 修改 WindowManager 外层包 `PlushPresence`

在 Step 1 找到的窗口列表 map 渲染处,把外层包一层:

```tsx
import { PlushPresence } from '../../ui/PlushMotion';

<PlushPresence>
  {windows.map((state) => (
    <Window key={state.id} state={state} appId={state.appId} />
  ))}
</PlushPresence>
```

- [ ] **Step 5:** 重写 [Window.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/window/Window.tsx) 的关闭逻辑

把第 15 行 `const CLOSE_ANIM_MS = 220;`、第 33–34 行的 `closingRef` / `isClosing` state、第 36–41 行的 `handleClose` 改成:

```tsx
// 删除 const CLOSE_ANIM_MS = 220
// 删除 closingRef + isClosing state
function handleClose() {
  closeWindow(state.id);
}
```

并在 return 的 root `<div>` 外层包 `PlushPop`:

```tsx
import { PlushPop } from '../../ui/PlushMotion';

return (
  <PlushPop open data-window-id={state.id}>
    <div className={cn('window', /* ... */)} /* ... */>
      {/* 原 Window 内容,删掉 is-closing className */}
    </div>
  </PlushPop>
);
```

(`is-minimized` className 如果在 store 控制就保留,只删 `is-closing`。)

- [ ] **Step 6:** 修改 [Window.css](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/window/Window.css)

删除以下区块:
- 第 12 行 `animation: window-pop 0.32s var(--ease-spring);`
- 第 27–36 行 `@keyframes window-pop { ... }`
- 第 54–58 行 `.window.is-closing { ... }`

(`is-minimized` 第 42–52 行保留,因为最小化是状态切换不是卸载,本 plan 暂不动。)

- [ ] **Step 7:** 跑测试确认 PASS

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/windowPresence.test.tsx`
Expected: PASS。

- [ ] **Step 8:** 跑全量校验

```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/src/components/window/Window.tsx apps/desktop-os/src/components/window/Window.css
```
Expected: 全绿,现有 89 + P1 4 + 本 task 1 = 94 用例(基线随项目而定)。

- [ ] **Step 9:** Commit

```bash
git add apps/desktop-os/src/components/window/ apps/desktop-os/tests/windowPresence.test.tsx
git commit -m "feat(desktop-os): motion P2 - window presence"
```

### Task 2.2: Spotlight 进出场

**Files:**
- Create: `apps/desktop-os/tests/spotlightPresence.test.tsx`
- Modify: `apps/desktop-os/src/spotlight/Spotlight.tsx`
- Modify: `apps/desktop-os/src/spotlight/Spotlight.css`

- [ ] **Step 1:** 写失败测试

```tsx
// apps/desktop-os/tests/spotlightPresence.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SpotlightGate from '../src/spotlight/Spotlight';
import { useSpotlightStore } from '../src/store/spotlightStore';

describe('Spotlight AnimatePresence', () => {
  it('open=false 时仍存在 exit 快照节点直到动画结束', () => {
    const { container, rerender } = render(<SpotlightGate />);
    useSpotlightStore.getState().open();
    rerender(<SpotlightGate />);
    useSpotlightStore.getState().close();
    rerender(<SpotlightGate />);
    expect(container.querySelector('[data-motion-presence="pop"][data-state="exit"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2:** 跑测试确认 FAIL

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/spotlightPresence.test.tsx`
Expected: FAIL。

- [ ] **Step 3:** 改 [Spotlight.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/spotlight/Spotlight.tsx)

把第 12–16 行 `SpotlightGate` 改为:

```tsx
import { PlushPop, PlushPresence } from '../ui/PlushMotion';

export default function SpotlightGate() {
  const isOpen = useSpotlightStore((s) => s.isOpen);
  return (
    <PlushPresence>
      {isOpen ? (
        <PlushPop key="spotlight" open>
          <SpotlightPanel />
        </PlushPop>
      ) : null}
    </PlushPresence>
  );
}
```

- [ ] **Step 4:** 改 [Spotlight.css](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/spotlight/Spotlight.css)

删除:
- `@keyframes spotlight-fade`(第 15 行附近)与对应 `animation` 引用。
- `@keyframes spotlight-pop`(第 41 行附近)与对应 `animation` 引用。
- 同名 `@media (prefers-reduced-motion: reduce)` 内对 `spotlight-fade` / `spotlight-pop` 的 `animation: none` 兜底分支。

(其他装饰样式如 `transition` 等保留。)

- [ ] **Step 5:** 跑测试确认 PASS

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/spotlightPresence.test.tsx`
Expected: PASS。

- [ ] **Step 6:** 跑全量校验

```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/src/spotlight/Spotlight.tsx apps/desktop-os/src/spotlight/Spotlight.css
```
Expected: 全绿。

- [ ] **Step 7:** Commit

```bash
git add apps/desktop-os/src/spotlight/ apps/desktop-os/tests/spotlightPresence.test.tsx
git commit -m "feat(desktop-os): motion P2 - spotlight presence"
```

### Task 2.3: Dock 应用菜单 / 子菜单进出场

**Files:**
- Create: `apps/desktop-os/tests/dockMenuPresence.test.tsx`
- Modify: `apps/desktop-os/src/components/Dock.tsx`(只动菜单 / 子菜单渲染部分,**magnification rAF 块不动**)
- Modify: `apps/desktop-os/src/components/Dock.css`

- [ ] **Step 1:** 在 [Dock.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/Dock.tsx) 内定位菜单渲染位置

Run: `rg -n "dock-menu|submenu|context-menu" apps/desktop-os/src/components/Dock.tsx`
记下菜单 / 子菜单条件渲染的行号区间。

- [ ] **Step 2:** 写失败测试

```tsx
// apps/desktop-os/tests/dockMenuPresence.test.tsx
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Dock from '../src/components/Dock';

describe('Dock 菜单 AnimatePresence', () => {
  it('右键 Dock 应用打开菜单后关闭,DOM 中保留 exit 快照', () => {
    const { container } = render(<Dock />);
    const firstApp = container.querySelector('[data-dock-app-id]') as HTMLElement | null;
    if (!firstApp) return;
    fireEvent.contextMenu(firstApp);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-motion-presence="pop"][data-state="exit"]')).not.toBeNull();
  });
});
```

(如 Dock 没有 `data-dock-app-id`,在 Step 3 改 Dock 时同步加。)

- [ ] **Step 3:** 跑测试确认 FAIL

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/dockMenuPresence.test.tsx`
Expected: FAIL。

- [ ] **Step 4:** 改 Dock.tsx

把菜单 / 子菜单的条件渲染包成:

```tsx
import { PlushPop, PlushPresence } from '../ui/PlushMotion';

<PlushPresence>
  {menuOpen ? (
    <PlushPop key="dock-menu" open>
      <div className="dock-menu">{/* 菜单内容 */}</div>
    </PlushPop>
  ) : null}
</PlushPresence>

<PlushPresence>
  {submenuOpen ? (
    <PlushPop key="dock-submenu" open>
      <div className="dock-submenu">{/* 子菜单内容 */}</div>
    </PlushPop>
  ) : null}
</PlushPresence>
```

并在 Dock 应用 `<button>` 加 `data-dock-app-id={app.id}`(若不存在)。

**magnification rAF 块**(`hoverFrameRef.current = window.requestAnimationFrame(...)` 附近)**不要改**。

- [ ] **Step 5:** 改 [Dock.css](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/Dock.css)

删除:
- `@keyframes dock-menu-pop`(第 267 行附近)。
- `@keyframes dock-submenu-pop`(第 279 行附近)。
- 对应 `animation: dock-menu-pop ...` / `animation: dock-submenu-pop ...` 的引用。
- `@media (prefers-reduced-motion: reduce)` 内对这两个 `animation: none` 的兜底分支。

**`@keyframes dock-bounce`(第 103 行附近)保留**(应用打开图标弹跳是装饰类)。

- [ ] **Step 6:** 跑测试确认 PASS

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/dockMenuPresence.test.tsx`
Expected: PASS。

- [ ] **Step 7:** 跑全量校验

```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/src/components/Dock.tsx apps/desktop-os/src/components/Dock.css
```
Expected: 全绿。

- [ ] **Step 8:** 人工验收(Phase 2 收尾)

按 spec § 4 Phase 2 「人工验收清单」逐条复核:5 个 App 开关、Spotlight ⌘空格、Dock 右键菜单 + 二级、系统设置开启「减少动画」复测。把异常写入 [本 plan](file:///Users/bytedance/Desktop/study/valley-mas/docs/plans/2026-06-23-desktop-os-motion-migration.md) 末尾「实施后记 · P2 人工验收记录」。

- [ ] **Step 9:** Commit

```bash
git add apps/desktop-os/src/components/Dock.tsx apps/desktop-os/src/components/Dock.css apps/desktop-os/tests/dockMenuPresence.test.tsx
git commit -m "feat(desktop-os): motion P2 - dock menu presence"
```

---

## Phase 3 · 面板层(ControlCenter / NotificationCenter / Launchpad)

### Task 3.1: ControlCenter 滑入

**Files:**
- Create: `apps/desktop-os/tests/panelSlide.test.tsx`(本 task 先写,Task 3.2 复用)
- Modify: `apps/desktop-os/src/components/ControlCenter.tsx`
- Modify: `apps/desktop-os/src/components/ControlCenter.css`

- [ ] **Step 1:** 写失败测试(覆盖 ControlCenter)

```tsx
// apps/desktop-os/tests/panelSlide.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ControlCenter from '../src/components/ControlCenter';
import NotificationCenter from '../src/components/NotificationCenter';
import { useControlCenterStore } from '../src/store/controlCenterStore';
import { useNotificationCenterStore } from '../src/store/notificationCenterStore';

describe('Panel slide AnimatePresence', () => {
  it('ControlCenter close 后保留 data-from="top" exit 快照', () => {
    const { container, rerender } = render(<ControlCenter />);
    useControlCenterStore.getState().open();
    rerender(<ControlCenter />);
    useControlCenterStore.getState().close();
    rerender(<ControlCenter />);
    expect(container.querySelector('[data-motion-presence="slide"][data-from="top"][data-state="exit"]')).not.toBeNull();
  });

  it('NotificationCenter close 后保留 data-from="right" exit 快照', () => {
    const { container, rerender } = render(<NotificationCenter />);
    useNotificationCenterStore.getState().open();
    rerender(<NotificationCenter />);
    useNotificationCenterStore.getState().close();
    rerender(<NotificationCenter />);
    expect(container.querySelector('[data-motion-presence="slide"][data-from="right"][data-state="exit"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2:** 跑测试确认 FAIL

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/panelSlide.test.tsx`
Expected: FAIL(两条都红)。

- [ ] **Step 3:** 改 [ControlCenter.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/ControlCenter.tsx)

把面板根渲染从「`isOpen` 条件直接渲染 + CSS 动画」改成 `PlushPresence + PlushSlide`:

```tsx
import { PlushPresence, PlushSlide } from '../ui/PlushMotion';

return (
  <PlushPresence>
    {isOpen ? (
      <PlushSlide key="control-center" open from="top" className="control-center">
        {/* 原面板内容 */}
      </PlushSlide>
    ) : null}
  </PlushPresence>
);
```

- [ ] **Step 4:** 改 [ControlCenter.css](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/ControlCenter.css)

删除:
- `@keyframes cc-pop`(第 23 行附近)。
- 对应 `.control-center { animation: cc-pop ...; }` 引用。
- `@media (prefers-reduced-motion: reduce)` 内对 `cc-pop` 的兜底分支。

- [ ] **Step 5:** 跑「ControlCenter」一条测试确认 PASS,NotificationCenter 那条仍 FAIL

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/panelSlide.test.tsx -t "ControlCenter"`
Expected: PASS。

- [ ] **Step 6:** Commit(NotificationCenter 留到 Task 3.2 一起)

```bash
git add apps/desktop-os/src/components/ControlCenter.tsx apps/desktop-os/src/components/ControlCenter.css apps/desktop-os/tests/panelSlide.test.tsx
git commit -m "feat(desktop-os): motion P3 - control center slide"
```

### Task 3.2: NotificationCenter 滑入 + 单条 Fade

**Files:**
- Modify: `apps/desktop-os/src/components/NotificationCenter.tsx`
- Modify: `apps/desktop-os/src/components/NotificationCenter.css`

- [ ] **Step 1:** 改 [NotificationCenter.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/NotificationCenter.tsx)

外层面板:

```tsx
import { PlushFade, PlushPresence, PlushSlide } from '../ui/PlushMotion';

return (
  <PlushPresence>
    {isOpen ? (
      <PlushSlide key="notification-center" open from="right" className="notification-center">
        {/* 通知列表 */}
        <PlushPresence>
          {notifications.map((n) => (
            <PlushFade key={n.id} open data-notification-id={n.id}>
              <NotificationCard notification={n} />
            </PlushFade>
          ))}
        </PlushPresence>
      </PlushSlide>
    ) : null}
  </PlushPresence>
);
```

- [ ] **Step 2:** 改 [NotificationCenter.css](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/NotificationCenter.css)

删除:
- `@keyframes nc-pop`(第 35 行附近)及对应 `animation:` 引用。
- 对应 reduced-motion 兜底分支。

**保留** `@keyframes widget-music-spin`(第 380 行附近)—— 装饰类。

- [ ] **Step 3:** 跑 panelSlide 测试两条都 PASS

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/panelSlide.test.tsx`
Expected: 2 passing。

- [ ] **Step 4:** 跑全量校验

```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/src/components/NotificationCenter.tsx apps/desktop-os/src/components/NotificationCenter.css
```
Expected: 全绿。

- [ ] **Step 5:** Commit

```bash
git add apps/desktop-os/src/components/NotificationCenter.tsx apps/desktop-os/src/components/NotificationCenter.css
git commit -m "feat(desktop-os): motion P3 - notification center slide & card fade"
```

### Task 3.3: Launchpad 顶层进出场切到 PlushPresence

**Files:**
- Create: `apps/desktop-os/tests/launchpadPresence.test.tsx`
- Modify: `apps/desktop-os/src/components/Launchpad.tsx`

- [ ] **Step 1:** 写失败测试

```tsx
// apps/desktop-os/tests/launchpadPresence.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Launchpad from '../src/components/Launchpad';
import { useLaunchpadStore } from '../src/store/launchpadStore';

describe('Launchpad AnimatePresence', () => {
  it('close 后立刻有 exit 快照(不再依赖 setTimeout 260ms)', () => {
    const { container, rerender } = render(<Launchpad />);
    useLaunchpadStore.getState().open();
    rerender(<Launchpad />);
    useLaunchpadStore.getState().close();
    rerender(<Launchpad />);
    expect(container.querySelector('[data-motion-presence="pop"][data-state="exit"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2:** 跑测试确认 FAIL

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/launchpadPresence.test.tsx`
Expected: FAIL。

- [ ] **Step 3:** 改 [Launchpad.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/Launchpad.tsx)

**第一步先把现有 motion 用法迁到 PlushMotion**(R7 缓解):
- 第 2 行 `import { AnimatePresence, motion, useReducedMotion } from 'motion/react';` 改为 `import { PlushPop, PlushPresence } from '../ui/PlushMotion';`。
- LaunchpadPanel 内对 `motion` / `AnimatePresence` / `useReducedMotion` 的现有引用,凡是用于「整体面板进出场」的全部换成 `PlushPop`(整页)+ `PlushPresence`(外层)。
- **翻页内部位移留到 P4 处理**,本 task 内任何「翻页 motion.div」用法暂时降级为 plain `<div>` + CSS class,P4 再用 `motion.div layout` 接回(详见 Task 4.2)。
- `useReducedMotion()` 直接调用的位置改成在子组件内调,`PlushPop` / `PlushFade` / `PlushSlide` 内部已自带,不重复。

**第二步删 setTimeout 260ms 路径**:
- 删第 14 行 `const CLOSE_ANIMATION_MS = 260;`。
- 删第 28–29 行 `shouldRender` / `isClosing` state。
- 删第 31–45 行 `useEffect`(管理 shouldRender / setTimeout)。
- 第 26–50 行 `Launchpad` 顶层组件改为:

```tsx
export default function Launchpad() {
  const isOpen = useLaunchpadStore((s) => s.isOpen);
  return (
    <PlushPresence>
      {isOpen ? (
        <PlushPop key="launchpad" open>
          <LaunchpadPanel isOpen={isOpen} />
        </PlushPop>
      ) : null}
    </PlushPresence>
  );
}

interface LaunchpadPanelProps {
  isOpen: boolean;
}

function LaunchpadPanel({ isOpen }: LaunchpadPanelProps) {
  // 删除 isClosing 参数,内部所有 isClosing 引用一并清理
  // ...
}
```

- 把 `LaunchpadPanel` 内对 `isClosing` 的所有引用清掉(`AnimatePresence` 已接管 exit 时机,不再需要业务侧判断)。

- [ ] **Step 4:** 跑测试确认 PASS

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/launchpadPresence.test.tsx`
Expected: PASS。

- [ ] **Step 5:** 跑全量校验

```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/src/components/Launchpad.tsx
```
Expected: 全绿。

- [ ] **Step 6:** 人工验收(Phase 3 收尾)

按 spec § 4 Phase 3 「人工验收清单」逐条复核:控制中心 / 通知中心反复开关 5 次、通知快速来 3 条再快速消 3 条、Launchpad 打开 / 关闭 / 翻页(翻页此时是 plain div,无动画属正常,P4 再补)。

- [ ] **Step 7:** Commit

```bash
git add apps/desktop-os/src/components/Launchpad.tsx apps/desktop-os/tests/launchpadPresence.test.tsx
git commit -m "feat(desktop-os): motion P3 - launchpad presence"
```

---

## Phase 4 · 业务列表(AICommandCenter / Launchpad 翻页)

### Task 4.1: AICommandCenter 消息流

**Files:**
- Create: `apps/desktop-os/tests/aiCommandPresence.test.tsx`
- Modify: `apps/desktop-os/src/apps/AICommandCenterWindow.tsx`
- Modify: `apps/desktop-os/src/apps/AICommandCenterWindow.css`

- [ ] **Step 1:** 写失败测试

```tsx
// apps/desktop-os/tests/aiCommandPresence.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AICommandCenterWindow from '../src/apps/AICommandCenterWindow';

describe('AICommandCenter AnimatePresence', () => {
  it('消息列表外层带 data-motion-presence="fade" wrapper', () => {
    const { container } = render(<AICommandCenterWindow />);
    expect(container.querySelector('[data-ai-command-messages] [data-motion-presence="fade"]')).not.toBeNull();
  });
});
```

(若组件需要 props 才能渲染,执行时先 `rg -n "export default" apps/desktop-os/src/apps/AICommandCenterWindow.tsx` 看默认导出签名:无 props 直接 `render(<AICommandCenterWindow />)`;有 props 则按签名写最小桩,且只断言 wrapper 选择器,不断言消息内容,避免与会话 store 异步加载耦合。)

- [ ] **Step 2:** 跑测试确认 FAIL

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/aiCommandPresence.test.tsx`
Expected: FAIL。

- [ ] **Step 3:** 改 [AICommandCenterWindow.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/apps/AICommandCenterWindow.tsx)

定位消息列表渲染:

```bash
rg -n "messages.map|message-item|ai-command-thread|prefersReducedMotion" apps/desktop-os/src/apps/AICommandCenterWindow.tsx
```

把消息列表渲染包成:

```tsx
import { PlushFade, PlushPresence } from '../ui/PlushMotion';

<div data-ai-command-messages>
  <PlushPresence mode="popLayout">
    {messages.map((m) => (
      <PlushFade key={m.id} open data-message-id={m.id}>
        <MessageItem message={m} />
      </PlushFade>
    ))}
  </PlushPresence>
</div>
```

把第 273 行附近 `const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;` 改名:

```tsx
// 不再服务动画,改名给「自动滚动」用,避免与 PlushMotion 内 useReducedMotion 双源不一致(R2)
const prefersReducedAutoScroll = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

并把所有引用同步改名;**该值不得再用于动画分支**,动画统一交给 `PlushFade` 内部的 `useReducedMotion()`。

- [ ] **Step 4:** 改 [AICommandCenterWindow.css](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/apps/AICommandCenterWindow.css)

删除以下 5 处 `@keyframes` 与对应 `animation:` 引用:
- `@keyframes ai-command-thread-in`(第 1031 行附近)
- `@keyframes ai-command-message-in`(第 1043 行附近)
- `@keyframes ai-command-inspector-in`(第 1055 行附近)
- `@keyframes ai-command-fade-in`(第 1067 行附近)
- `@keyframes ai-command-dialog-in`(第 1077 行附近)

并删 `@media (prefers-reduced-motion: reduce)`(第 1089 行附近)内对以上 keyframes 的兜底 `animation: none`(其他装饰类 `animation` 兜底如有保留)。

- [ ] **Step 5:** 跑测试确认 PASS

Run: `pnpm --filter @valley/desktop-os exec vitest run tests/aiCommandPresence.test.tsx`
Expected: PASS。

- [ ] **Step 6:** 跑全量校验

```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/src/apps/AICommandCenterWindow.tsx apps/desktop-os/src/apps/AICommandCenterWindow.css
```
Expected: 全绿。

- [ ] **Step 7:** Commit

```bash
git add apps/desktop-os/src/apps/AICommandCenterWindow.tsx apps/desktop-os/src/apps/AICommandCenterWindow.css apps/desktop-os/tests/aiCommandPresence.test.tsx
git commit -m "feat(desktop-os): motion P4 - ai command messages fade"
```

### Task 4.2: Launchpad 翻页位移

**Files:**
- Modify: `apps/desktop-os/src/components/Launchpad.tsx`(P3 已切顶层 Presence,这里只接翻页内部位移)

- [ ] **Step 1:** 在 [Launchpad.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/src/components/Launchpad.tsx) 内定位翻页渲染

Run: `rg -n "pageDirection|pageIndex|pages\[" apps/desktop-os/src/components/Launchpad.tsx`
找到当前页 `currentPage` 的渲染区块。

- [ ] **Step 2:** 用 `motion.div layout` 接翻页位移

(P3 把 motion 直接 import 拿掉了,这里**仅在翻页内部**重新引入 `motion`,而不再走 PlushMotion 包装层 —— 因为 layout 动画对 `motion.div` 原生 API 依赖较强,包装层会把语义模糊化。在 [AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/AGENTS.md) 「设计系统约束」段补一行豁免:**例外**:layout / shared layout 动画允许在组件内直接使用 `motion.div`,但仍优先用 `PlushMotion` 原语。)

```tsx
import { motion } from 'motion/react';
import { MOTION_TOKENS } from '../ui/PlushMotion';

<motion.div
  key={pageIndex}
  className="launchpad__page"
  layout
  initial={{ opacity: 0, x: pageDirection * 24 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -pageDirection * 24 }}
  transition={MOTION_TOKENS.slide}
>
  {/* 当前页 grid */}
</motion.div>
```

- [ ] **Step 3:** 同步 [AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/AGENTS.md) 豁免一行

在「设计系统约束」段已有的 motion 约束句末追加:

```markdown
  例外:layout / shared layout 动画(如 Launchpad 翻页)允许在组件内直接 `import { motion } from 'motion/react'`,但 transition 仍走 `MOTION_TOKENS`。
```

- [ ] **Step 4:** 跑全量校验

```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/src/components/Launchpad.tsx apps/desktop-os/AGENTS.md
```
Expected: 全绿;P3 launchpadPresence.test 仍通过(顶层 Presence 不受翻页改动影响)。

- [ ] **Step 5:** 跑 P4 完成版 build 比基线

Run: `pnpm --filter @valley/desktop-os build && du -sh apps/desktop-os/dist`
把数值与 P1 基线对比写入「实施后记 · P4 体积差」段;若 +60KB gzipped 以上需复查 import 路径。

- [ ] **Step 6:** 人工验收(Phase 4 收尾)

按 spec § 4 Phase 4 「人工验收清单」复核:AI Command 发送 5 条消息观察淡入、切换会话、Launchpad 翻页、reduced-motion 模式。

- [ ] **Step 7:** Commit

```bash
git add apps/desktop-os/src/components/Launchpad.tsx apps/desktop-os/AGENTS.md
git commit -m "feat(desktop-os): motion P4 - launchpad page layout"
```

### Task 4.3: PLAN.md 收尾标记 ✅

**Files:**
- Modify: `apps/desktop-os/docs/PLAN.md`

- [ ] **Step 1:** 把 P1 Task 1.2 写入的 Phase 进度行,P1–P4 全部加上 ✅:

```markdown
- Phase:P1 PlushMotion 原语 ✅ / P2 窗口层(Window / Spotlight / Dock 菜单) ✅ / P3 面板层(ControlCenter / NotificationCenter / Launchpad) ✅ / P4 业务列表(AICommandCenter / Launchpad 翻页) ✅
```

- [ ] **Step 2:** 跑 mojibake 检查

Run: `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/docs/PLAN.md`
Expected: PASS。

- [ ] **Step 3:** Commit

```bash
git add apps/desktop-os/docs/PLAN.md
git commit -m "docs(desktop-os): motion migration complete"
```

---

## 实施后记(执行时填)

### P1 体积基线

`du -sh apps/desktop-os/dist` = `38M`(主 JS 1,900.39 kB / gzip 562.29 kB,CSS 270 kB / gzip 47 kB),git sha = `2229e02f2a5cffdd37c94fc7f6baf0de08dee021`。

### P2 人工验收记录

- 5 个 App 开关:`<观察 / 异常>`
- Spotlight ⌘空格 / Esc:`<观察 / 异常>`
- Dock 右键 + 二级:`<观察 / 异常>`
- reduced-motion 模式:`<观察 / 异常>`

### P3 人工验收记录

- ControlCenter / NotificationCenter 反复开关:`<观察 / 异常>`
- 通知快速 3 进 3 出:`<观察 / 异常>`
- Launchpad 开关 / 翻页(P3 翻页降级):`<观察 / 异常>`

### P4 体积差

`du -sh apps/desktop-os/dist` = `<填写>`,与 P1 基线差 = `<填写>`(预算上限 +60KB gzipped)。

### P4 人工验收记录

- AI Command 5 条消息淡入 / 切换会话:`<观察 / 异常>`
- Launchpad 翻页 layout 动画:`<观察 / 异常>`
- reduced-motion 全局复测:`<观察 / 异常>`

---

## 收尾 Checklist(全部完成才算 plan 关单)

- [ ] 4 Phase 全部 commit 完成,每条 commit 都能单独 revert。
- [ ] `pnpm --filter @valley/desktop-os typecheck && check && exec vitest run` 全绿,新增 7 个测试文件全部通过。
- [ ] [apps/desktop-os/docs/PLAN.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/docs/PLAN.md) 「动画统一迁移到 motion」条目 P1–P4 ✅。
- [ ] [apps/desktop-os/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/desktop-os/AGENTS.md) 「设计系统约束」补充行 + layout 例外行均落地。
- [ ] 实施后记 4 段全部填完,体积差未超预算。
- [ ] [docs/specs/2026-06-23-desktop-os-motion-migration-design.md](file:///Users/bytedance/Desktop/study/valley-mas/docs/specs/2026-06-23-desktop-os-motion-migration-design.md) 与 [本 plan](file:///Users/bytedance/Desktop/study/valley-mas/docs/plans/2026-06-23-desktop-os-motion-migration.md) 由 owner 决定是否清理（C 档临时产物）。
