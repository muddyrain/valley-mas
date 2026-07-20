# Desktop OS · Plush 控件下沉迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/desktop-os/src/apps/**/*.tsx` 内全部 31 个窗口的原生交互控件 (`<button>`/`<input>`/`<textarea>`/`<select>`) 与自定义按钮样式收敛到 `PlushPrimitives`,统一走 Plush 设计系统,且通过 vitest 文件扫描测试守住边界。

**Architecture:** 5 批迁移 (批 0 模板 → 批 1 工具 → 批 2 生产力 → 批 3 游戏豁免 → 批 4 重型 + MiniApps.css 清档 + 防回潮测试)。批 0 先在 `PlushPrimitives` 补齐 `PlushSegmented` 并以 Calculator 为模板;批 4 末尾删除已弃 CSS 类并补 vitest 文件扫描断言。游戏 hit-target 用 `data-game-cell="true"` 属性豁免。

**Tech Stack:** React 19 + TypeScript + shadcn/base-ui + Plush 设计 token + biome + vitest (文件扫描断言)。

**Spec:** `docs/specs/2026-06-22-desktop-os-plush-control-migration-design.md`

---

## File Structure

### 新增文件

| 文件 | 责任 |
|---|---|
| `apps/desktop-os/src/ui/PlushSegmented.tsx` | 分段控件 (radiogroup 语义),接收 `value` / `onValueChange` / `options`;迁移目标:7 文件 13 处 `mini-segmented` fieldset。 |
| `apps/desktop-os/src/ui/PlushSegmented.css` | 分段控件视觉 token,与 `.plush-button[data-tone]` 使用同一调色,选中态走 `data-state="on"`。 |
| `apps/desktop-os/tests/plushControlBoundary.test.ts` | 防回潮测试:断言 `src/apps/**/*.tsx` 内排除 `data-game-cell` 后无裸 `<button>`/`<input>`/`<textarea>`/`<select>`,无废弃 class 引用。 |

### 修改文件

| 文件 | 责任变化 |
|---|---|
| `apps/desktop-os/src/ui/PlushPrimitives.tsx` | 在 re-export 区追加 `export { default as PlushSegmented } from './PlushSegmented'` 与类型重导。 |
| `apps/desktop-os/src/apps/CalculatorWindow.tsx` | 模板窗口:6 处 `<button>` → `PlushButton`;`<input>` → `PlushInput`。 |
| `apps/desktop-os/src/apps/StopwatchWindow.tsx` (批 1) | 模式 / 倒计时预设 → `PlushSegmented`;系统按钮 → `PlushButton`。 |
| `apps/desktop-os/src/apps/RandomizerWindow.tsx` (批 1) | 模式 → `PlushSegmented`;输入 → `PlushTextarea`;按钮 → `PlushButton`。 |
| `apps/desktop-os/src/apps/ConverterWindow.tsx` (批 1) | 单位 → `PlushSelect` (高阶组件);数值 → `PlushInput`;切换图标 → `PlushButton size="icon"`。 |
| `apps/desktop-os/src/apps/ClipboardWindow.tsx` (批 1) | 历史项 → `PlushButton unstyled`;搜索 → `PlushInput`。 |
| `apps/desktop-os/src/apps/DownloadsWindow.tsx` (批 1) | 单按钮 → `PlushButton`。 |
| `apps/desktop-os/src/apps/DeskTidyWindow.tsx` (批 1) | 整理动作 → `PlushButton`。 |
| `apps/desktop-os/src/apps/DailyToolsWindow.tsx` (批 1) | 工具入口 → `PlushCard` + `PlushButton`。 |
| `apps/desktop-os/src/apps/DevToolsWindow.tsx` (批 1) | 子工具 tabs → `PlushTabs`;每个工具内部按钮/输入全替换。 |
| `apps/desktop-os/src/apps/NotesWindow.tsx` (批 2) | 列表 actions → `PlushButton unstyled`;编辑域 → `PlushTextarea`。 |
| `apps/desktop-os/src/apps/TextLabWindow.tsx` (批 2) | 工具栏 → `PlushButton size="icon"`;输入 → `PlushTextarea`。 |
| `apps/desktop-os/src/apps/FocusTimerWindow.tsx` (批 2) | 模式 → `PlushSegmented`;时长 → `PlushInput type="number"`。 |
| `apps/desktop-os/src/apps/CalendarWindow.tsx` (批 2) | 月份 / 新建 → `PlushButton`;事件输入 → `PlushInput`/`PlushTextarea`;日期格子标 `data-game-cell` 豁免 (按 spec §4.3 备注)。 |
| `apps/desktop-os/src/apps/SettingsWindow.tsx` (批 2) | switch 用 `PlushSwitch`;按钮 → `PlushButton`。 |
| `apps/desktop-os/src/apps/AboutWindow.tsx` (批 2) | 链接按钮 → `PlushButton unstyled`。 |
| `apps/desktop-os/src/apps/WeatherWindow.tsx` (批 2) | 城市 / 收藏 → `PlushButton`;单位 → `PlushSegmented`。 |
| `apps/desktop-os/src/apps/SnakeWindow.tsx` (批 3) | 方向键打 `data-game-cell`;开始 / 重置 → `PlushButton`。 |
| `apps/desktop-os/src/apps/BlockDropWindow.tsx` (批 3) | 旋转 / 移动键打 `data-game-cell`;系统按钮 → `PlushButton`。 |
| `apps/desktop-os/src/apps/DiceCupWindow.tsx` (批 3) | 摇骰 / 历史 / 重置 → `PlushButton`。 |
| `apps/desktop-os/src/apps/CloudBounceWindow.tsx` (批 3) | 命中目标打 `data-game-cell`;开始 / 重置 → `PlushButton`。 |
| `apps/desktop-os/src/apps/PlushMatchWindow.tsx` (批 3) | 卡片打 `data-game-cell`;系统按钮 → `PlushButton`。 |
| `apps/desktop-os/src/apps/BeadSortWindow.tsx` (批 3) | 珠柱打 `data-game-cell`;重置 → `PlushButton`。 |
| `apps/desktop-os/src/apps/PlushGardenWindow.tsx` (批 3) | 地块打 `data-game-cell`;浇水 / 施肥 → `PlushButton`。 |
| `apps/desktop-os/src/apps/PaletteWindow.tsx` (批 3) | 颜料井 / 画布单元打 `data-game-cell`;工具切换 → `PlushSegmented`。 |
| `apps/desktop-os/src/apps/MailWindow.tsx` (批 4) | 列表 actions / 写信工具栏 → `PlushButton`;搜索 → `PlushInput`。 |
| `apps/desktop-os/src/apps/AICommandCenterWindow.tsx` (批 4) | 32 处控件全替换 → `PlushButton` + `PlushTextarea` + `PlushSegmented`。 |
| `apps/desktop-os/src/apps/MusicWindow.tsx` (批 4) | 残留控件 → `PlushButton`。 |
| `apps/desktop-os/src/apps/FinderWindow.tsx` (批 4) | 52 处工具条 / 列表 actions / 重命名 → `PlushButton` + `PlushInput`。 |
| `apps/desktop-os/src/apps/SafariWindow.tsx` (批 4) | 地址栏 → `PlushInput`;前进 / 后退 / 刷新 → `PlushButton size="icon"`。 |
| `apps/desktop-os/src/apps/BlogWindow.tsx` (批 4) | 残留按钮 → `PlushButton`。 |
| `apps/desktop-os/src/apps/AccountWindow.tsx` (批 4) | 表单 → `PlushInput` + `PlushButton`;退出登录 `tone="danger"`。 |
| `apps/desktop-os/src/apps/MiniApps.css` (批 4) | 删除 `.mini-app__plain` / `.mini-app__secondary` / `.dock-app-window__button` / `.calculator-keypad__key*` / `.mini-segmented` / `.mini-actions__btn` 及配套 hover/active;保留并改 token:`.mini-app__panel` / `.mini-list__row` / `.mini-stat` / `.mini-app__hero` / `.dock-app-window__eyebrow` / `.dock-app-window__badge`。 |
| `apps/desktop-os/docs/PLAN.md` (批 4 末尾) | 立条「Plush 控件下沉」并按批进度更新。 |

