# 🧠 脑内会议室（AI Mind Arena）

把你的纠结丢进去，让 5 个 AI 人格替你吵出答案。

---

# 🧩 项目定位（非常重要）

这是一个 AI 驱动的“多人格辩论决策产品”。

用户输入一个问题 →  
系统生成多个 AI 人格 →  
进行多轮辩论 →  
输出观点冲突 + 结论 + 支持率

👉 核心体验：让 AI 替用户“内心开会”

---

# 🎯 核心玩法（Codex必须理解）

## 多人格对战
默认 5 个角色：

- 理性派（分析、逻辑）
- 毒舌派（攻击、吐槽）
- 赌徒派（激进、冒险）
- 父母派（保守、现实）
- 摆烂派（躺平、情绪）

---

## 多轮辩论（核心机制）

- Round 1：立场表达
- Round 2：互相反驳
- Round 3：总结 / 决策

👉 不是简单回答，是“有冲突的对话流”

---

## 实时流式输出（SSE）

- 每个角色依次发言
- 中间为聊天流 UI
- 最后输出裁判结果

---

## 支持率系统

- 右侧展示实时排名
- 不同人格得票变化
- 用户可理解“谁更占优势”

---

# 🎨 UI设计规范（极其重要）

本项目 UI 风格：

👉 Neon Dark + Gradient + Glow + Glassmorphism

必须包含：

- 深色渐变背景
- 发光效果（shadow / glow）
- 半透明（bg-white/5）
- backdrop-blur

---

## ❗ UI 禁止行为

- ❌ 扁平化（无渐变）
- ❌ 去掉 glow
- ❌ 改成白底
- ❌ 改布局结构

---

# 🧩 页面结构（对战页）

三列布局：

- 左：角色列表（本场嘉宾）
- 中：对话流（核心区域）
- 右：战况面板（支持率 + 排行）

---

# 🧠 AI协作规则（Codex必须遵守）

## 修改规则

- 不允许重写组件
- 不允许改变 DOM 结构
- 不允许删除逻辑
- 优先修改 className / Tailwind

---

## 资源规则

- 所有头像必须使用 `/assets` 目录图片
- 不允许使用 placeholder / emoji

---

## 工作方式

你不是在“设计 UI”，而是在：

👉 **还原设计稿 + 精修视觉**

---

# 🚀 启动 Go server

```bash
cd server
AI_PROVIDER=mock go run ./cmd/server
默认端口来自 PORT，未配置时为 8080。
```

---

# 🚀 启动前端

```bash
cd apps/ai-mind-arena
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 pnpm dev
```

前端默认运行在：
```bash
http://localhost:3001
```

---


# 🔧 环境变量
## 前端

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## 后端

```bash
AI_PROVIDER=mock
AI_BASE_URL=https://xxx/v1
AI_API_KEY=xxx
AI_MODEL=xxx
```

---

# 🧪 mock 模式

当：

- AI_PROVIDER=mock
- 或未配置 AI_API_KEY
- 或真实模型配置不完整 / 上游调用失败

👉 自动使用 MockAIService

支持完整流程：

- 创建辩论
- 获取辩论详情
- SSE 三轮输出
- 裁判结果

---

# 🤖 真实模型模式

```bash
AI_PROVIDER=doubao
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_API_KEY=your-api-key
AI_MODEL=ep-xxxxxxxxxx
```

或使用任意 OpenAI-compatible 服务：

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=sk-xxx
AI_MODEL=your-model
```

调用接口：

```bash
POST ${AI_BASE_URL}/chat/completions
```

# 🔌 API

```bash
POST /api/v1/mind-arena/debates
GET  /api/v1/mind-arena/debates/:id
GET  /api/v1/mind-arena/debates/:id/stream
```

--- 


# 📡 SSE 事件

- message：人格发言
- judge：裁判结果
- done：辩论结束
- error：错误信息

---

# 🎯 项目目标

打造一个：

👉 有冲突感
👉 有戏剧性
👉 可分享传播

的 AI 娱乐产品，而不是普通工具。
