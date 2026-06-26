# Desktop OS · Plush 控件下沉迁移设计

- 日期:2026-06-22
- 范围:`apps/desktop-os/src/apps/**/*.tsx` 的全部窗口控件,以及配套 `PlushPrimitives` / `MiniApps.css` / lint 配置
- 工作流档位:C 档(`brainstorming` → `writing-plans` → `executing-plans`)
- 长期能力归档:`apps/desktop-os/docs/PLAN.md` 立条「Plush 控件下沉」并按批更新进度

## 1. 背景与现状

Desktop OS 的设计规范(`apps/desktop-os/docs/DESIGN.md`)要求所有交互控件都通过 `PlushPrimitives` 包装层进入页面,
禁止在窗口实现里直接出现 shadcn / base-ui 原生组件,也禁止 1px hairline + 纯白卡片这类违反 surface tone 的视觉。

实际扫描结果:

- `apps/desktop-os/src/apps/**/*.tsx` 共 35 个文件,其中 31 个文件包含裸 `<button>` / `<input>` / `<textarea>` / `<select>`,
  共 277 处直写原生控件。
- 仅 5 个窗口(Music / Account / Safari / Weather / Blog)从 `PlushPrimitives` import 了控件包装,且仍残留原生控件。
- `MiniApps.css` 内堆积 `.mini-app__plain` / `.mini-app__secondary` / `.dock-app-window__button` / `.mini-segmented`
  等自定义按钮/分段样式,被 28 个文件复用,与 DESIGN.md 的 surface tone 体系冲突。
- `mini-segmented` 形态在 7 个文件出现 13 处;`PlushPrimitives` 缺少对应的 `PlushSegmented`。

## 2. 需求边界(已与 owner 对齐)

- 本次治理范围:全量 31 个窗口分批迁移,目标态为 `src/apps` 内**零原生交互控件 + 零自定义按钮样式**。
- 游戏 hit-target 豁免:Snake / BlockDrop / DiceCup / CloudBounce / PlushMatch / BeadSort / Palette / PlushGarden 等
  作为「棋盘格 / 卡片 / 骰盅 / 颜料井」的原生 button 保留,标记 `data-game-cell="true"` 给 lint 放行。
  「开始 / 重置 / 暂停 / 设置」等系统控件仍必须走 `PlushButton`。
- `MiniApps.css` 按控件语义拆分:按钮类全删、必要布局容器(panel / list-row / stat / eyebrow)保留并改用 plush-* token。
- `PlushPrimitives` 新增 `PlushSegmented`(必加);数值输入统一复用 `PlushInput type="number" inputMode="numeric"`,不引入 `PlushNumberInput`。
- 工作流走 superpowers 全流程,plan / spec 落到 `docs/superpowers/`,长期能力同步到 `apps/desktop-os/docs/PLAN.md`。
- 防回潮:在 `apps/desktop-os/tests/` 新增 vitest 文件扫描测试,断言 `src/apps/**/*.tsx` 内
  排除 `data-game-cell` 后无裸 `<button>` / `<input>` / `<textarea>` / `<select>`,且无废弃 class 引用;
  CI 走 `pnpm --filter @valley/desktop-os exec vitest run` 兜住。

## 3. 终态与三层划分

### 3.1 终态

- `apps/desktop-os/src/apps/**/*.tsx` 内裸 `<button>` / `<input>` / `<textarea>` / `<select>` 计数 = 0
  (除标记 `data-game-cell` 的游戏 hit-target)。
- `apps/desktop-os/src/apps/**/*.tsx` 内零自定义按钮样式 className:JSX 中对 `.mini-app__plain` /
  `.mini-app__secondary` / `.dock-app-window__button` / `.calculator-keypad__key*` 等的引用全部替换为 PlushButton;
  对应 CSS 规则在批 4 的 `MiniApps.css` 清档时一并删除。
