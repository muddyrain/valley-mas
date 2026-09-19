# Expedition Runtime Loading Transition / Random Town Minimap Ready Gate

日期：2026-09-19。执行范围：正式 Camp → Mission Selection → Expedition 的转场、初始化调度和小地图就绪条件。

## 根因与实现

旧流程在出发演出结束后使用普通淡黑，同步构建整个 Mission，未等待导航、搜索可达性或小地图提交绘制就开始淡入。基线原生操作从点击到进入约 8.94 秒；转场结束后，小地图内容区道路与建筑目标颜色像素均为 0。

小地图缺层与 Seed 无关：已有缓存确实持有当前 Town 数据，但承载负世界坐标绘制命令的零尺寸 `Control` 在局部裁剪/平移时没有正确显示。独立切换绘制层顺序和扩大 Control 尺寸均未恢复；使用 `Node2D` 保留原世界坐标、缩放、裁剪和父子顺序后，原生画面恢复道路与建筑。没有增加固定图片、额外 Viewport 或跨局纹理缓存。

本轮实现：

- 可复用 `RuntimeLoadingOverlay` 位于 app 的 CanvasLayer，关闭 0.25 秒、展开 0.55 秒。深蓝黑遮罩、居中“加载中…”与右下循环圆环；不引入美术资产。确认出发立即开始 Iris Close，替换该入口先走 Camp 出发演出再淡黑的流程。原“继续游戏 → 营地”的 LoadingScreenV2 保持原用途。
- `close()` 等待实际 `frame_post_draw`，完全遮罩与 Loading 文案绘制后才执行初始化。原生与 headless 路径明确区分：headless 只等待调度帧，不宣称取得渲染证据。
- Town Adapter 拆出数据生成、环境计算、Town 实例化、环境实例化、Runtime 绑定阶段；同步入口和分帧入口调用同一组函数。Town/M00～M03 生成器和模型装配算法不因加载调度而改变。
- 为初始化增加单调时钟 Profile。搜索点可达性检查原先一次占用约 1.4 秒，现沿用同一个单地点判定函数，达到 12ms 预算后让出一帧；单个路径查询不可抢占。现有 SearchTask、Loot、奖励与搜索命令语义不变。
- 新 Mission 在加载期间禁用处理和输入。Town、建筑、环境、Navigation、Search Registry、Minimap World Layer、Survivors、HUD 八项全部满足且 HUD 已完整渲染后，才允许展开和启用操作。
- 小地图缓存键仍为当前 `seed:town_signature`，每个新 HUD 构建一次静态命令；Marker 独立实时更新，维持 70×70m、Squad Center、All Survivors Equal。缺少道路/建筑时清空旧命令并阻止 Gate；记录错误并提供返回主菜单，不静默放行。
- Profile 同时记录事件先后顺序，避免同一微秒内的两个事件被错误判为倒序。
- 回归暴露出两名队员在略有夹角的路径上都认定对方“在前方”，速度同时归零的等待环。只在这种互相等待时沿用队员顺序决定通行优先级，保留路径、碰撞、形成间距与地图数据；E01 原先 9 个失败恢复为 240 项全通过。

## 生产改动范围

| 文件 | 本轮责任 |
| --- | --- |
| [runtime_loading_overlay.gd](../ui/runtime_loading_overlay.gd) | 可复用 Iris / Hold / Indicator |
| [runtime_load_profile.gd](../core/runtime_load_profile.gd) | 事件顺序、分阶段毫秒与 Gate 状态 |
| [main.gd](../core/main.gd) | 正式确认出发入口、准备/放行/失败恢复 |
| [expedition_map_provider.gd](../maps/expedition/expedition_map_provider.gd) | 分帧 Provider 入口，保留同步/Legacy 路径 |
| [town_runtime_adapter.gd](../maps/expedition/town_runtime_adapter.gd) | 同一构建过程按阶段调度与计时 |
| [mission.gd](../missions/mission.gd) | 接受已准备的桥接结果、记录 Spawn/Search 就绪；修复回归发现的互相让行死锁 |
| [town_search_registry.gd](../maps/expedition/town_search_registry.gd) | 可达性查询分帧；判定函数共用 |
| [minimap.gd](../ui/expedition/minimap.gd) | Node2D 静态绘制、缓存清理与绘制确认 |

