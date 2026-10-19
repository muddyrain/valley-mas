# Blue Hour — Monorepo 全工程基线审计

审计日期：2026-10-19（Asia/Shanghai）。性质：首次跨系统只读基线审计，仅新增本报告。

## 1. 结论、范围与证据等级

**当前工程已有较完整的数据、地图、搜索、战斗、动画和保存组件，但正式 Medium Town 入口尚不能据此认定为完整的五日归航游戏。** 最主要的问题是不同阶段组件接入后的运行链路不一致：Mission 推进移动与搜索，HUD 又创建单独的敌人推进节点，正式地图分支没有进入原有时钟、全灭和撤离结算逻辑；营地新版展示组件也未完整接回旧版交易入口。

没有发现足以确认的 P0。发现的 P1 包括正式归航闭环缺口、暂停时敌人仍可推进、营地关键操作接线缺口、结束状态缺少界面、回归门禁失配，以及根 AI 指令入口损坏。它们是静态证据支持的发布阻断风险，**本轮没有复现运行结果**。

### 1.1 审计边界

- Git 实际根目录：`D:/my-code/valley-mas`；游戏根目录：`D:/my-code/valley-mas/apps/blue-hour`。
- 基准 HEAD：`8004ebabc6823c1c238045bf5406916879ed134b`，分支 `master`，跟踪 `origin/master`。未联网 fetch，不能据此判断远端是否有更新。
- 开始审计及写报告前，`git --no-optional-locks status --short --branch` 均只有分支行，已跟踪文件和普通未跟踪文件没有待处理改动。现存忽略目录、构建、截图和录像均保留。
- 系统性盘点游戏文件、AI 入口、Skills、计划与证据目录；对核心数据流、分支和高风险调用读取实现。未逐帧审查全部动画，未反编译 GLB、EXE 或验证全部资源内部轨道，未把目录盘点当成所有文件的逐行正确性证明。
- 未审计无关应用；游戏运行代码的本次静态引用追踪未发现对其他 `apps/*` 或 Monorepo `packages/*` 的直接加载依赖。根脚本仅追踪相关治理、测试和命名入口。
- 未读取认证文件、密钥、凭据、玩家存档、会话数据库或敏感配置正文。配置文件只盘点路径与元数据，因此部分全局配置行为保留为“信息不足”。

### 1.2 五种状态的使用方法

| 状态 | 本报告含义 |
|---|---|
| 已实现且有验证证据 | 必须同时说明证据性质。本轮可确认的是文件存在、静态引用存在、Git 模式、文本内容等静态性质；不扩张为运行通过。 |
| 已实现但尚未验证 | 已读取当前实现，但没有本轮 Godot 解析、运行或实机证据。历史测试另列。 |
| 部分实现 | 数据、方法、表现或部分入口存在，正式调用链、交互或持久化仍不完整。 |
| 尚未实现 | 在所核对的正式流程中未找到实现，且当前代码/明确边界支持此结论。 |
| 信息不足，无法确认 | 依赖未读取的敏感配置、引擎运行、二进制内部或人工体验判断。 |

后文源代码路径未另说明时均相对于游戏根目录；`repo:` 表示 Monorepo 根目录。行号对应上述 HEAD 的工作区快照。历史文档中的 PASS、用户当时确认、旧 JSON 和现存媒体均不代表 2026-10-19 运行结果。

## 2. Monorepo 与实际 Godot 工程结构

### 2.1 工程入口

`git rev-parse --show-toplevel` 返回 `D:/my-code/valley-mas`。游戏入口由 [project.godot:15–20](../../project.godot) 指定：名称为《蓝时归航 / BLUE HOUR: HOMEWARD》，版本 `0.5.0`，主场景 `res://core/main.tscn`，features 为 `4.7`、`GL Compatibility`。1600×900 参考视口、1024×640 最小窗口见该文件 24–30 行，Compatibility 渲染见 51–55 行。该配置只能证明声明，不能证明当前安装引擎版本。

游戏目录有 3,091 个 Git 跟踪文件，其中 447 个 `.gd`、83 个 `.tscn`、217 个 `.tres`、203 个 `.glb`、232 个 Markdown、697 个 `.import`。`tests/` 下有 212 个 `.gd`；其中包括采集、生成、烘焙与诊断脚本，并非 212 套互相独立的无副作用测试。

```text
valley-mas/                         Monorepo；Git、共享 AI 规则及治理脚本
├─ .agents/skills/                  项目 Skills 正文与 INDEX.md
├─ .codex/、.claude/                工具配置及兼容入口
├─ docs/、scripts/                  仓库指南、验证策略、检查入口
└─ apps/blue-hour/                  独立 Godot res:// 根
   ├─ project.godot、core/main.tscn  主工程与主场景
   ├─ core/                        场景装配、Campaign、SaveStore、Ledger、效果
   ├─ data/                        Resource 定义、目录、规则和 .tres
   ├─ missions/                    行动、输入、搜索、技能、相机
   ├─ survivors/、weapons/          移动、动画、武器实例与攻击解析
   ├─ enemies/、encounter/          感染者、感知、噪声、遭遇及 Town 补接
   ├─ camp/                        营地角色、行为、设施描述与出发表现
   ├─ maps/                        旧 City、Random、Town、导航、搜索注册及探索
   ├─ ui/                          菜单、营地 HUD、行动 HUD、小地图、结算
   ├─ scenes/、assets/              正式场景与运行/源/legacy 资源
   ├─ art/                         美术规范与生产工具，含独立 QA 小工程
   ├─ tests/、tools/                验证、采集、烘焙、接入工具
   ├─ docs/                        设计、架构、计划、报告和历史证据索引
   └─ .godot/、test-output/、build/  本地缓存及忽略产物；不是源码真源
```

除主工程外，跟踪目录中还存在 `art/blender/scripts/canonical_locomotion/project.godot`、`art/blender/scripts/survivor_bind_qa/project.godot`。它们有自己的 `res://`；不能用主工程根目录解释其内部路径。忽略的 `test-output/` 中也有独立 QA 工程，不属于正式游戏入口。

### 2.2 正式调用关系

```text
project.godot → core/main.tscn → core/main.gd
  ├─ Catalog → Survivor/Weapon/Effect/Map 等 Resource
  ├─ Campaign ↔ SaveStore → user://homeward/run.json
  ├─ Title / NewGame → CampHUDRoot + ShelterView → TodayAction
  └─ start_mission → staged loading → MEDIUM_TOWN_V1
       ├─ TownRuntimeAdapter → TownGenerator / 环境层 / 导航
       ├─ Mission → Survivor / SearchTask / Ledger / 探索
       └─ MissionHUD → AmbientThreatRuntime → Enemy / Noise

旧 City / FIXED_LEGACY：另有 EncounterDirector、Clock、撤离、全灭与结算推进
```

正式出勤固定选择 provider `MEDIUM_TOWN_V1`，地图 seed 由 Run seed、day 和内存中的 `random_mission_counter` 生成，见 [core/main.gd:670–683](../../core/main.gd)。旧地图和旧 Random 分支仍有消费者及大量测试，不能直接按“重复实现”删除。

## 3. AI 指令生效链与文件清单

### 3.1 实际加载与显式读取必须分开

