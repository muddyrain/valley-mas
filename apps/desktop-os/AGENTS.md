# Desktop OS · AI 协作入口

本文件是 AI 在 `apps/desktop-os` 目录内工作的局部协作入口。
全局规则、skill 选择和 Git 约定仍以根目录 `AGENTS.md` 为准；项目级技术栈和环境变量见 `docs/PROJECT_GUIDE.md`。

## 项目概述

- **名称：** macOS Plush（毛毡 macOS 风桌面）
- **类型：** Vite 6 + React 19 + TypeScript 独立 app
- **端口：** `5177`（开发模式）
- **启动：** `pnpm --filter @valley/desktop-os dev`
- **目标：** 一个看起来像毛毡毛绒玩具世界的在线桌面系统，用 Finder、Safari、Dock、Launchpad、Spotlight、控制中心、通知中心、Mail、Blog、AI Command Center、Music、Mini Apps 等窗口承载可扩展的资源与工具入口。
- **计划入口：** `apps/desktop-os/docs/PLAN.md`

## 视觉风格

- 风格唯一事实来源:`apps/desktop-os/docs/DESIGN.md`(任天堂 first-party 气质:动森 storybook miniature 打底、Switch 系统 UI 质感作壳层、宝可梦画风元素作角色化点缀)。
- 任何修改色板、控件形状、加载/空态吉祥物、装饰插画或新增视觉资产前,先读 `docs/DESIGN.md` 中的"三层结构"和"边界与禁区"。
- 描述如有冲突,以 `docs/DESIGN.md` 为准。

## 技术栈

- 运行时：React 19 + TypeScript（catalog 版本由 monorepo 统一管理）。
- 构建：Vite 6 + `@vitejs/plugin-react-swc` + `@tailwindcss/vite`。
- 样式：Tailwind 4（`tailwindcss` + `tw-animate-css`）+ 项目自定义 storybook miniature CSS token。
- UI 底座：shadcn / `@base-ui/react`，源码组件落在 `src/components/ui/`，对外统一通过 `src/ui/PlushPrimitives.tsx` 导出 `Plush*` 包装层；shadcn 只做可访问交互能力，视觉一律由 Plush 包装层和 token 控制。
- 图标：`lucide-react`。
- 状态：`zustand`（多个领域 store 拆分在 `src/store/`），偏好和本地数据通过 `localStorage` 维护。
- 动效：`motion`（Launchpad / 弹窗等关键过渡）+ CSS 过渡 + `prefers-reduced-motion` 兜底。
- 滚动：`overlayscrollbars` + `overlayscrollbars-react`，统一通过 `PlushScrollbar` 接入。
- 内容渲染：`react-markdown` + `remark-gfm`（Blog 正文）、`dompurify`（Mail HTML 安全清洗）。
- 3D：`three` + `@react-three/fiber`（仅骰盅等明确需要 3D 舞台的窗口使用）。
- 共享能力：`@valley/format-tools`（开发/日常工具纯函数）、`@valley/browser-media`（浏览器图片处理）、`@valley/mini-games`（小游戏规则）。
- 路径别名：`@/*` 指向 `src/`，配置在 `vite.config.ts` 与 `tsconfig.json`；shadcn 配置见 `components.json`。

## 设计系统约束

- 新增 UI 应优先通过 `PlushPrimitives` 或既有 `Plush*` 组件进入页面，不要直接暴露 shadcn 默认外观或浏览器原生控件。
- 公共组件清单（位于 `src/ui/`）：`PlushPrimitives`（Button/Card/Dialog/Input/Tooltip/Popover 等包装）、`PlushScrollbar`、`PlushImage`、`PlushSelect`、`PlushLoading`、`PlushLoadMore`、`EmptyState`、`Slider`、`ToggleSwitch`、`TrafficLights`、`ResizeHandles`。
- 壳层组件（`Window`、`MenuBar`、`Dock`、`Launchpad`、`Spotlight`、`ControlCenter`、`NotificationCenter`）必须共用同一套 surface / panel / field / accent / outline / shadow / motion / game-shape token，不得引入彼此割裂的暖色卡片或默认菜单 hover。
- 应用窗口、Finder 侧栏、资源区、详情区等高频滚动面板优先接入 `PlushScrollbar`，不直接暴露浏览器默认滚动条。
- 进出场 / layout 动画统一通过 `PlushMotion`（`PlushPresence` / `PlushPop` / `PlushFade` / `PlushSlide`）接入，业务组件不直接 `import 'motion/react'`。装饰类 `@keyframes`（loading / shimmer / spin / cloud-drift / 控件 pop）与 rAF 拖拽缩放路径不在 motion 治理范围内。例外:layout / shared layout 动画（如 Launchpad 翻页）允许在组件内直接 `import { motion } from 'motion/react'`，但 transition 仍走 `MOTION_TOKENS`。

## 运行时与生命周期治理