工作区另有并行贴地高度改动，包含 `walkable_ground.gd`、导航、Adapter 的高度投影、Town 表面的 `walkable_ground` metadata 和 WorldInteractionVFX；本轮没有回退或覆盖。冻结检查分别报告生成/摆放数据一致性和源文件变化，不把这些外部改动冒充本轮改动，也不宣称整个工作区字节冻结。

对照本轮开始时的源文件哈希，144 个 Town / World Scene / World Asset 定义中 143 个未变；唯一变化为并行任务给 `town_urban_view.gd` 的三处表面添加 `walkable_ground` metadata，未修改几何或摆放。Town Grammar、Road Graph、Land Use、Parcel、Building Placement、M00～M03 生成代码未变；详见本地 `source-before.json` 与 `source-comparison.json`。

## 验证

验证记录（最终 Windows 构建结果另列）：

- [runtime_loading.gd](../tests/runtime_loading.gd)：原生 Camp 与 Selection 鼠标输入，连续五次正式出发；无 `--map-seed`，新随机 Campaign 自动派生每局 Seed。检查真实道路/建筑像素、缓存归属、完整 Gate、角色移动及局部跟随。
- [runtime_loading_gate.gd](../tests/runtime_loading_gate.gd)：旧缓存、空底图、未就绪导航/搜索、零尺寸地图均不可通过；同步/分帧生成签名和导航栅格一致；分帧搜索入口及可达状态与同步结果逐项一致。
- Gate 专项：121 项通过；E00：58 项通过；E01：240 项通过；E01.5 Bridge：1,441 项通过；E01.5 Local Follow：1,892 项通过。小地图旧用例曾因比较三维 Arrival/POI 而受贴地 Y 变化影响，现明确比较用于小地图投影的 XZ，不放宽道路、建筑 footprint、区域、多 Seed 或 Marker 校验。
- 最终正式五局原生测试：90 项通过；修复互相让行后的 E02 Search：1,206 项通过。最终这些测试日志无 Missing Resource、Invalid UID 或脚本 Runtime Error。
- 最终录像单独使用随机 Seed 36182215：18 项通过。6.866 秒、1600×900、H.264 视频按实际帧时间编码，包含确认出发、收拢、加载、展开和已就绪的小地图。
- 额外调试中运行过旧 `expedition_minimap_capture.gd`，其“点击 POI 后三人全部移动”断言失败。该脚本早于 E02 的建筑点击搜索语义，未作为本轮正式流程验收；本轮移动/跟随和 E02 行为分别由专项测试核对。

## 截图、视频和性能记录

本地产物位于 `test-output/expedition-runtime-loading/`，不纳入 Git。

- [确认出发前](../test-output/expedition-runtime-loading/01_before_depart.png)、[Iris Close](../test-output/expedition-runtime-loading/02_iris_closing.png)、[Loading Hold](../test-output/expedition-runtime-loading/03_loading_hold.png)、[Iris Open](../test-output/expedition-runtime-loading/04_expedition_opening.png)。
- [Seed A](../test-output/expedition-runtime-loading/05_seed_a_minimap.png)、[Seed B](../test-output/expedition-runtime-loading/06_seed_b_minimap.png)、[Seed C](../test-output/expedition-runtime-loading/07_seed_c_minimap.png)、[Seed D](../test-output/expedition-runtime-loading/08_seed_d_minimap.png)、[Seed E](../test-output/expedition-runtime-loading/09_seed_e_minimap.png)。
- [五局底图对照](../test-output/expedition-runtime-loading/11_random_seed_minimaps.png)、[完整性能明细](../test-output/expedition-runtime-loading/10_load_profile.txt)。
- [完整出发转场视频](../test-output/expedition-runtime-loading/depart_to_expedition_loading_transition.mp4)。录像另走一次真实随机出发，保留帧间真实时间，不覆盖五局截图；对应阶段截图使用 `video_` 前缀。

