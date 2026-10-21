# P1-B-VISUAL：结束页视觉精修

## Task Summary

本轮在既有 P1-B 上精修表现：独立归航背景、加重结果标题与灯塔山线、叠层纸张、语义摘要图标、照片式成员卡、笔刷状态章，以及统一的切角按钮和键盘焦点。胜败继续共用页面和成员组件，真实 Campaign、成员 ID、结算与存档所有权保持原实现。

任务于2026-10-20开始，交付记录日期为2026-10-21；证据目录沿用起始日期 `test-output/p1-b-visual-20261020/`。**视觉判断与工程验证分开：本报告提供原生对照，视觉与情绪表现仍等待用户验收，不以测试数量判定美术达标。**

## 基线、参考与范围

- 分支 `master`，HEAD `865edec300e01d64d015924b3e6f391567ba46be`，缓存关系 ahead4 / behind3。没有 fetch、切分支、暂存、提交、推送或清理。
- 本轮开始已有46项修改 / 未跟踪成果；[起始状态](../../test-output/p1-b-visual-20261020/baseline-status.txt)、[哈希清单](../../test-output/p1-b-visual-20261020/baseline-hashes.json) 和计划、脚本、页面副本已保存。
- 使用本次明确附上的三张图：[胜利参考](../../test-output/p1-b-visual-20261020/references/design-victory.png)、[失败参考](../../test-output/p1-b-visual-20261020/references/design-failure.png)、[线框图](../../test-output/p1-b-visual-20261020/references/design-wireframe.png)。从用户给出的确切附件路径复制，不寻找同名替代图；参考图没有进入 Runtime。
- 对照 [P1-B报告](2026-10-20_p1_b_run_end_screen_report.md)、原生[修改前胜利页](../../test-output/p1-b-visual-20261020/before/controlled-final-victory-1600x900.png)和[修改前失败页](../../test-output/p1-b-visual-20261020/before/actual-five-day-loss-1600x900.png)。
- 已阅读根 / 项目规则、项目上下文、核心体验契约、计划 / 验证记录、UI素材规范、美术 Bible / Pipeline / Catalog 和当前实现。GitNexus 工具不可用，使用原生 Git 和源码追踪。
- 影响入口仅为 `RunEndScreen.setup/_layout`、`RunMemberResultCard.setup` 及其新表现辅助；调用方仍是原 main 的 ended 分支。没有修改 main、Campaign、Store、Ledger、正式头像、角色数据、动画或地图。

## 修改前后的差距

| 区域 | 修改前的可观察问题 | 本轮落实 |
| --- | --- | --- |
| 标题 / 品牌 | 较细的宋体标题类似信息标签，缺少结束状态的视觉重量 | 保留原 Logo；原生黑体字形配 FontVariation 加粗、阴影和灯塔山线；中英层级分开，情绪句使用楷体策略 |
| 背景 | 通用首页背景的视觉重心与右侧面板竞争，不能充分表达归航后的空间 | 一张独立无 UI 的河岸归航插画，人物 / 巴士 / 暖灯集中左侧；右侧留给纸张，胜败用同构图区分饱和度与曝光 |
| 主纸张 | 宽按钮纸板被拉成大圆角面板，灰色厚边与较大的中部空白明显 | 复用正式空白纸卡纹理作为主纸面，配两张偏移衬纸、细蓝分隔和跨边胶带；结语收进纸张底部的独立区域 |
| 资源摘要 | 只有标签和数值，层级接近，缺少识别图形 | 统一海军蓝日历 / 成员 / 罐头 / 齿轮图标，四项横排，细竖线分组，标签与数值字号分层 |
| 成员卡 | 扁平纸卡、直角灰底头像和整条矩形状态色块 | 独立米白照片相框、阴影与胶带、原生姓名、空白笔刷状态章和英文状态；损失头像降饱和，不修改原件 |
| 氛围 | 胜败主要靠文字与简单变暗区分 | 胜利保留落日与灯光；失败更冷、低饱和；纸张和文字保持清晰，损失原因和成员状态仍来自原记录 |
| 按钮 | 蓝 / 绿两套边缘与比例不统一，中英文同级；绿色外有橙色矩形 | 两张同族空白底图、统一切角和内间距；原生图标 / 中文主文字 / 英文副文字；匹配边缘的浅色焦点轮廓 |
| 动态空间 | 两卡与较少成员时留白偏大；测试画布缩放与项目实际缩放效果不同 | 标题、纸张与操作栏固定，成员独立滚动；物理窗口字号补偿使最小窗口在两种缩放条件下保持一致 |

