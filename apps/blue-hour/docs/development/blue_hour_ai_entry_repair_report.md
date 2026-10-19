# Blue Hour G0 — Monorepo AI 指令入口修复报告

日期：2026-10-19（Asia/Shanghai）。环境：Windows / PowerShell。

## 1. 交付状态与边界

**工作区入口正文修复完成；Git 索引模式尚未转换，新 Codex 会话加载尚未验证。** 本轮遵守“不自动 Git add、commit、reset 或清理”，因此不能宣称修复已经进入索引或可通过新检出跨平台交付。

依据：[基线审计 P1-06](./blue_hour_baseline_audit.md)。仓库根目录经 `git rev-parse --show-toplevel` 确认为 `D:/my-code/valley-mas`，分支为 `master`，HEAD 为 `8004ebabc6823c1c238045bf5406916879ed134b`。

开始时的 Git 状态只有上一轮留下的未跟踪文件 `apps/blue-hour/docs/development/blue_hour_baseline_audit.md`。本轮保留它，未覆盖、移动或暂存。

本轮只改两个根入口文件，并新增本报告。未修改游戏代码、Godot 场景/资源、Skills、全局或仓库 Codex 配置、历史 Plan、Harness 检查器及其他应用；未运行游戏、导入、构建或历史计划。

## 2. 变更文件

| 文件 | 操作 | 内容 |
|---|---|---|
| [根 AGENTS.md](../../../../AGENTS.md) | 修改 | 将损坏链接目标文本替换为 17 行普通 Markdown；明确读取共享规则、局部规则及 Blue Hour 规则的触发条件，保留必要的 Monorepo 边界。 |
| [根 CLAUDE.md](../../../../CLAUDE.md) | 修改一行 | 将“AGENTS 是兼容软链接”的入口说明改为“普通 Markdown 入口，要求显式读取共享正文”。其他规则逐字保留。 |
| `apps/blue-hour/docs/development/blue_hour_ai_entry_repair_report.md` | 新增 | 本报告，记录证据、验证结果、未暂存模式和新会话验证办法。 |

[Blue Hour AGENTS.md](../../AGENTS.md) 未修改。其数据、保存、角色绑定、平台与验收约束均保持原样。

## 3. 修复前证据：P1-06 确认

### 3.1 Git 与磁盘不是同一层状态

修复前 `git ls-files -s`：

```text
120000 af0b5eec4eee431db05ec505d0cecdea6d75edb1 0 AGENTS.md
100644 60d3756db14820e19f0ac83cf1689683d85f75ee 0 CLAUDE.md
100644 6928059903e2da81727991688d85ce887cffc469 0 apps/blue-hour/AGENTS.md
```

`git config --get core.symlinks` 返回 `false`。磁盘上的根 AGENTS 是可读普通文件，`Get-Item` 没有 LinkType/Target，Python `is_symlink()` 为 false。

Git 中 `120000` 表示符号链接，其 blob 应只存链接目标。实际 `git show HEAD:AGENTS.md` 得到的内容却是：

```text
CLAUDE.md

<!-- gitnexus:start -->
# GitNexus — Code Intelligence
……完整多行 GitNexus 规则……
<!-- gitnexus:end -->
```

因此存在两个不同问题：Windows 在 `core.symlinks=false` 下把链接检出成文本；根链接 blob 本身又已被追加正文，无法作为指向 CLAUDE.md 的链接目标。**只开启符号链接或保留一个文件名占位都不能解决问题。**

### 3.2 原有共享规则完整存在

CLAUDE.md 有完整的 Monorepo 协作正文和 GitNexus 块，游戏局部规则也完整存在。根 AGENTS 的 GitNexus 内容与 CLAUDE 中的对应块重复；没有必要再在 Codex 入口维护第二份全文。

## 4. 采用的最小方案

根 AGENTS 作为普通 UTF-8 Markdown，直接给出可执行的读取流程：

1. 开始仓库任务前，完整读取并遵守根 CLAUDE.md；明确它是 Codex 和 Claude 共用规则正文，且链接不等于已经读取。
2. 按任务范围读取子项目和更深路径的 AGENTS.override.md / AGENTS.md，同层 override 优先；保留用户当次明确要求的优先级。
3. 任务涉及 Blue Hour、蓝时归航或 apps/blue-hour/ 时，在分析或修改前必须读取游戏局部 AGENTS，即使启动 CWD 是 Monorepo 根目录。

读取链为：