- `PlushPrimitives` 是 src/apps 进入交互控件的唯一入口,新增 `PlushSegmented`,其它按需补齐。
- `MiniApps.css` 拆为「布局容器骨架」+「装饰 token」,删除按钮 / 分段 / 自定义 input 样式。
- biome / eslint 规则 + stylelint 禁用启用,后续 PR 自动拦截回潮(改为 vitest 文件扫描测试,见 §7.3)。

### 3.2 与 DESIGN.md 三层架构对齐

| 层 | 本次任务的处理 |
|---|---|
| Scene | 不动。游戏舞台 / 壁纸 / 沉浸态保持现状(含 `DiceCupScene.tsx`)。 |
| System | 本次重点。所有窗口的按钮 / 输入 / 分段 / 文本域 / 选择器全部下沉到 PlushPrimitives;1px hairline + 纯白卡片改为 surface tone + 阴影分层。 |
| Identity | 头像、徽章、加载吉祥物保持现状;Stopwatch 等的状态徽章语义保留,视觉走 `PlushBadge` 或 surface tone div(不再硬编码 `.dock-app-window__badge`)。 |

## 4. 文件清单与分批方案

### 4.1 批 0 — PlushPrimitives 缺口 + Calculator 模板

| 文件 | 类型 | 修改 |
|---|---|---|
| `apps/desktop-os/src/ui/PlushPrimitives.tsx` | 新增 | `PlushSegmented<TValue>`,基于 shadcn Tabs 或裸 radiogroup 包装,接 `value` / `onValueChange` / `options`。 |
| `apps/desktop-os/src/ui/PlushPrimitives.css` | 改 | 新增 `.plush-segmented` token(背景 / hover / `data-state=on`);若 PlushInput 数字态需要专门视觉,加 `.plush-field--numeric`。 |
| `apps/desktop-os/src/apps/CalculatorWindow.tsx` | 改(示范) | 6 处 `<button>` → `PlushButton`(数字 `neutral`、运算 `accent`、等号 `primary`、清除 `danger`);删除 `MiniApps.css` 内 `.calculator-keypad__key*`;数字显示从 `<input readOnly>` 改为 `<div role="status">`。 |

**批 0 验收**:Calculator 视觉与原版近似但不再有任何自定义 button class;`pnpm --filter @valley/desktop-os typecheck` + `check`;
手动核对计算逻辑;沉淀「窗口迁移模板」,后续 4 批照抄。

### 4.2 批 1 — 工具类(8 个窗口,71 处)

| 文件 | 原生计数 | 主要改动 |
|---|---|---|
| `StopwatchWindow.tsx` | 8 | 系统按钮 → PlushButton;`mini-segmented` → PlushSegmented;时长输入 → PlushInput type="number"。 |
| `RandomizerWindow.tsx` | 4 | 模式 → PlushSegmented;输入域 → PlushTextarea;抽签 → PlushButton tone="primary"。 |
| `ConverterWindow.tsx` | 4 | 单位 → PlushSelect(已有高阶组件);数值 → PlushInput type="number";切换方向 → PlushButton size="icon"。 |
| `ClipboardWindow.tsx` | 7 | 历史项操作 → PlushButton(unstyled);搜索 → PlushInput。 |
| `DownloadsWindow.tsx` | 1 | 单个 button → PlushButton;`mini-list__row` 改 token。 |
| `DeskTidyWindow.tsx` | 3 | 整理动作 → PlushButton。 |
| `DailyToolsWindow.tsx` | 20 | 工具入口 → PlushCard + PlushButton;放本批末尾做。 |
| `DevToolsWindow.tsx` | 24 | 子工具 tabs → PlushTabs;每个工具内部按钮/输入全替换;放本批最后。 |

### 4.3 批 2 — 生产力 / 信息(7 个窗口,47 处)

