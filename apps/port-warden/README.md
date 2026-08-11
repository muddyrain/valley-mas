# Port Warden（端口管家）

Port Warden 是 Valley MAS monorepo 内独立构建和运行的本地 Electron 开发者工具。它扫描本机 TCP LISTEN 端口，关联进程与项目目录，并只在用户核对精确 PID 后停止身份明确的进程。应用不连接 Valley Web、Admin 或 Go 服务。

## 第一版范围

- 扫描 TCP LISTEN 端口，展示地址、端口、PID、PPID、进程名、完整命令行、可执行文件、启动时间与可确定的工作目录。
- 按 PID + 端口合并 IPv4/IPv6 重复监听，保留全部原始地址和地址族。
- 按端口、PID、进程名、命令行、可执行文件、工作目录和项目路径搜索。
- 支持手动刷新、默认每 5 秒自动刷新，以及基于首轮基线的端口新增/释放提示。
- 详情抽屉展示父进程链、当前进程和子进程树；项目目录显示 `精确`、`推断` 或 `未知`。
- 支持从详情抽屉通过主进程目录选择器登记项目根目录；登记项保存在 Electron `userData/registered-projects.json`，后续扫描优先匹配，Renderer 不接收或提交任意路径。
- 只允许打开当前扫描快照确认过的项目目录或可执行文件所在目录；Renderer 不能提交任意路径。
- 停止当前进程或进程树时先重新扫描进程身份并生成 30 秒短时确认计划，界面展示即将停止的全部 PID；用户勾选确认后，主进程再次核对计划、PID 集合、启动时间、命令行、进程名与可执行文件，再按子进程到父进程的顺序向精确 PID 发送停止信号。
- 系统进程、其他用户进程、权限不足或缺少启动时间/命令行的进程默认只读；PID 已复用、身份变化、计划过期或确认 PID 不一致时阻止操作。
- 提供 loading、空列表、搜索无结果、扫描失败、权限不足、进程已退出和停止失败状态，并支持浅色/深色主题、键盘聚焦、`⌘/Ctrl + K` 搜索、`R` 刷新与 `Esc` 关闭。

第一版不做 UDP、Linux、远程机器、账号、云同步、自动更新、Docker/WSL 深度解析或按模糊进程名批量终止。

## 架构

```text
Renderer (React)
  └─ narrow typed API
       └─ Preload / contextBridge
            └─ validated IPC + trusted sender
                 └─ PortService
                      ├─ shared merge / project / tree / identity domain
                      ├─ MacOsPortAdapter (lsof + batched ps)
                      └─ WindowsPortAdapter (static PowerShell JSON snapshot)
```

- `src/shared/domain.ts`：跨平台 UI 与主进程共享的领域类型。
- `src/domain`：监听合并、搜索、项目归属、进程树、身份比对和停止协调器；这些模块不依赖 Electron。
- `electron/platform`：平台适配器和参数数组命令执行器。扫描先批量获取端口与进程快照，再在内存关联，不按端口逐个执行系统命令。
- `electron/services/port-service.ts`：扫描基线、变更计算、项目归属、详情树、打开目录和停止计划入口。
- `electron/ipc`：sender/origin 检查和手写运行时输入校验。
- `electron/preload.ts`：只暴露扫描、进程树、停止准备/执行、打开确认目录和登记项目六类能力。
- `src/App.tsx`：跨平台共享界面；不访问 Node API。

## 平台实现

### macOS 13+

- `lsof -nP -iTCP -sTCP:LISTEN` 使用字段模式采集监听；同一监听进程的 cwd 以批量 PID 分组通过 `lsof -a -d cwd` 获取。
- 两次批量 `ps` 分别获取 PID/PPID/UID/启动时间/命令行和可执行文件，不为每个端口单独执行命令。
- UID 与当前普通用户不一致、PID 受保护或身份字段不足时保持只读。应用不申请或要求 root 权限；以 root 启动时停止能力保持禁用。

### Windows 10/11 64 位