| 当前 Seed | Overlay 首帧 ms | Close 至 Hold 已绘制 ms | Open ms | TOTAL ms | 道路 / 建筑像素 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 34051435 | 21.18 | 262.88 | 554.88 | 4103.36 | 1993 / 228 |
| 34156164 | 11.92 | 260.62 | 558.29 | 4004.44 | 1738 / 513 |
| 34260893 | 11.84 | 260.67 | 542.91 | 4354.72 | 1757 / 626 |
| 34365622 | 11.90 | 260.65 | 561.79 | 4484.24 | 2132 / 337 |
| 34470351 | 11.89 | 260.64 | 559.86 | 4035.52 | 1705 / 699 |

每局实际几何均为 13 条 Road Bounds、55 个 Building Footprints；签名不同，缓存构建各一次。每次都从 Camp 点入 Mission Selection 再确认出发，中间通过菜单返回 Camp，没有直接调用 QA 地图装配绕过正式入口。

| Stage (ms) | 34051435 | 34156164 | 34260893 | 34365622 | 34470351 |
| --- | ---: | ---: | ---: | ---: | ---: |
| town_generate | 299.76 | 350.03 | 376.93 | 335.48 | 359.86 |
| building_instance | 20.80 | 21.75 | 26.79 | 20.20 | 26.02 |
| environment_generate | 661.30 | 778.26 | 1016.41 | 869.90 | 770.39 |
| environment_placement | 49.73 | 62.83 | 63.25 | 53.19 | 49.40 |
| navigation | 113.53 | 104.02 | 112.70 | 128.11 | 103.97 |
| search_registry | 11.87 | 10.20 | 10.53 | 10.80 | 9.50 |
| search_navigation_resolve | 1923.93 | 1657.30 | 1724.90 | 2027.34 | 1694.87 |
| minimap_world_build | 0.23 | 0.39 | 0.41 | 0.33 | 0.58 |
| survivor_spawn | 7.45 | 10.74 | 11.84 | 7.65 | 8.78 |
| hud_bind | 205.84 | 144.61 | 147.58 | 124.07 | 130.02 |
| final_ready_wait | 1606.62 | 1480.93 | 1550.36 | 1854.52 | 1540.21 |

耗时是本机实际墙钟时间，包含各自阶段调用，非旧报告估算。`mission_setup` 包含 Search Registry 和 Survivor 子阶段，`hud_bind` 包含 Minimap 子阶段，搜索分帧可与最终 Gate 等待重叠，不能将全部列直接相加。录像读取帧会引入开销，性能表使用不连续录制帧的五次运行；录像只作转场/画面证据。

Town/环境生成仍有必须访问 Godot 场景资源的主线程工作，冻结生成器未为加载而大改；阶段间让出渲染，搜索可达性分帧。五局最长单个环境计算阶段约 1.02 秒，期间遮罩与文字已绘制，但圆环仍会短暂停顿；搜索可达性期间持续让出帧，最大单批 46.70ms。没有整段裸黑屏，也不宣称全程零卡顿。

## 交付状态

- Runtime Loading Transition：TECHNICALLY COMPLETE。
- Random Town Runtime Minimap：TECHNICALLY COMPLETE。
- Human Runtime QA：PENDING。
- E03 Enemy：NOT STARTED。
- Windows build：已实际执行 `run.ps1 -Mode build`，退出码 1。导入、Search Gameplay 72、HUD 258、Survivor Command 45、Search Active Card 157、Settings 14 项通过后，被既有 `camp_ui_runtime.gd:114` 访问已不存在的 `member_buttons` 和“Camp exposes active abilities on its left edge”断言阻断。未跳过检查，未修改 Camp；没有本轮新 EXE，未执行新导出程序的独立启动验证。详见 [构建日志](../test-output/expedition-runtime-loading/windows-build.log)。

没有自动提交。本轮只同步本阶段计划，不推进 E03、战斗、Fog、HUD 重设计、Blue Hour 或撤离系统。
