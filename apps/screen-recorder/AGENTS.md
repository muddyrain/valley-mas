# Screen Recorder 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/screen-recorder/AGENTS.md` -> `README.md` -> `electron/main.ts` -> `electron/preload.ts` -> `src/App.tsx`。

## 平台边界

- 主进程、preload 与 renderer 的 IPC 契约保持窄类型边界；共享类型见 `src/shared/contracts.ts`。
- 选区、DPI 换算、长截图和录制运行时分别从 `src/core/selection-controller.ts`、`src/core/geometry.ts`、`src/core/long-screenshot.ts`、`src/renderer/recorder-runtime.ts` 进入。
- 平台捕获、权限、快捷键、文件写入或安装包改动需要目标平台验证；具体构建、测试和打包命令见 `docs/PROJECT_GUIDE.md`。