```text
AGENTS.md
  → CLAUDE.md
  → apps/blue-hour/AGENTS.md
  → apps/blue-hour/PROJECT_CONTEXT.md（按局部入口读取）
```

根入口还保留三项简短边界：保护已有成果及授权范围、不自动继续历史任务、按实际变更验证并诚实交付。未复制共享 Skills、GitNexus、测试命令表或游戏阶段状态。

CLAUDE.md 仅修正与新入口直接矛盾的一句说明，没有修改 Claude 的实际协作规则。Blue Hour AGENTS 不变；本次交付位置以用户明确指定为准，不再额外生成 docs/reports 或 .tmp/reports 副本，也不更新历史 Plan。

## 5. 验证结果

执行前已审阅三个治理检查脚本和 package.json 对应入口，确认这些检查只读、不触发安装/prepare。本会话无可调用的 GitNexus 工具，使用原生 Git 检查；没有修改代码符号，不涉及 symbol impact，也没有提交。

为避开本机默认的 System32 bash / WSL 入口，执行检查的子进程临时将 `C:/Program Files/Git/bin` 放到 PATH 前面，使用现存 Git Bash；未写入用户环境或任何配置。Python 检查设置 `PYTHONDONTWRITEBYTECODE=1`。

| 检查 | 实际结果 | 证明范围 |
|---|---|---|
| `git diff --no-ext-diff --no-textconv -- AGENTS.md CLAUDE.md` | 已核对 | 根 AGENTS 全文替换，CLAUDE 只改入口说明一行；没有游戏或 Skill 改动。 |
| `git diff --check` | PASS / exit 0 | 已跟踪改动无空白错误。新报告另做定向文本核对。 |
| `git diff --cached --exit-code` | PASS / exit 0 | 暂存区相对 HEAD 无变化。 |
| `git -c core.symlinks=true diff --summary -- AGENTS.md CLAUDE.md` | `mode change 120000 => 100644 AGENTS.md` | 临时按真实工作区类型比较，确认工作区提供的是普通文件；不是已经修改索引的证据。 |
| 同上 `--raw` | 根 AGENTS 为 `T`、CLAUDE 为 `M` | 分别是工作区类型变化和正文变化。 |
| `git ls-files -s` | 根仍为 `120000`，两个 CLAUDE/游戏规则条目不变 | 索引未暂存，旧 blob/模式依然保留。 |
| 路径解析 | PASS | AGENTS 两个 Markdown 链接分别解析到根 CLAUDE 与游戏 AGENTS，后续 PROJECT_CONTEXT.md 也存在。 |
| 共享规则内容比较 | PASS | CLAUDE 与 HEAD 的差异严格等于预定的一句替换；整个 GitNexus 块保持不变。 |
| 保护文件 SHA-256 | PASS | 游戏 AGENTS 与上一轮审计报告均和本轮开始时完全一致。 |
| `encoding-guard` 定向检查 | PASS | 根 AGENTS、CLAUDE 和本报告均未发现疑似乱码或文本丢失。 |
| `pnpm check:agents-context` | PASS / exit 0 | `AGENTS context entry check (13 files)`；验证现有局部上下文链。 |
| `pnpm check:docs-links` | exit 0 | 检查 21 个 Markdown，40 个本地链接可解析，0 个未解析，9 个外部/纯锚点跳过。该脚本不覆盖根 AGENTS 和游戏普通报告，已另做本轮文件路径检查。 |
| `pnpm check:harness` | **FAIL / exit 1** | 六项报告，详见下节。没有绕过或修改检查器。 |

三个 pnpm 命令均提示当前 Node `v26.4.0` 不满足仓库 `>=22.13.0 <23`，pnpm 为 `11.21.0`。检查实际运行并取得以上退出码；工具链未调整，不能据此宣称正式 CI 环境通过。

保护文件哈希：

```text
apps/blue-hour/AGENTS.md
178112906856fcd69414eee2062383258eff482c1f42bd34644c0dfa32f9e9a0

apps/blue-hour/docs/development/blue_hour_baseline_audit.md
52496f668cacc1733a15268e0ce40a63412b1f58794bd5c555e9b8ea3342d92b
```

## 6. 遗留问题与索引模式

### 6.1 索引未暂存：跨平台交付尚未完成

本轮磁盘正文已可供当前工作区读取，但 Git 索引/HEAD 仍把根 AGENTS 记为损坏的符号链接。默认 `core.symlinks=false` 下的普通 `git diff` 仍显示 `120000`，并不意味着磁盘修复失败；它使用了原索引的链接语义。

