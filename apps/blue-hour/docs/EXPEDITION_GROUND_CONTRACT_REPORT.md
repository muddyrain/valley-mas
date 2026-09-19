# Expedition Ground Height Contract

2026-09-19。本轮只修正式 Expedition 的地表高度合同，覆盖此前 Production Gate 的整体悬空阻塞。

| 验收项 | 结论 |
| --- | --- |
| Expedition Ground Height Contract | PASS |
| Xia Production Replacement | PASS：本轮地面门禁及之前角色接入专项 |
| Su Production Replacement | PASS：本轮地面门禁及之前角色接入专项 |

以上不是全仓测试全绿声明。三人长途返回路线的既有让行停滞仍存在；修改前导航对照在相同 XZ 位置复现，本轮未扩展修复。旧资源删除审批受阻项仍按[前轮报告](SURVIVOR_PRODUCTION_INTEGRATION_REPORT.md)记录，本轮没有执行清理。

## 根因审计

1. `FLOOR_Y = 0.08` 在 Git `f0a0c31d` 的 E01 导航接入中引入，是写死的路径高度，数值与人行道高度相同；没有从渲染或碰撞采样的依据。
2. 正式 Expedition 使用 **AStarGrid2D**，`navmesh_count=0`，不存在可读取实际 Y 的 NavigationMesh。既有输入碰撞平面也不是可行走表面，不能拿它作为地面。
3. 渲染地面高度原本不同：RoadNetwork 0.025m、SidewalkNetwork 0.08m、开放地表 -0.07m、街块空间 -0.025m、底层 Ground -0.12m；入口铺面 0.015m、Foundation -0.005m、公园步道 0.01/0.015m。上述值仍只由原地图作者代码持有，没有在导航里复制分类高度表。
4. 旧 `nearest()`、路径起点/终点/格点以及 Survivor spawn 都强制写 0.08。
5. Survivor 移动把 offset.y 清零，只推进 X/Z，从不更新 Actor Y。Search entry 又来自该平面导航；退出建筑时直接恢复到同一个错误 entry 高度。原 Ground VFX 以 actor/点击点 Y 加局部偏置，继承了高度错误。

## 统一合同实现

新增 `maps/expedition/walkable_ground.gd`。正式地表构造函数为实际渲染 Mesh 标记 `walkable_ground`；查询读取这些 Mesh 的世界空间三角形，建立 4m 空间桶，向下投影求最高有效地表。支持重叠表面、斜面、世界变换；查询范围外返回无效值，不伪造固定高度。

只有登记的地表参与索引。角色、屋顶、车顶、碰撞输入平面、ReturnZone 透明环和其他 VFX 不参与。不会因为点击建筑就把 Actor 放到屋顶。道路/开放区高度仍以**同一份渲染几何**为真源，没有道路 0.025 / 开放区 -0.07 的导航分支补丁。

`get_walkable_ground_height(world_xz)` 和 `project_to_ground(point)` 供以下路径共用：

- Spawn、地图入口/POI、导航目标和 nearest/path 格点投影到真实地表。
- 保留二维 AStar 寻路与障碍轮廓；路径点携带真实 Y。
- 路径简化仍可跨过多个高度边界。Actor 在实际 X/Z 上逐帧查询地表，而不是在两个远距离路径端点之间插出一条虚假的斜坡；更新的是 **Actor World Y**。
- 跟随/让行的方向和横向间距明确使用 XZ，避免地表高度差改变原二维交通规则；移动速度、加减速、转向速度和角色状态机不变。
- Search registry 原本就通过 nearest 求可达 entry，因此进入/退出和到达直接继承正确高度，无角色专属修正。

没有新增 Model、VisualRoot 或 Skeleton Y Offset。所有录制帧中 VisualRoot local Y=0。公共动作 Keyframe、GLB、Rig、Skin、武器与 Combat 动画及 Survivor 速度数据共 **42 项保护文件哈希未变**。

## Ground VFX

Selection Ring、角色 duty ring、Click Indicator、Search Feedback、Focus Feedback 和 ReturnZone 使用同一查询。地面标记保持统一 **12mm 绘制间距**，用于避免地面深度冲突，不参与 Actor 或鞋底高度。

短时命令线按 0.25m 分段投影，避免跨道路/人行道时整条线沿旧固定高度漂浮。Search/POI 的头顶图标继续保留设计上的 +1m/+2m 偏置，其基点使用投影后的 entry；不是地面环。原隐藏兼容 move marker 继续隐藏。

