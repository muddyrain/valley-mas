# Unity Climber 资产规范（P4）

## 目标

本阶段只做“资产规范 + 目录就位 + 首批替换计划”，保证后续模型与音频接入不返工。

## 目录约定

- `Assets/Models/Characters`：角色模型源文件（FBX/GLB）
- `Assets/Models/Setpieces`：关卡静态件（台阶、坡道、平台、终点装置）
- `Assets/Materials`：通用材质（角色、木质、金属、岩石、指示物）
- `Assets/Prefabs/Characters`：角色预制体
- `Assets/Prefabs/Setpieces`：关卡组件预制体
- `Assets/Audio/BGM`：背景音乐
- `Assets/Audio/SFX`：音效（跳跃、落地、登顶、UI）

## 命名规则

- 角色模型：`char_<name>_v001`，例如 `char_peach_v001`
- 关卡模型：`sp_<type>_<variant>_v001`，例如 `sp_step_wide_v001`
- 预制体：与模型同名，后缀 `_pf`
- 材质：`mat_<theme>_<type>`
- 音频：`bgm_<theme>_<bpm>`、`sfx_<action>_<variant>`

## 尺寸与碰撞基线

- 单位：`1 Unity unit = 1m`
- 角色胶囊参考：`height=2`, `radius=0.5`
- 主路线台阶默认净空：宽 >= `2.2m`，厚 >= `0.4m`
- 关键跳点水平间距建议：`2.0m ~ 3.0m`
- 关键跳点高度差建议：`0.2m ~ 0.8m`
- 所有可站立模型必须有真实碰撞体，不允许仅视觉无碰撞

## 首批替换目标（小步迭代）

1. 替换 `Step_01~Step_03` 为统一 setpiece 预制体
2. 替换 `FinishBuffer` 为终点引导台（更高辨识度）
3. 保留 `Step_04~Step_10` 白盒，待第一批资源通过后再批量替换\n4. 默认行为：打开 SampleScene 时自动把 Peach 绑定到 Player（仅当场景里还没有角色可视对象）\n5. 你也可以手动切换：`Tools > Unity Climber > Apply Player Model > Peach/Daisy`

## 首批替换执行方式（Unity Editor）

当首批模型放入 `Assets/Models/Setpieces` 后：

1. 打开 `Assets/Scenes/SampleScene.scene`
2. 执行菜单：`Tools > Unity Climber > Apply P4 First Asset Swap`
3. 工具会替换：
   - `Step_01 -> stepping_stone.glb`
   - `Step_02 -> rock_slab.glb`
   - `Step_03 -> plank_long.glb`
   - `FinishBuffer -> container_short.glb`
4. 工具会自动保存场景

## 需要你下载的最小资源清单

模型（优先）：
1. 角色模型 1~2 个（T-Pose + 基础动作更好）
2. 台阶/平台模块 3~5 个（宽窄、高低各一版）
3. 终点装置 1 个（旗帜、光柱、奖杯台任选）

音频（可后置）：
1. BGM 1 条（循环，时长 60s+）
2. SFX 4 条（jump / land / checkpoint / finish）

建议格式：
- 模型：`FBX` 或 `GLB`
- 音频：`WAV`（SFX）和 `OGG/WAV`（BGM）

## 交付检查

- 导入后无 Missing 材质与 Missing 脚本
- Scene 中对象仍是“直接可见对象”，不通过 Play 时脚本生成
- `Player`、`Main Camera`、`FinishTrigger` 脚本绑定保持有效
