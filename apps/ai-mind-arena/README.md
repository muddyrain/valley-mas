# 脑内会议室（AI Mind Arena）

把你的纠结丢进去，让 5 个 AI 人格替你吵出答案。

## 启动 Go server

```bash
cd server
AI_PROVIDER=mock go run ./cmd/server
```

默认端口来自 `PORT`，未配置时为 `8080`。

## 启动前端

```bash
cd apps/ai-mind-arena
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 pnpm dev
```

前端默认运行在 `http://localhost:3001`。

## 环境变量

前端：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

后端：

```bash
AI_PROVIDER=mock
AI_BASE_URL=https://xxx/v1
AI_API_KEY=xxx
AI_MODEL=xxx
```

## mock 模式

`AI_PROVIDER=mock` 或未配置 `AI_API_KEY` 时，后端会使用内置 MockAIService。

mock 模式不需要 API Key，可完整跑通：

- 创建辩论
- 获取辩论详情
- SSE 三轮流式输出
- 裁判结果与分数面板

## 真实模型模式

配置 OpenAI-compatible Chat Completions：

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=sk-xxx
AI_MODEL=your-model
```

后端会调用：

```text
POST ${AI_BASE_URL}/chat/completions
```

如果 `AI_API_KEY` 为空，会自动 fallback 到 mock 模式。

## API

```text
POST /api/v1/mind-arena/debates
GET  /api/v1/mind-arena/debates/:id
GET  /api/v1/mind-arena/debates/:id/stream
```

SSE 事件：

- `message`：人格发言
- `judge`：裁判结果
- `done`：辩论结束
- `error`：错误信息
