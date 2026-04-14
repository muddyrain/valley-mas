# Valley MAS 变更日志

> 说明：记录每次真实落地改动，按时间顺序追加，不覆盖历史。

## 2026-04-14 12:52 (Asia/Shanghai)

- 任务：新增“每次改动必须记日志”的 skill，并将规则接入仓库协作约定。
- 改动文件：
  - `.codex/skills/change-log-guard/SKILL.md`
  - `.codex/skills/change-log-guard/agents/openai.yaml`
  - `AGENTS.md`
  - `.codex/skills/INDEX.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新建 `change-log-guard` skill，明确日志文件路径、触发条件、模板与协作规则。
  - 将 `change-log-guard` 加入项目默认优先 skills 与场景强制技能说明。
  - 在 skills 索引中新增 `change-log-guard` 的触发指南与使用边界。
  - 建立统一日志文件并写入首条记录，后续按同模板持续追加。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
  - `pnpm --filter web exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：若未来回合未显式触发该 skill，可能出现漏记日志。
  - 下一步动作：后续每轮有文件改动时，必须在本文件追加一条记录。

## 2026-04-14 12:55 (Asia/Shanghai)

- 任务：把新增集装箱改为更明显的横置大台面，并提升该段跳跃容错。
- 改动文件：
  - `packages/climber-game/src/levels/togetherSkyAscent.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将 `sp201` 调整为明显横置（`rotation: [0, Math.PI * 0.5, 0]`）并放大台面尺寸。
  - 新增第二个横置集装箱 `sp204`，形成更连续的可落脚平台。
  - 微调 `sp202` 与 `sp203` 位置与尺寸，避免与新台面重叠并维持可跳路线。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：未做本地实机手感验证，仍需确认这段跳跃节奏是否过于简单。
  - 下一步动作：你进游戏实测后，我再按体感把两块集装箱的间距与高度做一轮微调。

## 2026-04-14 13:00 (Asia/Shanghai)

- 任务：将“模型展览”改为只展示当前地图实际使用的模型实例，并把该约束写入 skill。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/skills/climber-game-design-guard/SKILL.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 模型展览的数据源从“全量资产目录”改为 `activeLevel.setPieces`，每个实例单独展示。
  - 展览卡片改为实例维度命名（`模型名 · 实例ID`），并展示该实例的位置元信息。
  - 顶部统计中的“场景模型”改为当前地图实例数，新增实例后展览会自动出现。
  - 在 `climber-game-design-guard` 中新增“模型展览需按当前地图实例展示”的规则。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：未完成本地运行校验，需确认实例数量较多时展览滚动性能是否可接受。
  - 下一步动作：你实测后如果觉得列表太长，我再加“按资产类型折叠/筛选”。

## 2026-04-14 13:07 (Asia/Shanghai)

- 任务：修复“模型展览看不到集装箱/新增模型不明显”，并支持同模型多次出现的可视化统计。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `packages/climber-game/src/removedSetPieceAssets.ts`
  - `.codex/skills/climber-game-design-guard/SKILL.md`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 模型展览从“仅当前实例列表”升级为“全模型目录 + 当前地图实例”双来源，目录项展示“当前地图出现次数”。
  - 展览顶部新增关键统计：模型目录总数、已使用模型种类、集装箱出现次数，并增加“一键定位集装箱”按钮。
  - 放开 `stepping_stone` 与 `barrel_tower` 的移除过滤，保证新加短阶/木桶模型可进入关卡与展览。
  - 更新 `climber-game-design-guard`：模型展览规则改为必须显示“新增模型/新增实例及出现次数”。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：目录项与实例项合并后列表更长，后续可能需要增加搜索/分组折叠。
  - 下一步动作：你实机确认后，我可以继续补“按资产ID筛选 + 只看当前地图已使用模型”开关。

## 2026-04-14 13:10 (Asia/Shanghai)

- 任务：按用户反馈移除“集装箱专属”展示，保持模型展览为通用能力。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 删除“集装箱出现次数”专属统计，不再给单一模型做特化展示。
  - 删除“定位集装箱”按钮，避免展览 UI 偏向单模型。
  - 保留“全模型目录 + 当前地图实例 + 模型出现次数”的通用展示逻辑。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：无新增功能风险，属于展示层收敛。
  - 下一步动作：如需进一步提效，可做“按模型名搜索”而不是某单模型快捷按钮。

## 2026-04-14 13:22 (Asia/Shanghai)

- 任务：排查“sp 步骤缺失”并清理无效关卡模型配置，同时核对缺失 glb 引用。
- 改动文件：
  - `packages/climber-game/src/levels/togetherSkyAscent.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 审计结果：`climber-game` 当前 `setpieceCatalog` 与角色模型导入未发现“代码引用但 glb 文件不存在”的情况。
  - 根因定位：`togetherSkyAscent` 内存在大量已禁用模型的 `sp` 定义，运行时被 `REMOVED_SETPIECE_ASSET_IDS` 过滤，导致体感上“关卡步骤缺失”。
  - 直接清理：从关卡源码物理删除 192 个被禁用模型对应的 `sp`，保留 62 个真实生效点位，并移除该文件内的末尾过滤依赖。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：关卡点位数量大幅收敛后，部分高度段可能变稀疏，需一轮实机可达性复测。
  - 下一步动作：按你的“不要的小模型”清单继续收缩 `setpieceCatalog` 与对应 glb（含脚本产物）做第二轮彻底剔除。

