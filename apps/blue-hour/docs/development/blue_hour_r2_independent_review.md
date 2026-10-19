# Blue Hour R2 — 独立代码审查与回归风险诊断

日期：2026-10-19（Asia/Shanghai）。平台：**[Windows] Windows environment required**。

**结论：未确认 R2 新增 P0/P1；确认一项新增 P2：×4 浮点尾步把移动中的幸存者动画速度覆盖为零。** 单一模拟时间、暂停、两图更新职责和唯一结算的主体实现成立；不能据此写成“R2 没有新增行为错误”。建议先修复该尾步问题并复验，再正式交接 R3。Windows 发布继续 **BLOCKED**，本轮未构建或导出新 EXE。

旧效果测试从 16→19→18 项失败，**不是三项新玩法 Bug**：新增失败计数来自两处精确浮点断言与一次随机弹丸命中差异。同时，该套件始终另有一次未计入 failures 的 SCRIPT ERROR，升级版搜索检查没有完整执行。直接指向射击遗漏 focus 加成是另一个已证实的既有缺陷，不能全部归为测试问题。

## 1. 范围、比较基线与保全

工作目录 `D:/my-code/valley-mas`，游戏 `apps/blue-hour`；HEAD `8004ebabc6823c1c238045bf5406916879ed134b`，分支 `master`，跟踪 `origin/master`。已读取根 AGENTS / CLAUDE、游戏 AGENTS / PROJECT_CONTEXT、长期游戏设计契约、V0、R1 闭环、R1 独立审查、R2 报告及共享验证规则；目标路径没有更深层规则。保留小队指挥、自动战斗、Space 暂停可下令、WASD 镜头及五日归航，不引入角色手动动作控制。

采用 code-review 的规范／需求两轴只读分工，主审负责失败差异与隔离复现；Godot 规则辅助语义核对，delivery-reporting 和 encoding-guard 用于交付。没有可调用的 GitNexus 工具，回退原生 Git、调用点与文件差异；未重建索引。当前技能目录未提供可用的 Superpowers 入口，不宣称已执行该流程。

审查包含磁盘上的 R1、R2 未提交修改，以及未跟踪的 `tests/mission_dayloop.gd`、`tests/time_contract.gd` 和 UID。没有只审旧 HEAD。证据根 **E**：`test-output/r2-independent-review/`。

- 当前工程复制 **3,102 个源文件**，逐文件 SHA-256 核对；运行只在 `E/sandbox/current/`、`E/sandbox/baseline/`。
- 修复前副本从本轮当前副本恢复 R2 改动的七个既有文件，其哈希逐项匹配 R2 开始时的 manifest；R1 修复仍在。新时间测试保留但不作为“修复前已有测试”。见 [baseline-verification.json](../../test-output/r2-independent-review/baseline-verification.json)、[r2-source.diff](../../test-output/r2-independent-review/r2-source.diff)。
- 两份副本复用 R2 隔离工程的 `.godot` 缓存，**本轮没有重新证明全新导入成功**。Godot `4.7.2.stable.official.ed1daf0bf`，本轮新运行均为 Headless；没有抢占前台。
- 每个运行使用独立 APPDATA / LOCALAPPDATA / TEMP / TMP。实际用户目录打印见 `logs/search-completion-{before,after}.stdout.log`；不读写玩家存档。准确参数、退出码和耗时在 `logs/*.result.json`。
- 只新增本报告与 E 内证据。没有修改原工程源码、测试、场景、资源、配置、历史报告或 PLAN；未 add、commit、push、reset、stash、切换分支或清理。

快照见 [snapshot.json](../../test-output/r2-independent-review/snapshot.json)、[source-manifest.json](../../test-output/r2-independent-review/source-manifest.json)。本轮是独立取证与重新审查；R2 既有原生录像属于上一轮资料，没有冒充本轮重新完成的玩家流程。

## 2. 时间调用链与正确性

```text
Main：加载期间 Mission.process_mode = DISABLED → Ready Gate 后 INHERIT
HUD：Space / Esc / 设置 / F1 → Mission.time_scale = 0 或 1 / 2 / 4
引擎物理 delta（Engine.time_scale = 1）
  → Mission.simulation_delta：只在这里乘局部倍率
  → 最多 1/60 秒、兼顾技能到期边界的子步 dt
  → _advance_world(dt)
      → Periodic / City Noise / Clock / Director
      → Search.prepare / exit / Survivor.tick
      → simulation_advanced(dt) → Ambient
          Town：Noise + Enemy.tick；两图：搜索噪声
      → City：Enemy.tick（Town 跳过）
      → 全灭 / Search.advance / pickups / 撤离与关门
  → SpecialPower.advance(dt)
首次结束：active=false → completed → Main → Campaign pending → 保存
正式确认：Campaign.commit_day → 保存 → 下一天或既有 ended
```