这套合同解决整体地面高度；没有 Foot IK，也不承诺平地动画的两只脚跨在不同台阶上时分别适配台阶。跨地表边界使用真实高度，没有额外平滑偏移把角色悬在两层之间。

## 测量结果

固定 Town Seed **4101**。同一正式 Expedition、正式角色/公共动画、2.8m/s；原生 Godot 60Hz 模拟，30fps 采集。三类表面是独立测试案例，测试准备阶段投影到合法可达起点；每段 Run、转向、连续命令和搜索使用真实 Navigation / Command，没有在动作中瞬移修复。

以下是**独立 NumPy 三角形投影**结果，不调用运行时 Ground Query。采集 Skin 最低 3mm 鞋底 Rest 顶点组的最终世界姿态；Run 只统计速度 >2.79m/s 的稳定支撑窗口，排除正常 Flight/Swing。

| 角色 / 场景 | Actor Y m | Render Ground Y m | Shoe sole Y m | Shoe-to-ground mm |
| --- | ---: | ---: | ---: | ---: |
| Xia Road Idle | 0.025 | 0.025 | 0.02663–0.02855 | 1.63–3.55 |
| Xia Road Run support | 0.025 | 0.025 | 0.02688–0.03123 | 1.88–6.23 |
| Xia Open Idle | -0.070 | -0.070 | -0.06837–-0.06645 | 1.63–3.55 |
| Xia Open Run support | -0.070 | -0.070 | -0.06813–-0.06378 | 1.87–6.22 |
| Xia Sidewalk Idle | 0.080 | 0.080 | 0.08163–0.08355 | 1.63–3.55 |
| Xia Building/POI arrival Idle | 0.080 | 0.080 | 0.08266–0.08407 | 2.66–4.07 |
| Su Road Idle | 0.025 | 0.025 | 0.02652–0.02782 | 1.52–2.82 |
| Su Road Run support | 0.025 | 0.025 | 0.02677–0.03025 | 1.77–5.25 |
| Su Open Idle | -0.070 | -0.070 | -0.06847–-0.06718 | 1.53–2.82 |
| Su Open Run support | -0.070 | -0.070 | -0.06825–-0.06477 | 1.75–5.23 |
| Su Sidewalk Idle | 0.080 | 0.080 | 0.08153–0.08282 | 1.53–2.82 |
| Su Building/POI arrival Idle | 0.080 | 0.080 | 0.08212–0.08324 | 2.12–3.24 |

Spawn Idle：Xia 2.38–4.11mm，Su 2.03–3.27mm。两角色所有记录帧的 Actor-ground 误差为 0（当前平面网格及浮点精度），Selection Ring 相对 12mm 间距误差 <0.001mm。静态门槛为 -5～10mm，所有案例通过。

原道路约 57–61mm、开放区约 152–157mm 的整体悬空已消除。动作时间、步幅、Loop 和 playback 公式未变。急转、启停保持原表现，不把平地动作的转向横移宣称为本轮已消除。

## 视频与截图

[交互验收页](../test-output/ground-contract/index.html)提供双角色全部视频、测量和逐帧数据。每个完整视频 1163 帧 / 38.767s / 30fps，1280×720。

| 角色 | Road Idle close-up | Road Run | Open Ground Idle | Open Ground Run | Building / POI arrival |
| --- | --- | --- | --- | --- | --- |
| Xia | [角色](../test-output/ground-contract/xia_zhiyao/road-idle.mp4) / [鞋底](../test-output/ground-contract/xia_zhiyao/road-idle-feet.mp4) | [视频](../test-output/ground-contract/xia_zhiyao/road-run.mp4) | [视频](../test-output/ground-contract/xia_zhiyao/open-idle.mp4) | [视频](../test-output/ground-contract/xia_zhiyao/open-run.mp4) | [视频](../test-output/ground-contract/xia_zhiyao/poi-arrival.mp4) |
| Su | [角色](../test-output/ground-contract/su_wanxing/road-idle.mp4) / [鞋底](../test-output/ground-contract/su_wanxing/road-idle-feet.mp4) | [视频](../test-output/ground-contract/su_wanxing/road-run.mp4) | [视频](../test-output/ground-contract/su_wanxing/open-idle.mp4) | [视频](../test-output/ground-contract/su_wanxing/open-run.mp4) | [视频](../test-output/ground-contract/su_wanxing/poi-arrival.mp4) |

