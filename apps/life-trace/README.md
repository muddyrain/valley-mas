# 生活迹 Life Trace

Life Trace 是一个 AI 主导的个人生活计划与踪迹记录 PWA。第一版先以移动端静态 MVP 验证核心闭环：

```text
今日简报 -> AI 建议 -> 创建计划 -> 完成计划 -> 生成踪迹 -> 回顾生活
```

## 技术栈

- React 19 + Vite 6 + TypeScript
- Tailwind CSS 4
- shadcn/ui 风格组件
- lucide-react 图标
- Zustand 本地状态与 localStorage 持久化
- PWA manifest + service worker

## 开发命令

```bash
pnpm --filter @valley/life-trace dev
pnpm --filter @valley/life-trace build
pnpm --filter @valley/life-trace check
```

默认开发端口：`5178`。

## 当前原型能力

- 底部 Tab 切换今日、计划、AI、踪迹、我的。
- 计划页可通过底部 Drawer 创建计划。
- 计划和踪迹会保存到 localStorage，刷新页面后保留。
- 点击计划卡片的“完成”会自动生成一条生活踪迹。
- 我的页可编辑城市、工作时间、通勤方式、提醒和打卡项。
- 今日页会读取“我的”页偏好，展示个性化城市、通勤和计划数量。
- AI 页快捷操作已接入本地行为：创建计划、生成今日建议、生成踪迹和每周回顾。
- AI 页图片分析支持图片 URL / 本地图片预览，并可生成计划或踪迹。
- PWA 已补充应用图标、基础离线缓存和安装状态提示。