“引擎物理 delta”不是 OS 墙钟时间。源码未发现生产逻辑写 Engine.time_scale；现有原生证据也记录为 1。没有再把共享 dt 乘倍率，暂停没有现实时间蓄积器。

| 检查 | 结论与代码位置（游戏根相对路径） |
| --- | --- |
| 重复缩放／单一来源 | `mission.gd:326–351` 是唯一局部缩放边界。Ambient `:28` 订阅共享信号，已无独立 `_physics_process`。真实调度只有一个来源；公开 advance 方法本身不防止任意外部代码主动误调用。 |
| City／Town 职责 | Mission `:359–360,393–398` 只为 City 推进 Noise／Enemy；Ambient `:42–51` 只为 Town 推进它们。两图搜索噪声仍由 Ambient 处理。多处 refresh_stats 是从基础值重算，不是多个 tick。 |
| 子步伤害／搜索／技能 | 每步消费分片 dt，未复用整帧 delta。Search prepare 与 advance 分工不同，奖励完成后释放任务；powers 在 world 后消费同一个 dt。确定性三倍率战斗结果相同。**但存在 F1 尾步表现回归。** |
| 暂停／恢复 | simulation_delta 在暂停返回 0，没有后台累计；下次只消费下一物理帧。UI 未随世界禁用。暮色延缓仍仅冻结白昼／蓝时时钟，世界和技能时长继续走，符合设计。 |
| Ready Gate | Main `:553,607` 禁用／恢复父级处理；Mission `:328,353` 再保护 Town 命令未就绪；Ambient 保留 runtime_ready。准备加载时可装配人口，不等于敌人已获得模拟 tick。 |
| City 到站 | `mission.gd:337–342` 保留一个外层帧的下车阶段，不进入同帧后续战斗／到站噪声。该演出阶段并不采用战斗的 1/60 上界；当前 UI 锁定出勤操作。Noise 原测试独立复跑 13/0。 |
| 感染者动画 | `infected_animation_controller.gd:16–18` 改 MANUAL，`enemy.gd:133–135` 随 tick advance，未发现第二个自动推进源。播放随机变速既已存在，不是再次应用 Mission.time_scale。未发现此修改产生重复攻击事件；尾步对动画速度采样的风险见 F1。 |
| 撤离／上车 | `mission.gd:1156–1185` 用模拟倒计时驱动车门与角色缩放；无独立 Tween 偷跑。boarding 后 Survivor 不再移动／开火／受伤，Enemy 的选人与伤害入口保留保护。关门时世界仍可继续模拟，不意味着必须停止所有感染者。 |
| 任务结束／唯一结算 | `mission.gd:1188–1211` 先 inactive 再发 completed，子步循环随即停止；Ledger settled、Campaign `:302,327` 的 mission／pending 状态保护保留。没有发现重复 completed 或重复日结的新增入口。 |

### 两轴审查结果

**规范轴**：未发现新增硬性规范违规或需扩大范围重构的代码气味。指出周期效果专项只检查存在活跃效果，永久测试仍缺少精确事件次数与到期对照。

**需求轴**：统一时间、暂停、地图职责与门禁接入成立；发现 ×4 尾步覆盖表现速度的疑点。主审随后在两图、修复前后对照中确认，定为 F1。两轴均未提出新增 P0/P1；需求轴 1 项行为问题，规范轴 1 项覆盖观察，不将两者互相抵消。

## 3. 问题与建议

### F1 — P2／A：×4 极小尾步将移动动画写成 Idle（新增、已复现）

位置：[mission.gd:344](../../missions/mission.gd)、[survivor.gd:189](../../survivors/survivor.gd)、[survivor.gd:218](../../survivors/survivor.gd)、[survivor.gd:250](../../survivors/survivor.gd)、[survivor_expedition_animation_controller.gd:68](../../survivors/survivor_expedition_animation_controller.gd)。