- `App.tsx` 不直接承载业务定时器或全局 listener；全局键盘 / contextmenu / online-offline 集中在 `DesktopGlobalEvents`，通知轮询集中在 `NotificationPollingGate`，时钟集中在 `ClockGate`，音乐运行时集中在 `MusicRuntime` + `MusicRuntimeGate`，专注计时集中在 `FocusTimerRuntime`。
- `windowStore` 同时维护 `runningAppIds`、`visibleAppIds`、`activeAppIds` 与轻量 `focusedAppId`；focus / move / resize 不改变 App 运行集合，普通 App 最小化后业务组件随窗口内容卸载，只有 Music、FocusTimer 等明确白名单允许后台继续运行。
- 资源、天气、博客、邮件等重数据按窗口或面板激活时再加载；Spotlight / Safari / Finder 不在关闭态订阅资源列表。
- 拖拽和缩放通过 `requestAnimationFrame` 合并写入，本地持久化用 debounce 写 `localStorage`，避免在 scroll 事件中同步落盘。

## 目录结构

```
apps/desktop-os/
├── src/
│   ├── main.tsx              # 入口
│   ├── App.tsx               # 桌面根组件 + 运行时 Gate 编排
│   ├── api/                  # 与 Go server 对接的请求封装（auth/blog/mail/ai/resources/...）
│   ├── apps/                 # 各「应用」窗口组件（Finder/Safari/Mail/Blog/Music/AI/Mini Apps...）
│   ├── components/
│   │   ├── ui/               # shadcn / base-ui 源码组件
│   │   ├── window/           # 窗口管理与窗体（Window、WindowManager）
│   │   ├── ClockGate.tsx
│   │   ├── ControlCenter.tsx
│   │   ├── DesktopGlobalEvents.tsx
│   │   ├── Dock.tsx
│   │   ├── FocusTimerRuntime.tsx
│   │   ├── Launchpad.tsx
│   │   ├── MenuBar.tsx
│   │   ├── MusicMenuItem.tsx
│   │   ├── MusicRuntime.tsx / MusicRuntimeGate.tsx
│   │   ├── NotificationCenter.tsx
│   │   ├── NotificationPollingGate.tsx
│   │   └── Wallpaper.tsx
│   ├── finder/               # Finder 内容模型与默认数据
│   ├── hooks/                # 通用 hooks
│   ├── lib/                  # `cn` 等通用工具
│   ├── music/                # 音乐目录、歌词
│   ├── spotlight/            # Spotlight 数据与组件
│   ├── store/                # zustand store（auth/blog/browser/calendar/controlCenter/dock/finder/launchpad/music/notes/notificationCenter/resource/spotlight/tool/weather/window/desktopPreferences/windowSizing）
│   ├── styles/               # 全局 CSS + 主题 token
│   ├── tools/                # 工具箱与小游戏的本地辅助逻辑
│   ├── ui/                   # PlushPrimitives 与公共 UI 控件
│   ├── utils/                # 通用 util（如 scheduleIdleWork）
│   └── widgets/              # 通知中心小组件数据
├── tests/                    # vitest 用例（生命周期、API、surface、Mail、Mini Apps...）
├── docs/
│   └── PLAN.md               # Desktop OS 当前计划与验收标准
├── public/                   # 壁纸 / Dock / 文件夹 / 小组件图标等静态资源
├── scripts/                  # 本地脚本输入（不进 dist）
├── components.json           # shadcn 配置
├── vite.config.ts            # 入口、Tailwind 插件、`@/*` alias、5177 端口
└── package.json              # 包名 `@valley/desktop-os`
```

## 环境变量

- `.env.example` 已维护以下条目，新增变量必须同步示例：
  - `VITE_API_BASE_URL`：Go API 基础地址（默认 `http://localhost:8080/api/v1`）。
  - `VITE_AUDIUS_API_BASE_URL`：Audius 公共音乐 API。
  - `VITE_AUDIUS_API_BEARER_TOKEN`：仅本地注入；因 Vite 前端环境变量会暴露到浏览器，生产环境如需保护 token 应改为 server 代理。
- 不向仓库写入真实 token、授权码或 API key。
- 后端相关密钥（`MAIL_SECRET_KEY`、`GMAIL_*` 等）仍以 `server/.env.example` 与 `docs/PROJECT_GUIDE.md` 为准。

## 校验命令

```bash
# 类型与代码风格
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check

# 单元 / surface 测试（vitest 直接复用 monorepo catalog）
pnpm --filter @valley/desktop-os exec vitest run
```

涉及共享包的改动还需运行对应包的 `test` / `typecheck` / `check` / `build`，以 `apps/desktop-os/docs/PLAN.md` 的验收标准为准。

## 计划同步

- 任何新增、删除或调整功能、窗口、依赖、环境变量、产品方向或验收标准的改动，先更新 `apps/desktop-os/docs/PLAN.md` 再收尾。
- 临时调试、格式化或不改变计划的局部修复可不更新 PLAN，但最终回复必须说明“无需同步计划”的原因。