本轮仅通过单次命令 `-c core.symlinks=true` 观察工作区类型差异，未持久修改 core.symlinks。也未使用 update-index、临时索引或其他方式绕过“不自动暂存”的限制。

将来用户明确授权暂存时，可在当前普通文件的工作区运行下面的命令，将**正文和普通文件类型一起**记录进索引。以下仅是后续操作说明，本轮未执行：

```powershell
git -c core.symlinks=true add -- AGENTS.md
git ls-files -s -- AGENTS.md
git diff --cached --summary -- AGENTS.md
```

通过条件为索引模式变为 `100644`、暂存摘要明确显示 `120000 => 100644`，并核对暂存正文。仅在现有配置下普通 add 可能继续沿用旧链接模式，因此必须检查实际结果。CLAUDE 和本报告是否暂存由用户另行决定。

在模式进入正确索引并随后提交之前，其他平台若从当前 HEAD 新检出，仍会取得旧损坏条目。本轮不把“工作区修复”表述为“跨平台版本已交付”。

### 6.2 Harness 仍坚持旧入口模型

`pnpm check:harness` 的六项失败：

- `godot: SKILL.md exists but is not listed in INDEX.md`。
- `.claude/skills`、`.codex/skills`、`.codebase/skills`、`.trae/skills` 不是检查器要求的实际符号链接，共四项。
- `AGENTS.md: must be a compatibility symlink to CLAUDE.md`。

前五项与本轮未修改的 Skills 配置有关。最后一项来自 `scripts/check-agent-harness.sh` 硬编码的旧契约，与用户本次明确选择的普通 Markdown 入口直接冲突。用户选择优先，故保持正确入口方案并如实报告 FAIL。

`docs/HARNESS_ENGINEERING.md:21,45` 也仍记载根 AGENTS 是软链接。更新检查器及其说明属于后续独立授权范围；本轮不顺带修复它们、不让根入口为了通过旧检查重新变回链接。因此 G0 当前不能声称全套治理检查已绿。

### 6.3 没有开展的治理工作

四个 Skills 兼容链接、Skill 索引遗漏、Superpowers 状态、游戏规则中的历史阶段描述、旧 Plan 与旧报告均保持原样。现有有效 GitNexus 要求仍保留在 CLAUDE 中，其工具可用性问题没有通过本次入口修复解决。

## 7. 后续新会话验证方法

**本轮没有启动新 Codex 会话，也没有取得自动加载成功的运行证据。** 路径存在、正文可读和上下文链检查通过都不能代替这项验证。

建议分两层确认：

1. **当前工作区的新会话。** 在 Codex 手动新开一个启动目录为 Monorepo 根的会话，用只读任务提示：“检查蓝时归航的 AI 规则来源，说明启动时已有的指令、随后按指引读取的文件及优先关系；不要修改文件或运行游戏。”不要把整份根入口正文复制进提示。观察可见上下文与文件读取记录，确认启动上下文出现新根 AGENTS；随后实际读取 CLAUDE 和游戏 AGENTS，再按游戏入口读取 PROJECT_CONTEXT。后续显式读取的文件必须单独标注，不能全部自称自动加载。
2. **后续提交版本的跨平台新检出。** 先完成第 6.1 节的正确模式暂存、审查和用户授权提交；在 Windows 与另一平台的新检出中核对 Git 模式为 `100644`、磁盘非符号链接且正文完整，再重复上述新会话检查。还可从游戏目录启动一个只读会话，核对根与局部规则继承；这不替代“从根启动游戏任务”的路由验收。

判断证据应以新会话实际收到的初始指令和可见的读取动作作区分；只得到模型一句“已加载”时，结论仍是证据不足。若未出现根入口，继续检查客户端启动根、AGENTS.override 和配置优先级；本轮没有读取或修改全局配置来推测结果。

## 8. 收尾

- 已落地：根工作区入口正文、CLAUDE 一句同步说明、本修复报告。
- 已验证：diff、真实文件类型、未暂存索引、路径、共享规则保留、保护文件哈希、编码、上下文链和文档链接；Harness 失败已列明。
- 未完成：索引 `100644` 转换、提交后的跨平台检出、新 Codex 会话加载，以及旧 Harness 契约更新；前三者受本轮“不暂存/提交”和会话验证边界限制，后者不在本次最小范围。
- 历史 Plan 无需同步：本轮只修复入口并记录验证，不改变游戏功能或继续其他治理计划。