### 橙色矩形的真实来源

原结束页通过 `MenuArt.button()` 创建按钮；该函数为 focus 指定 `StyleBoxFlat`、`GOLD=#e8b36a`、2px边框、3px向外扩展。结束页又默认 `new_run_button.grab_focus()`，因此每张初始截图都显示金色矩形。这是键盘焦点样式，并非未知贴图或测试框。

本轮仅在结束页按钮创建器中覆写 focus 为独立透明切角 SVG。初始聚焦、上一项焦点切换和 ui_accept 均保留，重复确认仍只发一次导航；没有移除键盘反馈，没有修改共享 MenuArt 或其他页面的按钮。

## 构图与字体

- 1600×900：品牌区位于左上；右侧从约 x736 开始、宽约830。标题独立于纸张；纸张约 y258至754，操作栏约 y770、高78。人数增加不改变这些位置。
- 1024×640：紧凑构图扩大右侧占比，调整标题高度、照片和间距；成员仍两列，单人一列，不放置空卡。成员区内部滚动，操作栏固定。
- 项目 canvas_items 缩放模式也实际验证：结束页暂用 EXPAND 填满窗口，退出时恢复之前的 aspect；布局系数根据物理窗口与逻辑视口之比计算，避免把文字再次缩得过小。没有改全局项目设置。
- 标题：系统 SimHei / Microsoft YaHei 等黑体策略，FontVariation 加粗；中文正文继续现有 Microsoft YaHei / Noto 回退；情绪句采用 KaiTi / STKaiti / serif。没有复制系统字体文件或引入外部字体依赖。
- 标题、摘要、成员姓名、状态、原因、按钮与结语都是原生 Label / Button。角色没有正式英文名或台词字段时，不添加设计稿示例拼音或台词。

## 新增独立素材与复用

完整机器可读清单和**最终完整生成提示词**保存在 [art/run_end_asset_manifest.json](../../art/run_end_asset_manifest.json)，登记同步到 [UI_ASSETS](../../art/UI_ASSETS.md)。

| 新资源 | 规格 / 来源 | 使用位置 |
| --- | --- | --- |
| [run_end_homeward_background.png](../../assets/ui/run_end/run_end_homeward_background.png) | 1672×941，built-in image_gen 新生成，无输入图、无 UI / 文字 / 固定数据 | 胜败共用背景；同一资源的城市区域作为小照片装饰 |
| [run_end_heading_crest.svg](../../assets/ui/run_end/run_end_heading_crest.svg) | 440×86，原创无文字 SVG | 灯塔、山线、微弱光束标题装饰 |
| [run_end_symbols.svg](../../assets/ui/run_end/run_end_symbols.svg) | 448×64，原创语义 atlas | 日历、成员、食物、废料、菜单、出发、警示；由语义键选取 |
| [ui_common_status_brush.svg](../../assets/ui/common/cards/ui_common_status_brush.svg) | 320×72，原创空白笔刷 SVG | 所有状态章的共同底图，原生文字叠加并按状态着色 |
| [ui_common_washi_tape.svg](../../assets/ui/common/cards/ui_common_washi_tape.svg) | 120×40，原创半透明纤维胶带 SVG | 主纸张和照片卡片；不依赖原先已有旋转造型的路线贴纸 |
| [ui_common_chamfer_focus.svg](../../assets/ui/common/buttons/ui_common_chamfer_focus.svg) | 480×88，原创透明焦点 SVG | 两个按钮的浅色切角焦点轮廓 |

