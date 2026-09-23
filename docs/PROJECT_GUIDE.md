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
| 蓝时归航 · BLUE HOUR: HOMEWARD | `apps/blue-hour` | Godot 4.x、GDScript、3D 小队生存与五日归航试玩 |
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
./apps/aeon-vale/run.ps1 -Mode generation
./apps/aeon-vale/run.ps1 -Mode benchmark
./apps/aeon-vale/run.ps1 -Mode export
```

`test` 依次执行地图/存档、植物生态/旧档迁移、神力/物种、年份/种子/笔刷/灾难、肥料/新生态、地图配置/生态扩散、主动催生、天气、日历迁移、植被换代、风雨灾难、裸土/地震及动态远景、地表材料十四套无头检查，再执行 `generation_shapes.gd` 的八类、多种子、三档尺寸与参数端点结构检查。`capture` 依次启动完整运行、界面专项、`seasons_runtime.gd`、`canopy_runtime.gd`、`landscape_runtime.gd`、`feedback_runtime.gd`、`weather_runtime.gd`、`landform_runtime.gd`、`interface_design.gd`、`renewal_runtime.gd`、`tempests_runtime.gd`、`earth_runtime.gd` 和 `overview_runtime.gd`，通过真实 Godot 输入验证创建、施法、生长、灾难、天气、暂停倍速、笔刷、设置、WASD、生态扩散、分块地表、动态远景、植被换代、Esc 与窗口适配，将截图及报告写入应用的 `test-output/`。`generation` 单独采集八类各四个种子的原生概览、中景、地面及创建交互和满边裁切；`benchmark` 单独测量最大平原与岛屿的 1x 和移动缩放，运行时不并行其他压力任务。单独检查使用引擎参数 `--path apps/aeon-vale --script tests/专项名称.gd`。

持续镜头性能使用 `--script tests/motion_benchmark.gd -- 标签`，输出 `motion-标签.json`；追加 `weather` 可加入三片雨云。`tests/weather_motion.gd -- 标签` 检查真实长按、WASD、滚轮及三片雨云、四片晴天浮云并行的帧时间，追加 `tempests` 将其中一片雨改为酸雨并加入三股龙卷风。`tests/idle_motion.gd -- 标签` 按真实 1x 静置 15 秒检查周期长帧，追加 `far` 采样远景。两者追加 `wide` 使用历史 480×320，默认仍为固定 384×256 对照；追加 `large-window` 使用默认大窗口。`tests/overview_capture.gd -- 标签` 留下同种子远近景画面并独立记录 600 帧远景时间。性能检查独立执行，不与录屏或其他 GPU 检查并行。

`tests/tempests_runtime.gd -- record` 在引擎参数 `--fixed-fps 30` 下输出连续原生画面到 `test-output/film13/`；原天气录屏为 `tests/weather_runtime.gd -- record`，输出 `film09/`。录屏不用于性能结论。所有输入检查使用独立 `user://test-runs/` 存档及设置，不覆盖玩家数据。`tests/earth_film.gd` 在 `--fixed-fps 30` 下输出土壤和地震录像帧至 `film14/`；`tests/overview_film.gd` 同样输出动态远景、施肥、降雨和缩放至 `film15/`。当前 Windows 0.26 导出产物为 `apps/aeon-vale/build/AeonVale-0.26.exe`。

当前全套植被图集统一位于 `assets/vegetation`，覆盖 68 种植物与两个岩石编号、六个生命阶段和三个变体。`normalize.py` / `check_assets.py` 规范化并检查 40×48、20×24、4×5 三档帧；`flora_sprites.gd` 读取，`pixel_flora.gd` 提供公共图集，概览从相同原画生成最多三个实色的紧凑标记，每地形格一个像素，以最近邻显示并保持分区更新。普通地面代码绘制安静主色和稀疏有序浅纹；山脉读取 `assets/terrain/snow-crests.png`，其原始图、提示词与规范化工具保存在同目录中。两类资产的来源板、预览与制作脚本均排除 Windows 包。