| 文件 | 原生计数 | 主要改动 |
|---|---|---|
| `NotesWindow.tsx` | 7 | 列表 actions → PlushButton(unstyled);编辑域 → PlushTextarea。 |
| `TextLabWindow.tsx` | 4 | 工具栏 → PlushButton size="icon";输入 → PlushTextarea。 |
| `FocusTimerWindow.tsx` | 4 | 模式 → PlushSegmented;时长 → PlushInput type="number";启动 → PlushButton。 |
| `CalendarWindow.tsx` | 19 | 日期格子参照游戏 hit-target 豁免但 hover 走 token;月份 / 新建 → PlushButton;事件输入 → PlushInput / PlushTextarea。 |
| `SettingsWindow.tsx` | 3 | switch / select 走已有包装;剩余按钮 → PlushButton。 |
| `AboutWindow.tsx` | 2 | 链接按钮 → PlushButton variant="link"。 |
| `WeatherWindow.tsx` | 8 | 城市 / 收藏 → PlushButton;单位切换 → PlushSegmented。 |

### 4.4 批 3 — 游戏类(8 个窗口,31 处,含豁免甄别)

| 文件 | 原生计数 | 豁免范围 | 系统控件迁移 |
|---|---|---|---|
| `SnakeWindow.tsx` | 6 | 方向键 4 处 | 开始 / 重置 → PlushButton。 |
| `BlockDropWindow.tsx` | 7 | 旋转 / 左移 / 右移 / 下落 4 处 | 重开 / 暂停 / 难度 → PlushButton + PlushSegmented。 |
| `DiceCupWindow.tsx` | 3 | DiceCupScene 内骰子面已豁免(本次 Scene 不动) | 摇骰 / 历史 / 重置 → PlushButton。 |
| `CloudBounceWindow.tsx` | 3 | 命中目标 | 开始 / 重置 → PlushButton。 |
| `PlushMatchWindow.tsx` | 2 | 卡片 | 重置 / 结束 → PlushButton。 |
| `BeadSortWindow.tsx` | 2 | 珠柱 | 重置 → PlushButton。 |
| `PlushGardenWindow.tsx` | 3 | 地块 | 浇水 / 施肥 / 收获 → PlushButton。 |
| `PaletteWindow.tsx` | 5 | 颜料井 / 画布单元 | 工具切换 → PlushSegmented;清空 → PlushButton。 |

### 4.5 批 4 — 重型应用 + 残留 + MiniApps.css 清档 + lint(7 个窗口,122 处)

| 文件 | 原生计数 | 主要改动 |
|---|---|---|
| `MailWindow.tsx` | 7 | 列表 actions / 写信工具栏 → PlushButton;搜索 → PlushInput。 |
| `AICommandCenterWindow.tsx` | 32 | 命令面板 / 提示词编辑 / agent 切换 / 历史 → PlushButton + PlushTextarea + PlushSegmented;最重,放最后。 |
| `MusicWindow.tsx` | 12 | 残留控制按钮 / 列表 actions → PlushButton。 |
| `FinderWindow.tsx` | 52 | 侧边栏 / 工具条 / 列表 actions / 搜索 / 重命名 → PlushButton + PlushInput;视图切换 → PlushSegmented。 |
| `SafariWindow.tsx` | 7 | 地址栏 → PlushInput;前进 / 后退 / 刷新 → PlushButton size="icon"。 |
| `BlogWindow.tsx` | 3 | 残留按钮 → PlushButton。 |
| `AccountWindow.tsx` | 9 | 表单 → PlushInput + PlushButton;退出登录 → PlushButton tone="danger"。 |

**MiniApps.css 清档**:

- 删:`.mini-app__plain` / `.mini-app__secondary` / `.dock-app-window__button` / `.calculator-keypad__key*` /
  `.mini-segmented` / `.mini-actions__btn` / 所有按钮 hover/active 自定义样式。
- 留:`.mini-app__panel`(改 plush surface tone,去 1px hairline) / `.mini-list__row` / `.mini-stat` /
  `.mini-app__hero` / `.dock-app-window__eyebrow` / `.dock-app-window__badge`(改 token)。
