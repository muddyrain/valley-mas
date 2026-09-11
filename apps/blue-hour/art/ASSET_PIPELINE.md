# BLUE HOUR ART PIPELINE V1

视觉约束：[ART_BIBLE](ART_BIBLE.md)。模型复用入口：[MODEL_CATALOG](MODEL_CATALOG.md)。本地工具只依赖已安装的 Blender 和 Godot，无新增第三方包或外部模型。

首页 2D 用户素材走原图保留、Godot 区域切片和原生运行验收，登记见 [UI_ASSETS](UI_ASSETS.md)，不进入 Blender 模型生成器。

## 本机工具与入口

实际主程序：`D:\Blender\blender.exe`，检测版本 **5.2.1 LTS**，构建 `9e2066aef7ef`。`D:\Blender\blender-launcher.exe` 是同目录启动器；安装含 `5.2/` 资源和 Python，随附启动脚本直接调用相邻主程序，没有需要解析的独立版本管理配置。`probe.py` 已用后台模式创建 1 米立方体并检查 GLB 导出器。没有下载 Blender 或修改安装/用户偏好。

```powershell
& 'D:\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/blue-hour/art/blender/probe.py
# 每批生成后立即验证 GLB、Godot 导入与实例化；失败终止。
./apps/blue-hour/art/build_assets.ps1 -Batch architecture
./apps/blue-hour/art/build_assets.ps1 -Batch props
./apps/blue-hour/art/build_assets.ps1 -Batch vehicles
./apps/blue-hour/art/build_assets.ps1 -Batch weapons
./apps/blue-hour/art/build_assets.ps1 -Batch infected
# 按以上顺序完整重建
./apps/blue-hour/art/build_assets.ps1 -Batch all
python apps/blue-hour/art/blender/validate_assets.py
```

脚本支持 `-BlenderPath`、`-GodotPath`，默认 Blender 为本机路径，Godot 按现有 `run.ps1` 的安装约定发现。直接 Blender CLI 使用 `--python art/blender/generate.py -- --batch architecture`，从任何工作目录均可执行，所有路径由脚本自身位置解析。

## 源文件与生成结果

- `art/blender/utils/`：材质、命名、米制几何、统一倒角、碰撞和导出工具。
- `art/blender/generators/`：道路/建筑、城市道具、车辆、枪械、基础感染者分批生成器。
- `art/blender/asset_specs.py`：预期资产清单、类别、中文用途与预算；单模型定义仍在对应生成器。
- `art/blender/sources/BH_*.blend`：应用变换后的可编辑源文件，包含分组网格和碰撞代理；与 Python 源码共同管理。
- `assets/generated/*_model.glb`：正式运行时模型，采用小写领域与对象语义命名；路径由 `asset_specs.py` 登记并写入 manifest，纳入版本控制。模型内部 `BH_*` ID 与节点名仍保持稳定。
- `assets/generated/manifest.json`：实际面数、材质、包围盒、碰撞、来源、哈希及使用位置的机器可读登记。
- `art/.gdignore` 阻止 Godot 导入 Blender 源目录；`.godot/`、日志、截图、导出 EXE 和 `.blend1` 等备份不提交。

生成器只覆盖登记 `path` 的产物，不清空目录，也不再从内部 ID 推导 GLB 文件名。固定参数、无随机颜色；重建用同版本 Blender 时检查 GLB SHA256 一致。`.blend` 的二进制元数据不作为跨机器确定性保证。图片、角色贴图与命名边界见 [资源目录说明](RESOURCE_LAYOUT.md)。

## 导出契约

1 米单位；Blender `(x,y,z)` 转为 Godot `(x,z,-y)`。环境面向 Godot +Z，枪口朝 -Z。底部中心原点，枪械握把原点。所有网格顶点烘焙到资产坐标，Object Transform 归一；总根节点为 `BH_AssetID`。

GLB 2.0，`export_yup=True`，只导出选中当前资产；应用 Modifier，显式三角化、导出法线与材质，不带相机、灯、动画、贴图、压缩扩展或用户场景。静态零件按资产合并成少量 Mesh / Material Surface；巴士 `BH_EvacBus_01_Door` 和灯面 `BH_*_LightMesh` 保留独立节点用于表现动画。导出参数以 `utils/export.py` 为执行真源。

## Godot 导入、材质、LOD 与碰撞

项目使用 Godot 4.7.2 Compatibility。通过 `--headless --editor --import --quit` 导入 GLB，并执行 `tests/art_assets.gd` 实际载入每个场景；任何脚本错误、导入错误或缺失资产都使批次失败。

保留 Godot 场景导入的 `meshes/generate_lods=true` 自动 LOD；小道具若无法再简化可无有效 LOD。V1 不承诺手工 LOD 链或手机性能达标。共享材质名由 `vfx/generated_assets.gd` 统一缓存复用，不按资产随机覆盖。灯面与普通材质分开；Compatibility 模式通过统一的无光照灯面材质在 Day 深蓝玻璃色与夜间暖光色间过渡，不依赖 HDR 泛光或逐实例透明度。共享灯面材质只由时段统一控制。地图最多启用 4 处无阴影路灯加 1 处巴士暖光，不为每个道具新增实时灯。

每个环境资产同时导出最多几个 Box 形网格代理，名称 `BH_*_COL_00-convcolonly`；Godot 导入后只有简单凸碰撞，没有渲染网格，也不用复杂渲染面作 Trimesh。建筑代理分墙体、门楣和屋顶，入口保持空洞。枪械与感染者由宿主玩法节点负责碰撞，不额外导出刚体。

现有城市使用地图数据构建物理与 AStar 阻挡，集成时移除模型内代理，保留原 `site_id`、入口拾取 Area 和搜索字典。路面沿用单独 Ground Collider。装饰无独立阻挡，放在原有实体占地内。撤离巴士按真实长度调整它自己的一处 Box 占地，登车点、半径、时间和状态机不变；用路径与完整归航回归确认没有阻塞。独立展示或未来装配可选择启用 GLB 内的代理；不能同时开启两套碰撞。

Godot 后缀行为参见[官方碰撞导入说明](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/node_type_customization.html)。Blender 参数以本机 5.2 导出器与后台实跑为准。

## 新增模型的最短路径

先查目录并复用。确需新模型时，在 `asset_specs.py` 登记、对应类别生成器添加构建函数，调用共享几何/倒角/材质，给环境模型添加简化代理。执行对应批次，检查自动更新的 Catalog，再加入展示或地图视觉装配。不得为新道具复制整套流水线，不把搜索 ID 或玩法规则写入 Blender。

## 交付检查

所有批次成功后，启动 `run.ps1 -Mode art` 或 `scenes/debug/art_showcase.tscn` 检查比例、轮廓及两种灯光；运行 `run.ps1 -Mode capture` 验证实际游戏的原生渲染和合成输入，再 `run.ps1 -Mode build` 生成并独立启动 Windows EXE。构建自动执行 `art/verify_export.ps1`，将 EXE 单独复制到验证目录，通过内嵌的展示场景在 Headless / 原生窗口分别实例化全部 52 个模型，确认动态加载的 GLB 和 manifest 已进入导出包。发布模板不支持命令行场景路径覆盖，因此通过主入口的用户参数 `BlueHourHomeward.exe -- --art-showcase` 打开展厅；此入口在读取或创建玩家存档前跳转。自动化证据与人工未验范围记录在 [VALIDATION](../docs/VALIDATION.md)。
