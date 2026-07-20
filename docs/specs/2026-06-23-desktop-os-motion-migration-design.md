# Desktop OS · 动画统一迁移到 motion 设计

- 日期:2026-06-23
- 范围:`apps/desktop-os` 内「React 进出场 / layout 动画」一层,统一接入 `motion/react`
- 工作流档位:C 档(`brainstorming` → `writing-plans` → `executing-plans`)
- 长期能力归档:`apps/desktop-os/docs/PLAN.md` 立条「动画统一迁移到 motion」,按 Phase 同步进度
- 临时工作产物:本 spec + 同日 plan md;任务关闭后由 owner 决定是否清理

## 1. 背景与现状

Desktop OS 当前的动画分布在三层:

1. **React JS 进出场 / layout 动画**:仅 `apps/desktop-os/src/components/Launchpad.tsx` 一处使用 `motion/react`(`AnimatePresence` + `motion` + `useReducedMotion`),其余窗口 / 弹层 / 列表的进出场要么用 CSS `@keyframes` 一次性 pop,要么直接卸载、没有 exit 动画。
2. **CSS `@keyframes` 装饰类**:全仓 28 处,覆盖 Window 弹出 / Dock bounce / Spotlight 打开 / ControlCenter / NotificationCenter / AICommandCenter 多组消息进场 / Music 唱片旋转 / PlushLoading / PlushImage / PlushSelect / Skeleton 等,均带 `@media (prefers-reduced-motion: reduce)` 兜底。
3. **rAF 直驱 transform**:Window 拖动、Dock magnification、ResizeHandles,60fps 路径,通过 `requestAnimationFrame` 写 ref style。

`package.json` 已声明 `"motion": "^12.40.0"`,**未**显式依赖 `framer-motion`。`pnpm-lock.yaml` 中 `framer-motion@12.40.0` 是 motion 的传递依赖,本 plan 不显式新增。

`apps/desktop-os/AGENTS.md` 「技术栈」段已写「动效:`motion`(Launchpad / 弹窗等关键过渡)+ CSS 过渡 + `prefers-reduced-motion` 兜底」,但实际只兑现了 Launchpad 一个,需要把这条规约落地到所有进出场动画。

## 2. 需求边界(已与 owner 对齐)

- **覆盖边界 = L1**:仅 React 进出场 / layout 动画切到 motion。
  - CSS `@keyframes` 装饰类(loading sheen / shimmer / spin / cloud-drift / Plush 控件 pop 等)**保留 CSS,不动**。
  - rAF 直驱 transform(Window 拖动、Dock magnification、ResizeHandles)**保留 rAF,不动**。
- **迁移节奏 = 4 Phase 递进**:P1 基础 → P2 窗口层 → P3 面板层 → P4 业务列表;每个 Phase 独立 commit、可独立 revert,允许在任意 Phase 末尾停手。
- **reduced-motion 兜底单一来源**:被迁移组件统一用 motion 的 `useReducedMotion()`,同名 CSS `@media (prefers-reduced-motion: reduce)` 分支同步移除;未被迁移的纯装饰 keyframes 继续保留 CSS 媒体查询。
- **验收新增 surface 级单测**:每个 Phase 配套 vitest 文件,断言 motion 接入位置;沿用 `pnpm --filter @valley/desktop-os exec vitest run` 89 用例不掉绿。
- **不引入新动画依赖**:不加 GSAP / 显式 framer-motion / react-spring / lottie,本 plan 唯一动画运行时是 `motion/react`。
- **不跑 Playwright**:按 `AGENTS.md` 不引入 e2e,所有视觉验收交给 owner 人工复核。
- **不跨 app 推广**:本 plan 只覆盖 `apps/desktop-os`,不联动 `apps/web` / `apps/admin` / `apps/life-trace` / `apps/ai-mind-arena` / `apps/world-sim`。

## 3. 终态与架构

### 3.1 终态