- 拆:布局类规则保留在 `MiniApps.css`;按钮 / 输入 / segmented 全部交给 PlushPrimitives 自己的样式。

**防回潮 vitest 测试(批 4 末尾上)**:

- 在 `apps/desktop-os/tests/plushControlBoundary.test.ts` 新增文件扫描测试:遍历 `src/apps/**/*.tsx`(排除
  `appRenderers.tsx` / `MailHTMLFrame.tsx` / `MailBodyText.tsx` / `DiceCupScene.tsx`),断言无裸
  `<button>` / `<input>` / `<textarea>` / `<select>`,白名单按 `data-game-cell` 属性。
- 同一文件再加一条断言:`src/apps/` 下 `.tsx` 全文不含 `mini-app__plain` / `mini-app__secondary` /
  `dock-app-window__button` / `calculator-keypad__key` / `mini-segmented` / `mini-actions__btn` 等已删除 class。

### 4.6 不在本次范围

- `appRenderers.tsx`、`MailHTMLFrame.tsx`、`MailBodyText.tsx`、`DiceCupScene.tsx`:纯渲染 / 沙箱 iframe / Scene 层,不触碰。

## 5. 数据流(接口形状映射)

迁移不改业务,只改控件 props 形状。下表为唯一权威映射,5 个批次都按它执行。

| 原生形态 | Plush 形态 | 接口变化 | 注意 |
|---|---|---|---|
| `<button onClick={fn}>` | `<PlushButton onClick={fn}>` | 无 | 保留 `type="button"` 默认值;`type="submit"` 必须显式传。 |
| 图标按钮 `<button>` | `<PlushButton size="icon" tone="neutral" aria-label="...">` | 必须补 `aria-label` | `<svg><title>` 形式的无障碍标签迁到 `aria-label`。 |
| `<input value onChange>` | `<PlushInput value onChange>` | 无 | shadcn Input 透传 onChange。 |
| `<input type="number" onChange>` | `<PlushInput type="number" inputMode="numeric" onChange>` | 无 | 数值校验仍在调用方。 |
| `<textarea onChange>` | `<PlushTextarea onChange>` | 无 | 已有现成包装。 |
| `<select onChange={e => set(e.target.value)}>` | `<PlushSelect value options ariaLabel onChange={set} />`(已有高阶组件) | **`onChange(e)` → `onChange(value: string)`** | 调用方调整一行;接口为 `{ value, label, disabled? }[]`。 |
| `<fieldset role="radiogroup">` + `mini-segmented` | `<PlushSegmented value onValueChange={set} options={[...]} />` | **签名变** | 7 文件 13 处的 segmented 收敛为 props 化数据。 |
| 自渲染 toggle 按钮 | `<PlushSwitch checked onCheckedChange={set}>` 或 `<PlushButton tone="primary">` | 视场景 | Settings / FocusTimer 之前用按钮模拟开关的统一 PlushSwitch。 |
| 游戏 hit-target | 裸 `<button data-game-cell="true">` | 无 | 保留无障碍属性;靠 lint 白名单豁免。 |

## 6. 错误处理(迁移期间已知风险与防线)

按风险高到低列,每条配防线;不堆抽象处理层。

1. **`<button type>` 默认值漂移** — `<form>` 内裸 `<button>` 默认 submit;PlushButton 内部默认 button。
   防线:每批先 grep `<form` 找表单文件,核对每个 PlushButton 的 `type`。
2. **键盘可达性退化** — 误用 `<div onClick>` 替代会丢失原生按键支持。
   防线:迁移规则强制使用 `<PlushButton>`;review checklist 检查无 `onClick` 挂在非按钮元素。
3. **PlushSelect onChange 签名变更漏改** — TS 会兜住 props 不匹配,但若调用方解构 `e.target` 会运行时炸。
   防线:依赖 typecheck;批 1 的 Converter 作为参考实现。
