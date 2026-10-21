# Port Warden 协作入口

适用于 `apps/port-warden`，Electron 端口与进程管理工具。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 运行或产品行为 | [说明](README.md) |
| 查询或领域数据 | [领域模型](src/shared/domain.ts)、[端口服务](electron/services/port-service.ts) |
| 停止进程 | 端口服务及同目录的 `process-identity.ts`、`stop-coordinator.ts` |
| IPC、窗口或页面 | [契约](src/shared/contracts.ts)、[校验](electron/ipc/validators.ts)、[main](electron/main.ts)、[preload](electron/preload.ts)、[应用](src/App.tsx) |

## 关键约束

Renderer 经窄类型 IPC 访问主进程。停止操作先核对 PID 身份并经协调器执行，端口号或 UI 缓存不足以证明目标身份。

## 验证与文档

分别验证 macOS/Windows 适配器与解析器；命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。停止语义、权限或平台行为变化更新 README。