另有 [Xia 转向/停止](../test-output/ground-contract/xia_zhiyao/turn-stop.mp4)、[Su 转向/停止](../test-output/ground-contract/su_wanxing/turn-stop.mp4)，完整片含 Sidewalk。鞋底近景是原生帧裁切放大，未改变模型/地面或补帧。原生截图在各角色目录的 `road-idle.png`、`open-idle.png`、`sidewalk-idle.png`、`poi-arrival.png`。

## 回归与边界

- Ground Query 独立单测：10 项通过，覆盖任意高度、重叠、斜面、世界变换、无地表点、路径和 nearest。
- Xia / Su 原生地面专项：各 83 项通过，含 Spawn、三表面 Idle/Run/Stop、转向、连续命令、搜索/取消、可达 entry、Selection/Click VFX 和无 VisualRoot 补偿。
- Search：四种子 1206 项通过；本轮不改搜索行为。
- 原角色流程探测：27 项通过，包括原有武器挂载与自动攻击。未修改武器或战斗代码/资源。
- E01 全导航回归：240 项中 9 项失败，集中于三人长途返回/后续路线停滞，不能写成全绿。

针对导航失败，保留当前 2.8m/s 和相同队伍，在隔离诊断中载入 **Git HEAD 原始导航源码**，恢复该诊断里的平面 0.08 合同。修改前/后均在相同位置停滞：Xia XZ=(15.71495, -89.04303)，Su XZ=(15.86503, -88.0)，剩余路线分别 213.149922 / 211.490548m；Lin 已抵达。证明该失败不是地表高度投影引入。两份对照日志为 `nav-baseline-control.log` 和 `nav-ground-control.log`。保留原队伍避让规则，不在本轮重写 Gameplay 来使该测试变绿。

初次并行诊断共享同一个测试存档造成一条夹具启动失败，已将导航夹具存档名加进程 ID 隔离，随后对照完成。早期失败日志保留，最终结果以上述明确的完成标记为准。

正式 Windows EXE 已实际重新导出；最终 EXE 独立原生启动 exit 0、stderr 为空，嵌入包内两角色 240 ticks 移动检查 exit 0。Survivor Command 43 项通过。资源扫描 504 项，Missing Resource=0、Invalid UID=0、旧正式引用=0。16 份 MP4 均通过 ffprobe 检查。最终证据位于 `test-output/ground-contract/` 下的 `build-info.json`、`pack-final.log`、`commands-final.log`、`resources.json` 与 `video-validation.json`。总 build 入口先前还有旧 Camp HUD 断言阻塞，本轮没有将直接 export 等同于全套 build 测试通过。

## 修改文件与复现

生产改动：

- 新增 `maps/expedition/walkable_ground.gd`。
- `maps/town/town_urban_view.gd`：仅登记地表 Mesh，不修改形状、高度或材质。
- `maps/expedition/town_navigation.gd`：高度投影、去除 FLOOR_Y、障碍物垂直范围按地面判定。
- `maps/expedition/town_runtime_adapter.gd`：Spawn/入口/POI/标记共用投影；保留并行任务的 staged loading 改动。
- `survivors/survivor.gd`：Actor World Y 跟随地表，保持 VisualRoot Y=0；地面环使用绘制间距。
- `missions/world_interaction_vfx.gd`：标记与分段命令线投影。
- `missions/mission.gd`：只将原队伍间距/方向计算显式限制在 XZ，保留并行任务的其他变更。

验证：`tests/walkable_ground.gd`、`tests/expedition_ground_capture.gd`、`tests/expedition_ground_pack.gd`、导航诊断及原导航夹具；`art/analyze_expedition_ground.py`；`run.ps1` test/build 入口加入 Ground Query 单测。文档同步 `docs/PLAN.md` 与当前资产入口状态。

复现命令（工作目录 `apps/blue-hour`，使用 Godot 4.7.2）：

```text
godot --headless --path . --script tests/walkable_ground.gd
godot --path . --script tests/expedition_ground_capture.gd --resolution 1280x720 -- --character=xia_zhiyao --capture
godot --path . --script tests/expedition_ground_capture.gd --resolution 1280x720 -- --character=su_wanxing --capture
python art/analyze_expedition_ground.py
```

没有修改公共动画、Skin、23 骨 Rig、GLB、2.8m/s、武器系统或 Combat Animation。完成本轮地面合同验收后停止。
