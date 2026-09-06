# Valley MAS 项目指南

本页只记录可由仓库配置和目录验证的事实。协作规则见 `CLAUDE.md`，产品语义和交付状态按需读取目标子项目文档与 `docs/plans/README.md`。

## 仓库地图

| 范围 | 路径 | 技术或职责 |
| --- | --- | --- |
| Web 前台 | `apps/web` | React、Vite、React Router、Tailwind |
| Admin 后台 | `apps/admin` | React、Vite、Ant Design |
| Life Trace | `apps/life-trace` | React、Vite、Tailwind |
| Electron 应用 | `apps/screen-recorder`、`apps/port-warden` | Electron、React、Vite、TypeScript |
| Next.js 实验 | `apps/scratch-legend` | Next.js、React |
| 游戏/场景实验 | `apps/world-sim`、`apps/toy-climb-arena`、`apps/ambient-forge` | Vite、TypeScript、Pixi.js 或 Three.js |
| 纪元谷 · Aeon Vale | `apps/aeon-vale` | Godot 4.7.2、GDScript、原生像素造世游戏 |
| API | `server` | Go、Gin、GORM |
| 共享能力 | `packages/*` | 类型、请求、路由、格式化、浏览器媒体与小游戏包 |

各产品的入口、不可替代约束和专项验收由对应 `AGENTS.md` 定义。

## 开发与环境

```bash
# 安装与全量前端开发
pnpm install
pnpm dev

# 定向启动
pnpm --filter @valley/web dev
pnpm --filter @valley/admin dev
pnpm --filter @valley/life-trace dev
pnpm --filter @valley/screen-recorder dev
pnpm --filter @valley/port-warden dev
pnpm --filter @valley/scratch-legend dev
pnpm --filter @valley/toy-climb-arena dev
pnpm --filter @valley/world-sim dev
pnpm --filter @valley/ambient-forge dev

# Go 服务与迁移
cd server && go run ./cmd/server
cd server && air
cd server && go run ./cmd/migrate status
cd server && go run ./cmd/migrate up
```

| 服务 | 默认端口 |
| --- | --- |
| Go API | 8080 |
| Web / Admin / Life Trace | 5000 / 3000 / 5178 |
| Screen Recorder / Port Warden | 5179 / 5182 |
| Toy Climb Arena / Scratch Legend | 5175 / 5176 |
| Ambient Forge | 5181 |

环境变量以相应示例文件为唯一真源：`apps/*/.env.example`、`server/.env.example`。模型能力、Provider 配置和密钥不得在文档中复制；服务端读取逻辑从 `server/internal/config/config.go` 和模型目录实现定位。

## 常用定位入口

| 目标 | 入口 |
| --- | --- |
| Web/Admin/Life Trace 路由 | `apps/{web,admin,life-trace}/src/App.tsx` |
| Web/Admin API 封装 | `apps/web/src/api`、`apps/admin/src/api` |
| Electron 主进程 | 各应用的 `electron/main.ts`、`electron/preload.ts` |
| Go 路由与配置 | `server/internal/router/router.go`、`server/internal/config/config.go` |
| Go 模型与服务 | `server/internal/model`、`server/internal/service` |

## 常用校验

命令实现以根 `package.json#scripts`、各应用 `package.json#scripts` 与 Go 工具链为唯一真源；本页提供可复用的调用矩阵。

```bash
# 文档与 Harness
pnpm check:harness
pnpm check:harness:test
pnpm check:agents-context
pnpm check:agents-context:test
pnpm check:docs-links
pnpm check:docs-links -- --strict
pnpm check:docs-links:test
pnpm check:plans-index

# 工具链与全仓
pnpm check:toolchain
pnpm check:toolchain:test
pnpm check
pnpm build

# Go
cd server && go test ./...
cd server && go build ./cmd/server ./cmd/migrate

# 非 ASCII 文本、Markdown、skill 或配置示例
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <相关文件>
```

| 范围 | 静态/类型 | 行为与专项验证 |
| --- | --- | --- |
| Web | `pnpm --filter @valley/web check`、`pnpm --filter @valley/web exec tsc --noEmit` | `pnpm --filter @valley/web test`；高风险补 `test:cov` 与浏览器验证 |
| Admin | `pnpm --filter @valley/admin check`、`pnpm --filter @valley/admin exec tsc --noEmit` | `pnpm --filter @valley/admin test` |
| Life Trace | `pnpm --filter @valley/life-trace check`、`pnpm --filter @valley/life-trace exec tsc --noEmit` | `pnpm --filter @valley/life-trace exec vitest run` |
| Scratch Legend | `pnpm --filter @valley/scratch-legend check`、`pnpm --filter @valley/scratch-legend typecheck` | `pnpm --filter @valley/scratch-legend exec vitest run`（存在受影响测试时） |
| Screen Recorder | `pnpm --filter @valley/screen-recorder typecheck`、`pnpm --filter @valley/screen-recorder check` | `test`；平台改动补 renderer/Electron build、打包或目标机验收 |
| Port Warden | `pnpm --filter @valley/port-warden typecheck`、`pnpm --filter @valley/port-warden check` | `pnpm --filter @valley/port-warden test`；平台改动补 build 与目标机验收 |
| WorldSim | `pnpm --filter @valley/world-sim check`、`pnpm --filter @valley/world-sim typecheck` | `pnpm --filter @valley/world-sim exec vitest run`；地图/模拟补 `test:balance`、`test:stability` 或 `test:longrun` |
| Toy Climb Arena | `pnpm --filter @valley/toy-climb-arena check`、`pnpm --filter @valley/toy-climb-arena typecheck` | 受影响 Vitest 与实际物理/关卡验收 |
| Ambient Forge | `pnpm --filter @valley/ambient-forge check`、`pnpm --filter @valley/ambient-forge typecheck` | `pnpm --filter @valley/ambient-forge test`；视觉/声音改动补浏览器验收 |

