# Port Warden · AI 协作入口

本文件是 `apps/port-warden` 的局部协作入口。全局规则、skill 路由与 Git 约定仍以根 `AGENTS.md` 为准；产品范围、安全模型、平台限制和运行验收见本目录 `README.md`，完整命令表见 `docs/PROJECT_GUIDE.md`，AI 协作验证闭环见 `docs/HARNESS_ENGINEERING.md`。

## AI 任务最小上下文入口

- `AGENTS.md` -> `apps/port-warden/AGENTS.md` -> `apps/port-warden/README.md` -> `src/shared/domain.ts` -> `electron/services/port-service.ts` -> `electron/main.ts` -> `electron/preload.ts` -> `src/App.tsx`。
- macOS 扫描：继续读取 `electron/platform/macos/adapter.ts` 与 `electron/platform/macos/parsers.ts`。
- Windows 扫描：继续读取 `electron/platform/windows/adapter.ts` 与 `electron/platform/windows/parser.ts`。
- 停止安全链路：继续读取 `src/domain/process-identity.ts`、`src/domain/stop-coordinator.ts`、`electron/ipc/validators.ts` 与 `electron/ipc/register-handlers.ts`。
- 文档治理/约束变更任务：继续读取 `docs/README.md`、`docs/PROJECT_GUIDE.md` 与 `docs/HARNESS_ENGINEERING.md`。

## 项目概述

- 包名：`@valley/port-warden`。
- 技术栈：Electron + React 19 + Vite 6 + TypeScript。
- 支持平台：macOS 13+、Windows 10/11 64 位。
- Vite 开发端口：`5182`，必须使用 strict port。
- 边界：只查看本机 TCP LISTEN 端口并对身份明确的精确 PID 执行用户确认过的停止操作；不处理 UDP、Linux、远程机器、Docker/WSL 深度解析、账号、云同步、自动更新或模糊进程名批量终止。

## 安全与依赖边界

- BrowserWindow 必须保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；Renderer 不访问 Node、文件系统或系统命令。
- Preload 只暴露 `src/shared/contracts.ts` 声明的窄 API；IPC 必须同时校验 sender、顶层 frame、唯一生产入口或固定开发来源与全部输入字段。
- 项目登记只能由主进程打开系统目录选择器并写入 `userData/registered-projects.json`；Renderer 只提交当前扫描中的 PID，不能提交任意路径。
- 系统命令只在主进程通过 `spawn` 参数数组执行，禁止启用 shell，禁止把 PID、端口或路径拼进命令字符串。
- 停止操作必须经过 `prepareStop` 与 `executeStop` 两阶段：准备阶段生成短时计划并展示精确 PID，执行阶段核对计划、PID 集合、启动时间与命令行；任一身份变化都必须阻止操作。
- 禁止新增按进程名、命令片段或路径模式批量终止的能力。系统进程、其他用户进程、权限不足或身份字段不完整的进程保持只读。
- Windows 工作目录只能来自可靠系统信息；当前使用命令路径和项目标志文件推断时必须标记 `inferred`。
- 新依赖前先说明用途、取舍和替代方案并取得用户确认；优先使用当前 workspace 已有工具。

## AI Coding 约束（行为改动默认顺序）

1. 先补齐或更新同目录测试与 fixture。
2. 先运行最小受影响测试并确认需求断言失败。
3. 再修改实现。
4. 再运行受影响测试并确认通过。
5. 解析器、合并、项目归属、进程树、身份校验、IPC 和停止协调器均属于行为边界，不得以手工验证替代单元测试。

## 本地 Preflight 约束

1. `pnpm --filter @valley/port-warden typecheck`。
2. `pnpm --filter @valley/port-warden check`。
3. `pnpm --filter @valley/port-warden test`；行为改动要求先失败后实现。
4. `pnpm --filter @valley/port-warden build`。
5. 适配器改动必须在对应平台验证真实监听端口的出现、PID/命令匹配与释放；缺少对应宿主时明确列出未验证项，并依赖对应平台 CI 的 fixture、类型、静态检查与构建结果。

## 文档同步

- 功能范围、安全约束、平台、端口、依赖、入口、命令或验收标准变化时，同步本目录 `README.md`、根 `AGENTS.md`、`docs/PROJECT_GUIDE.md` 与 `docs/README.md`。
- 当前没有独立计划文档；第一版长期状态以本目录 `README.md` 为准，不为临时调试新增计划。
