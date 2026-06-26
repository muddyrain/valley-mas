# 生活迹 Life Trace

Life Trace 是一个 AI 主导的个人生活计划与踪迹记录 PWA。当前版本已经从早期静态原型进入前后端联调阶段，核心闭环是：

```text
今日简报 -> AI 建议 -> 创建计划 -> 完成计划 -> 生成踪迹 -> 回顾生活
```

## 技术栈

- React 19 + Vite 6 + TypeScript
- Tailwind CSS 4
- shadcn/ui 风格组件
- lucide-react 图标
- Zustand 状态管理，核心数据同步到 Go 服务端
- PWA manifest + service worker

## 开发命令

```bash
pnpm --filter @valley/life-trace dev
pnpm --filter @valley/life-trace dev:host
pnpm --filter @valley/life-trace build
pnpm --filter @valley/life-trace preview:host
pnpm --filter @valley/life-trace check
```

默认开发端口：`5178`。

## 真机调试与提醒验收

手机访问本地开发机分两种场景：

- 只验证页面、登录、计划、天气等普通功能：可以用同 Wi-Fi 局域网访问。
- 验证 PWA 安装、Service Worker、系统通知：必须用 HTTPS，iPhone 还需要添加到主屏幕后从桌面图标打开。

### 同 Wi-Fi 访问开发环境

1. 电脑和手机连接同一个 Wi-Fi。
2. 启动 Go 服务：

```bash
cd server && go run ./cmd/server
```

3. 启动前端局域网服务：

```bash
pnpm --filter @valley/life-trace dev:host
```

4. 查看电脑局域网 IP：

```bash
ipconfig getifaddr en0
```

如果上面没有输出，尝试：

```bash
ipconfig getifaddr en1
```

5. 手机浏览器访问：

```text
http://你的电脑IP:5178
```

例如：

```text
http://192.168.1.23:5178
```

这种方式适合快速验页面，但不适合验最终通知能力，因为局域网 HTTP 通常不是安全上下文。

### HTTPS 验证 PWA 和通知

推荐用 HTTPS tunnel 暴露本机 preview：

1. 构建并启动 preview：

```bash
pnpm --filter @valley/life-trace build
pnpm --filter @valley/life-trace preview:host
```

2. 用隧道工具把本机 `4178` 暴露成 HTTPS，例如 Cloudflare Tunnel：

```bash
cloudflared tunnel --url http://localhost:4178
```

3. 手机访问隧道返回的 `https://...trycloudflare.com` 地址。
4. iPhone：Safari 打开后，点分享按钮，选择“添加到主屏幕”，再从主屏幕图标打开 Life Trace。
5. 进入“我的”页，开启通知权限。
6. 创建一个 1-2 分钟后到期、提醒开启的计划，等待到点提醒。
7. 点击系统通知，确认可以回到计划页。

注意：开发模式下会主动注销 Service Worker，所以要用 `build + preview:host + HTTPS tunnel` 验 PWA 和系统通知。

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

## 当前能力

- 底部 Tab 切换今日、计划、AI、踪迹、我的。
- 计划页可通过底部 Drawer 创建计划。
- 计划、踪迹、偏好和部分 AI 结果会同步到 Go 服务端，localStorage 只保留非核心兜底状态。
- 点击计划卡片的“完成”会自动生成一条生活踪迹。
- 我的页可编辑城市、工作时间、通勤方式和提醒。
- 今日页会读取“我的”页偏好，展示个性化城市、通勤和计划数量。
- AI 页快捷操作已接入：创建计划、服务端今日建议、生成踪迹和服务端每周回顾；周报会保存到账号并可回看历史，支持从“下周行动”生成计划，AI 不可用时保留本地兜底。
- AI 页图片分析支持图片 URL / 本地图片预览，优先调用服务端视觉 AI，并可生成计划或踪迹。
- PWA 已补充应用图标、基础离线缓存和安装状态提示。

更多阶段规划、家庭空间、Pantry 设计和 AI 拍照分析计划见 `docs/PLAN.md`。