- `apps/desktop-os/src/**/*.tsx` 内 React 进出场 / layout 动画统一通过 `PlushMotion` 原语接入,不直接 `import { motion, AnimatePresence } from 'motion/react'`(允许在 `PlushMotion.tsx` 内部独占 import)。
- 已迁移组件配套 CSS 中 `@keyframes` 进出场 keyframe + 同名 `@media (prefers-reduced-motion: reduce)` 分支被删除,留下的只是与 motion 无关的装饰类 keyframes。
- `apps/desktop-os/AGENTS.md` 「设计系统约束」补充一条:进出场动画统一通过 `PlushMotion`,不直接 `import motion/react`。
- `apps/desktop-os/docs/PLAN.md` 立条记录长期能力状态(目标态 / 当前 Phase / 不动 rAF 与装饰 keyframes 的边界)。

### 3.2 PlushMotion 原语

新增独立文件 `apps/desktop-os/src/ui/PlushMotion.tsx`,不污染现有 `PlushPrimitives.tsx`。暴露 4 个原语 + 1 套 token:

- `PlushPresence`:基于 `motion/react` 的 `AnimatePresence`,默认 `mode="popLayout"`、`initial={false}`,所有窗口 / 面板出场用它包裹。
- `PlushPop({open, ...})`:弹层进出场,`initial={{ opacity: 0, scale: 0.96, y: 6 }}` → `animate={{ opacity:1, scale:1, y:0 }}` → `exit` 反向,`transition` 走 `MOTION_TOKENS.pop`(spring)。
- `PlushFade`:纯透明度过渡,服务消息流、tab 切换等不需要位移的场景。
- `PlushSlide({from})`:滑入 / 滑出,方向枚举 `top|right|bottom|left`,服务 NotificationCenter / ControlCenter。
- `MOTION_TOKENS`:同文件顶部唯一事实源,导出 `pop` / `fade` / `slide` 三套 spring / duration / ease 常量;曲线参数允许微调,但不改变「storybook miniature 弹性 + 任天堂 first-party 气质」的视觉语言。

所有原语内部一次性调用 `useReducedMotion()`:返回 true 时把 `transition.duration` 设为 0,把 `initial / exit` 替换为只剩 opacity 变化,避免缩放抖动;对 `PlushPop` 在 reducedMotion=true 时直接 `exit` 返回 `null` 跳过 exit 渲染,防止「关闭瞬间 1 帧残留」。

所有原语透传 `data-state` / `data-motion-presence` / `data-presence-key` 等显式 data 属性,供单测用稳定选择器断言,不依赖 motion 内部 className。

### 3.3 边界明确

- **不动 rAF 路径**:`apps/desktop-os/src/components/window/Window.tsx` 拖拽块、`apps/desktop-os/src/components/Dock.tsx` magnification、`apps/desktop-os/src/ui/ResizeHandles.tsx`,无论看起来多顺手都不在本 plan 内重写。
- **不动装饰类 @keyframes**:`music-spin` / `widget-music-spin` / `menu-music-spin` / `dock-bounce` / `weather-locate-spin` / `cloud-drift` / `plush-loading-*` / `plush-image-shimmer` / `plush-skeleton-shimmer` / `plush-button-dot` / `plush-select-pop`。
- **不动 shadcn 控件自带过渡**:`apps/desktop-os/src/components/ui/` 下的 dialog / dropdown-menu / tooltip / select 等,仍用 base-ui 自身过渡能力。

## 4. 4 Phase 迁移执行计划

### Phase 1 · 基础设施(半天,先有原语再有迁移)

**目标**:把 motion 的「标准接入姿势」固化下来,后面 Phase 只调用、不重写。

**改动**

- 新增 `apps/desktop-os/src/ui/PlushMotion.tsx`,导出 `PlushPresence` / `PlushPop` / `PlushFade` / `PlushSlide` + `MOTION_TOKENS`。
- 新增 `apps/desktop-os/tests/plushMotion.test.tsx`(vitest + @testing-library)。
- 在 `apps/desktop-os/AGENTS.md` 「设计系统约束」段落补一行:进出场动画统一通过 `PlushMotion`,不直接 import `motion/react`。

**单测断言**

- reducedMotion=true 时 4 个原语 `transition.duration` 应为 0。
- `PlushPresence` 子节点 `data-motion-presence` 在 mount / unmount 都被渲染。
- `PlushPop` `data-state` 在 `open=false` 时进入 exit 阶段,DOM 中临时残留节点带 `data-state="exit"`。

**不做**:不动任何业务组件,不删任何现有 CSS keyframes / transition。

**验收**