`while left > 0` 在 60Hz、×4 时产生四个 1/60 秒子步，以及 **6.938893903907228e-18 秒**尾步。Survivor 的移动积分忽略 ≤1e-6 的剩余时间，但后续仍把本次位移／delta 写入 actual_velocity，并把零速度写给动画控制器。正式渲染消费者读取最后一次采样，因此移动中的角色转为 Idle。该循环也会额外调用 Enemy 等系统；本轮没有把额外调用数直接解释为重复伤害。

受控探针执行相同 1 秒模拟区间，保留真实路径和原动画控制器；没有修改实现。还启用真实 render consumer 的分支读取最终状态，未以距离 PASS 替代动画判断。

| 对照 | ×1 | ×2 | ×4 |
| --- | --- | --- | --- |
| 修复前 City，1 秒位置 | z=12.40794 | z=12.40794 | z=12.40794 |
| 修复前最终速度／动画 | 2.80003／Run | 2.80003／Run | 2.80003／Run |
| 当前 City，同样位置 | z=12.40794 | z=12.40794 | z=12.40794 |
| 当前最终速度／动画 | 2.80003／Run | 2.80003／Run | **0／Idle** |
| 当前正式 Town fixture | 移动 2.40822m，Run | 移动 2.40822m，Run | **移动 2.40822m，0／Idle** |

证据：[edge-probe/report.json](../../test-output/r2-independent-review/sandbox/current/test-output/edge-probe/report.json)、[motion-baseline.stdout.log](../../test-output/r2-independent-review/logs/motion-baseline.stdout.log)、[motion-current.stdout.log](../../test-output/r2-independent-review/logs/motion-current.stdout.log)。这些是隔离受控诊断，不是本轮正式 HUD／原生玩家路线录像。

影响限于已证实的末尾速度与行走表现；路径位移、HP、搜索和结算没有因此被本轮证实重复推进。感染者 `_move_path` 也会用尾步的零位移更新动画倍率，静态上可能将其压到最小值；该附带影响没有单独动态量测，不扩大为第二项已确认缺陷。

建议最小修复：避免把减法舍入产生的残余当成完整 gameplay tick；分配／合并余量时保持总模拟区间和真实技能到期边界。补充 ×4 原生调度下的最终速度、行走动画、敌人动画及步数检查，再跑 173／26。不要把“所有小 delta 都忽略”当作未经验证的通用修复。本轮未实施。

### F2 — P2：指向射击遗漏 focus 加成（已存在，非 R2 回归）

位置：`weapon_combat_controller.gd:58`、`instant_hit_resolver.gd:53–60`、`mission.gd:502–509`、`tests/effect_system.gd:230`。

自动射击传入 target；指向射击只传 point，创建 AttackSpec 时 target=null，`mission.damage_to(member,null)` 无法判断 focus 目标。几何命中后也没有重算对应加成。修复前后与固定随机数探针均为普通 **45 / 67.5**、升级 **50.4 / 85.68**。这是合理期望与既有实现的真实差异，**不应为了归类 B 而宣称该断言完全无效**；也不是 R2 新引入的问题。

### P1 发布阻断与既有观察

完整 build 仍被旧 Camp UI 阻断；指令线相位风险、search_dispatch、武器与效果门禁未清债，详见第 6 节。没有新增 P0。HUD 创建 Ambient 的装配副作用、Town 避让提前返回而跳过旧腕表归航加速继续存在，R2 没有修改相关规则。

## 4. 旧效果测试逐项差异

### 环境与比较方法

历史三次运行都是隔离 Windows Godot 4.7.2 Headless，完整参数见其 result.json；不是 GPU 渲染差异。原 `tests/effect_system.gd` 及战斗、Trait、Aura、Periodic、武器数据在前后没有源码差异。R2 七个既有文件的确切差异保存在 E。Campaign seed 固定，但每个 WeaponCombatController 的 `RandomNumberGenerator.new()` 未在该旧夹具中固定 seed，不能由 Campaign seed 推断弹丸散布可复现。

本轮先原样复跑；再用继承观察器保留全部原断言，仅固定每名成员战斗 RNG 为 910+index，记录每个实际 HitEvent、数值断言和 reload 精度。没有改原测试文件、放宽断言或把诊断称作门禁 PASS。

| 运行 | checks／failures | 另有 SCRIPT ERROR |
| --- | --- | --- |
| R2 保存的修复前 | 324／16 | 1 |
| R2 保存的修复后 | 324／19 | 1 |
| R2 保存的诊断 | 324／18 | 1 |
| 本轮原样修复前／后 | 324／17 → 324／18 | 各 1 |
| 本轮固定战斗 RNG 修复前／后 | 324／17 → 324／19 | 各 1 |