## 2026-04-14 14:06 (Asia/Shanghai)

- 任务：清理 `SETPIECE_CATALOG` 未使用模型，并同步剔除不再保留的 setpiece 资产与生成脚本冗余逻辑。
- 改动文件：
  - `packages/climber-game/src/setpieceCatalog.ts`
  - `packages/climber-game/src/types.ts`
  - `packages/climber-game/src/removedSetPieceAssets.ts`
  - `packages/climber-game/scripts/generate_setpieces.py`
  - `packages/climber-game/assets/models/setpieces/*.glb`（删除未使用资产）
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - `SETPIECE_CATALOG` 与 `ClimberSetPieceAssetId` 收敛到当前关卡真实使用的 11 个模型。
  - 删除 45 个不再使用的 setpiece glb 文件，仅保留关卡实际使用的资产文件。
  - `removedSetPieceAssets` 收敛为空集合，避免类型与资产收缩后残留无效配置。
  - 生成脚本移除不再保留模型（round_stool/tree_pine/grass_patch/road_segment）的构建逻辑与调用。
- 校验：
  - `python3 -m py_compile packages/climber-game/scripts/generate_setpieces.py`：通过
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `python3` 扫描 `packages/climber-game/src` 的 `.glb` import：`missing_glb_refs = 0`
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：资产大幅收缩后，若后续要恢复旧主题区块需重新导入模型与碰撞参数。
  - 下一步动作：如你同意，我下一步把 `sp` 命名按现存点位重排为连续编号，便于后续继续加点。

## 2026-04-14 16:35 (Asia/Shanghai)

- 任务：优先推进 P2（角色与动画），补齐 Daisy 跳跃手感、动画调试面板与脚底自动校准能力。
- 改动文件：
  - `packages/climber-game/src/types.ts`
  - `packages/climber-game/src/characterRig.ts`
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - Daisy 跳跃分段参数收敛，调整 jump/fall/land 比例，减少起跳段过长导致的动作粘滞感。
  - 动画状态机从“空中统一 jump”细化为 `jump/fall/land`，新增落地锁定窗口，确保落地动作可见。
  - 新增角色动画调试快照（状态、速度、active clip、clip map、骨骼/overlay 信息），并接入暂停菜单开发态面板与开关。
  - 新增脚底自动校准能力：按足部骨骼最低点计算偏移，支持运行时开关，减少模型“漂浮/陷地”手工调参。
  - 扩展 prototype controller：支持 `setDebugCharacterAnimationVisible` 与 `setCharacterAutoFootCalibrationEnabled`。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：未做实机动作手感回归，Daisy 在极端落差段可能还需微调落地锁定时长。
  - 下一步动作：你实测后我按体感再细调 `LANDING_ANIMATION_LOCK_MS` 与 Daisy 分段比例。

## 2026-04-14 16:41 (Asia/Shanghai)

- 任务：新增菜单内全屏功能，并优化 `Esc` 与游戏菜单的冲突交互。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 暂停菜单新增“全屏开/关”按钮，并监听 `fullscreenchange` 同步全屏状态标签。
  - 新增 `P` 键快速回菜单（释放 pointer lock），减少与浏览器 `Esc` 系统行为冲突。
  - 按键提示与菜单文案更新为“`P` 菜单，`Esc` 系统退出”语义，避免用户误解。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：不同浏览器对全屏 + pointer lock 的 `Esc` 处理仍有细微差异，但交互路径已清晰分流。
  - 下一步动作：你实测后若需，我可以再加“全屏失败提示文案”与“首次进入时键位提示”。