官方默认发现规则是：全局先选 `AGENTS.override.md`、否则 `AGENTS.md`；项目按 Git 根到启动 CWD 逐层选择，每层最多一个文件，同层 override 优先于 AGENTS，再考虑配置的 fallback 名；较深目录约束覆盖较宽范围约束。默认总上限为 32 KiB。参考 [OpenAI 官方 AGENTS 指南](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。

本会话启动 CWD 是 Monorepo 根目录；不能假定 `apps/blue-hour/AGENTS.md` 已随启动自动加载。本轮先收到与全局指导、根 AGENTS 同文的会话指令，再从磁盘显式读取根 CLAUDE、游戏 AGENTS 和相关 Skill。**从已注入的文本本身无法反推客户端完整配置或每段文本的底层装载机制。** 以下分别记录观察结果，而不宣称所有存在的文件都自动生效。

| 来源/路径 | 存在情况与当前角色 | 本轮状态 |
|---|---|---|
| `C:/Users/A/.codex/AGENTS.md:1–7` | 第一性原理、先检查 Skills/Superpowers、GitNexus 优先及无工具时回退。 | 会话中已有同文规则；已显式核对文件。 |
| `C:/Users/A/.codex/AGENTS.override.md` | 未发现。 | 无全局同名 override 可供读取。 |
| `repo:AGENTS.md:1–46` | 当前实体为普通文本：首行 `CLAUDE.md`，随后只有 GitNexus 块；不是完整根协作正文。 | 会话中已有同文；已核对 Git 索引及文件。 |
| `repo:CLAUDE.md:1–80` | 完整根协作规则、指引、验证和同一 GitNexus 块。 | 显式读取后作为仓库规则遵守；不能把首行文件名当自动 include。 |
| `repo:apps/AGENTS.md`、`AGENTS.override.md` | 均未发现；`apps/` 四类 AI 隐藏目录也未发现。 | 没有中间层追加规则。 |
| `apps/blue-hour/AGENTS.md:1–50` | 游戏边界、平台分工、数据、保存、验收、报告、角色绑定、命名。 | 为审计范围显式读取；未发现游戏内更深层 AGENTS/override。 |
| `repo:.agents/skills/INDEX.md` | 项目 Skill 路由与组合上限。 | 显式读取。 |
| `repo:docs/PROJECT_GUIDE.md:141–179` | 游戏环境与测试命令入口。 | 显式读取相关章节；不自动执行命令。 |
| `repo:docs/HARNESS_ENGINEERING.md`、`docs/TESTING_STRATEGY.md` | 根协作与验证策略。 | 读取相关规则/命中章节；Web 专项不套给 Godot。 |
| `PROJECT_CONTEXT.md`、`CONTEXT.md`、`README.md` | 产品设计、术语、操作与实现描述。 | 按局部入口显式读取核对；不是 Codex 默认自动指令文件。 |
| `docs/PLAN.md`、其他历史 Plan/报告 | 状态断言和历史证据，不能自动转成当前授权。 | 仅审计。 |
| `repo:.agents/AGENTS_TEMPLATE.md` | 新建局部规则的模板。 | 已发现；本轮不新增 AGENTS，不调用模板。 |

同一层的 override 是选取替代，不意味着删除所有祖先规则。普通 Markdown 文件、`PLANS.md`、`.claude` 设置或 Skill 正文也不会仅因存在就全部进入当前上下文。实际用户本次指令优先于仓库/Skill 的一般流程；平台系统及工具限制仍优先。

### 3.2 配置与全局指导盘点

| 层级 | 已发现 | 未发现或不能确认 |
|---|---|---|
| Monorepo 根 | `.agents/`、`.codex/config.toml`、`.codex/skills`、`.claude/skills`；另有 `.codebase/skills`、`.trae/skills` 兼容入口。 | 无 `.agent/`、根 `AGENTS.override.md`、根 `PLANS.md`。 |
| `apps/` | 未发现本层 AI 指令/配置目录。 | 无本层 AGENTS、override、PLANS。 |
| Blue Hour | `AGENTS.md`、`.claude/settings.local.json`。 | 无本地 `.agent/`、`.agents/`、`.codex/`、PLANS 或游戏专属 SKILL.md。 |
| 全局 Codex | `C:/Users/A/.codex/AGENTS.md`、`config.toml`、`hooks.json`、`rules/default.rules`、`skills/`、`.system` 与插件 Skill 目录。 | 配置、hooks、命令规则仅核对元数据，不读取敏感正文；fallback、实际字节上限、项目 trust、hooks 和额外 instruction 设置无法完整确认。 |
| 全局其他指导 | `C:/Users/A/.agents/skills/`；`C:/Users/A/.codex/superpowers/`；`C:/Users/A/.agents/skills/superpowers/`。 | 未发现 `C:/Users/A/.claude/CLAUDE.md` 或 `C:/Users/A/.codex/PLANS.md`。 |
| 其他根目录上下文 | `.agent_context/` 只有无关应用日志/PID；`.omx/` 中发现的 Markdown 属于无关工作流。 | 未发现相关 Blue Hour 活跃计划；不读取无关日志，不继续无关任务。 |

`apps/blue-hour/.claude/settings.local.json` 属于 Claude 本地配置，不应视作 Codex 自动指令。未读取其具体许可内容，也未调用 hooks。`repo:.codex/config.toml` 存在，不等于能够证明所有宿主实际采用的值。

### 3.3 根入口与兼容链接的实质问题

1. `git ls-files -s` 显示根 AGENTS 和四个 Skills 兼容入口均为 **120000（符号链接）**；但当前 Windows `git config --get core.symlinks` 为 **false**，磁盘上五者均为普通文本文件。
2. 四个 Skills blob 正文是合法相对目标 `../.agents/skills`，但当前磁盘并不是可遍历目录；例如 `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` 当前无法沿该入口访问。正文真实存在于 `.agents/skills/gitnexus/gitnexus-exploring/SKILL.md`。
3. **根 AGENTS 更严重**：`git show HEAD:AGENTS.md` 的链接目标内容已经是 `CLAUDE.md` 加完整多行 GitNexus 块。即使未来允许符号链接，这个 blob 也不是指向 `CLAUDE.md` 的有效目标。它不能仅靠开启 Windows symlinks 修复。
4. `CLAUDE.md:3`、`docs/HARNESS_ENGINEERING.md:21,31,44`、`.agents/skills/INDEX.md:14` 关于这些入口“是软链接”的陈述与当前工作区事实冲突。技能目录仍被本会话目录清单从真实 `.agents/skills` 发现，不代表兼容链接正常。

建议：后续单独修复根 AGENTS 的文件类型/正文契约，并确定跨平台唯一可靠的入口方式；四个兼容目录按平台验证可遍历性。先修复根目标内容，再处理检出方式；本轮未执行任何 Git 配置或链接修改。

### 3.4 Superpowers 状态

全局两处 `superpowers` 目录均存在，但实查未发现其下 `SKILL.md`，也未发现 `skills/using-superpowers/SKILL.md`。目录中的 `AGENTS.md` 只是文本 `CLAUDE.md`；对应 CLAUDE 是 **Superpowers 自身仓库的贡献指南**，其 PR 审批条款不适用于 Blue Hour。

`C:/Users/A/.codex/superpowers/CLAUDE.md:69–86` 自身也区分 bootstrap 实际加载和文件存在。结合本会话未提供 Superpowers Skill，结论只能是：**已发现残留/源码目录，当前没有可确认的可调用 Superpowers bootstrap**；不能宣称它已启用。建议未来通过实际客户端可用的正式安装入口修复，再用新会话确认发现与调用，不在游戏中复制该上游贡献规则。

## 4. Skills、AGENTS 与计划的冲突和冗余

### 4.1 项目 Skills 清单与本轮调用

项目 `.agents/skills/` 有 28 个 `SKILL.md`：

| 分组 | 名称 | 本轮处理 |
|---|---|---|
| 文档/协作护栏 | `documentation-freshness-audit`、`delivery-reporting`、`encoding-guard` | 已读取并采用：事实核对、阶段证据、唯一中文报告的编码检查。 |
| 完成/提交护栏 | `task-completion-guard`、`conventional-commit-guard` | 前者已读取评估，其正文明确只读分析通常不触发，未套用实施流程；后者仅发现，未提交、未调用。 |
| Godot | `godot` | 已读取，用作类型、资源与架构参考；没有代码生成或重构。 |
| GitNexus | 子目录中的 `gitnexus-cli`、`gitnexus-debugging`、`gitnexus-exploring`、`gitnexus-guide`、`gitnexus-impact-analysis`、`gitnexus-refactoring` | 已发现；本会话无对应 MCP 工具，未伪造查询、运行 CLI 或重建索引。使用已读取的全局 `gitnexus` 回退规则。 |
| UI 业务护栏 | `ui-copy-boundary-guard`、`web-ui-consistency-guard`、`web-performance-review` | 已发现；不改 UI、不做 React/Web 性能审查，不调用。 |
| 访谈/设计参考 | `grill-me`、`grill-with-docs`、`make-interfaces-feel-better`、`ui-ux-pro-max`、`web-design-engineer` | 已发现；用户目标已明确，不进入访谈、设计或前端实现流程。 |
| GSAP 外部参考 | `gsap-core`、`gsap-frameworks`、`gsap-performance`、`gsap-plugins`、`gsap-react`、`gsap-scrolltrigger`、`gsap-timeline`、`gsap-utils` | 已发现；不适用于本次原生 Godot 基线，不调用。 |

此外，已调用全局 `C:/Users/A/.codex/skills/gitnexus/SKILL.md`，并采用 `C:/Users/A/.codex/skills/.system/openai-docs/SKILL.md` 核对 Codex 发现规则。会话提供的 Skill 名称/描述目录属于“已发现”，完整正文只有显式读取后才算“已加载”，更不等于其所有脚本已经运行。参考 [OpenAI 官方 Skills 指南](https://learn.chatgpt.com/docs/build-skills)。

项目组合上限见 `repo:.agents/skills/INDEX.md:7–13`。本轮以文档事实审计为主，Godot/交付汇报为辅助，编码护栏不计业务上限；全局 GitNexus 和 OpenAI Docs 用于遵守更高层能力发现和配置事实核对。没有因目录中存在几十个 Skills 而叠加实施工作流。

### 4.2 重复、失效与不适用规则

| 编号 | 路径与依据 | 判断与建议 |
|---|---|---|
| AI-01 | `repo:AGENTS.md:1–46` 与 `CLAUDE.md:37–80`；Git 120000 与多行 blob。 | 根入口损坏且 GitNexus 块重复。**更新**入口契约，GitNexus 规则只维护一份。详见 3.3；不是只改首行路径就完事。 |
| AI-02 | 四个 Skills 兼容入口；`INDEX.md:14`。 | 当前不可遍历。**更新**跨平台入口/检出验证，真实 Skills 保留 `.agents/skills` 一份。 |
| AI-03 | `AGENTS.md:15,23` 对第 32/33 节、v3 等描述；当前 `core/campaign.gd:27,444,611` 已为 v5。 | 局部规则混入过期实现快照。**更新**为稳定契约，把版本状态集中到状态文档。 |
| AI-04 | `AGENTS.md:31` 要求每次修改都新增 `docs/reports/YYYY-MM-DD_*_report.md`；`docs/development/docs-cleanup-plan.md:91` 要求普通执行报告改写到根 `.tmp/reports/`。 | 报告位置直接冲突。**合并/更新**为一条明确规则；不能机械要求同任务双份报告。本次用户指定唯一文件，故只写本报告。 |
| AI-05 | `AGENTS.md:24–26`、`repo:CLAUDE.md:28,34`、文档审计 Skill 的验证条款。 | 本次禁止游戏导入/测试/构建优先；纯文档本来也不要求 Windows build。没有修改 Harness/Skill/AGENTS，不触发其专门治理全套检查。只执行已审阅的无写入编码检查与 Git 范围核对。**保留**风险触发规则，明确只读审计豁免。 |
| AI-06 | `.agents/skills/godot/SKILL.md`；全局 `.codex/skills/godot/SKILL.md`、`.agents/skills/godot/SKILL.md`。 | SHA-256 内容比较确认三份完全相同。**合并**维护权；保留项目独有 Godot 约束，通用正文选单一来源。 |
| AI-07 | 项目 `grill-me`、`grill-with-docs` 与 `C:/Users/A/.agents/skills/` 同名文件；项目 GitNexus impact 与全局 `.agents/skills/gitnexus-impact-analysis/`；全局两份 `gitnexus`。 | 上述对应正文内容完全相同，存在双源维护成本。**合并**或显式标记外部镜像，不因重复名字删除未经核实的其他技能。 |
| AI-08 | 会话目录还显示两套 `code-review`、`codebase-design`、`prototype`、`encoding-guard`、`gitnexus-*`、多组 Figma/Godot/UI Skills。 | 已发现名称/职责重叠；未逐一读取全部正文，不能判定全是重复或失效。**更新**路由来源，按实际内容比对后处理，不本轮批删全局工具。 |
| AI-09 | `.agents/skills/godot/SKILL.md:41–58,167–190` 将部分偏好写成编译禁令；含 `emit_signal`、字符串状态、单行语句等。 | `emit_signal()` 仍见 [Godot 官方 Signal 文档](https://docs.godotengine.org/en/stable/classes/class_signal.html)。应区分 API 移除、弃用、项目风格和架构偏好；不能把合法旧写法当当前编译失败。**更新**分类，保留 typed GDScript 等有益建议。 |
| AI-10 | `godot` Skill 的 2D/CharacterBody 模板与 `survivors/survivor.gd:1,203–261` 的 Node3D 自定义运动；GSAP/Web Skills。 | 通用模板不应驱动现有架构重写；Web URL/loading/React 规则只管 Web。**保留但限定触发**，Godot 任务不自动套用 Web 组合。 |
| AI-11 | `repo:.agents/skills/INDEX.md` 未列已存在的 `godot` 与六个 GitNexus 子 Skill。 | “唯一真源”索引不完整。**更新**索引而非复制更多 Skill。检查的 Godot 引用参考文件存在，没有确认这些参考文件已失效。 |
| AI-12 | 根 GitNexus 块要求 query/impact，实际无可调用 GitNexus MCP。历史 `docs/reports/2026-09-24_survivor_animation_phase_3_batch_reuse_report.md:75` 还记载 GDScript impact 为 UNKNOWN。 | 工具/语言覆盖不能从索引符号数推断。**更新**可用性、GDScript 支持与回退说明；本轮未修改符号、未提交，不需要伪造 impact/detect_changes。 |

### 4.3 历史计划、设计目标和实现事实

游戏 `docs/` 当前有 212 个 Markdown，其中 147 个仍在 docs 根目录，21 个在 `docs/reports/`。它们不是同一种证据。

| 文档 | 正确定位 | 与当前实现的核对 |
|---|---|---|
| `PROJECT_CONTEXT.md:3–6`，共 1,643 行 | 2026-09-08 审阅的产品方向和研究；含正式版设想。 | 第 22 节房间、第 23 节双通关路线是目标；当前 Campaign 是五日结束条件，不能据此认定设施、Boss 或第二路线已做。建议**保留并缩短默认读取入口**。 |
| `docs/PLAN.md`，共 1,604 行 | 持续累积的阶段日志与局部状态。 | 同时含已交付、待人工验证、未实施建议和被后续覆盖的 FAIL/PASS。2026-09-24 动画、武器更新不能覆盖 E03/E05 的缺口。建议**提炼当前状态，历史归档**，不继续执行旧待办。 |
| `repo:docs/plans/README.md:3–11` | 根临时活跃计划索引。 | 当前写“暂无”，不代表 Blue Hour 没有历史 Plan，也不代表本轮需要创建新实施计划。**保留**职责边界。 |
| `docs/SEARCH_COMMAND_OWNERSHIP_REFACTOR_PLAN.md:4,45–58,130–132` | 标记“已实施，待交付报告归档”的历史计划。 | 计划要求正式 Town 不再从 selected_search_member 推断 worker；当前 `mission.gd:817–820` 仍有该回退。显式 caller 传参已在 `squad_input.gd:85` 存在。应标注为**部分落地**，归档前说明兼容保留，不能整体宣称严格 API 已实施。 |
| `docs/development/roadmap.md:3`、`docs/design/game-design.md:3–15` | 当前摘要。 | 仍称固定城区与完整归航循环；与默认 Town 及本报告 P1-01 不符。建议**更新**摘要，明确旧地图能力与正式入口能力。 |
| `docs/design/camp.md:5–8` | 营地行为描述。 | 当前新版 HUD 没有完整交易/出发演出接线，见 P1-03；不能用该设计文档代替入口事实。**更新**。 |
| `docs/development/docs-cleanup-plan.md:9–24,28–36,42–51,71–91` | 旧治理计划/执行记录。 | 同文件把 asset-system、asset-naming 同时列入 canonical 和 DELETE；含“文件→同文件”的迁移映射，旧计数也不再适用于当前目录。**归档**历史，撤销其作为当前批删指令的资格。 |
| `docs/development/project-structure-governance-report.md:12,24,28–39` | 一次治理快照。 | 有未改场景/UID、实体操作 0 的范围说明，也有 import 清理、历史计数；须按原范围理解。**保留历史证据/归档**，不把当时工作区描述套到今日。 |
| `docs/EXPEDITION_INTEGRATION_E00_RUNTIME_BRIDGE.md:3–8,35` | E00 当时边界。 | 后续 E01/E02 和小地图已接入；“NOT STARTED”与 path 空的文字是 E00 快照，不是今天事实。**保留并链接后续状态**。 |
| `docs/EXPEDITION_SEARCH_RUNTIME_REPORT.md:3–5`、`docs/EXPEDITION_RUNTIME_PERFORMANCE_P02_REPORT.md:6–9` | 搜索/性能专项历史证据。 | 其 E03 未开始也已被部分 AmbientThreat 接入推进；仍不能据此判定完整敌人/夜晚/撤离已实现。**更新当前汇总，保留阶段原文**。 |
| `docs/audit/weapon/*` 与 `docs/reports/*weapon*` | 专项分析正文与交付索引。 | 抽查 weapon data contract、contract freeze 配对，交付报告链接到详细正文，内容并非完全副本。建议**合并入口而非按名称删重**。 |

入口失效链接已静态确认：`README.md:5` → `docs/CAMP_INTERACTION_V1.md`，24 行 → `docs/COMBAT_ANIMATION_FOUNDATION.md`，26 行 → `docs/MISSION_LOCOMOTION_STYLE.md`；28 行引用的本地探索 HTML 也不存在。`docs/PLAN.md:946,983` 分别引用缺失的 `ENM_001_PHASE_2A_0B_1_RUNTIME_INTEGRATION_GATE_REPORT.md` 和 `CAMP_CORE_PROPS_PLACEMENT_CORRECTION_PASS_01A.md`。建议**更新或标记历史不可用**，不创建空文档掩盖缺失。

## 5. 各游戏系统当前真实状态

### 5.1 主流程、场景与跨日

| 能力 | 当前状态 | 当前代码证据及边界 |
|---|---|---|
| 主菜单、新游戏与确认覆盖 | 已实现但尚未验证 | `core/main.gd:345–405,723–761`；确认 specialization、保存成功后进营地。动画/焦点/覆盖确认仍待原生验证。 |
| 开局成员 | 已实现且有静态验证证据 | `data/new_run.tres:5–7` 起始数 2，池也只有夏知遥、苏晚星两人；`campaign.gd:35–54` 无放回抽取。当前随机影响顺序，不会从全部 12 人随机选出不同二人组合。 |
| 今日行动选择与队伍草稿 | 已实现但尚未验证 | `main.gd:313–343,509–543`；`today_action_screen.gd:24–27,71–78`。保存 start_action 后加载；三种行为 Resource 来自 `catalog.gd:50–54`。 |
| 分阶段加载和 Ready Gate | 已实现但尚未验证 | `main.gd:545–614,616–650`；导航、搜索注册、小地图、幸存者、HUD、呈现帧门禁及 15 秒超时；失败回菜单。不能用加载完成证明游戏闭环。 |
| 正式 Town 的搜索与移动 | 已实现但尚未验证 | `mission.gd:140–174,255–267,337–359`；导航就绪才开命令。 |
| 正式 Town 昼夜、全灭、撤离结束 | 部分实现，正式推进缺失 | Town 分支 359 行返回，绕过 370–404 行；有 clock/按钮/撤离方法，但不形成正常终局，见 P1-01。 |
| 旧地图战斗—搜索—撤离 | 已实现但尚未验证 | `mission.gd:360–406,1131–1199`；大量 flow fixture 使用默认 FIXED_LEGACY。不能外推到正式 Town。 |
| 结算、扣粮、减员、五日结束 | 规则已实现但尚未验证；正式闭环部分实现 | `campaign.gd:302–369`；`day_loop.tres:7–10`。once-only status、防全灭物资入账、饥饿与第五日 won 均有规则；正式 Town 结束入口和 ended 界面有缺口。 |

### 5.2 幸存者数据、移动、指令与动画

- **身份数据已实现但尚未验证。** `data/catalog.gd:3–43` 注册 12 名幸存者、12 份 Profile、12 个 Trait；`SurvivorDefinition` 在 `data/survivor_definition.gd:1–34` 持有 `survivor_id`、装备、Trait，并映射父类模型/头像字段。`campaign.gd:46–52` 正常 Run 使用 `crew:*` 成员键，roster 的 template 再指向内容 ID；不能把实例键、旧 template ID 和 `SUR_*` 三者混用。
- **移动已实现但尚未验证。** `survivors/survivor.gd:119–169,203–279` 使用 Node3D 路径运动、加减速、1/120 秒子步、实际地表投影和模型插值；并非 CharacterBody3D 控制器。Town 导航/编队与旧 City 的路径提供者不同，必须分别验收入口、路边、建筑和队形，不凭通用 Skill 改架构。
- **指令已实现但尚未验证。** `missions/squad_input.gd:14–35,44–115` 处理持续跟随、Ctrl 指向、X/F/R/E、相机与松键；`mission.gd:615–624` 有失焦/退出释放。`mission.gd:697–754` 排除室内、已搜索和上车成员，只替换允许覆盖的任务；显式搜索 worker 与兼容选择回退仍并存。
- **共享动画管线已实现但尚未验证。** `survivor.gd:70–85` 对正式 Definition 选 Expedition controller，其他兼容对象选旧 controller；`survivor_expedition_animation_controller.gd:70–118` 建图、绑定瞄准/支撑手及开火换弹信号，119–138 行处理 Hit/Death。`survivor_animation_controller.gd:44–86` 仍有公共 Idle/Walk/Run 图。两套不是可直接判定无用的重复文件，需按 Definition/fixture/营地消费者区分。
- **模型 fallback 与规则不一致。** `survivor.gd:70–87` 在正式模型不可加载时退回程序化 body，并在初始化动画失败时关闭动画。它有容错价值，但会掩盖正式资源绑定问题；与 `AGENTS.md:34` 禁止临时 fallback 覆盖正式数据的要求应明确划界。建议正式数据验证报错、开发占位仅显式启用，当前不改。
- **XP/等级基础已实现但尚未验证。** `campaign.gd:105–143` 自动跨阈值升级；`data/survivor_progression.gd:13–20` 为 5 级、搜索/击杀/完成/撤离事件经验。游戏搜索完成 `search_task.gd:178`、敌人回收 `mission.gd:1040–1048` 会去重发经验。运行角色的 talent 在 `mission.gd:210` 出勤装配时取值；未找到正常升级后自动调用 `apply_trait` 的链路（321 行是 Debug 换装路径），当局升级是否应立即改变 Trait 效果需明确并验证。正式结算经验受 P1-01 影响。
- **招募仅部分实现。** `survivor_roster_manager.gd:19–22,36–62` 有 LOCKED/DISCOVERED/RECRUITED 和默认 SUR_001/002；`campaign.gd:60–70` 仅更新 ownership。生产玩法未找到调用 discover/recruit 的营救事件，招募也不会自动创建 `data.members`、roster 实例与装备。所有已招募 UI 与当前 Run 存活/出战名单是不同集合，不能把“头像出现”当成可出战新成员。
- **Aura/周期效果已实现但尚未验证。** `core/trait_runtime.gd:5`、`aura_runtime.gd:10–38`、`periodic_effect_runtime.gd:19–50` 及 Mission 的注册、事件处理形成数据驱动链；`data/traits/morale_boost.tres:11–17` 已有周期暴击率效果。旧测试仍把该类角色要求为 data-only 的断言存在，不能据其失败撤回新实现。

### 5.3 武器、装备、拾取与战斗

| 能力 | 状态与证据 |
|---|---|
| 武器模板与个体 | 已实现但尚未验证。`data/weapon_registry.gd:4–27` 注册 8 类武器；`weapon_instance.gd:7–49` 独立 UID、kind、品质、modifier、升级字段。`core/equipment.gd:76–101` 派生模板副本，不直接改共享定义。 |
| 换装/转交/商店 | 底层已实现，正式营地交互部分实现。`campaign.gd:254–280` 用 UID 转交且避免两人占同一把；`main.gd:439–460` 保存及回滚入口存在，新 HUD 未接完。 |
| 自动/指向/近战与子弹 | 已实现但尚未验证。统一 `weapon_combat_controller.gd:41–81` → AttackSpec → InstantHitResolver → HitEvent → DamageResolver；包含弹匣、换弹、散布、霰弹、穿透、击退、噪声及 VFX。当前使用几何瞬时命中，不是持续飞行的物理弹丸。 |
| 墙体与伤害 | `instant_hit_resolver.gd:24–50` 查射线方向距离、碰撞半径及 city.line_clear；`damage_resolver.gd:5–8` 目前只取 event.damage，是扩展边界，不能称完整护甲/元素/状态系统。 |
| 搜索掉落与拾取 | 已实现但尚未验证。`search_task.gd:176–188` 同 tick 标记 searched、解析掉落并生成拾取；`mission.gd:1108–1129` 距离收取；`run_ledger.gd:22–57` 小数余量累计、UID 去重及全灭清空。 |
| 任务奖励差异 | 部分实现。`today_action_data.gd:43–69`、`mission.gd:1072–1106` 支持倍率和语义武器掉落；正式 AmbientThreat 初始数固定 8–12，未消费完整 profile 人口/补充/夜间规则。 |
| 品质资源化 | 部分实现。`weapon_rarity_registry.gd:5–18` 有五档 Resource，但旧 enum 及 `equipment.gd:23–31,46` 仍限制/生成 0–3；Legendary 数据存在不代表能正常掉落、购买和存档。属于兼容迁移边界，不将其误报为现有合法存档损坏。 |
| 升级候选/Apply | 部分实现。`weapon_upgrade_applier.gd:14–38,40–110` 验证后返回副本与历史，未找到生产 UI 调用。`weapon_instance.gd:39–49` 默认不带扩展升级状态，`weapon_inventory.gd:15` 使用默认序列化；不能称 Campaign 升级持久化已完成。 |

`docs/audit/weapon/weapon_upgrade_apply_persistence_phase_w2_4_report.md:27–38` 明确承认尚未迁移 Campaign v5→v6，和当前代码一致，应保留该限制。未来接入前再解决验证、所有嵌套武器字典与原始 v5 备份；本轮不启动迁移。

### 5.4 感染者 AI、噪声与昼夜压力

`enemies/enemy.gd:2,133–195,208–260` 已有 IDLE/WANDER/INVESTIGATE/CHASE/ATTACK/DEAD、FOV/遮挡、声音兴趣、目标记忆、远近感知节流与路径刷新。357–364 行攻击结算重新检查目标、距离、遮挡；315–327 行死亡隐藏并关闭碰撞。`infected_animation_controller.gd:20–40` 只有 Idle/Walk/Chase 接口；攻击、受击、死亡完整专用动作链不能由三段移动动画推出。

关键补充：**正式 Town 确有敌人运行实现**。`ui/mission_hud.gd:100–107` 创建 Mission 子节点 `AmbientThreatRuntime`；`encounter/ambient_threat_runtime.gd:24–59,61–96` 导航就绪后生成 8–12 个普通感染者，36–52 行独立 tick 敌人、Noise、回收，98–138 行添加搜索噪声。这覆盖了部分 E03；旧报告“E03 NOT STARTED”已不是完整现状。

但它不推进 Mission 时钟/夜晚导演，也不遵守 `mission.time_scale`，且依赖 HUD 的创建副作用。结论是 **AI 单体已实现但待验证；正式遭遇/时间/暂停的整合为部分实现**，而非“没有感染者”或“完整 E03 已完成”。

`time/mission_clock.gd:16–28,61–92` 本身有 Day→Blue Hour→Night、短预警、随停留升级及倍率，`mission.gd:370–379` 的消费在旧地图分支。正式 Town 是否能看到正常夜晚进度不能靠 HUD phase 标签证明。

### 5.5 营地、HUD、地图与搜刮

- **营地 3D 与漫游已实现但尚未验证。** `camp/camp_main.gd:21–41` 按 Campaign 成员替换 4 个预设站位并建立 ambient behavior；`ui/shelter_view.gd:16–40,71–89` 管理场景、选人和设施射线。当前 `main.gd:56–65` 只连接 member_selected，没有连接 facility_selected；设施点击描述不等于业务面板可用。
- **Camp HUD 是局部已接线、局部展示。** `camp_hud_root.gd:14–37` 接好 roster、详情、出勤和菜单。资源栏 `.tscn:90,138` 固定食物 10、废料 60，而实际初始值在 `day_loop.tres:8`、`campaign.gd:27` 为食物 6、废料 0。`time_status.tscn:131` 固定 10:24。测试 `camp_resource_bar_runtime.gd:77` 本身也说明是 fixed display，不证明动态资源绑定。
- **M06/M07 不是正式效果管理。** `camp_action_rail.gd:2,23–25` 只发局部信号；`loadout_panel.gd:26–34,66–69` 只展示传入数组/发 slot_requested。正式根没有连接这些信号、没有填入 Campaign effects。M05 view model 的 action_states 也明确 disabled/locked，见 `survivor_roster_adapter.gd:109–115`。它的四项 attributes 来源还是同一 HP 比例，并非四项独立战斗属性。
- **Expedition HUD 已实现但尚未验证。** `mission_hud.gd:115–155,508–531` 装配角色、地点、搜索提示、技能、返回巴士与小地图；`_sync_pause:859–863` 只修改 Mission time_scale/input，未冻结独立敌人循环。HUD 绑定还改变敌人系统的运行状态，测试必须包含真实 HUD。
- **Town 地图/导航/搜索已实现但尚未验证。** `town_runtime_adapter.gd:30–68`、`town_navigation.gd:25–89,136–200`、`town_search_registry.gd:20–60,140–190` 提供分段构建、地表/碰撞栅格、路径、后台入口解析和优先解析；`mission.gd:520–522` 在运行帧推进解析。已开始搜索、续搜、取消保留进度等共享 `SearchTask`，没有另起一套活动任务状态。
- **探索/小地图已实现但尚未验证。** `maps/exploration.gd:98–137`、`ui/expedition/minimap.gd:98–125,216–294,352–513` 有视野、记忆、静态世界层、动态 marker、聚类与发现提示。20Hz marker 更新和静态缓存是当前实现，像素级遮挡、缩放稳定性需原生验收。
- **车辆与目标差异不可混同。** Registry 只注册显式 lootable 车辆，拒绝纯装饰车辆，见 `town_search_registry.gd:37–57`；Adapter 的 `vehicle_search_points`/`enemy_spawn_zones` 仍是 NOT_AVAILABLE_YET（172 行），不能把该元数据当完整车辆/刷怪接口。生成类型 `rescue` 不等于已经实现营救，`today_action_data.gd:16` 已说明。
- **设施、正式营救/特殊任务、长期解锁与侵蚀、第二通关路线：尚未实现于核对的正式流程。** 基础 Resource、研究章节、按钮和 Trait 机制不改变这一结论。

### 5.6 保存、资源管理和性能

**保存基础已实现但尚未运行验证。** `save_store.gd:7–33` 验证 JSON envelope 和 SHA-256，主档无效时恢复 bak；35–79 行临时写入、flush、校验、备份轮转及失败恢复。`campaign.gd:428–492,583–618` 校验并迁移 v1–v5，行动中重启改为 shelter。`main.gd:422–437` 对传入 before 快照回滚，705–718 行先保存 pending 再尝试 commit_day；这是已有事务保护，不能说工程“没有保存”。磁盘满、权限、进程中断和历史玩家样本兼容均待隔离测试。

**保存边界待澄清。** `campaign.gd:105–143` 在行动中即更新内存 XP；`main.gd:184–187` 放弃行动回菜单没有恢复行动前 roster，也没有立即保存。关进程与回菜单再出勤可能保留不同的未结算 XP。当前是否允许这种成长继承缺少明确产品契约，标为信息不足/待运行验证，不直接判为已复现刷经验漏洞。

**资源静态检查有有限的正向证据。** 排除 `.godot/`、build、test-output 和独立 art QA 工程，对 `.gd/.tscn/.tres/.godot/.gdshader` 中非格式化的字面 `load/preload`、ext_resource 和 main_scene 做存在性检查，1,711 次命中中未发现缺失目标。该结果不检查 UID、动态拼接、导入缓存、GLB 内部节点或导出包，所以不是“所有引用有效”。`public_idle/walking/running.tres` 的 `metadata/source_animation = res://sources/...` 是生产溯源元数据，不能当成运行 load 失败；art 子工程路径也应按各自 res 根解释。

`ui/expedition/hud_skin.gd:95–110` 仍含旧 `assets/ui/expedition/legacy/hud_compat/` 回退；当前该目录不存在。主资源缺失时会返回 null。该动态容错与正式资源规范不一致，是待清理候选，**不是当前所有 HUD 图片都丢失的证据**。

**性能机制已实现，当前性能信息不足。** Town 导航有查询统计、Search Registry 每帧默认 6ms 预算，小地图有静态缓存与 20Hz 动态更新；`runtime_load_profile.gd:11–22` 记录加载阶段，`tests/expedition_runtime_performance.gd:175–194` 可采样帧、process/physics、draw calls 等。旧 P01/P02 的 RTX 3060、指定 seed、VSync off 数据不外推为本机/当前完整遭遇压力结果。正式敌人接入后还需重测暂停、尸体/池、Noise 和多人搜索组合。

`export_presets.cfg:11–14` 使用 all_resources，排除 art/tests/docs 等，角色 source 只显式列出 Xia/Su。现存 EXE 大小为 1,730,183,136 字节；全资源导出及其他 source/legacy 是否造成不必要打包需检查实际包内容，现有大小只能作为体积基线，不能证明每份源文件都已打包或可安全删除。

## 6. P0 / P1 / P2 / P3 风险与证据

分级：P0 为已确认会大范围毁坏成果/数据的紧急问题；P1 为正式核心路径或发布门禁阻断；P2 为局部正确性、未来集成/维护风险；P3 为低影响整理。严重度不等于本轮已经运行复现。

### 6.1 P0

**未确认 P0。** 未执行引擎、未读玩家存档，也未做破坏性故障注入；这不构成“已证明无数据丢失风险”。

### 6.2 P1

| ID | 触发、证据与影响 | 根因/后续验证 |
|---|---|---|
| P1-01 正式归航闭环中断 | `main.gd:683` 默认 Town；`mission.gd:337–359` 提前返回；Clock、living 空判定和 extraction 更新只在 370–404 行。`command_extract:1131` 只设状态，实际完成在 `_update_extraction:1150–1174` → `_finish:1176`。 | Provider 接入只搬了搜索/运动推进，通用终局仍锁在旧分支。正式入口等待时钟变化、全灭和所有人到巴士后完成结算均待运行验证；不能靠旧 day_loop_flow PASS 关闭问题。 |
| P1-02 暂停时感染者仍可行动/攻击 | HUD `mission_hud.gd:859–863` 只设 Mission.time_scale=0；Mission 324 行因此停止；AmbientThreat `36–52` 却只检查 active/runtime_ready，使用未缩放 delta，继续 enemy.tick，敌人 `enemy.gd:357–362` 可扣血。 | 两套推进时钟，未共享暂停/倍速契约。需真实 HUD + 接敌 + Space/Esc/设置/Debug 的暂停等待验证，同时检查倍速一致性。该风险也会使只手动 tick Mission 的测试遗漏敌人变化。 |
| P1-03 新营地 HUD 未接回关键玩法 | `main.gd:279–285` 只 configure_roster/三信号；`camp_hud_root.gd:14–37` 无旧交易接口；M06/M07 只发本地 signal；`main.gd:63` 没有 facility_selected 连接。旧 main 471/483/486/507 行还调用 `show_effects/close_context/show_effect_detail`，当前根无这些方法。 | 表现组件迁移没有同步业务装配。玩家正常路径缺少换装/购买/训练/效果管理入口；内部旧入口一旦调用可触发缺失方法。独立场景或底层事务测试不能证明可用。另，`camp_main.gd:43–46` 出发表现方法存在，但当前 start_mission 不调用它，设计所述上车演出也不能计为正式已接通。 |
| P1-04 通关/失败状态无界面 | `campaign.gd:361–364` 可产生 lost/won；`main.gd:266–286` 对两者清场、设 state=ended，却只在 shelter 分支创建 UI。`_input:151–175` 也没有 ended 返回入口。 | 结束页在新版营地入口更换后没有装配。旧地图完成第五日/全灭，或读取 ended 存档点继续，静态路径会落到无屏幕状态；原生表现待运行验证。 |
| P1-05 发布回归与当前 UI 契约失配 | `run.ps1:87` 在 test 模式调用 `camp_departure.gd`；该脚本 34–42 行查旧文本目标。`tests/camp_ui_runtime.gd:29,71,114,126` 仍访问当前 HUD 不具备的 member_buttons。现存 `build/BUILD-INFO.json` 明示 fullBuildPassed=false。 | 测试断言、正式 UI 和旧演出契约不一致；不能绕过失败将 direct export 当发布通过。先辨认产品应有能力和废弃控件，再重建符合当前契约的场景级验收。 |
| P1-06 根 AI 指令入口损坏 | `repo:AGENTS.md` 在 Git 为链接，却存多行非目标正文；Windows 实体又只是文本。`CLAUDE.md:3` 声称的唯一正文链接实际不成立；本会话需显式读取补全。 | 符号链接 blob 被追加规则与跨平台检出共同作用。未来客户端可能只获得 GitNexus 块而丢失保护规则。证据已静态确认；修复需单独任务，不更改本轮代码/配置。 |

### 6.3 P2

| ID | 证据与风险 | 建议 |
|---|---|---|
| P2-01 营地资源/时间是假定值 | `resource_bar.tscn:90,138` 显示 10/60；实际新 Run 6/0；`time_status.tscn:131` 显示 10:24；根仅绑定 roster。 | 明确展示稿与产品 HUD 的边界，接入 Campaign 并验证改变数据后显示同步；不能只跑固定 COPY 断言。 |
| P2-02 敌人由 HUD 装配并硬编码人口 | `mission_hud.gd:100–107`、`ambient_threat_runtime.gd:5–10,54–83`。无 HUD 的 Town fixture 与真实 App 不同；不同天/任务默认仍套 day-one 数量。 | 将业务生命周期与表现创建边界收敛；验证 profile 的低/中/高敌情、补充和夜间消费。本轮只给建议，不重构。 |
| P2-03 命名/状态接口残留 | Adapter `172` 仍提供 gameplay_available=false、NOT_AVAILABLE_YET；实际 Registry/敌人已有部分实现。搜索重构 Plan 与 `mission.gd:817–820` 兼容回退也不一致。 | 更新契约或显式标记保留字段，避免后续消费者按过期旗标禁用已实现功能；不简单删掉兼容代码。 |
| P2-04 行动时长恒为初始值 | `mission.gd:44` 初始化 action_elapsed；全文件仅 1196 行读取它，没有推进赋值。 | 结算秒数会沿此路径保持 0；待运行确认 UI/统计影响，再确定与暂停/倍速共用的时钟口径。 |
| P2-05 武器升级/Legendary 仅数据基础 | `weapon_instance.gd:39–49` 默认省略升级字段，`weapon_inventory.gd:15` 使用默认形式，`equipment.gd:23–24` 拒绝 tier 4。 | UI 接入前完成迁移方案、输入校验和完整保存往返；保留 W2-4 的未完成说明，不能把额外字段存在当成持久化完成。 |
| P2-06 规则/文档漂移 | AI-03/04/09/11，roadmap 固定城区/全闭环，旧链接缺失。 | 先解决真源及入口冲突；历史状态带日期，不用旧 PASS 覆盖当前事实。 |
| P2-07 测试目录混入生成工具 | `tests/build_survivor_animation_library.gd:32` 会写正式 assets；`bake_camp_navigation.gd`、build_infected 工具也在 tests 下。 | 不按 tests/*.gd 全部批跑。未来建立静态校验/规则/原生/生成分类，运行前审阅输出路径。 |
| P2-08 覆盖入口不完整 | test 模式 71 次/69 个唯一脚本，未包括 `ambient_threat_runtime.gd`、`expedition_search.gd`、`runtime_loading_gate.gd`、`save_catalog_compatibility.gd` 等；旧五日 fixture 用 FIXED_LEGACY。 | 先补正式 App 跨系统验证矩阵，不用测试脚本总数或历史检查数代替关键路径覆盖。 |
| P2-09 资源容错与发布体积 | `survivor.gd:70–87`、`hud_skin.gd:95–110`；all_resources 导出与 1.73GB 现存包。 | 动态路径显式登记，正式缺失可见报错；包内容和冷启动在隔离环境量测后再决定资源治理，不按静态未引用删除。 |

未结算 XP 在回菜单/重启之间的策略、地图重试是否应保持完整布局、全部旧存档兼容与实际性能，均先列为待确认/待验证；不把合理设计选项伪装成已确认 Bug。

### 6.4 P3

- Skills 同名/同文镜像、28 项中缺少索引登记：见 AI-06～11；建议合并维护源与路由，不新增更多通用 Skill。
- `run.ps1:94–95,127–128` 重复执行 `minimap_survivor_marker_acceptance.gd`、`town_phase_1_2_acceptance.gd`；保留一处入口即可，未证明当前重复有必要。
- `docs/development/docs-cleanup-plan.md:28–36` 自指迁移与旧计数；`docs/README.md:13–15` 的临时审计产物边界仍未收口。建议归档已结束治理记录，不恢复旧删除计划。
- 新命名规则只禁止“新增”历史后缀（AGENTS:47），所以现存 `LoadingScreenV2.tscn`、`loading_screen_v2.gd` 不应为本次审计顺手重命名；稳定消费者先保留。

## 7. 现有测试能力、历史证据与待运行验证

### 7.1 本轮实际完成的验证

1. 原生 Git 根目录、分支/HEAD、工作区状态、索引链接模式及 `core.symlinks` 的只读核对。
2. 游戏与 AI 配置路径盘点，28 个项目 Skills 清单、选定内容哈希比较、中央入口链接存在性核对。
3. 1,711 次限定字面 Godot 依赖路径存在性检查，未发现缺失；边界见 5.6。
4. 读取当前分支、HUD 接线、保存与测试脚本，建立系统间静态证据链。
5. 报告写入后的定向编码、文件范围和引用位置复核；不代表游戏测试。

未执行 Godot `--version`、导入、headless、原生截图、录屏、Blender、构建、EXE、pnpm 检查、GitNexus analyze、context:recent、自定义 hooks 或历史开发计划。没有启动服务或游戏进程。

### 7.2 现有执行能力及副作用

| 入口/机制 | 能力 | 为什么本轮不运行 |
|---|---|---|
| `run.ps1:1–19` | 从 GODOT_BIN/PATH/Downloads 定位引擎。 | 不启动引擎；项目声明不代表本机版本已确认。 |
| `run.ps1:20–30,79–82` | import/test/smoke/capture/build 创建 test-output/.gdignore；test 先 headless editor import；检查退出码及 SCRIPT ERROR/ERROR。 | 会写工作区与缓存，不是纯读检查。 |
| `run.ps1:83–153` | 规则、武器、角色、Trait、遭遇、搜索、跨日、效果等；71 次调用、69 个唯一脚本。 | 混有 4 次原生采集调用（129–132 行），不是纯 headless 套件；已知 UI 目标失配。 |
| `run.ps1:155–188` | capture 模式多分辨率原生窗口、合成输入和截图。 | 写 PNG/JSON/日志，且原生窗口和输入影响需隔离。 |
| `tests/expedition_search.gd:28–40,73–90` | 真实 App/Town 搜索、移动、选人、拾取与性能计数专项。 | 测试写本地输出与隔离存档；只手动 tick Mission 的模式还需覆盖 HUD 敌人时钟。 |
| `tests/ambient_threat_runtime.gd:60–88,112–120` | Town 人口、噪声、AI、警戒卡片专项。 | 手动关闭并分别推进两个 physics 循环，不能代替真实暂停/运行调度验收。 |
| `tests/expedition_runtime_performance.gd`、`encounter_performance.gd` | 固定 seed、warmup、运行帧与 CPU/绘制计数；后者含不同敌人人口诊断。 | 有写入且不能与录制/导入并行量测；旧环境性能不代表当前目标机。 |
| `tests/survivor_run_death_capture.gd:28–54,119–127` | 真实 Town、HUD、Run/Death 截图与 JSON。 | invincible、固定角色/武器和关闭输入的定向 fixture，不是完整任务/死亡结算验收。 |
| `tests/expedition_combat_capture.gd:42–80,250–260` | 固定场景摆敌、相机、连续 PNG 帧与 HitEvent/VFX 记录。 | 使用无敌、关输入、关闭部分视觉/补光及摆放敌人；只能验证指定画面/命中，不能证明自然遭遇/补给/撤离闭环。 |
| Godot MovieWriter / ffmpeg | 旧性能报告说明 MovieWriter 录原生视频；其他脚本输出 PNG，再用 ffmpeg 合成 MP4。 | 固定帧录制改变时序，视频不是性能基准；ffmpeg 是否可用本轮未执行确认。 |
| `run.ps1:190–295`、`art/verify_export.ps1` | 回归后 Windows Release；复制到独立目录检查 headless/native；挂载 EXE main-pack 检查内嵌资源。 | 创建/覆盖 EXE、输出和 metadata，还调用其他脚本；本轮禁止。启动 120 帧只证明启动，不证明一日或五日闭环。 |
| `tests/build_survivor_animation_library.gd:32`、导航烘焙等 | 生成正式 Resource。 | 明确是写源资源的工具，绝不因位于 tests 就自动运行。 |
| 根 package/Lefthook | `repo:package.json:17–24` 文档/Harness 检查；`lefthook.yml:40–41` staged 命名检查。 | 不提交，不触发钩子；不自动运行未审阅治理脚本，也不将 Web CI 成功当 Godot 通过。 |

### 7.3 现存证据能证明什么

- `build/BlueHourHomeward.exe` 存在，文件大小与 `build/BUILD-INFO.json` 记录一致；metadata 的 builtAt 为 **2026-09-24T21:09:02+08:00**，scope 为 Survivor Animation Phase 3 Batch Reuse，`directExportPassed=true`、`fullBuildPassed=false`。本轮未重算 EXE 哈希、未启动它，也不能确认其包含今日全部源码或全量测试已绿。
- 同一 metadata 记录两个历史失败：headless `camp_departure.gd` 找不到目标并超时；`remaining_survivor_batch.gd` 对 cheng_mo Trait 仍要求 data-only。代码的旧 UI 访问及过期断言仍可见。它们是可追溯的历史失败证据，实际当前重跑结果仍待验证。
- `test-output/survivor-animation/batch/batch-qa.json` 仍存在，内容为 1,417 checks、failures 空；对应目录仍有多张 PNG。`test-output/survivor-animation/expedition-runtime/runtime.json` 为 33 checks，`run_death_final_runtime.json` 为 12 checks，failures 均空。这只能确认**旧产物存在及其自报结果**，不能确认本轮运行或二进制与 HEAD 完全一致。
- `docs/development/runtime-baseline.md:11,32,46,63` 引用的四个文件目前不存在：`test-output/menu/title-1919x1080.png`、`test-output/camp-ui-review/01-camp-hud.png`、`test-output/expedition-ui-1-1/01_expedition_normal.png`、`test-output/enm_001_runtime/expedition_10_idle.png`。其中 38–39 行还一面标 PASS、一面注明 today_action 未输出完整结果，76 行承认全量未跑完。建议降为历史记录，补证前不得用作验收门禁。
- 本地 `test-output/` 有 17,057 个文件，其中 58 个 MP4、5 个 AVI、3,925 个 PNG、12,084 个 JPG；属于忽略的混合历史产物，数量不等于覆盖率。本轮没有批量观看或逐张审美验收。

### 7.4 安全执行方案——仅提案，尚未执行

未来验证需要写缓存和存档，应另获运行授权后，在 **原工作区之外的隔离副本** 执行：

1. 固定本报告 HEAD，记录当时最新 Git 状态；从跟踪文件建立 Blue Hour 工程副本。若后续有未提交改动，另列覆盖清单和哈希；不 stash/reset 原工作区。副本不携带玩家档、密钥、本地配置、hooks、`.git`、已有 build/test-output/.godot。保留测试所需正式资源，独立 art QA 工程按专项选择。
2. 给子进程设置独立 APPDATA/LOCALAPPDATA 及需要的 XDG 数据/配置根，使即便遗漏 `--test-save` 的脚本也不能写玩家 user://。继续强制 `user://test-runs/` 和每次运行唯一 ID。原用户存档只做路径隔离，不读写其内容。
3. 先审阅将执行的 run.ps1、调用的 GDScript、art/verify_export 和其输出路径；`tests/*.gd` 不允许通配批跑。引擎用明确 Godot 4.7.x 路径和匹配模板；导入、缓存、日志、截图、生成 Resource 只落副本。
4. 首先做副本 import/解析、内容校验、保存往返和小范围规则测试；再做默认 Medium Town 的真实 App/HUD 闭环。无新增测试脚本的情况下，对缺少的场景只能人工验收或记录未覆盖，不能用手动调用私有终局方法伪装正常闭环。
5. 原生窗口采用隐藏/屏幕外方式，只控制本轮进程与合成输入；不接管或结束用户现有 Godot/Blender/游戏。截图至少 1600×900，保留默认/菜单/搜索/遇敌/撤离/结算状态；动画另外录中断与连续操作。
6. 性能单独运行，记录 GPU、驱动、引擎、renderer、分辨率、VSync、seed、warmup、采样方法、P95/max。录屏和截图不用于 FPS 结论。
7. 完整 gate 通过后才在副本导出；独立目录原生启动、内嵌资源及真实任务验收分开记录。原目录 `build/BlueHourHomeward.exe` 不覆盖。报告输出绑定 commit、测试命令、环境、退出码、失败和媒体；最后只读复查原工作区未变。

### 7.5 待运行验证清单

| 顺序 | 待验证项目 | 必须观察的通过条件 |
|---|---|---|
| 1 | Godot 4.7.x 全新副本导入/解析及正式资源绑定 | 无脚本错误、缺失资源/UID；不靠旧缓存或 fallback 使表面启动成功。 |
| 2 | 默认 App → 今日行动 → Town → 搜索/拾取 → 归航 → 结算 | 通过正常 UI/输入完成，时钟推进，活人全到巴士后只结算一次；不可直接调用 `_finish` 代替。 |
| 3 | Town 接敌后 Space/Esc/设置/Debug 暂停、恢复与倍速 | 暂停等待时敌人位置、windup、HP、技能计时均按契约冻结；恢复无额外攻击。 |
| 4 | 全员阵亡、单人出战、留守成员、缺粮、第五日 | 失去出战小队后的 Run 规则明确，只有当前应存活者保留；won/lost 有可退出/新开入口。 |
| 5 | 营地换装、转交、训练、购买、道具/技能、资源刷新 | 从可见入口触发，Campaign/显示/存档一致；保存失败回滚；不是仅 fixture 调用底层方法。 |
| 6 | 保存 v1–v5、主档损坏恢复、pending 重入、写入失败 | 保留有效备份、身份及一次入账；不复活阵亡者、不换 UID；XP 放弃策略与产品定义一致。 |
| 7 | 搜索拥有权、并行、改派、取消、自卫、退出建筑 | 一人一任务、一目标一 owner，其他成员不被抢走，进度及奖励一次性；按真实 HUD 敌人调度测试。 |
| 8 | 全 12 人角色模型/头像/动画、多武器和真实地表 | Definition 绑定正确；Run/Death/Hit/换弹、握把与脚接地可见验收；历史批量动画 PASS 不替代。 |
| 9 | Town 多 seed、后台解析、小地图、profile 与长时间运行 | 失败 seed 可复现，空入口/不可达正确拒绝，敌情/收益差异真实消费；内存/节点/池无持续增长。 |
| 10 | 完整测试门禁、导出、独立 EXE | 全量失败真实列出；启动、内嵌资源、UI 流程、整日闭环分别验证，记录与源码对应。 |

## 8. AI 项目知识库最小化整理建议

以下是后续整理方案，**未执行保留之外的任何变更**，也不授权继续旧 Plan。

| 资料 | 建议动作 | 最小目标 |
|---|---|---|
| 全局 AGENTS | 保留；精简为跨项目原则与能力发现/回退。 | 不带游戏阶段状态，不把缺失 Superpowers 当已启用。 |
| 根 AGENTS / CLAUDE | 更新入口，合并重复 GitNexus 块。 | 一个可靠的根正文，加可验证的兼容策略；根 AGENTS 不再是多行损坏链接。 |
| Blue Hour AGENTS | 保留并更新。 | 只保留 res 根、平台边界、数据/身份/保存不可破坏约束、验证政策和报告位置；移出 v3/第 32 节等历史快照。无需新增更深 AGENTS。 |
| Skills | 合并通用重复源；更新 INDEX。 | 项目只维护有项目差异的护栏及必要路由；28 个现有 Skills 先明确范围，Web/GSAP 不进入 Godot 默认上下文。不自动新增 Skill。 |
| PROJECT_CONTEXT / CONTEXT | 保留产品目标和术语；更新状态引用。 | 长产品研究按需加载；稳定名词与实例身份说明可直接找到。 |
| docs/README | 更新为导航。 | 当前实现状态、设计目标、验收证据、历史归档各有明确入口，不再让多个文件争称全部事实真源。 |
| roadmap / known-issues / PLAN | 合并“当前状态”的维护责任；历史 PLAN 归档。 | 一张当前系统状态表 + 一个风险列表，逐项带代码与证据日期；当前未完成不埋在 1,604 行日志里。 |
| 设计与架构主题文档 | 保留，修正与代码冲突的现在时。 | 设计说明“应该是什么”；状态表说明“目前做到哪里”；Resource/代码决定实际行为。 |
| reports 与 audit/weapon | 保留独有证据和限制，合并导航；过期重复阶段记录再归档。 | 详细审计与交付索引可互链，不因文件后缀相同就删。 |
| 旧 cleanup-plan、runtime-baseline | 归档/更新证据可用性。 | 撤销旧全局删除模式，缺媒体的 PASS 标历史不可复验；未审阅的 UNKNOWN 不删除。 |
| 本地大体积输出 | 暂保留；之后另议证据保留期限。 | 当前不清理用户成果；未来输出 manifest 绑定 commit/seed/环境/命令，而非只写 PASS。 |

最短可行治理路径是：**修复根指令入口 → 明确一个当前状态入口 → 明确一个验证证据入口 → 历史按日期归档**。先不创建新的知识库目录、AGENTS、Skills 或多套计划文件，也不把本报告扩张成重构任务清单立即执行。

## 9. 后续开发与工程治理优先级

| 优先级 | 工作目标 | 依赖与可审查交付 |
|---|---|---|
| 第一 | 建立隔离验证环境，复现 P1-01/02/04；确认营地实际所需入口。 | 只在副本运行，明确源版本；得到真实失败/通过证据后再开发。 |
| 第二 | 打通默认 Town 的统一暂停、时钟、全灭、撤离和结算。 | 先明确两个 physics 循环的职责与时间契约；验收一日端到端，不以私有方法注入结果代替。 |
| 第三 | 接回营地正式交易、动态 HUD 与结束页；收敛旧测试契约。 | 交易保存失败回滚、角色 ID/武器 UID、死亡/留守名单和 UI 同步；明确旧出发表现是否仍为产品要求。 |
| 第四 | 恢复可信发布门禁。 | 保留合法视觉 fixture，淘汰已废弃节点断言；纳入正式 App/HUD/暂停/存档流程；全量绿后才称完整 Windows build 通过。 |
| 第五 | 最小 AI 治理与当前文档修订。 | P1-06 可与隔离验证并行规划，但实际改动需单独授权；解决链接、Skill 路由、报告位置与状态真源。 |
| 第六 | 扩展前完成数据边界。 | 招募真正进入 Run、武器升级 schema/Legendary、任务差异与放弃 XP 契约；每项单独规格与迁移验证。 |
| 第七 | 性能、资源体积、更多内容。 | 在完整遭遇/昼夜/归航可用后测目标机；再决定池/导航/UI/导出资源治理，最后扩充敌人、设施与长期系统。 |

## 10. 本轮交付与保留事项

- 唯一新增文件：`apps/blue-hour/docs/development/blue_hour_baseline_audit.md`。
- 未修改任何原有代码、资源、配置、Plan 或报告；未删除、移动、重命名，未执行 Git 清理、重置、提交、分支切换或索引重建。
- 无需同步历史 Plan：本轮是用户明确限定的审计，不改变游戏实现或授权旧计划继续；所有整理、修复和运行方案都仅保存在本报告。
- 本轮只有静态核对与报告检查。所有游戏运行、真实操作、视觉、性能、导出及玩家存档故障验证均仍为 **待运行验证**。