完整逐条错误、运行参数和观测值：[effects-comparison.json](../../test-output/r2-independent-review/effects-comparison.json)。固定 RNG 的前后数值差异：[seeded-value-differences.json](../../test-output/r2-independent-review/seeded-value-differences.json)。

### 历史三次失败值

N=普通，U=升级；数值为 actual，期望单列。“通过”表示当次未报该断言失败，原日志没有打印精确 actual，不能补造。合并行内每个检查仍分别计数。

| 断言／行 | 模式 | 期望 | 修复前16 | 修复后19 | 诊断18 | 判断 |
| --- | --- | --- | --- | --- | --- | --- |
| Automatic attack，180 | N | 8.75 | 26.25 | 17.5 | 26.25 | B＋随机敏感 |
| Directed fire，184 | N | 8.75 | 通过 | 17.5 | 通过 | B＋随机敏感，解释 1 项计数变化 |
| Focus directed hit，230 | N | 67.5 | 45 | 45 | 45 | 既有真实缺陷 F2 |
| Cart speed，278 | N | 2.576 | 2.47296 | 同前 | 同前 | B |
| Watch toward／away／transverse，319–321 | N | 3.136／2.8／2.8 | 3.01056／2.688／2.688 | 同前 | 同前 | B，3 项 |
| Watch actual path／detour，329、334 | N | .3136／.28 | .30165／.26927 | 同前 | 同前 | B，2 项 |
| Movement and reload，361 | N | moving 且 reload==1 | 通过 | 失败 | 失败 | C |
| Automatic attack，180 | U | 9.8 | 29.4 | 29.4 | 29.4 | B＋随机敏感 |
| Directed fire，184 | U | 9.8 | 29.4 | 19.6 | 19.6 | B＋随机敏感，始终失败 |
| Focus directed hit，230 | U | 85.68 | 50.4 | 50.4 | 50.4 | 既有真实缺陷 F2 |
| Watch toward／away／transverse，319–321 | U | 3.304／2.8／2.8 | 3.17184／2.688／2.688 | 同前 | 同前 | B，3 项 |
| Watch actual path／detour，329、334 | U | .3304／.28 | .31787／.26927 | 同前 | 同前 | B，2 项 |
| Movement and reload，361 | U | moving 且 reload==1 | 通过 | 失败 | 失败 | C |
| 升级搜索访问 task，269 | U | task 仍存在 | SCRIPT ERROR | SCRIPT ERROR | SCRIPT ERROR | B，**不在 failures 内** |

### 分类与根因

**A．已确认的新行为回归**：F1 的 ×4 行走表现。旧效果列表中的新增失败没有证明新伤害／换弹／搜索 Bug；这不消除另行复现的 F1。

**B．旧夹具契约不适用**：

- 霰弹枪：成员 0 实际为 `WPN_005_S12_SHOTGUN`，damage=7、pellet_count=7、spread=24°。每个命中弹丸独立应用 8.75／9.8，整枪实际命中 1、2、3 发时就得到测试所见倍数；不是一次 HitEvent 伤害被时间倍率重复相乘。固定 RNG 后，前后普通自动 **17.5**、普通指向 **26.25**，升级自动 **19.6**、升级指向 **29.4** 完全对应；记录的 critical 均为 false。此前把 2×／3×猜成暴击或爆头没有证据支持。
- 移动：Mission 基础速度已包含 `(1 + weapon.move_speed_modifier)` 与 Aura。夹具中霰弹枪、突击步枪均有 **-0.04** 修正，旧期望只乘 cart／watch。例如 2.8×.92×.96=2.47296，2.8×1.12×.96=3.01056；实际路径还包含既有减速积分。相同前后数值不支持 R2 移动倍率错误。
- 升级搜索：一秒前进后 corner 已完成，正常释放 `search_tasks.corner`。独立保留原调用的探针在前后都记录 **duration=.99、progress=1、searched=true、still_assigned=false**。旧测试第 269 行仍索引该任务并试图比较 >100% 的线性进度，随后中断本次 `_check_search`。见 `logs/search-completion-{before,after}.*`。324 是执行到的 check 数，不是完整效果套件成功跑完的证明；后续整个 run 仍继续，故错误容易被总数掩盖。

**C．浮点／随机时序敏感**：