### 不在范围

- `apps/desktop-os/src/apps/appRenderers.tsx` (路由派发,纯渲染)
- `apps/desktop-os/src/apps/MailHTMLFrame.tsx` / `MailBodyText.tsx` (沙箱 iframe / 三方解析)
- `apps/desktop-os/src/apps/DiceCupScene.tsx` (Three/R3F Scene 层)

---

## 通用迁移规则 (所有任务参照)

下面 6 条贯穿全部任务,任务步骤里不再每次重述。

1. **`type` 默认值**:`PlushButton` 默认 `type="button"`;若原 `<button>` 在 `<form>` 内充当 submit,迁移时显式补 `type="submit"`。
2. **图标按钮**:必须补 `aria-label`;`size="icon"` (普通) / `size="icon-sm"` (紧凑) 透传 shadcn 底层。
3. **PlushSelect 签名**:接口为 `<PlushSelect value={x} options={[{value,label}]} ariaLabel="..." onChange={(value) => set(value)} />`,**onChange 接收的是 value 字符串本身,不是 event**。
4. **PlushSwitch**:替换原 toggle 按钮,使用 `checked` + `onCheckedChange`。
5. **`unstyled` PlushButton**:用于 mini-app__plain / mini-app__secondary 这类弱按钮场景,保留行内 `className` 让外部样式主导,但仍获得 `aria-busy` / `loading` 行为。
6. **`data-game-cell="true"`**:所有游戏中的 hit-target 必须打这个属性,后续防回潮测试靠它白名单。

---

## 批 0 — PlushPrimitives 缺口 + Calculator 模板

### Task 0.1: 新增 PlushSegmented 组件

**Files:**
- Create: `apps/desktop-os/src/ui/PlushSegmented.tsx`
- Create: `apps/desktop-os/src/ui/PlushSegmented.css`

- [ ] **Step 1: Write `PlushSegmented.css`**

```css
.plush-segmented {
  display: inline-flex;
  border: 1px solid var(--plush-outline);
  border-radius: var(--shape-capsule);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 248, 232, 0.5)),
    var(--plush-field);
  padding: 4px;
  gap: 4px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.plush-segmented__option {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--plush-text-soft, rgba(90, 74, 58, 0.78));
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: var(--shape-capsule);
  cursor: pointer;
  transition:
    background 0.16s var(--ease-out),
    color 0.16s var(--ease-out),
    box-shadow 0.16s var(--ease-out);
}

.plush-segmented__option:hover:not([data-state="on"]) {
  background: rgba(255, 255, 255, 0.5);
  color: var(--plush-text);
}

.plush-segmented__option[data-state="on"] {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 232, 157, 0.78)),
    var(--plush-highlight);
  color: var(--plush-text);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 6px 12px rgba(90, 74, 58, 0.08);
}

.plush-segmented__option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plush-segmented__option:focus-visible {
  outline: 2px solid var(--plush-focus);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Write `PlushSegmented.tsx`**

```tsx
import { useId } from 'react';
import './PlushSegmented.css';

export interface PlushSegmentedOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

