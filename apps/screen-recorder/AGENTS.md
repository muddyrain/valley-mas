# Screen Recorder · AI 协作入口

本文件是 `apps/screen-recorder` 的局部协作入口。全局规则、skill 路由与 Git 约定仍以根 `AGENTS.md` 为准；长期范围和平台限制见本目录 `README.md`，完整命令表见 `docs/PROJECT_GUIDE.md`。

## AI 任务最小上下文入口

- `AGENTS.md` -> `apps/screen-recorder/AGENTS.md` -> `apps/screen-recorder/README.md` -> `electron/main.ts` -> `electron/preload.ts` -> `src/App.tsx`。
- 区域截图/录制：继续读取 `src/SelectionOverlay.tsx`、`src/SelectionSurface.tsx`、`src/ScreenshotEditor.tsx`、`src/RecordingSetup.tsx`、`src/LongScreenshotControl.tsx`、`src/renderer/recorder-runtime.ts`、`src/core/geometry.ts` 与 `src/core/long-screenshot.ts`。
- 文档治理/约束变更任务：继续读取 `docs/README.md` -> `docs/PROJECT_GUIDE.md` -> `docs/HARNESS_ENGINEERING.md`。

## 项目概述

- 包名：`@valley/screen-recorder`。
- 技术栈：Electron + React 19 + Vite 6 + TypeScript。
- 支持平台：Windows 与 macOS；Windows 为当前主要运行时验收平台。
- Vite 开发端口：`5179`；`5178` 已由 Life Trace 使用。
- 边界：托盘/菜单栏常驻的本地 PNG 截图标注与 WebM/原生 MP4 屏幕、区域录制；偏好设置覆盖快捷键、开机自启动和主进程授权的录屏目录，不接入 Valley Web、Admin、Life Trace、Desktop OS、WorldSim 或 Go Server。系统声音只在 Windows 提供；macOS 原生系统音频捕获仍需另行确认依赖。

## 安全与依赖边界

- 所有窗口保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`，只加载本地构建产物或本机 Vite 开发地址。
- `desktopCapturer`、保存目录、文件写入、托盘和全局快捷键仅由主进程管理；Renderer 不访问 Node 文件系统。
- Preload 只暴露 `src/shared/contracts.ts` 声明的类型化接口；新增 IPC 必须验证调用窗口、输入类型、长度和允许值，不能接收任意命令或保存路径。
- 当前只允许 Electron 与 `electron-builder` 作为本子项目新增的 Electron 专项依赖。引入 FFmpeg、原生捕获、Rust 或视频转码依赖前必须先取得用户确认。

## AI Coding 约束（行为改动默认顺序）

- 状态转换、捕获、坐标换算、IPC、文件写入和资源释放改动默认按以下顺序执行：
  1. 先补齐或更新同目录测试。
  2. 先运行最小受影响测试并确认需求断言失败。
  3. 再修改实现。
  4. 再运行受影响测试并确认通过。
- 仅文案或纯样式且无行为边界时可豁免，但交付说明必须记录未测原因与替代验证。

## 本地 Preflight 约束（AI Coding 默认前置）

1. 静态检查：`pnpm --filter @valley/screen-recorder check`。
2. 类型检查：`pnpm --filter @valley/screen-recorder typecheck`。
3. 行为测试：`pnpm --filter @valley/screen-recorder test`，行为修改要求先失败后实现。
4. 截图、录屏、Canvas 裁剪、拖拽、DPI、多显示器和窗口可见性结论必须补充对应平台运行时证据，不能只用 jsdom 或静态检查替代；缺少 macOS 主机时必须明确列出未验证项。

## 关键实现边界

- 录屏生命周期只使用 `idle`、`selecting`、`configuring`、`countdown`、`recording`、`stopping`、`completed`、`error` 状态机；截图另用包含 `capturing`、`editing`、`long-capturing` 的独立状态机。
- 截图编辑器与选择层在同一 BrowserWindow 内原子切换；长截图连续捕获与拼接、原生另存为对话框和最终文件写入均由主进程负责，Renderer 不能指定输出路径。
- 区域录制先捕获完整显示器，再依据视频轨道实际宽高将全局 DIP 选区映射到视频像素并用 Canvas 裁剪；`scaleFactor` 只作实际视频尺寸缺失时的兜底。
- 有效文件只在录制数据大于零且落盘、同步、关闭成功后由临时 `.part-*` 按实际 MIME 原子重命名为 `.webm` 或 `.mp4`；失败与取消必须清理临时文件。
- 录制结束或失败必须释放媒体轨道、Canvas 动画帧、计时器和监听器。

## 校验要求 / 提测前最小门禁

```bash
pnpm --filter @valley/screen-recorder typecheck
pnpm --filter @valley/screen-recorder check
pnpm --filter @valley/screen-recorder test
pnpm --filter @valley/screen-recorder build:renderer
pnpm --filter @valley/screen-recorder build:electron
pnpm --filter @valley/screen-recorder package:dir
pnpm --filter @valley/screen-recorder package:win
pnpm --filter @valley/screen-recorder package:mac
```

行为类高风险改动还必须按 `README.md` 的平台验收清单验证截图、直接录制、区域裁剪、Esc 取消、重复开始、窗口排除、媒体选项、快捷键和错误展示。

## 文档同步

- 功能范围、依赖、平台、端口、入口、命令或验收标准变化时，同步本目录 `README.md`、根 `AGENTS.md`、`docs/PROJECT_GUIDE.md`；长期文档入口变化时同步 `docs/README.md`。
- 当前没有独立计划文档；不要为临时调试创建计划，第一阶段长期状态以本目录 `README.md` 为准。