- 普通与升级的移动都实际发生；R2 两次 reload 实测均 **1.00000000000000490**，与 1 相差 **4.88e-15**。此处 freeze 指暮色延缓，移动／换弹应继续；随后的 time_scale=0 才是全局暂停。旧 `== 1` 失败，暂停后状态仍严格保持。不是暂停期间换弹继续跑，也不是现实时间补算。
- 未固定散布 RNG 导致正常指向射击在通过与多弹伤害间切换；这解释历史 19→18 的一项变化，不能用增加日志后少一项失败认定功能修好。
- 固定 RNG 后两版本所有已记录的射击伤害、射速、watch 数值一致；其余 near 数值差异只有约 1e-16～2e-13，均在原 is_equal_approx 内通过。两项额外 failures 正好来自上述精确 reload 比较。

**D．仍需验证的边界**：全部武器、所有 Trait/Aura/周期组合、高负载原生 ×4 表现及性能没有被本轮穷举；不能从单一探针外推。F2 已有源码和前后运行证据，不列作“暂无证据”，也不因年代久就降格为错误断言。

### Periodic／Trait／Aura 与射速

Periodic.advance 只从 Mission 有效 dt 调用；Trait 多为无时钟的规则计算，Aura 按当前位置／存活／上车状态即时查询，没有另一个 delta 源。永久173项对周期效果仅断言活跃与冻结，不能单独证明精确事件数。

本轮补充独立诊断：两图三倍率，同样 4 秒、一个 1 秒间隔／0.5 秒持续／ALL_TEAM provider，均为 **12 次 applied、9 次 expired、3 个活跃**；再推进 .6 秒均为 **12／12／0**。没有重复触发或额外到期；这是受控采样，未写回永久测试。HP、搜索、技能时长和攻击节奏仍以原专项的实际数值为依据：4 秒八发／144 伤害、感染者32伤害在三倍率一致，表示相同模拟时段一致，不表示每个真实秒伤害恒定不随倍率改变。

## 5. 本轮复跑与 R1 回归边界

| 检查 | 实际结果 | E 内证据 |
| --- | --- | --- |
| R2 原始专项 | **173／0**，exit 0 | `logs/time-contract.*` |
| R1 原始日循环 | **26／0**，exit 0 | `logs/dayloop.*` |
| 原始 Ambient | **56／0** | `logs/ambient.*` |
| 原始 City Noise／到站 | **13／0** | `logs/noise.*` |
| 原始 search_dispatch | **56／2**，相同120／167行 | `logs/search-dispatch.*` |
| 原始武器专项 | **474／1**，同一 Empty model allowed WPN_004_K9_SMG | `logs/weapons.*` |
| 原始／固定 RNG 效果 | 全部 FAIL，见第4节 | `logs/original-*`、`observer-*` |
| 新增边界观察器 | ×4 动画回归成立；周期次数对照一致 | `logs/edge-probe.*`、`motion-*` |

观察器 exit 0 仅代表采集成功，不是把其中 Idle 结果标成游戏 PASS。原始源码与断言完整保留；额外脚本仅在 E 内加载。部分独立测试并行执行，其耗时和 Ambient 的 ms/update **不能作为 FPS 基准**。

R1 completed、全灭优先于撤离、Ledger／Campaign／保存身份与 UID 链路仍安全；26项再次通过。另核对 R2 既有正式 `main.tscn` 证据：第2天实际带回2食物／5废料，扣2口粮，6／5→第3天6／10；自然昼夜、全灭后返回0／0、两人丢失，库存仍6／10，history各只增加一次。pending 与确认后 payload／checksum 检查保留于原 [closure-checks.json](../../test-output/r2-time-contract/cycle/closure-checks.json)、[wipe-checks.json](../../test-output/r2-time-contract/cycle/wipe-checks.json)。本轮没有重新操作完整 main 闭环，也未用内部结算方法补造其 PASS。

## 6. 标准门禁、UI 产品边界与性能风险

### 门禁已接入，但完整构建未到达

`run.ps1:142–143` 的 test、`:256–257` 的 build 都真实引用 mission_dayloop 和 time_contract，修复了 R1 未接门禁的交付缺口。`:25–30` 同时检查退出码及 ERROR／SCRIPT ERROR，没有删除断言、吞错误或绕过导出。两套专项位于较早旧测试之后，前置失败时不能宣称它们已经由完整 build 执行。

本轮未重跑完整 build。核对 R2 [build-final.result.json](../../test-output/r2-time-contract/logs/build-final.result.json)：exit1、166.461秒、executable_exists=false；Search Gameplay72、Phase2 265、Survivor Command45、Search Active Card157、Settings14、Camp Menu Overlay30通过，随后 Camp UI 失败，未到 export。