`tests/ground_runtime.gd -- ground-before` 在改美术前保存种子 319762786 的世界和基准图；`-- ground-after verify` 读取这份世界，验证模型数组未变，并拍摄相同远中近景、地面与海岸，再检查十八类生态、图鉴、播种边缘、动态远景及 720 帧移动缩放。不要在改后重新生成基准图冒充改前证据。`tests/terrain_materials.gd` 检验接边连续、雪岩纹理、编辑缓存、保存重建与工作线程图像一致。`tests/idle_motion.gd -- ground far wide large-window` 记录最大地图 1x 自然运行。 雪岩专项使用 `tests/ground_runtime.gd -- crest-before relief target` 在改前拍照，改后用 `-- crest-after relief verify` 检查同图模型、丘陵笔刷、播种、动态远景与移动缩放；`relief-only` 只拍丘陵笔刷。其前后数据均读取既有 `ground-world.json`，不重新随机生成；只有明确的 `ground-before` 标签会重建这份基准。

`tests/pixel_overview_runtime.gd -- pixel-after verify` 读取既有 `ground-world.json`，检查五个距离的同图画面、完整存档字段（不含保存时间）、十八类生态与动态远景，并另建三个固定种子的世界检查岸线和初始林地。前后图、窗口检查与独立性能样本见应用 `docs/VALIDATION.md` 的 0.24 记录。

模板目录与细调定义在 `scripts/world_templates.gd`，物理比例、陆块与山系由 `scripts/world_topology.gd` 构造，水岸分类、生态大区与初始植被由 `scripts/world_landscape.gd` 负责；局部竞争在 `scripts/biome_dynamics.gd`，完整数据与时间推进归 `scripts/world_data.gd`。`scripts/surface_renderer.gd` 从独立快照生成地表与每格一个像素的局部缩略图；`scripts/overview_layer.gd` 把实际地面与树冠按带余量的分区合成，只上传变化区域。`scripts/soil_art.gd` 负责连片草土，`scripts/plant_layer.gd` 保留分行绘制命令，镜头通过父级变换移动，植物变化分帧刷新。建图只读 `assets/maps/*.png`，离线工具为 `scripts/build_map_thumbnails.gd`；点击创建才生成。切换世界先结清旧后台任务。`scripts/weather.gd` 推进普通雨、酸雨和晴天浮云，`scripts/natural_forces.gd` 推进灾难，`scripts/weather_art.gd`、`scripts/tempest_art.gd` 负责显示。雨和酸雨共用最多十二片降雨云，酸雨不自动生成；龙卷风与火焰共用预制动画图集，海浪不改变地形。

存档使用 v11，保存独立裸土状态，兼容 v1–v10；旧图保留原尺寸、所见年份与植物生命进度，旧枯木消解进度按比例迁移，活动天气和灾难保留剩余寿命，旧雨云仍为普通雨。读取不写回，首次覆盖备份原版本字节。84 秒一年、环境场、生成设置、晴天浮云与边界休整期继续保存，v1–v5 首次读取保持扩散关闭。新建尺寸由 `World.MAP_SIZES` 统一定义为 288×288、384×384、480×480，默认标准档。

## 蓝时归航：原生 Godot

