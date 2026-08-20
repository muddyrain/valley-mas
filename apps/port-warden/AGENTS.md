# Port Warden 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/port-warden/AGENTS.md` -> `README.md` -> `src/shared/domain.ts` -> `electron/services/port-service.ts` -> `electron/main.ts` -> `electron/preload.ts` -> `src/App.tsx`。

## 安全边界

- Renderer 只能通过窄类型 IPC 访问主进程；契约从 `src/shared/contracts.ts` 和 `electron/ipc/validators.ts` 进入。
- 停止进程前必须经 `process-identity.ts` 与 `stop-coordinator.ts` 做 PID 身份复核；不得依据端口号或 UI 缓存直接终止进程。
- macOS/Windows 适配器和解析器需要分别验证；具体构建与测试命令见 `docs/PROJECT_GUIDE.md`。