| Windows 尚未解决的门禁／风险 | 当前证据与状态 |
| --- | --- |
| Camp UI | R2 build 停在不存在的 member_buttons 与“Camp exposes active abilities on its left edge”；V0 原生已复现。P1 发布阻断。 |
| 指令线 | R1独立审查已用相位对照证明20Hz重绘和逐帧精确位置断言冲突；R2这次45/0不能消除偶发失败。本轮未重做该专项。 |
| search_dispatch | 本轮56/2，仍为Trait一秒进度和旧City召回／归航联合断言。修复前同样失败；两项具体治理尚未完成，不能因旧问题就跳过。 |
| 武器 | 本轮474/1，同一SMG空模型断言，前后基线相同。 |
| 效果 | 本轮仍FAIL，另有SCRIPT ERROR与F2；必须分别治理夹具、浮点与真实缺陷，不能仅删失败。 |
| 旧角色／营地入口 | V0还记录camp_departure目标失配及remaining_survivor_batch的旧data-only断言失败；本轮未复跑，不冒称现门禁全覆盖或当前都已恢复。 |
| 导出及独立EXE | 未通过完整前置门禁、未执行新导出与新EXE独立启动。旧产物不代表当前工作区可发布。 |

### 倍速 UI 的产品边界

现存入口是 **F1 Debug 菜单**里的 ×1／×2／×4 OptionButton（`debug/debug_menu.gd:49–53`），HUD `:861` 把选择值用于 Mission。Debug 打开本身暂停，关闭后恢复所选速度。R2原生证据中的三档选择是真实鼠标选择，内部状态设置的受控专项不能替代它。

因此可说“正式运行中的既有 Debug 倍速入口可用”，不能说“已交付独立的玩家常驻倍率HUD”或“移除Debug后仍可选倍速”。是否将倍率做成普通产品入口需明确设计任务；本轮不增加UI，不把这个范围边界擅自扩成R4。

### 今后性能专项应覆盖

×4 理想情况下每真实秒约240个有效子步，当前还多出F1尾步，不能把x1成本直接外推。建议单独量测自然夜间高人口、人口上限、多人多点搜索、密集Noise／感知／路径查询、效果同帧到期、关门与镜头移动并发；分别记录物理／渲染帧p50／p95／p99、追帧丢失、子步数、路径查询和人口，并核对单位墙钟的模拟进度。

性能测试应避免并行压力进程和PNG录屏I/O，区分CPU、GPU、资源装载与存档成本。低渲染FPS、达到引擎追帧上限时，要同时测正确性和游戏实际速度；173项的误差、Ambient平均更新耗时及录屏物理帧计数均不能替代这些数据。

## 7. R3 建议、交付及限制

**建议先处理 F1，再正式进入 R3。** 所需的是局部尾步修复与对应表现回归，不是重写统一时间架构；未发现需要推倒R1或暂停体系的新P0/P1。历史门禁债不必全部混入R3功能开发，但发布状态必须继续BLOCKED，F2与旧效果夹具应单独列入清债范围。

未验证：本轮完整原生玩家路线、音频、全角色／装备、全部地图seed、五日通关、存档故障与迁移、FPS性能、macOS和新EXE。此前原生时间／结算录像只作为已有证据核对，未被本轮的Headless诊断替代。Node实际为v26.4.0，不符仓库22.x约束，未调整；本轮Godot诊断不依赖Node构建链。Blender未使用。

不更新既有PLAN：用户只授权审查报告和独立证据，本轮没有改变实现或执行任何修复。所有建议留在本报告供后续授权处理。

最终保全见 [preservation.json](../../test-output/r2-independent-review/preservation.json)：原源文件、Git索引、HEAD、根规则哈希保持；原缓存／build／既有证据的已存在文件大小与mtime无变化，未冒称大型二进制逐字节验证。检查期间另有动画线程在 `test-output/anim-a0-20261019/` 新增文件，并有该路径的Godot进程运行；单独记录为外部新增，没有关闭它们，也没有把它们算成本轮证据。本轮测试子进程均已结束。

第一次元数据比较遗漏UTF-8读取参数，导致中文路径被错误解码并误报变更；原输出保留为 `preservation-initial-decoding-diagnostic.json`。修正的是E内检查工具，重新比较确认已存在文件零变更，不涉及修改历史证据。报告编码、链接、空白及进程退出检查见 [final-checks.json](../../test-output/r2-independent-review/final-checks.json)。