4. **PlushButton `loading` 与 `disabled` 双重 spinner** — 原代码若 `disabled={isPending}` + 自渲染 spinner 要改为 `loading={isPending}`。
   防线:迁移规则明确「只用 `loading`,不再自渲染 spinner」。
5. **MiniApps.css 删除导致 className 断裂** — JSX 残留对已删 class 的引用。
   防线:批 4 删 class 前 `rg "<class-name>"` 确认零引用;stylelint 兜底。
6. **游戏 hit-target 误改** — 把棋盘格替换成 PlushButton 破坏游戏感。
   防线:批 3 单独立项;迁移前先在游戏窗口 JSX 顶部注释「以下 button 为 game hit-target」并打 `data-game-cell`,
   再开始改其他系统按钮。

## 7. 测试策略

不引入新测试框架,只用项目已有能力。UI 一致性的最终验收由 owner 手动跑过(对齐根 AGENTS.md「不要 Playwright 自动验收」)。

### 7.1 每批必跑(自动)

```bash
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
```

- typecheck 兜住 props 形状变化(尤其 select 的 onChange、PlushSegmented 新接口)。
- check(biome)兜住 lint / 死代码 / import 顺序。
- vitest 跑 desktop-os 已有测试 + 批 4 末尾新增的 `plushControlBoundary.test.ts` 防回潮断言。

### 7.2 每批人工验收清单(交付时附上)

- 每个窗口列三条「核心交互」由 owner 点确认。
- 视觉对照前后截图由 owner 完成(我无浏览器);spec 只列出待截图清单。
- 键盘可达性抽查 1 处:Tab + Enter 跑通该批最复杂的窗口(批 4 推荐 AICommandCenter)。

### 7.3 全量收尾验证(批 4 末尾)

```bash
# src/apps 内除 game hit-target 外不再有裸控件
rg --type ts --type tsx '<(button|input|textarea|select)\b' apps/desktop-os/src/apps \
  | rg -v 'data-game-cell'

# 废弃 class 已清空
rg 'mini-app__plain|mini-app__secondary|dock-app-window__button|calculator-keypad__key' \
  apps/desktop-os/src/apps

pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
```

### 7.4 不在范围

- 不引入 Playwright / Storybook / 视觉回归框架。
- 不写 PlushButton 内部行为单测(shadcn 责任)。
- 残留风险写进最终交付报告的「未验证 / 残留风险」段。

## 8. 计划同步与归档

- 长期能力:`apps/desktop-os/docs/PLAN.md` 立条「Plush 控件下沉」,按批更新进度(批 0 → 批 4)。
- 临时产物:本 spec 与配套 plan 保留在 `docs/superpowers/specs|plans/`;任务关闭后由 owner 决定是否清理。
- 提交节奏:每批一个 commit,信息走 `conventional-commit-guard`,默认一行简短中文 conventional commit。

## 9. 验收标准

- [ ] `apps/desktop-os/src/apps/**/*.tsx` 中,排除 `data-game-cell` 后无裸 `<button>` / `<input>` / `<textarea>` / `<select>`。
- [ ] `apps/desktop-os/src/apps/**/*.tsx` 中无 `mini-app__plain` / `mini-app__secondary` / `dock-app-window__button` /
      `calculator-keypad__key*` / `mini-segmented` / `mini-actions__btn` 等已删除 class 引用。
- [ ] `PlushPrimitives` 新增 `PlushSegmented`,文档与示例就位。
- [ ] `MiniApps.css` 仅保留布局容器骨架与装饰 token,无按钮 / 输入 / segmented 样式。
- [ ] biome `check` 全绿;`apps/desktop-os/tests/plushControlBoundary.test.ts` 防回潮断言全绿。
- [ ] `typecheck` / `check` / `vitest run` 全绿。
- [ ] `apps/desktop-os/docs/PLAN.md` 「Plush 控件下沉」一项标 done。