## 2026-04-14 16:54 (Asia/Shanghai)

- 任务：针对“底层地面过空、模型辨识度不足”补充分批落地任务清单。
- 改动文件：
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在 P3 新增地面场景与地表分层任务（大树/花草/岩石、土地/水泥地、碰撞回归与密度校准）。
  - 在 P4 新增可辨识度与比例基线任务（大树高度、草花尺寸、纹理策略升级）。
  - 在“下轮优先任务”新增地面冲刺包（按 3 批推进，先可辨识再精细化）。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：任务量较大，若不分批可能再次出现“模型多但体验乱”。
  - 下一步动作：按新清单先执行第一批“树石 + 碰撞 + 出生区回归”。

## 2026-04-14 16:58 (Asia/Shanghai)

- 任务：执行底层地面场景第一批落地（树石草花 + 土地/水泥地分层），改善“地面空与辨识度低”问题。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在底层边缘区域新增大树与岩石场景组，并为树/岩石添加碰撞体（`system` 分类，避免影响主路线 setpiece 统计）。
  - 新增草簇与花簇装饰（可见性优先，体量放大到第三人称镜头下一眼可见）。
  - 地面新增土地区与水泥区分层补丁，缓解单一平面“空白感”。
  - 场景资源在销毁流程中补充统一释放，避免新增几何/材质泄漏。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：树石碰撞虽然放在边缘，但仍需实机走一遍出生区和前段路线确认无遮挡感。
  - 下一步动作：继续第二批“密度校准 + 主路线前 3 段回归 + 纹理策略升级（程序贴图）”。

## 2026-04-14 17:58 (Asia/Shanghai)

- 任务：继续补齐底层空白区，执行第二批地面密度填充。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 扩充土地/水泥地补丁数量，覆盖此前“只有纯地面”的空白区域。
  - 地面大树从 6 棵扩到 12 棵，岩石从 6 组扩到 12 组，进一步填充边缘环带。
  - 草花簇从 6 组扩到 12 组，并为每组新增低矮碰撞体，保证底层场景可触达反馈。
  - 保持新增碰撞体归类为 `system`，避免影响 setpiece 关卡调试统计。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：草簇碰撞数量增加后，边缘绕行手感可能偏“绊脚”，需要实机确认密度是否仍舒适。
  - 下一步动作：按你的体感反馈再做一轮“局部疏密调参 + 纹理层次增强”。

## 2026-04-14 18:01 (Asia/Shanghai)

- 任务：修复 `climber-game` 中 `ImportMeta` 缺少 `env` 属性的 TypeScript 类型错误。
- 改动文件：
  - `packages/climber-game/src/env.d.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增本地 `ImportMetaEnv` 与 `ImportMeta` 声明，补齐 `import.meta.env.DEV/PROD/MODE/BASE_URL` 类型。
  - 采用包内声明文件方案，避免额外依赖 `vite/client` 类型引入。
- 校验：
  - `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：未执行（环境缺少 `pnpm/node`）
- 风险与后续：
  - 当前风险：若后续读取新的 `env` 字段（自定义变量），需继续在该声明中补充类型。
  - 下一步动作：等你确认后，我可顺手补一个最小 `tsc` CI 校验，防止同类错误回归。

## 2026-04-14 19:53 (Asia/Shanghai)

