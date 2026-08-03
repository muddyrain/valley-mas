# AI Mind Arena AGENTS

本文件只补充 `apps/ai-mind-arena` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- `apps/ai-mind-arena` 是“脑内会议室”前端，一个 AI 多人格辩论决策产品。
- 核心体验是用户输入问题后，由 5 个 AI 人格进行多轮辩论，形成观点冲突、战况变化、裁判结论和可分享结果。
- 技术栈为 Next.js 15 + React 19 + Tailwind 3，开发端口为 `5175`。
- 后端接口默认来自 `NEXT_PUBLIC_API_BASE_URL`，示例见 `.env.example`。

## 路由与代码入口

- 首页入口：`app/page.tsx`。
- 辩论页入口：`app/debate/[id]/page.tsx`。
- 全局布局与元信息：`app/layout.tsx`；全局样式：`app/globals.css`。
- 首页组件：`components/home`。
- 对战组件：`components/debate`。
- API 封装：`lib/api.ts`；类型：`lib/types.ts`；SSE 事件解析：`lib/debateEvents.ts`。
- 人格视觉与分数逻辑：`lib/personaTheme.ts`、`lib/debateScores.ts`。
- 人格头像素材：`assets`；不要用 placeholder 或 emoji 替代头像资产。

## 产品与视觉规范

- 默认人格为理性派、毒舌派、赌徒派、父母派、摆烂派；改动人格、轮次或支持率规则时要联动检查服务端 `server/internal/mindarena` 和 `server/internal/ai`。
- 辩论不是普通问答，页面应强调冲突感、戏剧性、多轮对话、实时战况和最终裁判。
- UI 风格保持 Neon Dark + Gradient + Glow + Glassmorphism：深色渐变背景、发光、半透明和 backdrop blur 是核心识别。
- 不要把本应用改成白底、扁平化、通用 SaaS 风格，也不要随意改三列对战布局。
- 优先精修既有组件和 Tailwind class；除非任务明确要求，不整体重写组件或改变主要 DOM 结构。

## AI Coding 约束（行为改动默认顺序）

- 行为改动（对话流程、SSE 处理、分数计算、人格切换、请求映射）默认按以下顺序执行：
  1. 先补齐或更新对应测试。
  2. 先运行受影响测试并确认先有可观测失败。
  3. 实现改动。
  4. 再运行受影响测试并确认通过。
- 仅文案/样式且无明显行为边界的改动可写明豁免原因，不当作行为改动。

## 本地 Preflight 约束（AI Coding 默认前置）

- 行为任务在实现前先跑：
  1. `pnpm --filter @valley/ai-mind-arena check`。
  2. `pnpm --filter @valley/ai-mind-arena typecheck`。
  3. 受影响行为测试（有测试脚本时先跑最小范围）。
- 涉及人格与辩论链路变更，补跑更大范围回归并同步说明受影响服务端接口。

## 常用命令

```bash
cd apps/ai-mind-arena && NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 pnpm dev
pnpm --filter @valley/ai-mind-arena typecheck
pnpm --filter @valley/ai-mind-arena check
pnpm --filter @valley/ai-mind-arena build
```

## 校验要求

- 仅类型或逻辑改动：至少运行 `pnpm --filter @valley/ai-mind-arena typecheck`。
- 样式、格式、lint 相关改动：运行 `pnpm --filter @valley/ai-mind-arena check`。
- 对战流程、SSE、人格或分数逻辑改动：同时检查 `lib/api.ts`、`lib/debateEvents.ts`、`lib/types.ts` 和服务端 `server/internal/mindarena` 的接口契约。
- 视觉改动需要浏览器检查桌面和移动视口，确认主要内容不重叠、不溢出、发光与暗色氛围仍然成立。
- 行为类高风险提测前最小门禁：
  1. `pnpm --filter @valley/ai-mind-arena check`。
  2. `pnpm --filter @valley/ai-mind-arena typecheck`。
  3. 受影响行为测试通过（如有 `test` 脚本用 `pnpm --filter @valley/ai-mind-arena test`；无脚本时说明并补齐最小可复现验证）。
  4. `lib/api.ts`、`lib/debateEvents.ts`、`lib/types.ts` 与服务端 `server/internal/mindarena` 接口联动确认。
