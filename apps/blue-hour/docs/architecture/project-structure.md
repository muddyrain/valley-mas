# 项目目录规范

## 目录职责

- `assets/` 只存运行时或明确的资源流水线产物；`source/`、`runtime/`、`legacy/`、`generated/` 需在资源清单中说明。
- `data/` 是 Resource 数据真源；场景和脚本通过数据引用资源。
- `scenes/` 只存可实例化场景；逻辑按职责分布在 `core/`、`maps/`、`missions/` 等目录。
- `docs/` 根目录保留入口索引；长期规范进入 `architecture/`、`design/`、`art/`、`development/`，历史记录进入 `archive/YYYY-MM/`。
- `tests/` 只存验证脚本；运行输出进入 `test-output/`，不得作为正式资源依赖。

## 边界

正式运行目录不得混入截图、阶段报告、Blender 临时文件、导出物或自动生成缓存。生成流程可以保留，但必须通过文档说明输入、输出和生命周期。

## 禁止行为

- 不在正式资源目录新增 `*_v2`、`*_v3`、`*_final`、`*_new`、`*_copy`、`*_test`、`*_temp`。
- 不人工创建或改写 Godot `.uid`、`.import` 来“修复”引用。
- 不以 grep 未命中作为删除依据；动态加载必须登记。
- 不跨目录做全局字符串替换；引用更新必须基于上下文并在 Godot 导入后验证。

## 一级目录职责（Governance 2B）

| Directory | Responsibility | Runtime | Source | Dev Only |
|---|---|---|---|---|
| `art/` | Blender、参考图、源资产与导入工具 | 否 | 是 | 部分 |
| `assets/` | Godot 运行时资源及明确流水线产物 | 是 | `source/` 子目录 | `generated/` |
| `blue_hour/` | 氛围与共享表现逻辑 | 是 | 否 | 否 |
| `camp/` | 营地 Gameplay 与出发控制 | 是 | 否 | 否 |
| `core/` | 主场景、Campaign、装备与全局状态 | 是 | 否 | 否 |
| `data/` | Resource 数据真源 | 是（被加载） | 否 | 否 |
| `debug/` | 调试菜单与展示场景 | 否 | 否 | 是 |
| `encounter/` | 遭遇、噪声与敌人生成编排 | 是 | 否 | 否 |
| `enemies/` | Enemy AI 与运行时行为 | 是 | 否 | 否 |
| `maps/` | 地图、导航与世界生成 | 是 | 否 | 否 |
| `missions/` | 行动、搜索、输入与结算 | 是 | 否 | 否 |
| `scenes/` | 可实例化 Godot 场景 | 是 | 否 | 否 |
| `survivors/` | Survivor 运行时控制与动画桥接 | 是 | 否 | 否 |
| `tests/` | 自动化与原生验收脚本 | 否 | 否 | 是 |
| `tools/` | 构建、比较与资源处理工具 | 否 | 否 | 是 |
| `ui/` | 菜单、营地与 Expedition UI 脚本 | 是 | 否 | 否 |
| `vfx/` | 特效运行时与生成脚本 | 是 | 否 | 部分 |
| `weapons/` | 武器运行时逻辑 | 是 | 否 | 否 |

当前最适合 **Hybrid**：运行时代码按 Feature（`camp/`、`missions/`、`enemies/`、`survivors/`、`weapons/`、`ui/`）组织；资源按 Type/生命周期（`assets/characters`、`assets/weapons`、`assets/ui`、`source`、`runtime`、`legacy`）组织；`scenes/` 与 `data/` 作为跨 Feature 的唯一场景和数据边界。这样能保持现有引用稳定，同时避免把源资产和运行资产混在一起。

## 唯一归属规则

- 角色 GLB：`assets/characters/<id>/{source,runtime}/`；角色 Scene：`scenes/survivors/`；角色 Script：`survivors/`。
- 敌人 GLB：`assets/characters/<enemy_id>/{source,runtime}/`；Enemy Scene：`scenes/enemies/`；Enemy AI：`enemies/`。
- Camp UI：`ui/camp/` 与 `assets/ui/camp_hud_2_0/`；Camp Gameplay：`camp/`；Camp Scene：`scenes/camp/`。
- Weapon Model：`assets/weapons/models/`；Weapon Data：`data/weapons/`；Weapon Logic：`weapons/`。

## 2B 重复集结论

19 组重复/版本集合已写入 `docs/development/asset-audit.json` 的 `duplicate_set_analysis`。当前没有执行删除或合并；`20k/30k`、动画 `v2/v2_2` 和 Loading V2 均保留其现有用途。

## Proposed Target Tree

```text
art/                         source art, Blender, references, import tools
assets/                      runtime assets only
├─ characters/<id>/{source,runtime,legacy}
├─ animations/humanoid/{combat,locomotion}
├─ ui/{common,main_menu,loading,camp,expedition,...}
├─ weapons/{icons,models}
├─ items/  skills/  world/
├─ generated/                 generated intermediates; no implicit runtime dependency
core/ camp/ encounter/ enemies/ maps/ missions/ survivors/ ui/ weapons/  runtime code by feature
scenes/                      instantiable scenes, grouped by feature
data/                        Resource definitions and catalogs
tests/ tools/ debug/          development-only code
```

## Migration Plan

- **2C-A Docs and metadata**：继续维护唯一 Canonical 文档与重复集清单；不移动运行资源。
- **2C-B UI duplicate sets**：逐个确认 `loading_v2`、Expedition UI 目录的场景/脚本引用，建立正式目录映射；每批后 import、smoke 和对应页面验证。
- **2C-C Animation variants**：确认 v1/v2/v2_2 的运行时权重与测试用途；仅在引用更新方案可审阅时改名。
- **2C-D Character/World source boundaries**：只整理 `source`、`runtime`、`legacy` 的明确边界，不改变模型内容或场景路径。
- **2C-E Cleanup candidates**：对 `OLD_REPLACED` 逐项完成无引用、无动态依赖和启动验证后，再单独决定删除。

本阶段不执行上述迁移。
