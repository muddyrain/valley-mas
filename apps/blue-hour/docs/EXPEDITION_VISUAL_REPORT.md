# 外出地图、相机与 HUD

当前正式实现的统一记录；2026-09-12 更新。旧的按阶段命名 HUD 报告已合并到本页。Windows 验证和最终构建信息见 [VALIDATION](VALIDATION.md)。

## 正式入口与范围

Main Menu → New Game → 专属路线 → Camp → 今日行动 → 营地集结、上车与驶离 → Expedition → 搜索 / 战斗 / Blue Hour → E 归航 → 结算确认 → Camp。

- 唯一 Main Scene：`res://core/main.tscn`，装配在 `core/main.gd`。
- 菜单 `ui/title_screen.gd`；路线 `ui/new_game_screen.gd`；营地 `ui/shelter_screen.gd` 与 `scenes/camp/camp_main.tscn`；今日行动 `ui/today_action_screen.gd`。
- `core/main.gd::start_mission()` 接收今日行动确认，复用营地出发演出，再装配 `missions/mission.gd` 与 `ui/mission_hud.gd`。没有平行 Expedition Scene。
- `missions/mission.gd::command_extract()`、`_update_extraction()`、`_finish()` → `Main._mission_complete()` → `ui/settlement_screen.gd` → `Main.return_to_shelter()`。
- 保留同一 Campaign、任务、物资账本、角色控制、武器、时间与结算；同期营地出发、双角色 Rig 和武器改动合并验证。没有把这些内容归为本次新增。

## Camera

| 项目 | 之前 | 当前 |
|---|---|---|
| 默认正交 Size | 33 | **25** |
| 玩家缩放范围 | 28–42 | **20–35**，原滚轮步长 3 |
| 相对位置 | (34,42,43) | 保持 |
| 旋转 | (-37.458374°,38.33334°,0°) | 保持 |
| 入场位置 | (34,42,66) | **(23,42,85)**，随南缘出生点变化 |
| 前视 / 平滑 | 世界 -Z 方向 4m / 指数速率 6 | 保持 |
| 1600×900，1.6m 身体投影 | 34.64px | **45.72px** |
| 1920×1080 / 1366×768 | 41.57 / 29.56px | **54.87 / 39.02px** |

从 25 实机起测；24、25、26 的同角度投影分别约 47.63、45.72、43.96px，25 已满足 1600×900 的目标，因此未改动角色比例。原生画面验证使用 25；没有宣称这三个值都完成了独立完整出勤。

同一相机继续执行小队中心 Follow、WASD、右/中键拖动、手动解除跟随和“定位”恢复。队员分散不会自动缩远。边界根据新地图半宽/半深各向内 8m 裁定。仅验收脚本的布局截图使用一次调试总览，玩家范围内不存在总览档位。

## 闪烁：原视频与排查证据

主要 Before 为用户的 `Valley-Recording-20260912-145836.mp4`：9.255 秒，1602×932，包含窗口边框。工程内保留逐字节副本 [Before 视频](../test-output/expedition-motion/before.mp4)。先检查整段的连续时间采样，再对移动段提取原尺寸相邻帧；没有把一张静态截图作为运动问题的结论。

原视频中可辨认的位置：