生成使用内置 image_gen，不使用 CLI / API Key。原生成文件为 Codex 返回的确切路径 `C:/Users/A/.codex/generated_images/01a15968-4ebb-73f1-8132-e47f077982c9/exec-5cc10a80-4ce2-446c-ad89-31b66f6aef3c.png`，已逐字节复制到工程，未剪裁完整参考图、未合成 UI，也未覆盖原件。原生显示采用 KEEP_ASPECT_COVERED，源尺寸近16:9，不把“理想2560×1440”的提示词当作实际尺寸。

背景 SHA-256：`81813e91da4c6469ab90c4bb8fc6433a59ccfa0e642c42c2c32b26aa3837ae7b`。PNG 保持原字节，SVG 不含 text 元素；尺寸、字节、哈希和来源一致性见 [asset-qa.json](../../test-output/p1-b-visual-20261020/asset-qa.json)。Godot 2D Lossless 导入，未开启3D压缩或降低源尺寸。背景内匿名旅人只表达氛围，不代表本轮名单或存活人数。

继续复用正式 Logo、`ui_common_card_paper.png`、今日行动 blue / green 空白按钮底图和各角色 `SurvivorDefinition.portrait_path`。没有修改这些资源的原字节；没有新增角色模板、头像、模型、动作或地图资产。

## Changed Files

| 类型 | 文件 / 范围 | 内容 |
| --- | --- | --- |
| 修改 | [ui/run_end_screen.gd](../../ui/run_end_screen.gd) | 表现构图、摘要图标、纸张层次、背景氛围、窗口缩放适配；原导航锁与数据入口保留 |
| 修改 | [ui/run_member_result_card.gd](../../ui/run_member_result_card.gd) | 照片相框 / 胶带 / 状态笔刷、紧凑布局和损失灰度 |
| 新增 | [ui/run_end_art.gd](../../ui/run_end_art.gd) | 结束页表现资源、字体、分隔与按钮创建器 |
| 新增 | [ui/run_end_backdrop.gdshader](../../ui/run_end_backdrop.gdshader) | 背景氛围和损失头像的表现饱和度 / 曝光 |
| 新增 | 上述六个独立素材 | 一张无 UI 背景及五张无文字 SVG |
| 新增 | [tests/run_end_visual.gd](../../tests/run_end_visual.gd) | 人数位置稳定、文字 / 边界、键盘焦点、真实项目缩放与退出恢复 |
| 修改 | [tests/run_end_runtime.gd](../../tests/run_end_runtime.gd)、[tests/run_end_flow.gd](../../tests/run_end_flow.gd) | 仅增加可选证据目录环境变量，保留既有500 / 133项断言，不改变玩法驱动 |
| 修改 | [run.ps1](../../run.ps1) | capture / build 各加入一次新视觉专项 |
| 新增 / 修改 | 资产清单、UI_ASSETS、PLAN、VALIDATION、本报告 | 来源登记与交付状态同步 |
| 自动生成 | 新 GDScript / Shader 的 .uid 与新图像的导入设置 | Godot 资源身份 / 导入元数据，实际文件以工作区为准 |

没有删除文件。日志、截图和构建输出继续忽略提交。

## 数据与交互保持

既有链路未改变：`Campaign.data → RunEndSummary.from_campaign → RunEndScreen → RunMemberResultCard`。实际成员 ID 来自当前 members 和结算历史的 returned / lost / starved / stayed 去重并集；姓名、内容身份和正式头像由原 Definition 关联。

结束页不增加资源、不提交结算、不写存档。返回主菜单与重新出发继续调用原装配信号；新开局草稿的取消、保存成功后的替换、终态继续及防重复输入仍交给原流程。状态仍区分生还、战斗阵亡、缺粮损失和证据不足的记录不详；没有为视觉图补造人数、成员或死亡原因。

