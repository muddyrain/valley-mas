# 资源命名规范

统一使用小写 snake_case；稳定内容使用 Asset ID，UI 与特效使用语义名。版本由 Git 管理。

| 类别 | 规则 | 示例 |
|---|---|---|
| 生还者 | `CHR_<id>_<name>` | `CHR_001_xia_zhiyao.glb` |
| 敌人 | `ENM_<id>_<name>[_<variant>]` | `ENM_001_infected_basic_a.glb` |
| 武器 | `WPN_<id>_<name>` | `WPN_002_p9_pistol.glb` |
| 物品 | `ITEM_<id>_<name>` | `ITEM_001_tool_belt.png` |
| 技能 | `SKILL_<id>_<name>` | `SKILL_001_focus_fire.png` |
| 建筑/营地 | `CAMP_PROP_<id>_<name>` 或 `BLD_<id>_<name>` | `CAMP_PROP_001_workbench.glb` |
| UI | `ui_<screen>_<role>_<state>` | `ui_loading_progress_fill.png` |
| 特效 | `fx_<context>_<role>` | `fx_selection_ring.png` |
| 环境 | `env_<context>_<role>` | `env_city_road_block.glb` |
| 音频 | `bgm_<scene>_<state>` / `sfx_<context>_<event>` | `sfx_weapon_reload.ogg` |

`01/02` 只有在内容编号明确时保留；不要用 `v2`、`final`、`new` 表达版本。已有稳定 Asset ID 不因风格统一而强制重命名，迁移必须先验证引用。