| 位置 / 时间段 | 实际观察 | 归因与处理 |
|---|---|---|
| 0–9 秒可见草地、路面、人行道；约 2 秒路口附近最容易看清 | 细密斜纹随平移变化；大平面本身不应有这种密度的纹理 | 同路径关闭 RoadNetwork 投射阴影后显著消退：薄层地面自阴影。水平地面、道路、标线、停车与底板现在接收阴影但不投射阴影 |
| 约 1.8–3.5 秒、后半段可见的修车铺金属屋顶；餐厅瓦面 | 细线亮暗游移；未看到整栋建筑闪现或清晰的大块 LOD 跳变 | 阴影 normal bias 1→2 减轻细面自阴影；8× MSAA 减少剩余细几何采样变化。源屋顶高频纹理仍保留 |
| 白墙、厢式车表面 | 细节与轮廓存在小幅变化；没有足够证据称为重复模型或 LOD Pop | 检查真实 Mipmap、材质、法线与高光开关；保留 2K 原纹理和正常 PBR，不用删除材质掩盖 |
| 录像边缘可见围栏与其阴影 | 亚像素网纹在运动中改变可见密度 | 原 Shader 是硬 step + alpha scissor，没有像素宽度过滤；现按 fwidth 对周期网丝积分，使用透明混合保留亚像素覆盖率。远处平均覆盖率会弱化成薄灰网影 |
| 道路标线 / 斑马线 | 边缘有采样变化，未见整片在路面间互换的典型共面闪烁 | 标线确有垂直间隙；本次把高度层级明确化，并停止薄标线投影。修复生成器 T 口朝向，斑马线仅画在相连道路 |
| 路灯和阴影边缘 | 灯杆及细影边缘会变化，主要平面跳纹不是灯模型 LOD | 保留灯和建筑阴影；法线偏移修正与 MSAA 后复查 |
| 树叶 / 灌木 | 原片多在边缘或远处，不足以据此断定整棵树有 LOD Pop | After 增加近处树、庭院与围栏段；源叶片是**不透明几何**，没有错误地套用 Alpha Cutout 解释 |

另外检查出入口路径与建筑底板的顶面原来都为 Y=0，并在门口重叠。这是确定的局部共面缺陷，但不能把整张地图屋顶闪烁归咎于它。入口路径现顶面 Y=.035；底板顶面 Y=0。道路顶面 Y=0、标线底面 Y=.019、停车顶面 Y=.025/标线底面 Y=.039，人行道顶面 Y=.045。人行道以 0.8m 格统一求并、合并条带，只输出一份网格，路口不叠两层 Sidewalk。

对 16 个源 GLB 解码顶点、索引并检查完全重合的三角面，发现数量均为 0，明细在 `test-output/expedition-motion/source-faces.json`。这排除了完全重复三角面，不能据此保证源模型不存在所有近共面细节。

### 单变量验证

在原地图、Size=33、同一 48 帧平移轨迹中，分别测试基线、禁用自动 LOD、禁用太阳阴影、禁用法线、移除纹理、高粗糙度、加 bias、正交阴影模式、缩短远裁面、禁用水平路网投影、normal bias=2。原始无损帧与指标在 `test-output/expedition-motion/`。

相机投影配准后的相邻帧平均 RGB 绝对变化（0–255），用于辅助比较，不等于人的闪烁评分：

| 同布局实验 | 屋顶 | 道路采样区 | 灯影采样区 |
|---|---:|---:|---:|
| 原始基线 | 1.723 | .697 | .634 |
| 关闭 LOD | 1.740 | .697 | .633 |
| 关闭太阳阴影（仅诊断） | 1.185 | .179 | .121 |
| 只关闭路网投影 | 1.723 | .233 | .211 |
| 只把 normal bias 改为 2 | 1.616 | .233 | .204 |

自动 LOD、缩短 far、单独增加 depth bias、单独移除法线/高光都未消除主要问题，因此最终没有全局关闭 LOD、阴影或纹理，也未采用极端 depth bias。修正后的同一修车铺屋顶采样区，4×→8× MSAA 的指标为 1.616→1.393。地图扩张使其他位置物体发生变化，**不把新地图全部 ROI 数值冒充同场景对比**。

逐个加载真实 15 项有贴图的正式 World 模型：2048²、**11 层 mipmaps**、过滤枚举 5（带 mipmaps 的各向异性）、项目 8× anisotropic；原本已正确，未假称新增 Mipmap 修复。树与灌木 transparency=0。所有源 GLB、47K 树及原材质资源共享保持。