## 视觉对照与原生截图

以下为当前 Godot 原生渲染，不是参考图重贴或浏览器重绘。人数图是明确的隔离 Campaign API 夹具；自然失败与受控胜利的正式流程图另列。

| 内容 | 1600×900 | 1024×640 |
| --- | --- | --- |
| 胜利两人夹具 | [当前胜利构图](../../test-output/p1-b-visual-20261020/visual-won-2-1600x900.png) | [紧凑构图](../../test-output/p1-b-visual-20261020/visual-won-2-1024x640.png) |
| 失败两人夹具 | [当前失败构图](../../test-output/p1-b-visual-20261020/visual-lost-2-1600x900.png) | [紧凑构图](../../test-output/p1-b-visual-20261020/visual-lost-2-1024x640.png) |
| 1人 | [单卡](../../test-output/p1-b-visual-20261020/visual-won-1-1600x900.png) | [单卡最小窗](../../test-output/p1-b-visual-20261020/visual-won-1-1024x640.png) |
| 4人 | [四卡](../../test-output/p1-b-visual-20261020/visual-won-4-1600x900.png) | [四卡最小窗](../../test-output/p1-b-visual-20261020/visual-won-4-1024x640.png) |
| 8人 | [八卡首屏](../../test-output/p1-b-visual-20261020/visual-won-8-1600x900.png) | [八卡最小窗](../../test-output/p1-b-visual-20261020/visual-won-8-1024x640.png) |
| 12人 | [十二卡首屏](../../test-output/p1-b-visual-20261020/visual-won-12-1600x900.png) | [十二卡最小窗](../../test-output/p1-b-visual-20261020/visual-won-12-1024x640.png) |
| 12人滚动末尾 | [末位成员与固定按钮](../../test-output/p1-b-visual-20261020/fixture-won-12-1600x900.png) | [最小窗末尾](../../test-output/p1-b-visual-20261020/fixture-won-12-1024x640.png) |
| 项目真实 canvas_items 缩放 | 与主画布相同尺寸 | [胜利](../../test-output/p1-b-visual-20261020/visual-project-stretch-won-1024x640.png) / [失败](../../test-output/p1-b-visual-20261020/visual-project-stretch-lost-1024x640.png) |
| 自然第五日缺粮失败 | [真实流程失败](../../test-output/p1-b-visual-20261020/actual-five-day-loss-1600x900.png) | [真实流程最小窗](../../test-output/p1-b-visual-20261020/actual-five-day-loss-1024x640.png) |
| 受控 pending 胜利的实际末次确认 | [终态胜利](../../test-output/p1-b-visual-20261020/controlled-final-victory-1600x900.png) | 不作为自然五日胜利证据 |

[默认出发焦点](../../test-output/p1-b-visual-20261020/visual-keyboard-focus-new-1600x900.png)、[键盘切换至菜单](../../test-output/p1-b-visual-20261020/visual-keyboard-focus-menu-1600x900.png)、[无焦点状态](../../test-output/p1-b-visual-20261020/visual-unfocused-1600x900.png)分别展示焦点表现。长姓名、缺失头像、混合伤亡和零记录图由原500项专项继续生成，同样位于本轮证据目录。

**当前视觉判断：**标题重量、归航空间、纸张层次、照片卡与状态章、按钮统一性已有可观察变化；橙色矩形的来源和替换均已核对。当前仍是原生字体加装饰，不是参考图的逐字书法美术；背景采用新构图，不宣称逐像素还原。请以当前原生截图验收审美、情绪和可读性。

## 工程验证

### 实际命令与隔离

`[Windows]` 从仓库根执行。此环境变量只影响测试证据目录，不影响玩家数据或运行时规则：

