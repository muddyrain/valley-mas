# 资源目录与新增归属

2026-09-12 完成目录整理及文件命名规范化。目录迁移历史见 [目录迁移记录](../docs/ASSET_MIGRATION_2026-09-12.md)，当前文件名及完整映射见 [命名迁移记录](../docs/ASSET_NAMING_2026-09-12.md)。

```text
assets/
├─ characters/
│  ├─ xia_zhiyao/{source,runtime}/
│  ├─ su_wanxing/{source,runtime}/
│  └─ infected_basic_a/model/  # 唯一正式普通感染者及其材质、贴图
├─ generated/                  # 51 个 Blender 模型；manifest 另登记正式蓝时号 wrapper
├─ world/
│  ├─ buildings/{commercial,residential,industrial,service}/
│  │  └─ CAMP_001_main_station.glb # 正式营地主站；wrapper 归 scenes/camp/buildings/
│  ├─ vehicles/                # 三种环境车；同期正式蓝时号 VEH_BLUE_HOUR.glb
│  ├─ props/street/            # 路灯、垃圾桶
│  ├─ barriers/                # 围栏源件；标准几何在Runtime Wrapper
│  ├─ vegetation/              # 树与灌木
│  └─ materials/               # 共享灯罩、标准网丝材质
├─ weapons/
│  ├─ icons/                   # 八把正式武器的原始 200×200 透明 PNG
│  └─ models/                  # 正式短刀 / P9 / A21 GLB，含握点与枪口
├─ items/
│  ├─ cards/                   # 靶子、咖啡、复制机等道具卡面
│  ├─ icons/                   # 正式被动道具的 100×100 图标
│  └─ illustrations/           # 可复用的独立道具插画
├─ skills/
│  ├─ cards/                   # 火力、治疗、疾行能力卡面
│  ├─ icons/
│  └─ illustrations/
└─ ui/
   ├─ common/
   │  ├─ backgrounds/          # 首页和路线页共用背景
   │  ├─ branding/             # 品牌图与分层源素材
   │  ├─ buttons/
   │  ├─ cards/                # 不含具体道具或技能的空白卡面和分层组件
   │  ├─ icons/                # 锁、箭头、营地图标
   │  ├─ panels/
   │  └─ progress/
   ├─ main_menu/               # 导航雪碧图、海报、社交入口
   └─ route_selection/         # 专属路线标题、标签、装饰、操作按钮
```

## 判断归属

- 先判断图片表达的是游戏对象还是界面装饰。道具、能力、武器、角色的图标、插画或卡面归资源领域，即使目前只在一个界面出现也不绑定该界面。卡面含有纸张底图也不改变具体对象的归属。
- 无具体游戏对象的通用按钮、面板、空白卡面、箭头、状态图标和共享背景归 `ui/common/`，多个界面引用同一份文件。
- 只有某个界面会使用的标题、排版装饰、导航雪碧图、路线标签和专属按钮归对应模块。`route_selection` 对应当前“选择你的专属路线”界面；业务脚本与 Scene 名不随资源目录重命名。
- 简单资源保留“领域 / 类型 / 文件”。某个对象确实具有多类模型、贴图或动画时才增加对象目录；不预建无内容的 `vehicles/`、`environment/`、`audio/` 等目录。
- 夏知遥与苏晚星的 `characters/<角色>/source/<角色>.glb` 保留 Meshy 原文件；`runtime/<角色>.glb` 是绑定统一骨骼后的游戏资源。两阶段使用相同 canonical name，以目录区分；角色 GLB 不使用版本后缀。贴图嵌入各自 GLB，Godot 导入时嵌入压缩场景，不再维护重复 JPG 或旧材质。
- `generated/` 保留既有 3D 生成管线的输出边界，`manifest.json` 登记类别和语义化 `path`。模型文件名采用 `environment_`、`vehicle_`、`weapon_` 或 `character_` 前缀；运行时和导出器读取登记路径，不再通过内部 ID 拼接文件名。模型内部 `BH_*` ID、节点名和 Blender 源文件名不改，避免改变模型内容和已有业务引用。

## 文件命名

角色 GLB 按用户指定使用 xia_zhiyao.glb、su_wanxing.glb，由 source/runtime 目录表达阶段，不采用下述一般对象文件名前缀。已指定的公共标准 BH_Humanoid_Rig_v1 和公共动作库名称保留。

