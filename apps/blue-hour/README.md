# 蓝时归航 / BLUE HOUR: HOMEWARD

原生 Godot / GDScript 小队生存游戏。玩家在营地整备、选择今日行动、外出搜索与战斗，再归航结算并推进游戏日；五日循环是现有试玩基线，完整长期系统另行规划。

- 开发任务从 [AGENTS](AGENTS.md) 进入，文档职责见 [docs/README](docs/README.md)。
- 产品术语见 [CONTEXT](CONTEXT.md)，玩法见 [游戏设计](docs/design/game-design.md)。
- 剩余工作与证据状态见 [当前计划](docs/PLAN.md)，验证方式见 [验证入口](docs/VALIDATION.md)。

## 打开与验证

工程为 `project.godot`，使用 Compatibility 渲染。运行 `run.ps1` 的 run/editor/test/capture/build 模式；完整命令、引擎定位与平台分工见 [根项目指南](../../docs/PROJECT_GUIDE.md)。Windows 可运行构建为 `build/BlueHourHomeward.exe`，存在文件不代表当前源码已经重新构建通过。

## Development Environment

所有环境相关操作及命令示例都标注 `[Windows]` 或 `[macOS]`，并使用对应系统的路径格式。不得把 Windows 路径直接复制到 macOS，也不得把 macOS 路径直接复制到 Windows；构建与验证按各自平台的流程执行。

- `[Windows]` Windows 试玩/发布构建及独立程序、目标平台性能、Blender/Meshy 资源处理；使用 `run.ps1` 和匹配的 x64 导出模板。
- `[macOS]` 代码、文档、UI 与逻辑迭代，可用本机 Godot 做受影响专项。日常迭代按当前环境完成验证；交付 Windows 包、发布或更改平台集成时再执行 Windows 构建及独立程序验收。


## 操作

| 输入 | 行为 |
|---|---|
| 左键点击 / 按住 | 小队移动；世界搜索点可下达搜索命令 |
| Ctrl | 停步并朝鼠标指向射击 |
| Space | 战术暂停，暂停中可下令 |
| WASD / 右键或中键拖动 / 滚轮 | 镜头移动、拖动和缩放 |
| X / F / R / E | 停止、集火、集合、归航 |
| Esc / F1 | 菜单 / 开发调试 |

搜索、输入释放和撤离边界见 [搜索与输入](docs/architecture/search-and-input.md)，成员与 UI 选择不能代替实际任务归属。

## 保存与资源

玩家存档为 `user://homeward/run.json`，自动化使用 `user://test-runs/`。保存失败保留有效状态，跨版本迁移保留备份；行动退出与待结算恢复见 [跨日契约](docs/design/day-loop.md)。

内容定义位于 `data/`，Campaign 持有跨日状态，Mission 持有行动状态。角色绑定、公共动画和资源路径见 [资源身份](docs/architecture/resource-binding.md)，美术新增先读 [资产流水线](art/ASSET_PIPELINE.md)。

旧版本功能说明、数值和构建结果保留在 [历史 README](docs/archive/2026-10/readme-before-governance.md)，不再向本页追加逐轮交付记录。
