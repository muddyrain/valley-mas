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