- `pnpm --filter @valley/desktop-os typecheck && check && exec vitest run` 全绿。
- 跑一次 `pnpm --filter @valley/desktop-os build` 记录 dist 体积基线。
- `apps/desktop-os/src/components/Launchpad.tsx` 现有 motion 用法不动,留到 P3 一起治理,确认 P1 没有回归。

### Phase 2 · 窗口层(核心体感)

**目标**:窗口关闭 / 最小化、Spotlight、Dock 菜单 / 子菜单进出场切到 `PlushMotion`,让用户感知最强的「窗口层」先有一致动画语言。

**改动**

- `apps/desktop-os/src/components/window/Window.tsx` + WindowManager:
  - 用 `PlushPresence` 包外层渲染列表;单个 Window 用 `PlushPop`。
  - 当前关闭即卸载 → 改成「先 exit 动画,AnimatePresence 完成再卸载」;`closeApp` 与 store 解耦,store 仍可同步删,AnimatePresence 自己持有快照子节点。
  - **rAF 拖拽路径完全不动**(`apps/desktop-os/src/components/window/Window.tsx` 第 60–80 行 rAF 块只读不改)。
- `apps/desktop-os/src/spotlight/Spotlight.tsx` + `Spotlight.css`:换 `PlushPop`,删 `@keyframes spotlight-fade` / `spotlight-pop` 与对应 CSS `prefers-reduced-motion` 分支。
- `apps/desktop-os/src/components/Dock.tsx` + `Dock.css`:
  - Dock 应用菜单 / 子菜单进出场用 `PlushPop`,删 `@keyframes dock-menu-pop` / `dock-submenu-pop` 及其 reduced-motion 分支。
  - **`@keyframes dock-bounce`(应用打开图标弹跳)属于装饰类,保留 CSS。**
  - **rAF magnification 完全不动**(`apps/desktop-os/src/components/Dock.tsx` 第 140–160 行 rAF 块只读不改)。

**新增 surface 单测**

- `windowPresence.test.tsx`:断言关闭 / 最小化触发后 DOM 中存在带 `data-state="exit"` 的快照节点;reducedMotion=true 下立即卸载。
- `spotlightPresence.test.tsx`:断言 Spotlight `open=false` 时仍走 exit 路径。
- `dockMenuPresence.test.tsx`:断言 Dock 应用菜单 / 子菜单 open=false 时走 exit 路径。

**人工验收清单**

- 打开 / 关闭 / 最小化 5 个 App(Finder / Safari / Mail / Music / Notes),期望 ≈ 0.32s 弹出 + ≥ 150ms exit 淡出且不闪。
- Spotlight ⌘空格唤起 / Esc 关闭,期望对称(不再「唤起有动画、关闭硬切」)。
- Dock 右键应用菜单 + 二级子菜单进出场。
- 系统设置开启「减少动画」后重测,期望所有进出场立即完成无缩放抖动。

### Phase 3 · 面板层

**目标**:贴边面板的进出场统一到 `PlushSlide`。

**改动**

- `apps/desktop-os/src/components/ControlCenter.tsx` + `ControlCenter.css`:`PlushSlide from="top"`,删 `@keyframes cc-pop`。
- `apps/desktop-os/src/components/NotificationCenter.tsx` + `NotificationCenter.css`:面板 `PlushSlide from="right"`;通知卡片单条进出场用 `PlushFade`(多条快速到来时通过 `AnimatePresence` 自动错峰)。`@keyframes nc-pop` 删除;`@keyframes widget-music-spin` 是装饰类,保留。
- `apps/desktop-os/src/components/Launchpad.tsx`:从直接调 `motion` / `AnimatePresence` 切到 `PlushPresence` / `PlushPop`,删 `CLOSE_ANIMATION_MS=260` 的 `setTimeout` + `setShouldRender` 逻辑(让 `AnimatePresence` 接管卸载时机,不再手算 260ms)。**翻页过渡留到 P4 处理**,本 Phase 只做整体进出场切换。**P3 task 第一条:先把现有 Launchpad motion 用法逐行对照迁到 PlushMotion,再做 setTimeout(260ms) 删除**(防止丢失现有 `useReducedMotion` 行为)。

**新增 surface 单测**