- 资源文件统一使用 `lowercase_snake_case`，不使用顺序编号、批次编号或 `final`、`new`、`temp`、`test`、`copy` 等过程标记。
- 用户指定的正式蓝时号文件名为 `assets/world/vehicles/VEH_BLUE_HOUR.glb`，这是明确的命名例外，不增加版本后缀。所有使用处统一引用 `scenes/world/vehicles/veh_blue_hour.tscn`；manifest 中 `BH_EvacBus_01` 仅是兼容 ID。外部纹理保留 Godot 从源 GLB 自动提取的名称。
- 游戏对象使用 `<domain>_<object>_<asset_type>`：例如 `item_replicator_card.png` / `item_replicator_illustration.png`，`skill_sprint_card.png` / `skill_sprint_icon.png`，`character_xia_zhiyao_normal_texture.jpg`。同一对象的多种图片保持同一对象词干。
- 以当前数据语义为准：`shooting_target` 属于 `catalog.passives`（起始道具），仍在 items；`sprint` 属于 `catalog.powers`（技能）。`coffee` 与 `map_healing` 表达现有显示含义，分别对应历史数据 ID `early_start` 与 `aid`；数据 ID 和数值不随文件命名改变。
- 专属 UI 使用 `<screen>_<element>_<state>`，公共 UI 使用 `ui_common_<element>_<state>`。仅有交互状态的图片加状态后缀，状态限定为 `normal`、`hover`、`pressed`、`selected`、`disabled`、`locked`；标题、海报、插画不虚构状态。
- `source` 明确表示保留原稿这一资产角色；例如 `route_selection_scavenge_tab_source_selected.png` 是当前选中图的原始版本，不是 hover 态。`compact`、`single_arm`、`double_arm`、`small` 等表示实际构图或对象差异，不使用无意义版本号区分。
- `sources.json`、`manifest.json` 属于配置清单；它们的来源字段、内部内容 ID 及历史报告可以保留来源名，不能为了消除文本命中而重写历史。规范检查针对当前资源文件名及有效加载路径。

## 来源与导入

2026-09-12 营地主站保留用户指定名称 `CAMP_001_main_station.glb`，归 `assets/world/buildings/`；不增加版本后缀。与蓝时号一样保留 Godot 自动提取的相邻 `Image_N` 纹理名和导入参数，唯一运行场景为 `scenes/camp/buildings/camp_main_station.tscn`。原件哈希、尺寸、简单碰撞与冻结布局验证见 [营地主站与出发报告](../docs/CAMP_DEPARTURE_V1.md)。

2026-09-13 Phase 2A-Rebuild 继续沿用 `characters/<对象>/model/` 边界，正式文件名仍为 `ENM_001_infected_basic_a.glb`；该文件现在是用户提供的新版 A-pose GLB，旧字节归档到 `legacy/`。材质与三张贴图由 Godot 从新 GLB 导入，来源与哈希见 [感染者来源表](infected_source.json)；尺寸、模型朝向和碰撞高度由唯一敌人场景维护，运行时代码不缩放模型。定义、Rig、动作与验证入口见 [普通感染者规格](../docs/ENEMY_DEFINITION.md) 和 [重建报告](../docs/ENM_001_NEW_A_POSE_ASSET_REBUILD_REPORT.md)。

2026-09-12 道具/技能扩充原样导入用户提供的 14 张 100×100 PNG，原始文件名、项目路径与 SHA-256 见 [图标来源表](effect_icon_sources.json)。分别归入 `items/icons/` 与 `skills/icons/`，定义直接持有 Texture2D 引用；技能使用 `action_icon` 区分既有路线装饰图标。中文文件名仅作来源记录，稳定业务 ID 与文件名分离。病床、购物篮、报纸未出现在此次提供目录中，未新增其玩法或内容注册。

既有两份 `sources.json` 继续记录各批用户素材的来源、尺寸、哈希与派生关系；`file` 相对清单所在目录，可指向公共或领域目录。它们是来源记录，不是运行时资源加载配置。外部原始来源名保留；项目内的派生源引用跟随新文件名更新。搜集与勘查的 `tab_source_selected` 原图仍是各自 `tab_selected` 图片的派生来源，不重复制作。

重命名时同时移动相邻 `.import` 并保留 UID，让 Godot 更新路径与导入缓存。不手动操作 `.godot/imported/`。本轮 118 个普通资源保持导入参数不变；4 个角色 GLB 使用 Godot 原生外部材质选项，引用从现有模型保存的同参数材质，停止重复导出内嵌 `Image_N`。GLB、JPG 原始字节不变，纹理导入参数及 mipmap 保持不变；没有添加自定义导入插件或运行时替换脚本。

删除前还需区分未加载的源素材与已经废弃的成品。未确认废弃的原图、分层组件及设计资料保留；本次没有清理 `docs/`、`references/` 或 Blender 源文件。

武器图标由用户提供，字节校验见 [来源清单](weapon_icon_sources.json)，使用与后续模型接口见 [武器系统](../docs/WEAPON_SYSTEM.md)。旧 generated 武器继续保留在资产库，正式装备不再附着旧 Demo 模型。

上述 4 个旧 GLB 的外部材质规则属于命名迁移时的处理记录。A-Pose 角色替换后的当前规则见 [角色替换报告](../docs/CHARACTER_REPLACEMENT_REPORT.md)：先验证新模型、显式更新引用，再清理已废弃角色资产；其他美术源素材不受影响。
