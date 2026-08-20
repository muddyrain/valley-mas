# AI Mind Arena 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/ai-mind-arena/AGENTS.md` -> `app/page.tsx` -> `lib/api.ts` -> `server/internal/mindarena`。

## 局部边界

- 辩论状态、SSE 事件、人格主题和评分分别从 `lib/debateEvents.ts`、`lib/personaTheme.ts`、`lib/debateScores.ts`、`lib/types.ts` 进入。
- API 或事件契约改动同时检查服务端 Mind Arena handler、前端类型与回退态；不以 mock 成功替代真实流式错误处理。
- 保持现有 Next.js/Tailwind 视觉语言；具体检查命令见 `docs/PROJECT_GUIDE.md`。