interface PlushSegmentedProps<TValue extends string = string> {
  value: TValue;
  options: ReadonlyArray<PlushSegmentedOption<TValue>>;
  onValueChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export default function PlushSegmented<TValue extends string = string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className = '',
  disabled = false,
}: PlushSegmentedProps<TValue>) {
  const groupId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={`plush-segmented ${className}`.trim()}
      id={groupId}
    >
      {options.map((option) => {
        const isOn = option.value === value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={isOn}
            data-state={isOn ? 'on' : 'off'}
            disabled={disabled || option.disabled}
            key={option.value}
            className="plush-segmented__option"
            onClick={() => {
              if (!isOn) onValueChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 在 PlushPrimitives 中 re-export**

修改 `apps/desktop-os/src/ui/PlushPrimitives.tsx`:在文件末尾的 `export {` 区块内追加一行 `default as PlushSegmented`,并补 `import` 顶部不要混进 (PlushSegmented 用 default export)。最终增量:

```tsx
// 在 PlushPrimitives.tsx 末尾的 export {} 块下方追加:
export { default as PlushSegmented } from './PlushSegmented';
export type { PlushSegmentedOption } from './PlushSegmented';
```

注意:`PlushSegmentedOption` 在 `PlushSegmented.tsx` 里是 `export interface`,所以 `export type` 形式 re-export 即可。

- [ ] **Step 4: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿,无 type error,无 biome warning。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-os/src/ui/PlushSegmented.tsx apps/desktop-os/src/ui/PlushSegmented.css apps/desktop-os/src/ui/PlushPrimitives.tsx
git commit -m "feat(desktop-os): 新增 PlushSegmented 控件"
```

### Task 0.2: 迁移 CalculatorWindow 作为模板

**Files:**
- Modify: `apps/desktop-os/src/apps/CalculatorWindow.tsx`

- [ ] **Step 1: 替换整个 `CalculatorWindow.tsx` 为以下迁移后版本**

```tsx
import { useState } from 'react';
import { PlushButton, PlushInput } from '../ui/PlushPrimitives';
import { useToolStore } from '../store/toolStore';
import { evaluateCalcExpression } from '../tools/calc';
import './MiniApps.css';

const KEYS: ReadonlyArray<{ key: string; tone: 'neutral' | 'accent' | 'primary' }> = [
  { key: '7', tone: 'neutral' },
  { key: '8', tone: 'neutral' },
  { key: '9', tone: 'neutral' },
  { key: '÷', tone: 'accent' },
  { key: '4', tone: 'neutral' },
  { key: '5', tone: 'neutral' },
  { key: '6', tone: 'neutral' },
  { key: '×', tone: 'accent' },
  { key: '1', tone: 'neutral' },
  { key: '2', tone: 'neutral' },
  { key: '3', tone: 'neutral' },
  { key: '-', tone: 'accent' },
  { key: '0', tone: 'neutral' },
  { key: '.', tone: 'neutral' },
  { key: '=', tone: 'primary' },
  { key: '+', tone: 'accent' },
];

export default function CalculatorWindow() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const history = useToolStore((s) => s.calcHistory);
  const addHistory = useToolStore((s) => s.addCalcHistory);
  const clearHistory = useToolStore((s) => s.clearCalcHistory);

  function press(key: string) {
    if (key === '=') {
      runCalc();
      return;
    }
    setExpression((value) => `${value}${key}`);
  }

  function runCalc() {
    const next = evaluateCalcExpression(expression);
    if (!next) {
      setResult('无法计算');
      return;
    }
    setResult(next.result);
    addHistory(next.expression, next.result);
  }

  async function copyResult() {
    if (!result || result === '无法计算') return;
    await navigator.clipboard?.writeText(result);
  }

  return (
    <div className="dock-app-window mini-app mini-calculator">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>小算盘</h2>
        </div>
        <PlushButton tone="neutral" unstyled onClick={() => setExpression('')}>
          清空
        </PlushButton>
      </header>

      <section className="calculator-display" aria-label="计算结果">
        <PlushInput
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runCalc();
          }}
          placeholder="12 + 8"
          aria-label="表达式"
        />
        <PlushButton tone="neutral" unstyled onClick={copyResult} aria-label="复制结果">
          {result || '0'}
        </PlushButton>
      </section>

      <div className="calculator-grid">
        {KEYS.map(({ key, tone }) => (
          <PlushButton key={key} tone={tone} onClick={() => press(key)}>
            {key}
          </PlushButton>
        ))}
      </div>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>最近计算</span>
          {history.length > 0 ? (
            <PlushButton tone="neutral" unstyled onClick={clearHistory}>
              清除
            </PlushButton>
          ) : null}
        </div>
        <div className="mini-list">
          {history.length === 0 ? (
            <span className="mini-list__empty">暂无记录</span>
          ) : (
            history.slice(0, 4).map((item) => (
              <PlushButton
                tone="neutral"
                unstyled
                key={item.id}
                className="mini-list__row"
                onClick={() => {
                  setExpression(item.expression);
                  setResult(item.result);
                }}
              >
                <span>{item.expression}</span>
                <strong>{item.result}</strong>
              </PlushButton>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 3: 手动验收 (无须自动化)**

启动 `pnpm --filter @valley/desktop-os dev`,打开计算器:
- 数字键、运算键、清空、复制结果点击行为不变
- 历史记录点击仍能回填表达式
- 视觉上 16 个键有 tone 区分 (数字 neutral / 运算 accent / 等号 primary)
- 浏览器 DevTools 检查 DOM,小算盘内不应再出现 `<button class="...">`,只剩 PlushButton 渲染出的结构。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop-os/src/apps/CalculatorWindow.tsx
git commit -m "refactor(desktop-os): Calculator 迁移到 PlushButton/PlushInput"
```

---

## 批 1 — 工具类 (8 个窗口,71 处)

> 所有任务遵循"通用迁移规则"。每个窗口的迁移产物是同一个文件,按下表逐个 task 执行。每个 task 完成后跑一次 `typecheck && check`,本批末尾跑 `vitest run`。

### Task 1.1: StopwatchWindow

**Files:** Modify `apps/desktop-os/src/apps/StopwatchWindow.tsx`

- [ ] **Step 1: 引入 Plush 控件**

文件顶部 import 区追加:

```tsx
import { PlushButton, PlushInput, PlushSegmented } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 模式 segmented (含 legend) → PlushSegmented**

把现有 `<fieldset className="mini-segmented"> ... <legend>计时模式</legend>` 整段替换为:

```tsx
<PlushSegmented
  ariaLabel="计时模式"
  value={mode}
  options={[
    { value: 'stopwatch', label: '秒表' },
    { value: 'countdown', label: '倒计时' },
  ]}
  onValueChange={(next) => reset(next as StopwatchMode)}
/>
```

- [ ] **Step 3: 倒计时预设 → PlushSegmented**

把 `mode === 'countdown'` 分支下的整个 `<div className="mini-segmented">...</div>` 替换为:

```tsx
{mode === 'countdown' ? (
  <PlushSegmented
    ariaLabel="倒计时预设"
    value={String(duration)}
    options={COUNTDOWN_PRESETS.map((seconds) => ({
      value: String(seconds),
      label: `${Math.round(seconds / 60)}m`,
    }))}
    onValueChange={(next) => {
      setDuration(Number(next));
      reset('countdown');
    }}
  />
) : null}
```

- [ ] **Step 4: 操作按钮 → PlushButton**

把 `<div className="mini-actions">` 内 3 个 `<button>` 替换为:

```tsx
<div className="mini-actions">
  {running ? (
    <PlushButton tone="primary" onClick={pause}>暂停</PlushButton>
  ) : (
    <PlushButton tone="primary" onClick={start}>开始</PlushButton>
  )}
  <PlushButton tone="neutral" onClick={lap}>计次</PlushButton>
  <PlushButton tone="neutral" onClick={() => reset()}>重置</PlushButton>
</div>
```

- [ ] **Step 5: "清除"按钮 → PlushButton unstyled**

把 panel-head 内 `<button type="button" className="mini-app__plain" onClick={clearRecords}>清除</button>` 替换为:

```tsx
<PlushButton tone="neutral" unstyled onClick={clearRecords}>
  清除
</PlushButton>
```

- [ ] **Step 6: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop-os/src/apps/StopwatchWindow.tsx
git commit -m "refactor(desktop-os): Stopwatch 迁移到 PlushButton/PlushSegmented"
```

### Task 1.2: RandomizerWindow

**Files:** Modify `apps/desktop-os/src/apps/RandomizerWindow.tsx`

- [ ] **Step 1: 顶部 import**

```tsx
import { PlushButton, PlushSegmented, PlushTextarea } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 模式切换 → PlushSegmented**

定位现有 `mini-segmented` fieldset/div,改用 `PlushSegmented` (ariaLabel="抽签模式")。模式 options 形如 `[{value:'pick', label:'随机一项'}, {value:'shuffle', label:'打乱顺序'}]`,以源文件实际枚举为准。

- [ ] **Step 3: 输入域 → PlushTextarea**

定位 `<textarea ...>` 替换为 `<PlushTextarea ...>`,保留 `value` / `onChange` / `placeholder` / `rows`。

- [ ] **Step 4: 抽签按钮 → PlushButton**

主操作按钮使用 `<PlushButton tone="primary">`;次要"清空" / "复制结果"使用 `tone="neutral"`,文字型走 `unstyled`。

- [ ] **Step 5: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-os/src/apps/RandomizerWindow.tsx
git commit -m "refactor(desktop-os): Randomizer 迁移到 Plush 控件"
```

### Task 1.3: ConverterWindow

**Files:** Modify `apps/desktop-os/src/apps/ConverterWindow.tsx`

- [ ] **Step 1: 顶部 import**

```tsx
import { PlushButton, PlushInput } from '../ui/PlushPrimitives';
import PlushSelect from '../ui/PlushSelect';
```

注意:`PlushSelect` 是 default export,不是从 `PlushPrimitives` 来的。

- [ ] **Step 2: 数值输入 → PlushInput type="number"**

```tsx
<PlushInput
  type="number"
  inputMode="numeric"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  aria-label="数值"
/>
```

- [ ] **Step 3: 单位 select → PlushSelect**

按 `PlushSelect` 接口替换,**注意 onChange 收的是 value 字符串本身**:

```tsx
<PlushSelect
  ariaLabel="源单位"
  value={fromUnit}
  options={UNITS.map((u) => ({ value: u.id, label: u.label }))}
  onChange={(next) => setFromUnit(next)}
/>
```

目标单位同理。

- [ ] **Step 4: 切换方向按钮 → PlushButton size="icon"**

```tsx
<PlushButton
  tone="neutral"
  size="icon"
  aria-label="交换源和目标单位"
  onClick={swapUnits}
>
  <ArrowLeftRight aria-hidden size={16} />
</PlushButton>
```

如该文件未引入 lucide-react 图标,在顶部 import:`import { ArrowLeftRight } from 'lucide-react';`。如原本就用了别的图标,沿用即可。

- [ ] **Step 5: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-os/src/apps/ConverterWindow.tsx
git commit -m "refactor(desktop-os): Converter 迁移到 PlushSelect/PlushInput"
```

### Task 1.4: ClipboardWindow

**Files:** Modify `apps/desktop-os/src/apps/ClipboardWindow.tsx`

- [ ] **Step 1: 顶部 import**

```tsx
import { PlushButton, PlushInput } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 搜索 → PlushInput**

`<input type="search" ...>` → `<PlushInput type="search" aria-label="搜索剪贴板历史" .../>`。

- [ ] **Step 3: 主操作按钮 → PlushButton**

"读取剪贴板" / "清空全部" / "添加固定项" 等系统按钮 → `<PlushButton tone="primary">` 或 `tone="neutral"`,按视觉权重选择。

- [ ] **Step 4: 历史项行按钮 → PlushButton unstyled**

每条历史 row 的 button 形态,保留行 className,改为 `<PlushButton unstyled className="mini-list__row">...</PlushButton>`;行内"复制" / "删除" 等次要图标按钮使用 `<PlushButton tone="neutral" size="icon-sm" aria-label="复制">`。

- [ ] **Step 5: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-os/src/apps/ClipboardWindow.tsx
git commit -m "refactor(desktop-os): Clipboard 迁移到 Plush 控件"
```

### Task 1.5: DownloadsWindow

**Files:** Modify `apps/desktop-os/src/apps/DownloadsWindow.tsx`

- [ ] **Step 1: 顶部 import**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 单按钮替换**

仅 1 处 `<button>`,根据语义选择 `tone`;若是"在 Finder 中显示" / "清空记录"等,默认 `tone="neutral"`。

- [ ] **Step 3: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop-os/src/apps/DownloadsWindow.tsx
git commit -m "refactor(desktop-os): Downloads 迁移到 PlushButton"
```

### Task 1.6: DeskTidyWindow

**Files:** Modify `apps/desktop-os/src/apps/DeskTidyWindow.tsx`

- [ ] **Step 1: 顶部 import**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 3 处整理动作按钮 → PlushButton**

主整理动作 → `tone="primary"`;辅助按钮 → `tone="neutral"`。

- [ ] **Step 3: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop-os/src/apps/DeskTidyWindow.tsx
git commit -m "refactor(desktop-os): DeskTidy 迁移到 PlushButton"
```

### Task 1.7: DailyToolsWindow

**Files:** Modify `apps/desktop-os/src/apps/DailyToolsWindow.tsx`

- [ ] **Step 1: 顶部 import**

```tsx
import { PlushButton, PlushInput, PlushTabs, PlushTabsContent, PlushTabsList, PlushTabsTrigger, PlushTextarea } from '../ui/PlushPrimitives';
```

按文件实际使用情况裁剪 import (例如未用 PlushTabs 就不引入)。

- [ ] **Step 2: 工具入口卡片 → PlushButton (内含图标 + 文案的卡片型按钮)**

工具入口若是"卡片状大按钮",使用 `<PlushButton tone="neutral" unstyled className="daily-tool-card">...</PlushButton>` 保留原 className 控制布局,失去 hairline,改用 surface tone。

- [ ] **Step 3: 工具内部输入 → PlushInput / PlushTextarea**

逐个工具 (日期 / 密码 / 图片 / 分账) 内部的 `<input>` / `<textarea>` 替换。`<input type="number">` 必须补 `inputMode="numeric"`。

- [ ] **Step 4: 工具内部按钮 → PlushButton**

主动作 `tone="primary"`,次要 `tone="neutral"`,危险 `tone="danger"`,文字型 `unstyled`。

- [ ] **Step 5: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-os/src/apps/DailyToolsWindow.tsx
git commit -m "refactor(desktop-os): DailyTools 迁移到 Plush 控件"
```

### Task 1.8: DevToolsWindow

**Files:** Modify `apps/desktop-os/src/apps/DevToolsWindow.tsx`

- [ ] **Step 1: 顶部 import**

```tsx
import {
  PlushButton,
  PlushInput,
  PlushTabs,
  PlushTabsContent,
  PlushTabsList,
  PlushTabsTrigger,
  PlushTextarea,
} from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 子工具 tabs → PlushTabs**

若现有为自渲染 tabs (button group + state),改为受控的 `PlushTabs`:

```tsx
<PlushTabs value={active} onValueChange={setActive}>
  <PlushTabsList>
    <PlushTabsTrigger value="json">JSON</PlushTabsTrigger>
    <PlushTabsTrigger value="ts">时间戳</PlushTabsTrigger>
    {/* ... */}
  </PlushTabsList>
  <PlushTabsContent value="json">
    {/* JSON 工具内容 */}
  </PlushTabsContent>
  {/* ... */}
</PlushTabs>
```

- [ ] **Step 3: 每个子工具的输入 → PlushInput / PlushTextarea**

JSON 美化 / Diff / CSV 等大文本框 → `PlushTextarea`;时间戳 / 哈希 / 随机 ID 短输入 → `PlushInput`。

- [ ] **Step 4: 每个子工具的按钮 → PlushButton**

"美化" / "压缩" / "解析" / "比较" / "复制" 等主动作 `tone="primary"`;复制图标按钮 `<PlushButton size="icon-sm" aria-label="复制">`;清空 `tone="neutral"`。

- [ ] **Step 5: typecheck + check**

Run: `pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check`
Expected: 全绿。

- [ ] **Step 6: 批 1 收尾跑 vitest**

Run: `pnpm --filter @valley/desktop-os exec vitest run`
Expected: 已有测试集全绿 (本批未引入新断言)。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop-os/src/apps/DevToolsWindow.tsx
git commit -m "refactor(desktop-os): DevTools 迁移到 Plush 控件"
```

---

## 批 2 — 生产力 / 信息 (7 个窗口,47 处)

### Task 2.1: NotesWindow

**Files:** Modify `apps/desktop-os/src/apps/NotesWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput, PlushTextarea } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 列表 actions → PlushButton unstyled**

列表行的 actions (打开 / 删除等) 走 `<PlushButton tone="neutral" unstyled>` 或 `tone="danger"` (删除型);保留原 className 控制布局。

- [ ] **Step 3: 编辑域 → PlushTextarea**

`<textarea>` → `<PlushTextarea>`,保留 `value` / `onChange` / `placeholder` / `rows`。

- [ ] **Step 4: 标题输入 (若有) → PlushInput**

`<input value=...>` → `<PlushInput aria-label="标题">`。

- [ ] **Step 5: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/NotesWindow.tsx
git commit -m "refactor(desktop-os): Notes 迁移到 Plush 控件"
```

### Task 2.2: TextLabWindow

**Files:** Modify `apps/desktop-os/src/apps/TextLabWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushTextarea } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 工具栏图标按钮 → PlushButton size="icon"**

每个图标按钮补 `aria-label`,使用 `tone="neutral"`,`size="icon-sm"`。

- [ ] **Step 3: 输入区 → PlushTextarea**

`<textarea>` 全部替换。

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/TextLabWindow.tsx
git commit -m "refactor(desktop-os): TextLab 迁移到 Plush 控件"
```

### Task 2.3: FocusTimerWindow

**Files:** Modify `apps/desktop-os/src/apps/FocusTimerWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput, PlushSegmented } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 模式 / 预设 → PlushSegmented**

"专注 / 休息" 模式与预设时长 → 两个 `PlushSegmented`,签名同 Stopwatch (Task 1.1)。

- [ ] **Step 3: 自定义时长 → PlushInput type="number"**

`<input type="number">` → `<PlushInput type="number" inputMode="numeric" aria-label="自定义时长(分钟)">`。

- [ ] **Step 4: 启动 / 停止 → PlushButton**

主按钮 `tone="primary"`,辅按钮 `tone="neutral"`。

- [ ] **Step 5: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/FocusTimerWindow.tsx
git commit -m "refactor(desktop-os): FocusTimer 迁移到 Plush 控件"
```

### Task 2.4: CalendarWindow

**Files:** Modify `apps/desktop-os/src/apps/CalendarWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput, PlushTextarea } from '../ui/PlushPrimitives';
import PlushSelect from '../ui/PlushSelect';
```

- [ ] **Step 2: 日期格子加 `data-game-cell="true"` 豁免**

把日历"日期格子"按钮改成:`<button type="button" data-game-cell="true" aria-label="选择 X 月 X 日" ...>`,保留原 onClick / className。注释一行说明:"日期格子作为 hit-target 由 plushControlBoundary 测试白名单豁免"。

- [ ] **Step 3: 月份切换 / 今天 / 新建事件 → PlushButton**

"上月" / "下月" → `<PlushButton size="icon-sm" aria-label="上月" tone="neutral">`,内部图标用 lucide。
"今天" → `<PlushButton tone="neutral">今天</PlushButton>`。
"新建事件" → `<PlushButton tone="primary">新建事件</PlushButton>`。

- [ ] **Step 4: 事件输入 → PlushInput / PlushTextarea**

事件标题 → `PlushInput`,描述 → `PlushTextarea`,事件分类 → `PlushSelect` (按 Converter 模式)。

- [ ] **Step 5: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/CalendarWindow.tsx
git commit -m "refactor(desktop-os): Calendar 迁移到 Plush 控件并标记日期格子豁免"
```

### Task 2.5: SettingsWindow

**Files:** Modify `apps/desktop-os/src/apps/SettingsWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput, PlushSwitch } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: toggle → PlushSwitch**

每个布尔切换项使用 `<PlushSwitch checked={value} onCheckedChange={setValue} aria-label="...">`。

- [ ] **Step 3: 普通按钮 → PlushButton**

危险操作 (重置 / 清空缓存) 用 `tone="danger"`,普通操作 `tone="neutral"`。

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/SettingsWindow.tsx
git commit -m "refactor(desktop-os): Settings 迁移到 Plush 控件"
```

### Task 2.6: AboutWindow

**Files:** Modify `apps/desktop-os/src/apps/AboutWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 链接按钮 → PlushButton unstyled**

2 处 `<button>` 替换为 `<PlushButton tone="neutral" unstyled>`,保留原 className 维持链接型外观。

- [ ] **Step 3: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/AboutWindow.tsx
git commit -m "refactor(desktop-os): About 迁移到 PlushButton"
```

### Task 2.7: WeatherWindow

**Files:** Modify `apps/desktop-os/src/apps/WeatherWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput, PlushSegmented } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 城市侧栏 → PlushButton**

每个城市行用 `<PlushButton tone="neutral" unstyled>` 保留 row 布局;"添加城市"按钮 `tone="primary"`,"删除"按钮 `tone="danger" size="icon-sm"`,"重新定位"按钮 `tone="neutral" size="icon-sm"`。

- [ ] **Step 3: 单位切换 → PlushSegmented**

```tsx
<PlushSegmented
  ariaLabel="温度单位"
  value={unit}
  options={[
    { value: 'c', label: '°C' },
    { value: 'f', label: '°F' },
  ]}
  onValueChange={(next) => setUnit(next as 'c' | 'f')}
/>
```

- [ ] **Step 4: 搜索框 (若仍存在) → PlushInput**

按 spec 描述 Weather 已隐藏搜索框;若文件中残留,顺手替换。

- [ ] **Step 5: typecheck + check + commit + 批 2 收尾**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
git add apps/desktop-os/src/apps/WeatherWindow.tsx
git commit -m "refactor(desktop-os): Weather 迁移到 Plush 控件"
```

---

## 批 3 — 游戏类 (8 个窗口,31 处,游戏 hit-target 豁免)

> 每个窗口的迁移分两步:**先**给所有游戏 hit-target 打 `data-game-cell="true"` 并加注释,**再**把系统按钮换成 PlushButton。这样确保任何中途回退都不会破坏游戏视觉。

### Task 3.1: SnakeWindow

**Files:** Modify `apps/desktop-os/src/apps/SnakeWindow.tsx`

- [ ] **Step 1: 引入 PlushButton**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 方向键豁免**

4 个方向控制按钮 (上 / 下 / 左 / 右) 在原 `<button>` 上加属性:`data-game-cell="true"`,并在该 group 上方加一行注释:`{/* 方向键作为游戏 hit-target,保留裸 button + data-game-cell 豁免 */}`。

- [ ] **Step 3: 系统按钮 → PlushButton**

"开始" / "重置" / "暂停" → `<PlushButton tone="primary">` 或 `tone="neutral"` 按视觉权重。

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/SnakeWindow.tsx
git commit -m "refactor(desktop-os): Snake 系统控件下沉,方向键豁免"
```

### Task 3.2: BlockDropWindow

**Files:** Modify `apps/desktop-os/src/apps/BlockDropWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushSegmented } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 旋转 / 移动 / 下落键打 `data-game-cell`**

4 处按钮加 `data-game-cell="true"` 并注释。

- [ ] **Step 3: 重开 / 暂停 → PlushButton**

`tone="primary"` / `tone="neutral"`。

- [ ] **Step 4: 难度 → PlushSegmented**

按现有难度枚举构造 options。

- [ ] **Step 5: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/BlockDropWindow.tsx
git commit -m "refactor(desktop-os): BlockDrop 系统控件下沉"
```

### Task 3.3: DiceCupWindow

**Files:** Modify `apps/desktop-os/src/apps/DiceCupWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 摇骰 / 历史 / 重置 → PlushButton**

`摇骰` `tone="primary"`;`历史` / `重置` `tone="neutral"`。`DiceCupScene.tsx` 不动 (3D Scene 层)。

- [ ] **Step 3: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/DiceCupWindow.tsx
git commit -m "refactor(desktop-os): DiceCup 系统控件下沉"
```

### Task 3.4: CloudBounceWindow

**Files:** Modify `apps/desktop-os/src/apps/CloudBounceWindow.tsx`

- [ ] **Step 1: 引入 PlushButton**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 命中目标打 `data-game-cell`**

把作为命中区 / hit-target 的 `<button>` 加 `data-game-cell="true"` 并注释。

- [ ] **Step 3: 开始 / 重置 → PlushButton**

`tone="primary"` / `tone="neutral"`。

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/CloudBounceWindow.tsx
git commit -m "refactor(desktop-os): CloudBounce 系统控件下沉"
```

### Task 3.5: PlushMatchWindow

**Files:** Modify `apps/desktop-os/src/apps/PlushMatchWindow.tsx`

- [ ] **Step 1: 引入 PlushButton**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 卡片打 `data-game-cell`**

匹配卡片 `<button>` 加 `data-game-cell="true"` 并注释。

- [ ] **Step 3: 重置 / 结束 → PlushButton**

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/PlushMatchWindow.tsx
git commit -m "refactor(desktop-os): PlushMatch 系统控件下沉"
```

### Task 3.6: BeadSortWindow

**Files:** Modify `apps/desktop-os/src/apps/BeadSortWindow.tsx`

- [ ] **Step 1: 引入 PlushButton**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 珠柱按钮打 `data-game-cell`**

- [ ] **Step 3: 重置 → PlushButton**

`tone="neutral"`。

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/BeadSortWindow.tsx
git commit -m "refactor(desktop-os): BeadSort 系统控件下沉"
```

### Task 3.7: PlushGardenWindow

**Files:** Modify `apps/desktop-os/src/apps/PlushGardenWindow.tsx`

- [ ] **Step 1: 引入 PlushButton**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 地块按钮打 `data-game-cell`**

- [ ] **Step 3: 浇水 / 施肥 / 收获 → PlushButton**

均 `tone="primary"` 或 `tone="accent"`,按现有视觉权重决定。

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/PlushGardenWindow.tsx
git commit -m "refactor(desktop-os): PlushGarden 系统控件下沉"
```

### Task 3.8: PaletteWindow

**Files:** Modify `apps/desktop-os/src/apps/PaletteWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushSegmented } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 颜料井 / 画布单元打 `data-game-cell`**

- [ ] **Step 3: 工具切换 → PlushSegmented**

按现有工具枚举构造。

- [ ] **Step 4: 清空 → PlushButton**

`tone="danger"` (清空画布),其它 `tone="neutral"`。

- [ ] **Step 5: typecheck + check + commit + 批 3 收尾**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
git add apps/desktop-os/src/apps/PaletteWindow.tsx
git commit -m "refactor(desktop-os): Palette 系统控件下沉"
```

---

## 批 4 — 重型应用 + MiniApps.css 清档 + 防回潮

### Task 4.1: BlogWindow (轻量起手)

**Files:** Modify `apps/desktop-os/src/apps/BlogWindow.tsx`

- [ ] **Step 1: 引入 PlushButton**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 3 处残留 button → PlushButton**

按视觉权重选 tone。

- [ ] **Step 3: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/BlogWindow.tsx
git commit -m "refactor(desktop-os): Blog 残留按钮迁移到 PlushButton"
```

### Task 4.2: SafariWindow

**Files:** Modify `apps/desktop-os/src/apps/SafariWindow.tsx`

- [ ] **Step 1: 引入控件 + 图标**

```tsx
import { PlushButton, PlushInput } from '../ui/PlushPrimitives';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
```

(若 SafariWindow 已用 lucide,合并 import 即可。)

- [ ] **Step 2: 地址栏 → PlushInput**

```tsx
<PlushInput
  value={url}
  onChange={(e) => setUrl(e.target.value)}
  onKeyDown={(e) => { if (e.key === 'Enter') navigate(url); }}
  aria-label="网址"
  placeholder="搜索或输入网址"
/>
```

- [ ] **Step 3: 前进 / 后退 / 刷新 → PlushButton size="icon"**

```tsx
<PlushButton tone="neutral" size="icon-sm" aria-label="后退" onClick={goBack}>
  <ArrowLeft aria-hidden size={14} />
</PlushButton>
<PlushButton tone="neutral" size="icon-sm" aria-label="前进" onClick={goForward}>
  <ArrowRight aria-hidden size={14} />
</PlushButton>
<PlushButton tone="neutral" size="icon-sm" aria-label="刷新" onClick={reload}>
  <RefreshCw aria-hidden size={14} />
</PlushButton>
```

- [ ] **Step 4: 起始页快捷方式按钮 → PlushButton unstyled**

保留 className 控制网格。

- [ ] **Step 5: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/SafariWindow.tsx
git commit -m "refactor(desktop-os): Safari 工具条迁移到 Plush 控件"
```

### Task 4.3: AccountWindow

**Files:** Modify `apps/desktop-os/src/apps/AccountWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 表单输入 → PlushInput**

用户名 / 密码 / 邮箱 / 电话 → `<PlushInput aria-label="...">`,密码补 `type="password"`。

- [ ] **Step 3: 操作按钮 → PlushButton**

登录 / 保存资料 / 绑定 → `tone="primary"` (利用已有 `loading` props 接 isPending);
退出登录 / 解绑 → `tone="danger"`;
其它 → `tone="neutral"`。

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/AccountWindow.tsx
git commit -m "refactor(desktop-os): Account 表单迁移到 Plush 控件"
```

### Task 4.4: MailWindow

**Files:** Modify `apps/desktop-os/src/apps/MailWindow.tsx`

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 列表 actions → PlushButton unstyled**

每条邮件 row 的快捷动作按钮使用 `unstyled`,行 row 本身若是 button 也走 `unstyled` 保留 className。

- [ ] **Step 3: 工具栏 → PlushButton**

刷新 / 搜索切换 / 解绑 → `tone="neutral"` 或 `tone="danger"`;
搜索 → `<PlushInput type="search" aria-label="搜索邮件">`。

- [ ] **Step 4: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/MailWindow.tsx
git commit -m "refactor(desktop-os): Mail 列表与工具栏迁移到 Plush 控件"
```

### Task 4.5: MusicWindow

**Files:** Modify `apps/desktop-os/src/apps/MusicWindow.tsx`

- [ ] **Step 1: 引入 PlushButton**

```tsx
import { PlushButton } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 12 处残留按钮 → PlushButton**

播放控制 (除 `MusicRuntime` 外的 UI 按钮) / 列表 actions / 歌词偏移调整 / 队列管理 → 按视觉权重选 tone;图标按钮统一 `size="icon-sm"` 并补 `aria-label`。

- [ ] **Step 3: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/MusicWindow.tsx
git commit -m "refactor(desktop-os): Music 残留控件迁移到 PlushButton"
```

### Task 4.6: FinderWindow

**Files:** Modify `apps/desktop-os/src/apps/FinderWindow.tsx`

> Finder 是本批最复杂的文件 (52 处)。建议按 UI 区域分 5 段提交,每段 typecheck 一次。如需放在同一 commit 也可,只要不在中间挂 type error。

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput, PlushSegmented } from '../ui/PlushPrimitives';
```

- [ ] **Step 2: 侧边栏 (收藏 / 最近 / 资源包入口)**

每条 row → `<PlushButton tone="neutral" unstyled className="...">`,删除 / 编辑型 hover action 用 `tone="danger" size="icon-sm"`。

- [ ] **Step 3: 顶部工具条 (前进 / 后退 / 视图切换 / 排序 / 刷新)**

前进 / 后退 / 刷新 → `<PlushButton size="icon-sm" tone="neutral" aria-label="...">`;
视图切换 (网格 / 列表) → `PlushSegmented` (`ariaLabel="视图"`);
排序下拉 → 维持现有 dropdown menu,触发器换 `<PlushButton tone="neutral" size="sm">`。

- [ ] **Step 4: 搜索 → PlushInput**

`<PlushInput type="search" aria-label="搜索资源">`。

- [ ] **Step 5: 资源卡片 / 列表行 actions → PlushButton**

资源卡片若为 `<button>` (整张卡片可点) → `<PlushButton tone="neutral" unstyled className="...">`;
hover 显示的快捷动作 (下载 / 收藏 / 复制链接 / Open With) → `<PlushButton size="icon-sm" tone="neutral" aria-label="...">`;
危险操作 (删除资源包 / 删除保存搜索) → `tone="danger"`。

- [ ] **Step 6: 重命名 / 详情区表单 → PlushInput**

`<input>` 重命名 / 备注输入 → `PlushInput`;`<textarea>` 描述 → `PlushTextarea` (按需 import)。

- [ ] **Step 7: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/FinderWindow.tsx
git commit -m "refactor(desktop-os): Finder 工具条与资源面板迁移到 Plush 控件"
```

### Task 4.7: AICommandCenterWindow

**Files:** Modify `apps/desktop-os/src/apps/AICommandCenterWindow.tsx`

> 本批最重 (32 处)。按三栏布局分 4 步执行。

- [ ] **Step 1: 引入控件**

```tsx
import { PlushButton, PlushInput, PlushSegmented, PlushTextarea } from '../ui/PlushPrimitives';
import PlushSelect from '../ui/PlushSelect';
```

- [ ] **Step 2: 左栏 (智能体卡片 / 会话列表)**

智能体卡片 / 会话 row → `<PlushButton tone="neutral" unstyled className="...">`;
"新建智能体" / "新建会话" → `tone="primary"`;
hover 显示的删除 → `tone="danger" size="icon-sm"`。

- [ ] **Step 3: 中间 (主对话 + 输入框 + 建议胶囊)**

输入框 → `<PlushTextarea aria-label="向智能体提问" .../>`;
"发送" → `<PlushButton tone="primary" loading={isStreaming}>`;
"停止生成" → `<PlushButton tone="danger" size="sm">`;
建议胶囊 → `<PlushButton tone="neutral" unstyled size="sm" className="...">`;
快捷指令切换 (Chat / 总结 / 翻译 / 改写 / Prompt Lab) → `PlushSegmented`,选项以现有枚举构造。

- [ ] **Step 4: 右栏 (智能体详情 + 资料编辑区)**

模型选择 → `PlushSelect`;头像色 / 头像图标的选择若是 button group 则 → `PlushSegmented`;
名称 / 简介 → `PlushInput` / `PlushTextarea`;
"保存" / "取消" → `PlushButton`(主 primary / 次 neutral);
"删除智能体" → `tone="danger"`。

- [ ] **Step 5: typecheck + check + commit**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
git add apps/desktop-os/src/apps/AICommandCenterWindow.tsx
git commit -m "refactor(desktop-os): AI Command Center 全面迁移到 Plush 控件"
```

### Task 4.8: MiniApps.css 清档

**Files:** Modify `apps/desktop-os/src/apps/MiniApps.css`

- [ ] **Step 1: 删除前的零引用确认**

按以下 grep 命令逐个 class 确认 `apps/desktop-os/src/apps/**/*.tsx` 内已经没有引用:

```bash
rg "mini-app__plain" apps/desktop-os/src/apps
rg "mini-app__secondary" apps/desktop-os/src/apps
rg "dock-app-window__button" apps/desktop-os/src/apps
rg "calculator-keypad__key" apps/desktop-os/src/apps
rg "mini-segmented" apps/desktop-os/src/apps
rg "mini-actions__btn" apps/desktop-os/src/apps
```

每条命令应输出空。如果还有引用,回到对应的批次 task 把它替换掉,**不要**仅在 CSS 删除而留下 className 引用。

- [ ] **Step 2: 删除按钮 / 分段 / 自定义 input 样式**

在 `MiniApps.css` 中删除以下规则块及其所有变体 (hover / active / focus / disabled / is-active):

- `.mini-app__plain`, `.mini-app__secondary`
- `.dock-app-window__button`
- `.calculator-keypad__key`, `.calculator-keypad__key--*`
- `.mini-segmented` 整段 (包括 `.mini-segmented button`, `.mini-segmented button.is-active`)
- `.mini-actions__btn`
- `.calculator-display__input` (1px hairline 违反 surface tone),`.calculator-display__result` 按钮型样式

- [ ] **Step 3: 保留布局容器并改 token**

以下 class 保留,但把 `border: 1px solid rgba(...)` / `background: rgba(255,255,255,...)` 这类 hairline + 纯白卡片改为 `var(--plush-outline)` / `var(--plush-surface)` / `var(--plush-field)`:

- `.mini-app__panel`
- `.mini-list__row` (它现在被 PlushButton unstyled 沿用)
- `.mini-stat`
- `.mini-app__hero`
- `.dock-app-window__eyebrow`
- `.dock-app-window__badge`

- [ ] **Step 4: typecheck + check**

```bash
pnpm --filter @valley/desktop-os typecheck && pnpm --filter @valley/desktop-os check
```

Expected: 全绿。如有 biome `noUnusedVariables` / 未引用 class 之类,清理对应 import。

- [ ] **Step 5: 手动验收**

启动 dev server,逐个抽查批 1-3 的窗口:
- Calculator / Stopwatch / Clipboard / Notes / Calendar / Finder / Account 等无视觉破口
- 任何窗口出现"无样式裸按钮"都意味着批次 task 漏改 `unstyled` className,回到对应任务补刀。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-os/src/apps/MiniApps.css
git commit -m "refactor(desktop-os): 清理 MiniApps.css 已弃按钮/分段样式"
```

### Task 4.9: 防回潮 vitest 测试

**Files:** Create `apps/desktop-os/tests/plushControlBoundary.test.ts`

- [ ] **Step 1: 写测试文件**

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APPS_ROOT = 'src/apps';
const EXCLUDED_FILES = new Set([
  'appRenderers.tsx',
  'MailHTMLFrame.tsx',
  'MailBodyText.tsx',
  'DiceCupScene.tsx',
]);

const FORBIDDEN_CLASSES = [
  'mini-app__plain',
  'mini-app__secondary',
  'dock-app-window__button',
  'calculator-keypad__key',
  'mini-segmented',
  'mini-actions__btn',
];

const NATIVE_CONTROL_RE = /<(button|input|textarea|select)\b([^>]*)>/g;

function listAppFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listAppFiles(full));
    } else if (entry.endsWith('.tsx') && !EXCLUDED_FILES.has(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('Plush 控件下沉边界', () => {
  const files = listAppFiles(APPS_ROOT);

  it('apps/**/*.tsx 内不出现裸 <button>/<input>/<textarea>/<select> (除 data-game-cell 豁免)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      let match: RegExpExecArray | null;
      NATIVE_CONTROL_RE.lastIndex = 0;
      while ((match = NATIVE_CONTROL_RE.exec(source)) !== null) {
        const [tag, , attrs] = match;
        if (attrs.includes('data-game-cell')) continue;
        const lineIndex = source.slice(0, match.index).split('\n').length;
        violations.push(`${file}:${lineIndex} ${tag}`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('apps/**/*.tsx 内不再引用已删除的按钮 / 分段 class', () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const cls of FORBIDDEN_CLASSES) {
        if (source.includes(cls)) {
          violations.push(`${file} contains "${cls}"`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行 vitest 验证**

```bash
pnpm --filter @valley/desktop-os exec vitest run tests/plushControlBoundary.test.ts
```

Expected: 两条断言均通过。如失败,根据失败信息回到对应窗口任务补豁免或修引用。

- [ ] **Step 3: 跑全量 vitest 兜底**

```bash
pnpm --filter @valley/desktop-os exec vitest run
```

Expected: 已有测试集 + 新增 plushControlBoundary 全绿。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop-os/tests/plushControlBoundary.test.ts
git commit -m "test(desktop-os): 新增 Plush 控件下沉防回潮断言"
```

### Task 4.10: 全量收尾验证

**Files:** none (verification only)

- [ ] **Step 1: 命令行核对裸控件**

```bash
rg --glob '*.tsx' '<(button|input|textarea|select)\b' apps/desktop-os/src/apps | rg -v 'data-game-cell'
```

Expected: 输出为空 (除注释或字符串里偶现的 ASCII 误报,人工核对一遍)。

- [ ] **Step 2: 命令行核对废弃 class**

```bash
rg "mini-app__plain|mini-app__secondary|dock-app-window__button|calculator-keypad__key|mini-actions__btn" apps/desktop-os/src/apps
```

Expected: 输出为空 (允许 `mini-segmented` 在 PlushSegmented 不引用,这里只针对 src/apps)。

- [ ] **Step 3: 三件套 + encoding-guard**

```bash
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
  apps/desktop-os/src/apps/CalculatorWindow.tsx \
  apps/desktop-os/src/apps/MiniApps.css \
  apps/desktop-os/tests/plushControlBoundary.test.ts \
  apps/desktop-os/src/ui/PlushSegmented.tsx \
  apps/desktop-os/src/ui/PlushSegmented.css \
  apps/desktop-os/docs/PLAN.md
```

Expected: typecheck / check / vitest 全绿;encoding-guard 无 mojibake 提示。

- [ ] **Step 4: 手动验收清单 (附在最终交付报告)**

- 31 个窗口逐个开起来抽查交互不退化 (owner)
- AICommandCenter 跑 Tab + Enter 键盘可达
- Calendar 日期格子键盘可达
- Settings 开关切换正常
- Music 队列 / 歌词面板按钮无视觉断裂
- Finder 重命名 / 删除 / 排序菜单交互无断裂

### Task 4.11: 更新长期能力文档

**Files:** Modify `apps/desktop-os/docs/PLAN.md`

- [ ] **Step 1: 在「当前状态」末尾追加一行**

```markdown
- Desktop OS 已完成 Plush 控件下沉:`apps/desktop-os/src/apps/**/*.tsx` 内零原生交互控件 (游戏 hit-target 通过 `data-game-cell` 豁免) 与零自定义按钮样式;`PlushPrimitives` 新增 `PlushSegmented`;`MiniApps.css` 仅保留布局容器骨架与 token;新增 `plushControlBoundary.test.ts` 防回潮断言。
```

- [ ] **Step 2: encoding-guard**

```bash
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/desktop-os/docs/PLAN.md
```

Expected: 无 mojibake。

- [ ] **Step 3: Commit**

```bash
git add apps/desktop-os/docs/PLAN.md
git commit -m "docs(desktop-os): 同步 Plush 控件下沉完成状态"
```

---

## Self-Review (执行后)

执行 plan 的 agent 应在批 4 全部完成后,对照下列检查项过一遍:

1. **Spec coverage** — spec §9 验收标准 7 条逐条对应:
   - 裸控件 = 0 → Task 4.10 Step 1 ✓
   - 废弃 class = 0 → Task 4.10 Step 2 ✓
   - PlushSegmented 就位 → Task 0.1 ✓
   - MiniApps.css 仅留布局 → Task 4.8 ✓
   - biome check + plushControlBoundary 全绿 → Task 4.10 Step 3 ✓
   - typecheck/check/vitest 全绿 → Task 4.10 Step 3 ✓
   - PLAN.md 已 done → Task 4.11 ✓

2. **Placeholder scan** — 本 plan 内不应出现"TBD"、"参考批 N"无代码、"add error handling"等。

3. **Type consistency** — `PlushSegmented` 接口在 Task 0.1 定义 (`value` / `options` / `onValueChange` / `ariaLabel`),所有引用 (Stopwatch / Weather / FocusTimer / Palette / BlockDrop / AICommandCenter) 均按此签名。`PlushSelect` 接口贯穿 Converter / Calendar / AICommandCenter 三处:`value` / `options: {value,label}[]` / `ariaLabel` / `onChange(value)`。`PlushButton` 仅使用 `tone: 'primary' | 'neutral' | 'accent' | 'danger'`,**不出现 tone="ghost"**;弱按钮场景统一用 `unstyled`。

---

## Execution Handoff

Plan 完成并保存到 `docs/plans/2026-06-22-desktop-os-plush-control-migration.md`,共 31 个窗口拆为 5 批,**约 32 个 task / 130+ steps**。两种执行选择:

**1. Subagent-Driven (recommended)** — 我每批派一个 fresh subagent (或更细粒度按 task),subagent 完成后我做两阶段 review (类型 / 代码 / 视觉清单);适合本任务的高重复度 + 文件互不耦合。

**2. Inline Execution** — 在当前会话直接按批执行,每批 typecheck + check 当 checkpoint;适合需要更紧凑控制的场景,但 token 占用更高。

请告诉我用哪种,我就开始执行批 0。