- `panelSlide.test.tsx`:断言 ControlCenter / NotificationCenter `open=false` 时仍存在快照节点直到动画结束。
- `launchpadPresence.test.tsx`:断言 Launchpad 关闭由 `AnimatePresence` 触发,不再依赖 `setTimeout(260ms)`。

**人工验收清单**

- 控制中心 / 通知中心反复开关 5 次,期望无残影 / 无 z-index 错层。
- 通知快速来 3 条再快速消 3 条,期望每条独立淡入淡出。
- Launchpad 打开 / 关闭 / 翻页,期望关闭时图标不再「先停 260ms 再消失」。

### Phase 4 · 业务列表

**目标**:让两个高密度内容区接入「列表层动画」。

**改动**

- `apps/desktop-os/src/apps/AICommandCenterWindow.tsx` + `AICommandCenterWindow.css`:
  - 消息流外层 `PlushPresence`,每条消息 `PlushFade`(保留淡入,不再做硬位移避免聊天可读性问题)。
  - 删 `@keyframes ai-command-thread-in` / `ai-command-message-in` / `ai-command-inspector-in` / `ai-command-fade-in` / `ai-command-dialog-in` 5 处。
  - `prefersReducedMotion` 的 `matchMedia` 仍保留(与会话渲染策略相关),**不与 motion 的 `useReducedMotion` 重复实现** —— AI Command 模块的动画分支只读 `useReducedMotion()`;原 `matchMedia` 改名为 `prefersReducedAutoScroll` 只服务非动画的「自动滚动」开关。
- `apps/desktop-os/src/components/Launchpad.tsx` 翻页过渡:用 `motion.div` + `layout` + `transition={MOTION_TOKENS.slide}`(P3 已切顶层 PlushPresence,这里只补翻页内部位移)。

**新增 surface 单测**

- `aiCommandPresence.test.tsx`:断言新增消息渲染于 `PlushPresence` 子树内(断言外层 wrapper 的 `data-motion-presence` 属性);切换会话清空时旧消息进入 exit。

**人工验收清单**

- AI Command Center 发送 5 条消息观察淡入;切换会话时旧列表淡出。
- 切到「减少动画」后会话仍能正常发送,自动滚动不受影响。

## 5. 测试策略与验收清单

### 5.1 自动化测试矩阵

每个 Phase 落地时**先写测试再迁移**(test-driven),最低保证不掉到「迁了就只有人眼能验」。

| Phase | 新增测试文件 | 覆盖断言 | 红绿循环 |
|---|---|---|---|
| P1 | `tests/plushMotion.test.tsx` | reducedMotion=true 时 4 个原语 `transition.duration=0`;`PlushPresence` mount/unmount 都触发;`PlushPop` exit 阶段保留 `data-state="exit"` 节点 | 先写 expect → 跑 vitest 红 → 实现 PlushMotion → 绿 |
| P2 | `tests/windowPresence.test.tsx`、`spotlightPresence.test.tsx`、`dockMenuPresence.test.tsx` | 关闭 / 最小化触发后 DOM 仍有 exit 快照;reducedMotion 下立即卸载;Spotlight / Dock 菜单 open=false 也走 exit 路径 | 写好后先打到现有同步卸载实现红 → 迁移 → 绿 |
| P3 | `tests/panelSlide.test.tsx`、`launchpadPresence.test.tsx` | ControlCenter / NotificationCenter open=false 仍存在 slide-out 子节点;Launchpad 关闭由 `AnimatePresence` 触发,不再依赖 `setTimeout(260ms)` | 删掉 `CLOSE_ANIMATION_MS` 后旧逻辑红 → 接 PlushPresence 后绿 |
| P4 | `tests/aiCommandPresence.test.tsx` | 新增消息渲染于 `data-motion-presence` 容器内;切换会话清空时旧消息进入 exit | 红 → 迁 → 绿 |

**统一断言风格**:用 `data-state` / `data-motion-presence` / `data-presence-key` 这类显式 data 属性做选择器,不依赖 motion 内部 className,防止 motion 升级造成测试脆性。

### 5.2 现有测试不能挂

- `apps/desktop-os/tests/` 当前 89 用例必须保持 100% 通过。
- 重点保护:`desktopLifecycleSurface.test`(`loadResources` / `!currentUrl` / `scheduleIdleWork` 字面量约束)、Mail / Mini Apps surface、Plush 控件 surface。
- 每个 Phase 的 commit 必须能单独跑 `pnpm --filter @valley/desktop-os exec vitest run` 全绿,否则不进下一 Phase。

