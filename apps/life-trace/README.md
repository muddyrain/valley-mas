# 生活迹 Life Trace

Life Trace 是一个个人生活助手 PWA，提供计划、踪迹、家庭库存、采购清单和衣橱穿搭，AI 用于对话、建议、回顾与拍照录入。核心闭环是：

```text
今日安排 -> 创建计划 -> 提醒与完成 -> 生成踪迹 -> 回顾生活
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

- 今日、计划、AI、踪迹、我的五个主 Tab；库存、采购、衣橱和成就通过二级页面进入。
- 计划管理、周日历、周期任务、系统日历导出；完成计划自动生成踪迹。
- 踪迹支持图片、心情、标签和地点文本，核心数据同步到 Go 服务端。
- Pantry 支持库存、到期提醒、使用记录、家庭共享、条码和拍照入库；采购清单支持补货与勾选已买。
- 衣橱支持衣物录入、拍照识别、主动共享、穿搭建议和已穿记录。
- AI 支持对话、今日建议、每周回顾、图片分析和商品 / 衣物识别；保留计划与库存动作。
- 账号偏好、提醒诊断、计划 / 库存 / 每日简报推送、反馈、成就和 PWA 安装更新。

2026-09-08 收敛移除了隐藏旧首页、灵感 Inbox 及转换、智能菜谱、轻账本、订阅续费、地点库和书影音日记。相关前后端入口、状态、AI 动作和模型注册已清理；保留历史计划、踪迹及地点文本。

专属数据库结构由新增 PostgreSQL / MySQL 迁移清理，本次代码变更未对真实数据库执行删表。当前范围、待办与迁移边界见 [产品范围与计划](docs/PLAN.md)。