共享包改动运行对应包的 `typecheck`、`test` 或 `build`。无法运行必要验证时，交付说明原因、影响范围与剩余风险。

## Aeon Vale：原生 Godot

引擎版本为 Godot 4.7.2，工程入口为 `apps/aeon-vale/project.godot`，使用 Compatibility 渲染。启动脚本从 `GODOT_BIN`、PATH 或用户 Downloads 下的 Godot 便携目录定位引擎；也可传入 `-GodotPath`。独立于 pnpm/Turbo 构建，Windows 导出需要本机安装对应版本的 x64 模板。

```powershell
# 仓库根目录执行
./apps/aeon-vale/run.ps1 -Mode run
./apps/aeon-vale/run.ps1 -Mode editor
./apps/aeon-vale/run.ps1 -Mode test
./apps/aeon-vale/run.ps1 -Mode capture
./apps/aeon-vale/run.ps1 -Mode export
```

`test` 依次执行地图/存档、植物生态/旧档迁移、神力/物种、年份/种子/笔刷/灾难、肥料/新生态、地图配置/生态扩散、主动催生、天气、日历迁移、植被换代、风雨灾难及裸土/地震十二套无头检查。`capture` 依次启动完整运行、界面专项、`seasons_runtime.gd`、`canopy_runtime.gd`、`landscape_runtime.gd`、`feedback_runtime.gd`、`weather_runtime.gd`、`landform_runtime.gd`、`interface_design.gd`、`renewal_runtime.gd` 、`tempests_runtime.gd` 和 `earth_runtime.gd`，通过真实 Godot 输入验证创建、施法、生长、灾难、天气、暂停倍速、笔刷、设置、WASD、生态扩散、分块地表、植被换代、Esc 与窗口适配，将截图及报告写入应用的 `test-output/`。单独检查使用引擎参数 `--path apps/aeon-vale --script tests/专项名称.gd`。

持续镜头性能使用 `--script tests/motion_benchmark.gd -- 标签`，输出 `motion-标签.json`；追加 `weather` 可加入三片雨云。`tests/weather_motion.gd -- 标签` 检查真实长按、WASD、滚轮及三片雨云、四片晴天浮云并行的帧时间，追加 `tempests` 将其中一片雨改为酸雨并加入三股龙卷风。`tests/idle_motion.gd -- 标签` 按真实 1x 静置 15 秒检查周期长帧。性能检查独立执行，不与录屏或其他 GPU 检查并行。

`tests/tempests_runtime.gd -- record` 在引擎参数 `--fixed-fps 30` 下输出连续原生画面到 `test-output/film13/`；原天气录屏为 `tests/weather_runtime.gd -- record`，输出 `film09/`。录屏不用于性能结论。所有输入检查使用独立 `user://test-runs/` 存档及设置，不覆盖玩家数据。`tests/earth_film.gd` 在 `--fixed-fps 30` 下输出土壤和地震录像帧至 `film14/`。Windows 0.14 导出产物为 `apps/aeon-vale/build/AeonVale-0.14.exe`。

地图生成入口为 `scripts/world_landscape.gd`；局部竞争在 `scripts/biome_dynamics.gd`，完整数据与时间推进归 `scripts/world_data.gd`。`scripts/surface_renderer.gd` 从独立快照生成地表与局部缩略图，主线程只上传变化块；`scripts/soil_art.gd` 负责连片草土，`scripts/plant_layer.gd` 保留分行绘制命令，镜头通过父级变换移动，植物变化分帧刷新。建图只读 `assets/maps/*.png`，离线工具为 `scripts/build_map_thumbnails.gd`；点击创建才生成。切换世界先结清旧后台任务。`scripts/weather.gd` 推进普通雨、酸雨和晴天浮云，`scripts/natural_forces.gd` 推进灾难，`scripts/weather_art.gd`、`scripts/tempest_art.gd` 负责显示。雨和酸雨共用最多十二片降雨云，酸雨不自动生成；龙卷风与火焰共用预制动画图集，海浪不改变地形。

存档使用 v10，新增地震痕迹、雨/酸类别和龙卷风转向相位，兼容 v1–v9；旧档保留所见年份与植物生命进度，旧枯木消解进度按比例迁移，活动天气和灾难保留剩余寿命，旧雨云仍为普通雨。读取不写回，首次覆盖备份原版本字节。84 秒一年、环境场、生成设置、晴天浮云与边界休整期继续保存，v1–v5 首次读取保持扩散关闭。

## CI 质量门禁

`.github/workflows/quality.yml` 在 push 和 pull request 中运行 Harness、context、workspace check/build 与 Go 测试。Node 与 pnpm 版本以根 `package.json#engines` 和 `package.json#packageManager` 为唯一真源；部署迁移与重启顺序见 `.github/workflows/deploy-server.yml`。