### 5.3 静态校验三件套(每 Phase 必跑)

```
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <本 Phase 涉及的中文 / CSS / MD>
```

**任何一项不绿不进入下一 Phase**。在 plan md 每个 Phase 末尾固定贴这 4 条命令,避免遗忘。

### 5.4 人工验收清单

按 `apps/desktop-os/AGENTS.md` 「不要使用 Playwright 做自动验收」,每个 Phase 末尾提供「✅ 操作 / ✅ 期望 / ✅ reduced-motion 期望」三列 checklist 给 owner 自验。具体清单见 Section 4 各 Phase。

### 5.5 回滚策略

- **粒度**:每个 Phase 是独立 commit / 可独立 revert 的「`feat(desktop-os): motion P{n} - <scope>`」。一个 Phase 出问题不连累其他 Phase。
- **应急开关**:不引入运行时 feature flag。motion 已经是 dependency,回滚直接 `git revert` 该 Phase commit。
- **CSS keyframes 删除时机**:每个 Phase 删 keyframes 与改 TSX 必须**同一 commit**,避免「TSX 已迁但 CSS 残留导致两套动画叠加」的中间态。
- **Phase 之间允许停留**:plan 不要求一次性 4 Phase 跑完,每个 Phase 完成后可随时停手;停在任意 Phase 末尾都是「内部一致 + 视觉自洽」的状态。

### 5.6 性能与包体观察(不阻塞)

- P1 完成后跑一次 `pnpm --filter @valley/desktop-os build`,记录 dist 体积基线。
- P4 完成后再跑一次,差值写入 plan md 末尾的「实施后记」段。
- 不强行设阈值,但若 motion 引入超过 +60KB gzipped 视为预算异常,回头检查是否误用 `import * from 'motion'`。

### 5.7 计划文档同步

- C 档产物落 `docs/specs/2026-06-23-desktop-os-motion-migration-design.md`（本文件）和 `docs/plans/2026-06-23-desktop-os-motion-migration.md`，按 `AGENTS.md` 的临时工作产物规则。
- 同时在 `apps/desktop-os/docs/PLAN.md` 加一个「动画统一迁移到 motion」条目,**只记长期能力状态**(迁移目标 / 当前 Phase / 不动 rAF 与装饰 keyframes 的边界),不抄具体 task。
- `apps/desktop-os/AGENTS.md` 「设计系统约束」补一行:进出场动画统一通过 `PlushMotion`,不直接 `import motion/react`(这条放在 P1 完成时同步)。

## 6. 风险登记

