# Desktop OS · AI 协作入口

本文件是 AI 在 `apps/desktop-os` 目录内工作的局部协作入口。  
全局规则、skill 选择和 Git 约定仍以根目录 `AGENTS.md` 为准。

## 项目概述

- **名称：** macOS Plush（毛毡 macOS 风桌面）
- **类型：** Vite + React 19 + TypeScript 独立 app
- **端口：** `5177`（开发模式）
- **启动：** `pnpm --filter @valley/desktop-os dev`
- **目标：** 一个看起来像毛毡毛绒玩具世界的伪 macOS 桌面，用作个人作品集 / 趣味项目入口。

## 视觉风格

- 整体走 Animal Crossing × Pixar 的 storybook miniature 风格，**不是真实毛毡摄影**。
- 配色：cream `#f8f5ec`、sage `#8fb45e`、sky `#a8d4ea`、terracotta `#d97a4f`、butter `#f4d97a`、pink `#f4a8b8`。
- 阴影一律柔和、低饱和、长投影。

## 目录结构

```
apps/desktop-os/
├── src/
│   ├── main.tsx              # 入口
│   ├── App.tsx               # 桌面根组件
│   ├── styles/               # 全局 CSS + 主题 token
│   ├── components/
│   │   ├── Wallpaper.tsx     # 桌面壁纸
│   │   ├── MenuBar.tsx       # 顶部菜单栏 + 时钟
│   │   ├── Dock.tsx          # 底部 Dock
│   │   └── window/           # 窗口管理与窗体
│   ├── apps/                 # 各「应用」组件（关于本机、终端…）
│   └── store/                # Zustand store（窗口、主题）
└── public/
    ├── wallpaper/            # 壁纸（手动放入）
    ├── dock/                 # Dock 图标
    ├── folders/              # 文件夹图标
    └── widgets/              # Widget 图标
```

## 校验命令

```bash
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
```
