# Expedition Load Performance P01

日期：2026-09-20。范围仅限正式 Mission Selection → Loading → Medium Town Expedition 的开场性能、Search Navigation Resolve 调度、Ready Gate 和对应 QA；未修改 Town Grammar、Road Graph、Land Use、Parcel、Building Placement、M00～M03 规则语义、E01 移动语义、E01.5 Minimap 语义或 E02 Loot / Reward 语义。

## 根因与实现

上一轮五 Seed 的 `search_navigation_resolve` 为 1.66～2.03 秒，并作为硬 Ready Gate 继续占用 1.48～1.85 秒的末段等待。P01 将 Search Registry 的基础条目与全 Town 路径解析分离：目标先以 `UNRESOLVED` 注册，Navigation Ready 后立刻允许展开；进入 Expedition 后每帧按预算解析，结果进入 `RESOLVED_REACHABLE` 或 `RESOLVED_UNREACHABLE`。玩家在后台完成前点击目标时，Registry 先同步优先解析该目标，再沿用既有 SearchTask、取消、完成、拾取和 once-only 奖励链。

Ready Gate 仍阻塞 Town、Building Runtime、基础环境、Navigation、当前 Seed Minimap World Layer、Survivor 和 HUD；不再阻塞全 Town Search 路径解析。`final_ready_wait` 黑盒已删除，改为 `wait_navigation_sync`、`wait_search_registry_ready`、`wait_minimap_ready`、`wait_survivor_ready`、`wait_hud_ready`、`wait_frame_present`、`wait_search_resolve` 和 `wait_transition`。

Environment 保持原生成结果语义，只把 M02 数据计算、M03 Roadside 数据计算、环境实例化和 Roadside 实例化拆成独立阶段并在阶段间让出渲染帧。Profile 新增 `environment_data_generate`、`environment_roadside_generate`、`environment_instance` 和 `roadside_instance`，可见最长阶段仍是纯数据环境计算；未引入线程化或大规模架构改写。

## 五 Seed 真实等待时间

测试使用原生 Godot 4.7.2 Compatibility / RTX 3060、1600×900，从 Mission Selection 确认按钮的合成鼠标点击开始，到 Iris 完全展开后测试侧立即下达真实地面移动命令并得到接受为止。该墙钟位于测试侧，不使用内部 Profile `TOTAL` 代替玩家等待时间。

| Seed | 测试侧点击至移动命令接受 | 内部 Click to Playable | Environment Data | 展开时未解析 Search 目标 |
| --- | ---: | ---: | ---: | ---: |
| 18933346 | 2.688 s | 2.649 s | 0.756 s | 49 |
| 19038075 | 2.343 s | 2.289 s | 0.669 s | 49 |
| 19142804 | 2.544 s | 2.492 s | 0.799 s | 49 |
| 19247533 | 2.381 s | 2.245 s | 0.614 s | 47 |
| 19352262 | 2.462 s | 2.415 s | 0.732 s | 48 |

平均 2.484 秒，最慢 2.688 秒。平均 ≤ 3.0 秒且五局均 ≤ 3.5 秒。Environment Data 仍是当前最大单阶段，五局为 0.614～0.799 秒；后续若继续压缩，应优先优化纯数据 Placement 计算，而不是削减 Ready Gate 的 Minimap、Navigation、Survivor 或 HUD 条件。

完整阶段值见 [load_profile_5_seeds.txt](../test-output/expedition-load-performance-p01/load_profile_5_seeds.txt)。五局均在首次展开时看见当前 Seed 的道路、建筑 footprint、全部 Survivor Marker、Arrival / POI Marker，并立即接受移动命令。

## Search、Minimap 与视频证据

- E02 Search：1,222 项通过；新增 `UNRESOLVED` 目标即时优先解析、单目标后台队列正确收尾、不可达拒绝、无任务/无瞬移验证。既有取消、续搜、完成阈值、奖励 once-only 和完成目标不可重复领取继续通过。
- Search 原生视频：`priority_resolve_count=1`，目标从 `UNRESOLVED` 进入 `RESOLVED_REACHABLE`，真实建筑点击创建既有 SearchTask，最终画面显示搜索进度 64%。
- E01 Navigation：240 项通过；E00 Runtime Bridge：58 项通过；Ready Gate：121 项通过。
- E01.5 Minimap：1,441 项通过；五 Seed原生 Loading：100 项通过；两段录像专项分别 19 项和 4 项通过。
- [完整出发至可移动视频](../test-output/expedition-load-performance-p01/depart_to_playable_optimized.mp4) 保留 Mission Selection、点击出发、Iris Close、Loading、Iris Open、真实移动命令与队员移动。
- [未解析目标优先解析视频](../test-output/expedition-load-performance-p01/search_unresolved_priority_resolve.mp4) 展示真实建筑点击和进入搜索。

P01 产物目录为 `test-output/expedition-load-performance-p01/`，包含要求的 `load_profile_5_seeds.txt`、`seed_01_loading.png`、五张 `seed_XX_playable.png` 和两段 MP4。测试截图、视频、帧与日志不纳入 Git。

在补录后台完整解析耗时的一次先行批次中，第 3 个随机 Seed 的冻结 Town Generator 返回失败，该批次按真实失败中止，未计入性能 PASS；随后一组连续五个不同随机 Seed 完整通过。P01 未修改 Town Generator，此偶发生成失败仍是范围外风险。

## Windows 构建

已实际执行 `run.ps1 -Mode build`。Search Gameplay 72、Expedition HUD 258、Survivor Command 45、Search Active Card 157、Settings 14、Camp Menu Overlay 30 项通过；随后被既有 Camp UI 回归阻断：`tests/camp_ui_runtime.gd:114` 访问已不存在的 `member_buttons`，并失败于“Camp exposes active abilities on its left edge”断言。未修改并行 Camp UI、未跳过门禁，因此没有生成 P01 的新独立 EXE，也没有执行新 EXE 独立启动验证。

## 完成状态

```text
Expedition Load Performance P01:
TECHNICALLY COMPLETE

Human Runtime QA:
PENDING

E03 Enemy:
NOT STARTED
```

Windows 全量构建仍因范围外 Camp UI 回归失败；这不改写 P01 专项的真实性能结果，但必须在独立试玩包交付前另行修复并重跑完整 build。