- 任务：修复全屏失控、重构地面覆盖与碰撞体拟合，并启动 P3 新一轮落地。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/climber-game-design-guard/SKILL.md`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 全屏按钮链路修复：进入全屏后自动尝试恢复 Pointer Lock，避免“只显示鼠标、无法继续游戏”。
  - 地面材质重构：由“整面基础地板 + 土地区薄层覆盖”替代厚盒子叠层，解决泥地/水泥地冲突覆盖与踩踏错位。
  - 地面碰撞体重构：新增基于对象世界包围盒的碰撞体生成，树木按“树干/冠层”分段，岩石按实际结构拟合，不再使用单个大立方体占位。
  - `climber-game-design-guard` 新增“碰撞体拟合硬约束”，明确禁止非方块物体套单一立方体碰撞体。
  - 更新 `CLIMBER-GAME-TASKS`：记录本轮已完成项，并保留 P3 回归与主题区块等未完成项。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：树冠分段碰撞体数量上升后，边缘绕行手感可能偏紧，需要一轮实机回归确认。
  - 下一步动作：继续执行 P3 未完成项中的“地面场景碰撞回归 + 主路线实跳可达性回归”，再推进主题区块和高难挑战段。

## 2026-04-14 19:56 (Asia/Shanghai)

- 任务：继续推进 P3，先落地“四主题区块”可视辨识层。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在底层新增四个主题区块底面（集装箱区 / 木板桥区 / 管道区 / 农场区），通过颜色与区域分区提升路线辨识。
  - 为每个主题区块补充代表性视觉元素（箱体块、桥板条、管道件、农场体块），先完成“可辨识”目标。
  - 本轮主题区块元素先以视觉层为主，避免新增阻挡影响现有起步节奏，后续再按回归结果补精细碰撞。
  - `CLIMBER-GAME-TASKS` 中 P3“增加主题区块”条目标记为已完成。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：主题区块目前偏“基础辨识版”，美术精细度和叙事细节仍需下一轮深化。
  - 下一步动作：执行 P3 的“地面场景碰撞回归 + 主路线实跳可达性回归”，确认无阻挡后再推进移动障碍段。

## 2026-04-14 20:10 (Asia/Shanghai)

- 任务：修正“树碰撞体缺失”和“地面未全覆盖”回归问题。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 为对象包围盒碰撞生成补上 `updateWorldMatrix(true, true)`，修复树木分段碰撞体因世界矩阵未刷新导致的位置失真问题。
  - 新增整面地表覆盖层（全图混凝土基底薄层），在其上保留土地区域薄层，确保整个可玩地面都有覆盖模型。
  - 保持薄层方案，避免再次出现泥地/水泥地厚盒子互相穿插导致的踩踏冲突。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：整面覆盖层与土地区颜色对比在个别角度可能偏弱，后续可再微调材质层次。
  - 下一步动作：你实机复测树木碰撞与全图地面后，我继续推进 P3 的“实跳可达性回归 + 高难障碍段”。

## 2026-04-14 20:18 (Asia/Shanghai)

- 任务：按实机反馈修正“地面看起来未铺满”的视觉参数。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 明确地面统一尺寸：碰撞地面与视觉地面使用同一基准尺寸 `220 x 220`（`FLOOR_COLLIDER_SIZE` / `FLOOR_VISUAL_SIZE`）。
  - 下调网格干扰：`GridHelper` 改为跟随地面尺寸，并降低透明度，避免“只看见网格、看不见地表材质”。
  - 扩大土地区薄层覆盖：由局部小贴片改为全场分区覆盖（上下/左右/中心），确保地表视觉连续。
  - 调整地表层高度，减少共面闪烁与遮盖冲突。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：地表已经铺满，但土地区分层目前偏工程版，可在下一轮继续做更自然的材质过渡。
  - 下一步动作：等你实机确认视觉OK后，我继续推进 P3 的可达性回归与高难障碍段。

## 2026-04-14 20:26 (Asia/Shanghai)

- 任务：修复“人物与地面穿模”与“地面白网格可见”问题。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 引入统一地表高度常量：`FLOOR_SURFACE_Y`，并将 floor 视觉层、覆盖层、地面碰撞体顶部统一对齐到同一地表高度。
  - 地面碰撞体中心改为由地表高度推导（`FLOOR_COLLIDER_CENTER_Y`），避免视觉地面与物理地面错层导致脚底穿模。
  - 白网格调试层默认隐藏（`grid.visible = false`），并降低透明度，避免玩家视角下出现明显白网格干扰。
  - 地表覆盖薄层高度改为略低于地表平面，减少共面冲突和视觉闪烁。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：若后续再抬高地表装饰层，需要同步调整其高度与碰撞关系，避免再次错层。
  - 下一步动作：你实机确认“穿模 + 白网格”已消失后，我继续推进 P3 的可达性回归与移动障碍段。

## 2026-04-14 20:33 (Asia/Shanghai)

- 任务：继续推进 P3，把“地面/前段可达性回归”固化为自动检测门槛。
- 改动文件：
  - `packages/climber-game/src/types.ts`
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 扩展 `ClimberJumpClearanceReport`：新增 `earlyRouteCheckedLinks`、`earlyRouteHighRiskCount`、`spawnBlockerCount`、`spawnZoneClear`、`routeRegressionPassed`。
  - 在原有净空分析中加入 P3 回归规则：
    - 自动检查出生区阻挡碰撞体（排除 floor/boundary-wall）。
    - 自动统计前 3 段路线高风险数量。
    - 给出统一回归门槛 `routeRegressionPassed`（出生区清空 + 前段高风险为 0 + 全局高风险为 0）。
  - HUD 新增回归可视信息：前段高风险、出生区阻挡、回归门槛状态。
  - 任务清单补记“自动回归门槛已落地”，并保留“实机碰撞回归”待确认项。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：自动回归已能拦截明显阻挡，但仍不能替代完整手感实跳。
  - 下一步动作：你实机确认出生区与前 3 段后，我继续做 P3 的“移动障碍/摆锤/旋转杆”首批实现。

## 2026-04-14 20:42 (Asia/Shanghai)

- 任务：修复主题土地块视觉穿模（角色进入棕色地块时半身陷入）。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 将主题区块底面从 `BoxGeometry` 改为 `PlaneGeometry`，避免厚度体块悬浮于地表导致“视觉穿模”。
  - 主题区块高度统一贴地（`FLOOR_SURFACE_Y - 0.002`），仅作为地表贴面，不再形成隐式台阶。
  - 同步把主题装饰体块基准高度改为 `FLOOR_SURFACE_Y + height * 0.5`，保证与地表关系一致。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：主题贴面与基础地面仍存在极小高度差，若后续加更强后处理可能出现轻微闪烁，可再加 polygonOffset 微调。
  - 下一步动作：你复测该棕色地块后，我继续做 P3 的移动障碍首批（摆锤）。

## 2026-04-14 20:45 (Asia/Shanghai)

- 任务：修复地表接缝处“仍有轻微穿模”的精度问题。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 地表层改为同一世界高度（`FLOOR_SURFACE_Y`），不再依赖上下错层避免 z-fighting。
  - 对基础地表、土地区贴面、主题区块贴面统一启用 `polygonOffset`，通过渲染偏移控制覆盖关系。
  - 主题区块贴面与地表完全同高，消除边界“视觉下陷”现象。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：若后续再新增多层地表材质，需沿用 polygonOffset 分级，避免再次产生接缝闪烁或错层。
  - 下一步动作：你复测该边界后，我继续 P3 的移动障碍首批实现。

## 2026-04-14 20:53 (Asia/Shanghai)

- 任务：继续推进 P3，落地高难挑战段首批动态障碍（摆锤）。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/skills/web-feature-iteration/CLIMBER-GAME-TASKS.md`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 2 组摆锤障碍（中段/高段各 1 组），包含锚点、绳索、摆锤体视觉。
  - 摆锤接入实时碰撞：每帧根据摆动角度刷新摆锤碰撞体包围盒，确保是“可碰撞障碍”而非纯装饰。
  - 动态障碍更新挂入主循环 simulation step，避免障碍与角色碰撞时序错位。
  - 清单中 P3 “加入移动障碍/摆锤/旋转杆”标记为已完成（首批摆锤落地）。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：动态障碍已可碰撞，但摆动参数仍需实机手感微调（速度/幅度/点位）。
  - 下一步动作：继续完成 P3 最后一项“主路线全段实跳可达性回归”，必要时按回归结果调摆锤参数。