入口为 `apps/blue-hour/project.godot`，使用 Compatibility 渲染，当前验证引擎为 Godot 4.7.2。项目独立于 pnpm/Turbo，不需要额外插件。环境分工与路径规则见[项目 Development Environment](../apps/blue-hour/README.md#development-environment)。`[Windows]` 启动脚本从 `GODOT_BIN`、PATH 或用户 Downloads 的便携目录定位引擎，也接受 `-GodotPath`。

`[Windows]` 从仓库根目录运行：

```powershell
./apps/blue-hour/run.ps1 -Mode run
./apps/blue-hour/run.ps1 -Mode editor
./apps/blue-hour/run.ps1 -Mode import
./apps/blue-hour/run.ps1 -Mode test
./apps/blue-hour/run.ps1 -Mode smoke
./apps/blue-hour/run.ps1 -Mode capture
./apps/blue-hour/run.ps1 -Mode build

# [Windows] 已将 Godot 加入 PATH 时可直接执行
godot --headless --path apps/blue-hour --editor --import --quit
godot --headless --path apps/blue-hour --script tests/rules.gd
godot --headless --path apps/blue-hour --script tests/mission_flow.gd
godot --headless --path apps/blue-hour --script tests/search_dispatch.gd
godot --headless --path apps/blue-hour --script tests/parallel_commands.gd
godot --headless --path apps/blue-hour --script tests/day_loop.gd
godot --headless --path apps/blue-hour --script tests/day_loop_flow.gd
godot --headless --path apps/blue-hour --script tests/new_run.gd
godot --headless --path apps/blue-hour --script tests/new_run_flow.gd
godot --headless --path apps/blue-hour --quit-after 120 -- --test-save=smoke-03.json
godot --headless --path apps/blue-hour --script tests/balance_probe.gd
godot --headless --path apps/blue-hour --script tests/parallel_routes.gd
```

`[macOS]` 使用本机 Godot 对源码进行专项检查时，从仓库根目录执行 `godot --headless --path apps/blue-hour --script tests/camp_roster_recruitment_integration.gd`；Godot 可执行文件路径以本机安装位置为准。此命令不生成 Windows EXE。

`test` 执行资源导入、模型导入/集成，以及规则、行动、单人派遣、并行操作、跨日规则、跨日行动、开局规则和新队伍五日流程八组玩法验证；`day_loop_flow.gd` 包含实际战斗中的五日补给路线、装备路线耗尽储粮以及单人任务边界。`smoke` 启动主场景并在 120 帧后退出。`capture` 依次运行 `tests/art_runtime.gd`、`tests/runtime.gd`、`tests/day_loop_runtime.gd`、`tests/controls_runtime.gd` 和 `tests/new_run_runtime.gd`，使用屏幕外原生窗口及合成输入验证战斗/搜索、持续带队、指向射击、暂停与镜头，以及购买、换装、口粮分配、续玩、减员和结束界面；截图与五组 runtime 报告输出到 `apps/blue-hour/test-output/`。路线诊断 `balance_probe.gd` 记录原有串行路线，`parallel_routes.gd` 在 3 个固定种子且关闭无敌的条件下对照串行三点、并行三点与并行八点；这些记录不作为体验好坏的自动化断言。脚本同时检查退出状态和 Godot 错误日志，避免引擎遇到脚本错误仍返回零而误报通过。

所有自动化、启动检查和独立导出验证使用 `user://test-runs/` 的隔离记录，不覆盖玩家的 `user://homeward/run.json`，也不控制用户当前窗口。当前只在安全屋与待结算节点保存；行动中退出后重试当天，装备奖励保持固定。

`[Windows]` `build` 使用匹配引擎版本的 Windows x64 模板，先执行导入及上述模型与玩法测试，再通过 `Windows Desktop` 预设导出资源内嵌的 `apps/blue-hour/build/BlueHourHomeward.exe`。随后将 EXE 复制到独立验证目录，在不带源码和独立 PCK 的情况下分别完成基地、主菜单的 Headless 与屏幕外原生启动，以及内嵌模型检查，成功后记录 `BUILD-INFO.json`。试玩只需该 EXE，无需 Godot 编辑器；每次功能交付都更新构建。Debug Menu 在当前试玩构建中保留。

范围、操作与资源入口见 [蓝时归航 README](../apps/blue-hour/README.md)，实际验证记录见 [VALIDATION](../apps/blue-hour/docs/VALIDATION.md)。缓存、构建与本地验证产物由项目 `.gitignore` 排除。

## CI 质量门禁

`.github/workflows/quality.yml` 在 push 和 pull request 中运行 Harness、context、workspace check/build 与 Go 测试。Node 与 pnpm 版本以根 `package.json#engines` 和 `package.json#packageManager` 为唯一真源；部署迁移与重启顺序见 `.github/workflows/deploy-server.yml`。

方形世界与边界检查：`./apps/aeon-vale/run.ps1 -Mode boundary` 验证八类 384×384 世界的边线、两档窗口、移动缩放、边缘编辑与旧矩形存档。`-Mode test` 含三档方形存读档检查；当前 `-Mode benchmark` 采用 480×480。实机对照见 `apps/aeon-vale/test-output/square-review.html`。