```powershell
$engine = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe'
$env:BLUE_HOUR_RUN_END_OUTPUT = 'p1-b-visual-20261020'
& $engine --headless --path apps/blue-hour --editor --import --quit
& $engine --headless --path apps/blue-hour --script tests/run_end_state.gd
& $engine --path apps/blue-hour --position -3000,-3000 --resolution 1600x900 --audio-driver Dummy --script tests/run_end_runtime.gd
& $engine --path apps/blue-hour --position -3000,-3000 --resolution 1600x900 --audio-driver Dummy --script tests/run_end_visual.gd
& $engine --path apps/blue-hour --position -3000,-3000 --resolution 1600x900 --audio-driver Dummy --script tests/run_end_flow.gd
./apps/blue-hour/run.ps1 -Mode build -GodotPath $engine
```

精确命令与时间由 [专项驱动](../../test-output/p1-b-visual-20261020/run-validation.ps1)、[构建驱动](../../test-output/p1-b-visual-20261020/run-build.ps1)及相应 result.json 保存；最终流程以完整构建 stdout 和 JSON 为准。自动化使用屏幕外原生窗口、合成输入及 `user://test-runs/`，没有操作玩家存档。

### 结果

| 验证 | 当前结果 | 证据 |
| --- | --- | --- |
| Godot import | PASS，exit0，无脚本错误 | `import-headless.*`，完整构建日志 |
| P1-B 数据 | PASS，138 / 0；未修改 Summary 或 Campaign | `run_end_state-headless.*`，完整构建复跑 |
| 原生成员 / 交互 | PASS，500 / 0；1 / 2 / 3 / 4 / 8 / 12人、伤亡、长姓名、缺失头像、滚动及重复操作 | [population-runtime.json](../../test-output/p1-b-visual-20261020/population-runtime.json) |
| 新视觉 / 键盘 / 实际缩放 | PASS，366 / 0，包括退出恢复检查；最终构建复跑 | [visual-runtime.json](../../test-output/p1-b-visual-20261020/visual-runtime.json)，完整构建stdout第59行 |
| P1-B 正式终态流程 | PASS，133 / 0；最终构建复跑 | [flow-runtime.json](../../test-output/p1-b-visual-20261020/flow-runtime.json)，完整构建stdout第147行 |
| 独立素材 | PASS，6项，无 SVG text；生成 PNG 原字节保留 | [asset-qa.json](../../test-output/p1-b-visual-20261020/asset-qa.json) |
| 完整 Windows build | FAIL / BLOCKED，520.932秒、exit1，未进入导出 | [build.result.json](../../test-output/p1-b-visual-20261020/build.result.json)、[stdout](../../test-output/p1-b-visual-20261020/build.stdout.log)、[stderr](../../test-output/p1-b-visual-20261020/build.stderr.log) |

原终态流程继续包含：正常伤害 / live director 下从新游戏开始五次实际空手外出与 E 撤离，正常确认至第五日连续缺粮失败；终态继续、返回菜单、新开局取消 / 确认和保存重置。胜利段仍是明确标注的 Campaign API pending 夹具，再以实际继续与末次确认验证 won，不能用作自然五日成功搜刮的证明。

### 发现、修正和中断

- 第一轮截图发现按钮源图的九宫格纹理边距超过78px目标高度，导致底图压缩。改为按正式素材的可见区域整体缩放，保留原 PNG，不通过普通 Border 伪装材质。
- 第一轮叠纸用了全尺寸锚点又显式写 size，Godot 发出锚点尺寸警告；改为此固定构图区由页面统一分配尺寸。初始截图与警告留在 `first-native-review/`。
- 增补实际项目缩放时，首次得到1024×576内容区，2项截图尺寸断言失败；根因是原 KEEP 策略的黑边。结束页采用 EXPAND、退出恢复；随后补偿物理 / 逻辑画布比例，使最小窗口实际可读布局一致。失败证据留在 `letterbox-failure/`，没有删除尺寸断言。
- 两次 build 在源冻结前由本轮主动中断：一次为真实最小窗口的可读布局修正，一次为把新增的退出恢复断言纳入测试结果输出。均保存 `first-build-interrupted/`、`second-build-interrupted/`，exit -1，不作为完整构建通过证据。最终构建重新从头执行。