| # | 风险 | 命中条件 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | `AnimatePresence` 接管卸载,window store 删除时机错位 | P2 关闭 / 最小化时 store 同步删 → AnimatePresence 仍持子节点 → 子节点访问已删的 store slice 报错 | 控制台报 cannot read properties of undefined / 闪红 | `PlushPop` 子节点订阅 store 时用 `useStore(selector, shallow)` + selector 在 id 缺失时返回 `null`;exit 期间组件只渲染最后快照,不再调用网络 / store 改写 |
| R2 | reducedMotion 双源不一致 | P4 AICommandCenter 同时存在 `matchMedia('(prefers-reduced-motion: reduce)')` 与 `useReducedMotion()`,两个值在系统切换时刷新时机不同 | 部分动画跳过、部分不跳过 | P4 强制:动画分支只读 `useReducedMotion()`;原 `matchMedia` 改名为 `prefersReducedAutoScroll` 只服务自动滚动逻辑 |
| R3 | motion 包体超预算 | 误用 `import * as Motion from 'motion'` 或顺手引入 `motion/react-three` 等子入口 | bundle +200KB | P1 在 `PlushMotion.tsx` 文件顶部固定写 `import { AnimatePresence, motion, useReducedMotion } from 'motion/react'`;plan 验收里加 build 对比;biome lint 规则不变(不新增插件) |
| R4 | 现有 89 用例脆性 | 测试用 className / 选择器命中 motion 自动加的 transform 内联样式 | vitest 红 | 所有断言用 `data-state` / `data-motion-presence` / role / text,不用 className;P1 即在 `PlushMotion.tsx` 强制透传这些 data-* 属性 |
| R5 | rAF 路径误伤 | P2 改 `Window.tsx` 时顺手把拖拽里的 transform 也 motion 化 | 60fps 抖动 / 拖动卡顿 | plan 在 P2 章节顶部红色标注「rAF 块只读不改」,精确范围以代码内 rAF / `requestAnimationFrame` 块为准(`Window.tsx` 的 drag rAF 块、`Dock.tsx` 的 magnification rAF 块、`ResizeHandles.tsx` 的 resize rAF 块);plan 落地时按 `git blame` 核实当前行号,不在 spec 中固化行号防漂移 |
| R6 | CSS / TSX 中间态叠动画 | 同 Phase 内 keyframes 删除与 TSX 接 motion 不在同一 commit | 同一弹层走两次动画 / 闪烁 | 强制「同 Phase 同 commit」,commit message 走 `conventional-commit-guard`,例 `feat(desktop-os): motion P2 - window/spotlight/dock-menu` |
| R7 | Launchpad 现有 motion 用法被边缘化 | P3 切到 `PlushMotion` 时丢失 `Launchpad.tsx` 的 `useReducedMotion` 已有行为 | 翻页 / 关闭与系统设置不一致 | P3 task 第一条:先把现有 Launchpad motion 用法逐行对照迁到 PlushMotion,再做 setTimeout(260ms) 删除 |
| R8 | 「减少动画」用户的 PlushPresence 仍排队 exit | reducedMotion=true 时 motion 仍走 0ms 动画但 AnimatePresence 仍调度一帧 | 关闭瞬间 1 帧残留 | `PlushPop` 在 reducedMotion 时直接以 `mode="wait"` + `transition={{ duration: 0 }}` + exit 返回 `null` 跳过 exit 渲染(P1 单测覆盖) |

## 7. Out-of-scope(明确「这版不做」)

- **不动 rAF 路径**:`Window.tsx` 拖拽、`Dock.tsx` magnification、`ResizeHandles.tsx`,无论看起来多顺手都不在本 plan 内重写。
- **不动装饰类 @keyframes**:`music-spin` / `widget-music-spin` / `menu-music-spin` / `dock-bounce` / `weather-locate-spin` / `cloud-drift` / `plush-loading-*` / `plush-image-shimmer` / `plush-skeleton-shimmer` / `plush-button-dot` / `plush-select-pop`。
- **不动 shadcn 控件自带过渡**:`apps/desktop-os/src/components/ui/` 下的 dialog / dropdown-menu / tooltip / select 等,仍用 base-ui 自身过渡能力。
- **不引入新动画依赖**:不加 GSAP / Framer Motion 单独包 / react-spring / lottie,本 plan 唯一动画运行时是 `motion/react`。
- **不重做 `apps/desktop-os/docs/DESIGN.md` 视觉风格**:动画曲线 / 时长可微调,但不改变「storybook miniature 弹性 + 任天堂 first-party 气质」的视觉语言。
- **不补 e2e / Playwright**:按 `AGENTS.md` 不引入 Playwright;人工验收清单已替代。
- **不做跨 app 推广**:本 plan 只覆盖 `apps/desktop-os`。
- **不引入显式 framer-motion**:lockfile 里 framer-motion 是 motion 的传递依赖,本 plan 不显式 `pnpm add framer-motion`,未来 motion 上游切换 runtime 时跟随升级即可。
- **不优化拖拽手感**:例如「关闭窗口飞向 Dock」这类需要 Flip / shared layout 的动画属于下一期。

## 8. Future Work(本期完成后的复盘起点)

- 用 motion 的 `layout` + `LayoutGroup` 实现 Window 关闭飞向 Dock。
- Dock magnification 评估迁到 `useMotionValue` + `useTransform`(替代 R5 中明确 out-of-scope 的 rAF 路径)。
- 把装饰类 `@keyframes`(如 `cloud-drift` / `music-spin`)做一次「能否合并到 motion `useTime` + `useTransform`」的可行性研究 —— 只研究,不立即迁。
- AICommandCenter 消息流接 `AnimatePresence` 的 `popLayout` 模式,让消息删除 / 编辑时上下条自然回填。