## 2026-04-14 21:12 (Asia/Shanghai)

- 任务：修复中段关卡“后续上不去”的断链问题（用户截图箭头位置）。
- 改动文件：
  - `packages/climber-game/src/levels/togetherSkyAscent.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 对 `sp077 -> sp080` 段做局部重排，降低单跳跨度并形成连续过渡。
  - 微调 `sp077`（箱体）位置与尺寸，减少“卡视线 + 卡跳点”的压迫感。
  - 新增 `sp078`（stepping_stone）与 `sp079`（rock_slab）作为过渡踏点。
  - 将 `sp080` 调整到更接近主路线的落点位置，保证可顺接后续路线。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：该段已从“断链”修复为“连续可跳”，但仍需一次实跳确认在不同角色下都顺手。
  - 下一步动作：你实测通过后，我继续做 P3 的“全段实跳可达性回归”并据结果收口第 55 项。

## 2026-04-14 21:33 (Asia/Shanghai)

- 任务：为调试模式增加“物体头顶 instanceId（spid）标签”，便于按 ID 定位和改点位。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 碰撞体调试层新增标签渲染：在每个可调实例碰撞体上方显示 `instanceId`（如 `sp078`）。
  - 标签与碰撞调试同开关：开启碰撞体调试时显示，关闭时一并隐藏。
  - 补充标签资源释放逻辑（CanvasTexture / SpriteMaterial），避免调试频繁开关造成内存堆积。
  - 默认过滤 `floor` 与 `boundary-wall` 两个系统碰撞体标签，减少干扰。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：当调试标签数量过多时，画面信息密度会升高，但仅在调试模式下生效。
  - 下一步动作：你按标签直接报 `spid + 期望坐标`，我可以批量精准改位。

## 2026-04-14 21:42 (Asia/Shanghai)

- 任务：新增“调试专用模式”，仅在该模式显示 `spid`，并优化切焦点时的调试体验。
- 改动文件：
  - `packages/climber-game/src/types.ts`
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 新增 controller 能力 `setDebugInstanceLabelsVisible`，用于独立控制实例 ID 标签显示。
  - `spid` 标签显示收口到“调试专用模式 + 碰撞体调试开启”条件，避免平时调试信息过载。
  - 调试专用模式下优化焦点切换：失去 Pointer Lock 后不再强制弹暂停大菜单，提供自动/一键恢复控制。
  - HUD 与菜单新增“调试专用模式”状态和开关。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：浏览器 Pointer Lock 仍受安全策略限制，自动恢复在部分环境可能被拦截；已提供手动恢复按钮兜底。
  - 下一步动作：你实测调试流程是否顺手；若还需，我可再加“固定显示 `spid` 跟随屏幕缩放/距离淡出”。

## 2026-04-14 22:06 (Asia/Shanghai)

- 任务：在调试专用模式中补充坐标轴方向说明（含正负方向）。
- 改动文件：
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 调试专用模式下新增 HUD 坐标方位面板，显示 `position: [x, y, z]` 以及 X/Y/Z 正负方向。
  - 增加快速改值提示（`x+` 右移、`y+` 抬高、`z-` 推远）。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：无功能风险，属于纯调试辅助信息增强。
  - 下一步动作：你按面板调整坐标后直接反馈 `spid + 目标方向`，我可批量改点位。

## 2026-04-14 22:11 (Asia/Shanghai)

- 任务：按用户要求升级调试专用模式，直接在物体六个方向面显示坐标轴标签。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 在调试专用模式 + 碰撞体调试开启时，为每个实例碰撞体生成六面标签：`spid +X/-X/+Y/-Y/+Z/-Z`。
  - 保留顶部 `spid` 标签，同时新增面标签，便于直接按面方向改 `position[x,y,z]`。
  - 面标签按碰撞体当前旋转后的世界方向摆放，适配旋转物体。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：标签数量较多时画面信息密度提升，仅建议在定位点位时短时开启。
  - 下一步动作：你实测后若太拥挤，我可以再加“只显示当前焦点物体的六面标签”。

## 2026-04-14 22:32 (Asia/Shanghai)

- 任务：按用户反馈收敛调试标签密度，改为“人物周围 6 个方向便签”。
- 改动文件：
  - `packages/climber-game/src/createClimberPrototype.ts`
  - `packages/climber-game/src/ClimberArcadeExperience.tsx`
  - `.codex/logs/CHANGE-LOG.md`
- 关键改动：
  - 移除“每个物体六面 +X/-X/+Y/-Y/+Z/-Z 标签”逻辑，避免满屏信息噪音。
  - 新增“人物周围 6 方向便签”（+X/-X/+Y/-Y/+Z/-Z），调试专用模式下跟随角色位置显示。
  - 保留物体顶部 `spid` 标签，用于定位具体实例。
  - `debugInstanceLabelsVisible` 改为由调试专用模式直接驱动，不再依赖碰撞调试开关。
- 校验：
  - `pnpm --filter @valley/climber-game exec tsc --noEmit`：通过
  - `pnpm --filter web exec tsc --noEmit`：通过
  - `python .codex/skills/encoding-guard/scripts/check_mojibake.py`：通过
- 风险与后续：
  - 当前风险：无功能风险，属于调试显示层优化。
  - 下一步动作：你按新便签体系继续调点位，我根据 `spid + 偏移方向` 帮你批量改坐标。