## Known Issues / 未验证边界

- 视觉验收等待用户；不以工程全绿宣称视觉达标。标题仍采用系统字体，未制作独立书法字形，部分细节与参考原画不同。
- 动态布局没有人数上限，本轮验证到12人；未作几十 / 数百成员性能压力测试。
- 未自然游玩五日胜利路线；胜利截图明确区分夹具与真实最后确认。
- macOS 字体、手柄、超宽屏与低端 GPU 未验收；没有新增跨平台性能结论。
- 继承 P1-B 的旧档证据缺口：无法从缺失历史还原不存在的损失记录，仍显示记录不详，不制造角色状态。
- Windows 新 EXE 与独立启动结论以下方完整构建结果为准。

## Environment

| 平台 | 实际环境 |
| --- | --- |
| `[Windows] Windows environment required` | Windows11专业版10.0.26200；RTX3060，OpenGL3.3 Compatibility / NVIDIA591.86；Godot4.7.2.stable.official.ed1daf0bf，匹配Windows x64模板存在 |
| Godot Editor | 同一 Console 引擎完成 headless editor import；原生渲染使用同一版本 |
| Blender | 未使用，未更改模型管线或安装 |
| Node / Git | context:recent 显示Node26.4.0 / pnpm11.21.0 engine范围warning；Git2.39.1.windows.1；Godot不依赖pnpm运行 |
| `[macOS] macOS compatible` | 未访问；Godot Editor、Blender、Node、Git与字体运行均未验证 |

## 收尾记录

### Windows完整构建与新EXE

最终于2026-10-21 20:01:58至20:10:39（+08:00）从头执行构建，520.932秒，exit1。导入、P1-A状态62 / 原生186、本轮数据138 / 成员500 / 视觉366 / 终态133，以及搜索72、外出HUD265、指令45、指令线554、搜索卡157、设置14、营地菜单30通过。

随后既有 [tests/camp_ui_runtime.gd](../../tests/camp_ui_runtime.gd) 第114行访问不存在的 `camp_ui.member_buttons`，第23行“Camp exposes active abilities on its left edge”断言失败；错误在完整build.stdout第185和192行。该脚本与Camp HUD未由本轮修改，不删除断言，不绕过门禁，也不扩修P1-C。

没有生成本轮新Windows EXE，当前新包的独立启动**未验证**。现有 [build/BlueHourHomeward.exe](../../build/BlueHourHomeward.exe) 仍是旧产物，不能用于查看本轮UI；SHA-256前后均为 `E194539E347E5B2757B4C61107E2EBBAD98352DC44AE43FE7A40D0E26951B627`，见[构建前](../../test-output/p1-b-visual-20261020/exe-before.json) / [构建后](../../test-output/p1-b-visual-20261020/exe-after.json)。本轮原生截图来自当前源码Godot运行。

### 交付核对

- PASS：[交付核对JSON](../../test-output/p1-b-visual-20261020/delivery-checks.json) 确认39个其他原有修改 / 未跟踪文件哈希不变；移除本轮新增段落 / 两条视觉门禁后，PLAN、VALIDATION、run.ps1与起始副本一致，UI_ASSETS历史正文保留。
- PASS：两个既有P1-B原生测试剥离证据目录配置后与起始版本一致，原断言均保留；构建清单773个源码 / 配置文件哈希不变，专项冻结清单15个表现代码 / 独立素材哈希不变，截图对应最终实现。报告全部本地链接有效，定向encoding-guard及git diff --check通过。
- 已同步PLAN / VALIDATION和资源登记；历史P1-B报告保留原文，不改写为当时已经精修。本轮当前原生截图43张；已目视核对胜败、真实最小窗口、长姓名 / 缺失头像及12人末尾滚动。视觉判断仍等待用户验收。
- 本轮Godot进程均已退出，没有新增长驻服务。没有Git暂存、提交或推送。仅完成本轮视觉精修，到此停止，不自动开始P1-C或其他阶段。