原理参考：[Godot 阴影参数](https://docs.godotengine.org/en/stable/tutorials/3d/lights_and_shadows.html)、[Spatial Shader 透明与覆盖率](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/spatial_shader.html)。这些文档仅解释参数，根因结论来自上述运行对比。

### After 与剩余边界

[After 视频](../test-output/expedition-motion/after.mp4)：1600×900、30fps、20 秒，600 个实际 Viewport 渲染帧；从正式菜单和营地出发进入，合成真实鼠标/键盘事件。0–4s Follow，4–7s WASD，7–10s 拖动，10–14s 缩放，14–18s 拖到围栏与树旁停留，18–20s 定位恢复 Follow。录制采用 fixed-fps 和无损帧编码，录制写盘耗时不作为性能结果。

修正后未再复现原片中大面积道路/草地持续斜纹跳动，也未见建筑主体消失或明确的 LOD Pop。不能声称所有像素完全静止：高频屋顶细节、细叶边缘仍有轻微采样变化；近看素材自带的细密纹理也仍存在。Compatibility 下的 alpha-to-coverage 实测曾出现实心网片，已移除这条尝试；仅细网片改用过滤后的 Alpha Blend，柱/横杆保留实体阴影。围栏远处做覆盖率平均，不以密集黑白闪点强行保留每根网丝。视觉强度最终仍需用户按 Before / After 复看。

诊断中三个材质替换实验曾在测试释放场景时触发 GLES 材质空引用错误；这些替换仅存在于隔离诊断脚本，已从正式录制脚本移除。最终运行与导出日志单独检查，不把诊断错误混称为产品零错误。

连续采样：[After 0–9.5s](../test-output/expedition-motion/after-sheet-01.png)、[After 10–19.5s](../test-output/expedition-motion/after-sheet-02.png)。视频保留正常人物动作与时间推进，诊断 A/B 片段才使用冻结模拟的相机轨迹。

## 地图

| 项目 | 之前 | 当前 |
|---|---|---|
| 可玩范围 | 96×72m，6912m² | **160×120m，19200m²，2.78倍** |
| 主要路口 | 1 个十字 | **2 个十字 + 1 个 T 口** |
| 街区区域 | 路口周边资产组合 | **6 个区域**：北商业、北工业、西侧住宅、东侧服务、站前花园、南侧作业区 |
| 建筑 / POI | 8 / 11 | **15 / 18**（15 建筑 + 3 可搜车） |
| 环境车辆 | 3 | **12**（9 辆不搜刮，仍用同样 Wrapper） |
| 巴士出生基准 | (0,0,27) | **(-11,0,46)**，南缘支路停车区 |
| Seed | 20260912 | 保持 |

道路为 8m 模块、2.4m 人行道，主路 Z=0、北路 Z=-32、南支路 Z=40，纵路 X=0。建筑正面由数据 RoadAnchor 定向；入口、车辆、树木和围栏参与同一导航审查。北端商业/工业保留高价值 POI；南缘住宅及服务区先遇到。沿用 8 种建筑、3 种车、树/灌木/灯/桶/标准围栏，没有增加模型类型。

32 段 4×1.8m 标准围栏，四条分段边界，28 处端点衔接；仍留出通行缺口。街灯仅四处实时暖光，全部灯面复用同一 Blue Hour 材质。布局详见 [地图职责](WORLD_MAP_REPORT.md) 与 [调试布局图](../test-output/expedition-layout.png)。

### 距离与时间

采用正式开局角色、原移动、装备和导航，只在独立行走基准中关闭刷怪/清除敌人；没有传送、加速或修改时长。各段最后一名队员抵达耗时：

| 路段 | 路径长度 | 小队时间 |
|---|---:|---:|
| 出生点→中部修车铺 | 51.04m | 13.17s |
| 中部→北街货站 | 54.97m | 14.03s |
| 北街货站→巴士 | 101.91m | 25.77s |

同期角色移动修改合并后补测，两人的平均抵达时间分别约 12.76、13.72、25.17s；明细 [travel JSON](../test-output/expedition-travel.json)。纯走路合计约 53.0s；搜索、战斗、登车准备 8 秒和关门另计。DAY=150、BLUE HOUR=18、每个 profile 的搜索时间均未修改。远处等到 Blue Hour 才返航会进入 Night；建议用户先验收空间风险，再决定是否调整预警/白昼，而不是本轮擅自平衡。

## HUD 与资源

- 左侧：70×72 头像、名称小底签、HP 细线、原武器图标/弹药与条件状态；删除整个幸存者矩形背景。小窗口头像高度 64，原搜索查看/改派/取消保留。
- 中上：208×76 的半透明椭圆钟面、两侧细弧/刻度、时段和倒计时、进度线；删除 236×104 大矩形盒，收起重复“距蓝时”常驻行。
- 右侧：同一轻背景，默认 3 行相关目标；普通行全透明，Hover/Selected 才强调。删除三块独立 POI 卡；展开能访问全部 18 处。
- 底部：保留原图标/快捷键/状态，普通底色减轻、标题 12→11；归航独立右下，Blue Hour/Night 仍提高优先级。
- 使用现有角色衍生头像、正式技能和武器图标；没有新增 SVG/PNG 或复制 Deadly Days 美术。现有资源/命令线形图标暂保留：素材库没有同职责的统一正式成套替代，这是美术缺口，不声称已补齐。
- HUD 局部抵消 Canvas 缩放以保持像素字号；1366×768、1600×900、1920×1080 检查边界与中央行动矩形。角色名字、进入/搜索/战斗反馈保留，普通 POI 不常驻漂浮。

## 文件与交付

### 实际运行验收

| 检查 | 结果与证据 |
|---|---|
| 地图结构、所有 POI 入口、出生、各道路分支往返导航、车辆/建筑间距、固定 Seed | `tests/world_map.gd`：1921 项，0 失败 |
| 相机、UI 尺寸、模型 Mipmap 与材质 | `tests/expedition_visual.gd`：85 项，0 失败 |
| 完整正式开局、出发、点击移动/搜索、真实战斗、Day→Blue→Night、步行上车、结算→Camp | 134 项，0 失败；[运行记录](../test-output/world-runtime.json)。原生 Godot 窗口与合成鼠标/键盘；时间压缩调用原有模拟，没有传送、无敌或强制完成 |
| 其他原生操作回归 | 行动 71、跨日 74、操作 50、开局 202、菜单 881、效果 80 项均 0 失败；营地与同期武器检查也在最终构建链中保留 |
| 录像 | 18 项，0 失败；600 原生帧已编码为 1600×900、30fps、20 秒 MP4 |
| 渲染观察 | RTX 3060 / Compatibility / 8× MSAA；合并后原生 Night 静态场景 100 帧间隔中位 6.74ms、P95 11.67ms，当时还在并行录制。较早无录制样本为 6.06 / 6.31ms。这是渲染循环间隔，采样期间模拟暂停，**不是战斗压力测试或完整 CPU/GPU profiler 结果** |

截图：[DAY 1600×900](../test-output/expedition-day-1600x900.png)、[1920×1080](../test-output/expedition-day-1920x1080.png)、[1366×768](../test-output/expedition-day-1366x768.png)、[BLUE HOUR](../test-output/expedition-blue-hour-1600x900.png)、[战斗](../test-output/expedition-combat-formal-1600x900.png)、[搜索](../test-output/expedition-poi-search.png)、[地图局部](../test-output/expedition-squad-action.png)、[Tracker 展开](../test-output/expedition-objectives-expanded.png)。三种分辨率检查了操作边界及中央行动区。

最初旧的通用原生测试仍把固定世界坐标当作路面/战斗位置，在新地图出现两项失败；现改为使用正式巴士/入口/小队坐标，重新运行 71 项全部通过。部分既有单元测试退出仍报告 ObjectDB 泄漏 warning，保留日志；本次正式出勤没有 Script Error、Missing Resource、导航报错或崩溃。

新增仅两项现有测试工作流脚本：`tests/expedition_motion.gd`、`tests/expedition_travel.gd` 及 Godot UID。没有新增 Gameplay Scene、地图版本或美术模型。

修改：`missions/expedition_camera.gd`、`blue_hour/atmosphere.gd`、`project.godot`；`ui/mission_hud.gd`、`ui/expedition_theme.gd`、`ui/expedition/{squad_card,poi_entry,action_icon,cut_plate}.gd`；`data/map_data.gd`、`data/maps/east_quay.tres`；`maps/generation/{road_generator,block_generator,map_generator,map_layout}.gd`；`assets/world/materials/chain_link.gdshader`；相关地图/视觉/流程回归；`run.ps1`、`art/verify_export.ps1` 的单一构建及测试副本清理。

文档统一更新 README、PLAN、VALIDATION、本页、WORLD_MAP_REPORT、ASSET_PIPELINE、UI_ASSETS；旧 `EXPEDITION_HUD_V2_REPORT.md` 已删除，链接归并。其他任务记录仅更新已清理游戏副本的指向，不重写其实现历史。源骨架/格式中有语义的版本号不属于任务构建垃圾，不批量改名。

正式游戏构建只输出 [build/BlueHourHomeward.exe](../build/BlueHourHomeward.exe)，`run.ps1` 不再接受另一个任务目录绕过占用。若被用户进程占用，明确失败并等待释放。独立启动检查使用的临时 EXE 在验证后移除；没有新建任务名或 v2/v3 构建目录。既有独立 Rig 审阅工具保留，不当作第二份正式游戏。

**旧构建清理未完成**：检查了 `build/expedition-hud-v2/`、`expedition-visual/`、`rig-integration/`、`weapons-phase1/` 和 `BlueHourHomeward-CampV1.exe`。内容为旧游戏包/构建清单，未发现它们正被运行。递归清理以及改用明确绝对路径的清理均被自动审批拒绝，返回原因只有“blocked by policy”。因此这些旧副本仍在，没有绕过限制删除，也不宣称目录已只剩一个 EXE。

构建末尾的新增武器包检查起初超时：当前 Godot 4.7.2 Release Template 的 `--help` 不含 `--script`。已修正为同版本引擎通过 `--main-pack` 挂载 EXE 内嵌包，测试输出写到绝对可写目录；Headless/原生均通过。12 项独立 EXE 启动与这两项包内模型检查分开记录。导出包清单见 [BUILD-INFO](../build/BUILD-INFO.json)，验证日志见 `test-output/expedition-build.log` 和 `test-output/export-verification.log`。[Godot 命令行支持范围](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)仅作为接口参考。

最终冻结的共享 EXE：2026-09-12 16:30:18 +08:00、451,621,400 字节，SHA-256 `EE57DABC34F82501B2D0907142B66A817E5FD9EF996ED660D929437EC07293D7`。当前地图、相机、HUD、营地、武器和角色移动源码共同验证后导出；实际文件哈希与 BUILD-INFO 已核对一致。最终共享源码的完整流程与 After 已重新采集，未将较早角色行为的录像当作最终证据。

另外直接挂载最终 EXE 内嵌包，核对 Camera 25/20–35、160×120/6 区域、15 建筑/12 车、巴士/Seed、8× MSAA 和最终过滤网片 Shader，六组均通过，日志为 `test-output/expedition-final-pack.log`。文档检查 35 个 Markdown、219 个本地链接、0 未解析；定向编码及差异空白检查通过。

尚存：源屋顶高频细节、树冠/加油棚遮挡、少量材质风格差异；没有加入屋顶透明、室内、Fog of War、更多模型或新玩法。本轮停止扩张，等待用户复看。