- 单个静态 PowerShell 脚本调用 `Get-NetTCPConnection -State Listen` 和 `Get-CimInstance Win32_Process`，统一输出结构化 JSON；脚本不插入 Renderer 输入、PID、端口或路径。
- `Win32_Process` 不可靠提供外部进程 cwd，因此 Windows 记录不伪造精确工作目录；只从命令行中的绝对脚本/配置路径向上寻找项目标志，并标记 `推断`。
- 构建清单使用 `asInvoker`，应用默认不请求管理员权限。系统进程或身份字段不足时保持只读。

## 项目识别顺序

1. Port Warden 启动配置中登记的服务路径。
2. 系统提供的工作目录。
3. 命令行中的绝对脚本或配置路径。
4. 从候选目录向上寻找 `.git`、`pnpm-workspace.yaml`、`package.json`、`go.mod`、`Cargo.toml`、`pyproject.toml`。
5. 无法确认时显示 `unknown`。

系统 cwd 和登记路径标记为 `精确`；仅由命令路径与项目标志推导的结果标记为 `推断`。

## 安全模型

- BrowserWindow：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webSecurity: true`。
- 所有命令和进程操作仅在主进程执行；命令执行器固定 `shell: false`，参数以数组传递并限制输出大小。
- IPC 只接受已登记顶层窗口和本地构建页面或固定开发来源，输入对象要求精确字段集合、类型、枚举、范围和数组上限。
- Renderer 的打开目录请求只包含 PID 与目录类型，主进程从最新快照解析实际路径。
- 停止操作不接收进程名或命令查询；准备与执行阶段都重新获取批量进程快照，缺失或不一致即安全失败。
- 进程树停止只操作确认计划列出的 PID，不使用进程名、通配符、`taskkill /IM` 或未展示的新目标。

## 开发与构建

```bash
pnpm --filter @valley/port-warden dev
pnpm --filter @valley/port-warden typecheck
pnpm --filter @valley/port-warden check
pnpm --filter @valley/port-warden test
pnpm --filter @valley/port-warden build
pnpm --filter @valley/port-warden package:dir
pnpm --filter @valley/port-warden package:win
pnpm --filter @valley/port-warden package:mac
```

开发 Renderer 固定使用 `http://127.0.0.1:5182`。启动前必须确认该端口未被未知进程占用；Vite 使用 `strictPort`，不会自动顺延到其他端口。`package:win` 生成 Windows x64 NSIS，`package:mac` 生成 macOS x64/arm64 DMG 与 ZIP。正式分发仍需配置 Windows 代码签名与 Apple Developer ID/notarization；未签名产物只用于本地测试。

## 测试与验收

单元测试覆盖：

- macOS lsof/ps/cwd fixture 解析。
- Windows PowerShell JSON fixture 解析。
- IPv4/IPv6 监听合并。
- 父子进程树和子进程终止顺序。
- 项目路径识别来源与可信度。
- PID 启动时间、命令行、进程名和可执行文件身份比对。
- 停止计划过期、只读目标、PID 列表不一致与 PID 复用保护。
- 扫描基线的新增/释放事件。
- IPC 输入和任意路径注入保护。

`.github/workflows/port-warden.yml` 在 macOS 14 和 Windows Server 2022 上分别运行类型检查、Biome、全部单元测试和构建。macOS 测试额外创建一个临时 TCP listener，通过真实 `lsof/ps` 适配器验证端口出现、PID/命令匹配和关闭后的释放；Windows CI 当前验证 PowerShell fixture、类型、静态检查与构建，真实 Windows 监听扫描和停止操作仍需在 Windows 10/11 x64 实机验收。

## 已知限制

- macOS 无权限读取的命令行、可执行文件或 cwd 可能缺失，记录会只读或显示 `unknown`。
- Windows 项目路径通常为命令行推断，不代表进程真实 cwd；受保护进程的 CIM 字段可能为空。
- 进程可能在扫描间隔内自行退出或创建新子进程；停止计划只处理确认时列出的 PID，并在执行前再次校验。
- `SIGTERM` 是否触发应用优雅退出取决于目标进程；MVP 不自动升级到强制终止。
- 第一版不解析端口转发、容器命名空间、WSL 内部进程或 UDP socket。
