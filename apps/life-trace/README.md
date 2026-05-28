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

## 天气服务

今日页会通过 Vite 代理请求 Go 服务端：

```bash
cd server && go run ./cmd/server
pnpm --filter @valley/life-trace dev
```

服务端需要在 `server/.env` 配置和风天气：

```env
QWEATHER_API_KEY=你的和风天气 Key
QWEATHER_API_HOST=和风控制台里的 API Host
```

如果 `QWEATHER_API_HOST` 未配置，或仍使用旧公共域名，接口会返回 mock 天气并在 `warning` 字段说明原因。

## 当前原型能力

- 底部 Tab 切换今日、计划、AI、踪迹、我的。
- 计划页可通过底部 Drawer 创建计划。
- 计划、踪迹、打卡和偏好会同步到 Go 服务端，localStorage 只保留非核心兜底状态。
- 点击计划卡片的“完成”会自动生成一条生活踪迹。
- 我的页可编辑城市、工作时间、通勤方式、提醒和打卡项。
- 今日页会读取“我的”页偏好，展示个性化城市、通勤和计划数量。
- AI 页快捷操作已接入：创建计划、服务端今日建议、生成踪迹和服务端每周回顾；周报会保存到账号并可回看历史，支持从“下周行动”生成计划，AI 不可用时保留本地兜底。
- AI 页图片分析支持图片 URL / 本地图片预览，优先调用服务端视觉 AI，并可生成计划或踪迹。
- PWA 已补充应用图标、基础离线缓存和安装状态提示。
