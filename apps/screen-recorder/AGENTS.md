# Screen Recorder 协作入口

适用于 `apps/screen-recorder`，Electron 截图与录屏工具。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 运行、权限或打包 | [说明](README.md) |
| 窗口、IPC 或主进程 | [main](electron/main.ts)、[preload](electron/preload.ts)、[契约](src/shared/contracts.ts) |
| 选区或 DPI | [选区控制](src/core/selection-controller.ts)、[坐标换算](src/core/geometry.ts) |
| 长截图或录制 | [长截图](src/core/long-screenshot.ts)、[录制运行时](src/renderer/recorder-runtime.ts) |
| 页面 | [应用](src/App.tsx) |

## 关键约束

主进程、preload 和 renderer 经窄类型 IPC 契约通信。平台捕获、权限、快捷键和文件写入在目标平台验证；打包遵循 README 的宿主与签名要求。

## 验证与文档

选区、DPI、长截图和录制取得真实运行证据；命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。权限、操作或打包方式变化更新 README。
