# Unity Climber 任务清单（线程内持续维护）

> 说明：本清单用于 `apps/unity-climber` 的持续迭代，保持“少量活跃任务 + 每轮可提交”。
> 产品目标：对齐《攀爬动物：在一起》的核心玩法体验（向上攀爬、可达路线、登顶反馈）。

## 版本路线

- P0 项目起步：仓库清理、基础场景、最小可玩闭环。
- P1 白盒关卡：主路线可达、关键跳点稳定、基础失败恢复。
- P2 角色手感：移动/跳跃/落地反馈与相机配合。
- P3 UI 与反馈：高度进度、登顶结算、重开与暂停。
- P4 美术替换：从基础几何体过渡到正式模型与材质。
- P5 内容扩展：主题区块、挑战段、轻量社交或排行榜。

## 活跃 Backlog（保持 3-5 项）

- [x] P1-01：补齐 `Step_04~Step_10` 与终点前缓冲平台，形成连续可达主路线。
- [x] P1-02：增加一次坠落恢复点（Checkpoint_01），避免失败后总是回到起点。
- [x] P2-01：补最小调参面板（移动速度、跳跃力、相机偏移）并固化默认参数。
- [x] P3-01：补最小 HUD（高度、进度、重开提示）。
- [x] P4-01：完成资产规范文档与目录骨架（Models/Materials/Prefabs/Audio）。
- [ ] P4-02：执行首批模型替换（`Tools > Unity Climber > Apply P4 First Asset Swap`）。
- [ ] P4-03：补首批 SFX（jump/land/checkpoint/finish）并接入。

## 过渡状态看板

- Three.js 旧链路（`packages/climber-game`）：`冻结维护 / 过渡中 / 已下线`
- Unity 主线（`apps/unity-climber`）：`可演示`
- Scene 建模规则：`必须直接写入 scene，禁止 Play 时脚本生成`
- 产品对齐状态：`对齐《攀爬动物：在一起》核心攀爬循环`
- 当前策略：`先推进 Unity 主线，暂不处理 threejs/web 迁移决策`

## 每轮提交前检查

- [ ] `git status --short`
- [ ] `git status --short apps/unity-climber`
- [ ] 若涉及 Web：`pnpm --filter web exec tsc --noEmit`
- [ ] 若改中文：`python .codex/skills/encoding-guard/scripts/check_mojibake.py`
- [ ] Unity Inspector 抽查脚本绑定：`Player/Camera/FinishTrigger` 不得出现 `None (Mono Script)`
- [ ] 若要“模型直接落 Scene”：先验证 `LoadAssetAtPath<GameObject>() != null`，失败则必须阻断并改走导入修复/格式切换

## 迭代记录（追加）

### 2026-04-14

- 初始化 `unity-climber-iteration` skill。
- 新增本任务清单模板，作为后续活跃 backlog 的唯一维护入口。
- 当前决策：Three.js 旧链路先冻结，不立即删除。
- 新增 Unity 可玩起步闭环：空场景下自动生成地面、阶梯、玩家、相机、终点触发。
- 已新增 `apps/unity-climber/.gitignore` 与 `apps/unity-climber/README.md`，明确提交边界和目录约定。
- 修复地面检测逻辑，解决“无法跳跃”问题；并将相机偏移改为世界空间，降低侧向移动时视角扭动感。
- 新增菜单 `Tools > Unity Climber > Setup Sample Scene`，支持在编辑器内一键生成并保存可玩原型场景。

### 2026-04-15

- 强化约束：Scene 模型和 3D 对象必须直接写入场景文件，不走 Play 时脚本生成。
- 任务清单升级为版本路线（P0-P5），并切换到 P1/P2/P3 可执行活跃项。
- 明确产品目标：Unity 主线对齐《攀爬动物：在一起》的核心体验，不偏离为泛 3D 演示。
- P4-01 已落地：新增资产规范与目录骨架，准备进入首批模型/音频替换。
