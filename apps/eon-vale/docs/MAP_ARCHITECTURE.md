# Eon Vale 地图架构

> 状态：P0 阶段 1–4、P1-1、P1-2、P2-1 与 P2-2 已完成并通过复验。P2-3 寒冷生境链路已实现并等待用户视觉验收；P2-4 尚未开始。

## 架构目标

地图架构只服务一个固定 `1024×1024` 世界格的原创像素地图。它必须同时做到：

- 同一种子与生成器版本产生完全一致的地图事实；
- 世界、区域和近景是同一地图事实的三种观察投影，不是三张地图；
- placeholder 与正式 tileset 可以整体替换，不重写生成算法，也不移动地图物件；
- 生成、视觉派生、资产打包和 GPU 绘制互不泄漏各自的内部知识；
- 完整世界可以渐进生成和渐进显示，取消旧任务后不会混入过期结果；
- 地图只通过内置模板与种子生成；本阶段没有地图编辑、保存、加载或旧版本兼容接口。

## 当前实现审计

以下问题描述的是已删除的旧原型，也是新链路必须避免回归的历史基线：

- `GeneratedWorld` 把生境、地表覆盖物、地图物件和具体 variant 压在少量枚举数组中，缺少地貌带、基础生境、子材质、环境主题和稀疏物件事实的独立表达；
- `MapRenderer` 同时承担相机、LOD、chunk 调度、地表绘制、资源选择、palette、程序噪点和选择反馈，接口浅而实现知识分散；
- 四个 atlas loader 通过枚举行序计算物理帧，没有 visual manifest，也没有可验证的语义解析接口；
- 区域 LOD 由程序临时画几何色块，近景直接读取旧 atlas，不能满足同一物件跨层级一致性；
- 边界拓扑、水岸动画、shadow mask、最大视觉溢出和资产版本都没有进入数据流；
- 渲染 chunk 的固定 padding 与正式素材最大溢出没有契约关系。

新链路只保留了固定世界尺寸、确定性种子、生成任务取消、TypedArray 数据布局和 Pixi 作为 GPU 宿主。旧枚举到 atlas 行列的链路已整体删除，没有兼容 adapter 或运行时开关。

## 第一性原理分层

地图系统只有五类信息：

1. **地图事实**：某格是什么地貌、生境、材质与环境主题，某个物件位于哪里。
2. **确定性派生**：边界拓扑、材质组节奏、可见物件顺序和同一语义族中的变体选择。
3. **视觉目录**：当前 tileset 中有哪些语义资产，以及它们被打包到哪里。
4. **观察投影**：给定视口与 LOD，需要画哪些 chunk、符号和动态叠层。
5. **GPU 表现**：把已经决定好的绘制计划交给 Pixi，不再解释生境或生成规则。

任何字段必须只属于其中一层。地图生成器不得知道 atlas 坐标，visual manifest 不得决定生境，Pixi renderer 不得随机生成轮廓。

## 候选深模块与接口

以下是当前候选形状；名称和具体字段会在本轮决策完成后锁定。

```text
MapSession
  ├─ WorldTemplateCatalog.list() → WorldTemplate[]
  ├─ WorldGenerator.generate({ templateId, seed }, control) → WorldSnapshot
  ├─ MapProjection.compile(snapshot, viewport, visualCatalog) → RenderChunkPlan[]
  ├─ VisualCatalog.load(bundle) → ValidatedVisualCatalog
  └─ MapRenderer.present(plans, camera) → RenderStatus
```

### WorldGenerator

外部接口只接受世界配置与任务控制，返回完整的 `WorldSnapshot`。高程、气候、生境分配、地表斑块、植被簇和物件放置都留在模块实现内部。同步生成与 Worker 生成不得成为两个规则实现；Worker 只是同一接口的运行 adapter。

### WorldSnapshot

它是当前浏览器会话中一次生成任务的完整权威事实集合，不包含 atlas 页、帧矩形、当前相机或 GPU 对象。普通地图物件保存语义族、锚点位置和确定性变体种子，不保存由当前 tileset 决定的具体帧。它只存在于内存；刷新、关闭页面或重新选择模板后可以直接丢弃。

### VisualCatalog

它只暴露已经通过 schema 与资产门槛检查的只读查询接口。atlas 分页、裁切偏移、palette、shadow、动画和 `lod-world` 引用全部隐藏在内部；无效 bundle 在进入地图会话前整体失败，运行中不存在“尽量画一个错误资源”的静默降级。

### MapProjection

它把地图事实、视口和视觉目录编译为纯数据 `RenderChunkPlan`。八邻域拓扑、variant 洗牌袋、重复冷却、排序键、跨 chunk 溢出、世界 LOD 聚合和动态水面选择集中在这里，测试只验证编译结果，不读取 Pixi 内部对象。

### MapRenderer

它只拥有 Pixi application、GPU texture、可见 chunk 和相机变换。它执行 `RenderChunkPlan`，不判断某格属于什么生境，不计算资源权重，也不自行选择 variant。

### MapSession

它是页面唯一需要协调的深模块，负责模板选择、当前 snapshot、生成任务、视口、可见 LOD、缓存失效和选择状态。React 只订阅低频状态并发送用户意图，不持有百万格地图数组。

## 已由视觉系统锁定的架构不变量

- 一个世界格是地图事实最小单位；区域原生表现为 `4px/格`，完整底图为 `4096×4096px`。
- 地图事实保存语义族与确定性种子；visual manifest 才把它解析为具体 variant 和 atlas 帧。
- 八邻域 `47` 种拓扑只决定几何遮罩，不决定材质或 atlas 坐标。
- 世界视图使用专用 `lod-world` 视觉资源；区域与近景共享同一正式 sprite，近景仅作 `4×` 最近邻显示。
- 水体由静态 tile、美术动画叠层和受限程序效果组合；世界视图保持静态。
- chunk 必须读取邻接 halo，并根据 manifest 的最大视觉溢出扩大绘制与裁切范围。
- 所有随机选择由世界种子、地图 revision、位置和稳定语义盐决定；帧率、加载顺序和 chunk 构建顺序不得改变结果。
- visual manifest schema version、tileset version、generator version 和存档版本是四个不同概念，不得共用一个版本号。

本阶段没有存档，因此存档版本不进入运行时；它只保留为未来可能新增持久化时的独立概念。

## 已确认的首轮架构决策

### 模板、种子与权威 snapshot

- 新世界的唯一输入是 `templateId + seed`。模板只定义大陆数量、海陆比例、内海/群岛倾向和气候参数范围等宏观生成约束；种子决定具体岸线、地貌、生境、植被和装饰。
- 生成完成后，完整地图事实物化为内存中的不可变 `WorldSnapshot`：百万格规则字段使用紧凑 TypedArray，树木、岩石和环境地标使用稀疏物件表。
- `WorldSnapshot` 不保存具体美术 variant；同一语义族的选择由位置、世界种子和稳定语义盐确定性派生。
- 地图没有编辑事务、patch、保存或加载接口。选择另一个模板或重新生成会直接替换当前世界。

### 生成任务与 loading

- 玩家选择模板后创建一次 `GenerationJob`，页面进入独立 loading 状态。
- Worker 只运行地图事实生成；它发布可验证的阶段进度，但不把半成品地图交给当前会话，也不承担 Pixi 或 atlas 工作。
- 生成成功后一次性提交新的 `WorldSnapshot` 并进入世界视图；取消或失败不会留下部分地图。
- 当前 loading 视觉不进入正式实现；它需要按原创像素地图语言重新设计，不能沿用现有简陋表现。

### 派生数据与缓存

- snapshot 只保存种子决定的地图事实；拓扑遮罩、材质节奏、具体视觉 variant、排序键、LOD 聚合和 `RenderChunkPlan` 都是可丢弃的确定性派生数据。
- 派生缓存键至少包含 `snapshotId + visualCatalogVersion + chunkKey + lod`。更换 tileset 只清除视觉派生与 GPU 缓存，不重新生成地图事实。
- `MapProjection` 首版在主线程以分帧任务运行；只有性能证据表明确实阻塞交互时，才增加 Worker adapter。

### Chunk 与性能门槛

- 正式逻辑 chunk 为 `64×64` 世界格，完整世界为 `16×16` 个 chunk；每块读取必要的邻接 halo，绘制 padding 来自 visual manifest 的最大溢出。
- 世界视图不加载全部区域/近景 chunk；详细 chunk 按视口和相机移动方向排队，并按距离淘汰。
- 桌面浏览器首轮门槛：loading 中首个可信进度反馈 `≤1.5s`；完整 snapshot 与世界视图可用 `≤5s`；可见区域/近景细化 `≤150ms`；稳定交互 `60 FPS`、P95 帧时间 `≤25ms`；地图自有 CPU 与 GPU 内存合计 `≤256MiB`。

### 发布前兼容策略

- 项目上线前不维护旧地图、旧 snapshot、旧 generator 或旧 visual bundle 的兼容。
- 生成规则发生不兼容变化时直接提升 generator version、更新测试种子并重新生成；不写迁移代码。
- 是否需要正式存档和上线后的兼容政策，等产品接近发布时另行设计。

### 模板目录与 seed 入口

- 首版提供八个原创宏观模板：大陆、双大陆、群岛、岛链、内海、环陆、破碎海岸和三洲。
- 模板只约束大陆数量、海陆比例、连通性、内海、岛屿尺度与海岸破碎度等宏观地理；它不固定 biome 配方。气候和自然地理可以使某个具体世界缺少个别基础生境。
- 默认 seed 自动生成且不在玩家入口展示；开发诊断模式允许查看、输入和复用 seed。相同模板与 seed 必须得到相同地图事实。
- 模板缩略图是美术绘制的类型示意，不冒充当前 seed 的结果预览。
- 第一次选择模板直接生成；当前已有世界时再次生成，必须先明确提示当前世界会被替换。确认后旧 snapshot 立即退出当前会话，不提供恢复。

### Loading 契约

- 选择模板后进入独立全屏 loading，不在背景保留旧世界，也不展示半完成地图。
- 玩家可以取消当前 `GenerationJob` 并返回模板选择；已经被取消或被新任务取代的 Worker 消息不得改变会话状态。
- loading 显示真实加权百分比、当前阶段和一句具体状态。百分比由已完成工作单元计算，不使用假进度、循环回退、随机提示或填充等待时间。
- 阶段语义固定为地貌、水系、气候、生境、地表、植被与装饰、最终校验、世界视图准备；实际权重由基准测试校准，所有阶段合计为 `100%`。
- loading 的画面、排版和过渡需要单独完成正式视觉设计；架构只提供状态、阶段、进度、取消和完成事件。

### Visual bundle 失败语义

- visual bundle 必须完整校验后原子替换当前 `VisualCatalog`，不得让新旧 atlas、palette 或 manifest 条目混用。
- 更新失败时保留上一套有效目录；首次启动没有有效目录时，回退到内置 P0 placeholder。
- 回退属于明确可观察的诊断状态，不允许把缺失资源静默跳过或用程序几何临时补画。

### LOD 与详细 chunk 缓存

- LOD 由屏幕像素/世界格决定，阈值两侧设置迟滞区间，并使用 `100–160ms` 短交叉淡化；相机停在临界区时不得来回切换。
- 世界视图使用专用投影；区域与近景共享同一正式 sprite。LOD 切换不重新选择物件、不改变锚点，也不重算地图事实。
- 详细 chunk 缓存在固定内存预算内综合视口距离、相机移动方向和最近使用时间排序；预计即将进入视口的 chunk 优先于身后远离的 chunk。
- 内存压力首先淘汰不可见近景 GPU 资源，再淘汰不可见区域资源，最后才清除成本较低的派生计划；当前可见 chunk 与世界视图资源受到保护。

### WorldSnapshot 权威字段

`WorldSnapshot` 的元数据至少包含 `snapshotId`、`templateId`、`seed`、`generatorVersion`、固定世界尺寸和权威内容 checksum。逐格事实只保留：

- `elevation`：量化高程；
- `landform`：深海、外海、浅水、岸缘、低地、高地或山地；
- `hydrology`：海洋/湖泊/河流类型，以及河流等级与八方向流向；实现可以在模块内部压入单个字节，但接口必须保留这些语义；
- `biome`：八种基础生境之一；
- `groundMaterial`：当前格明确归属的子材质；
- `environmentTheme`：无主题或腐化等可叠加环境主题。

温度、湿度、各尺度噪声、地表斑块场、植被簇场、候选点和排斥计算只属于 `WorldGenerator` 的实现；最终物件放置完成后全部丢弃。projection 不得重新采样这些生成场。

### 稀疏地图物件

普通地图物件采用 struct-of-arrays，而不是百万格对象表或大量 JavaScript 对象：

- `objectIds: Uint32Array`：当前 snapshot 内稳定的确定性 ID；
- `anchorCells: Uint32Array`：底部锚点所在世界格；
- `semanticFamilyIds: Uint16Array`：树木原型、灌木、岩石等稳定语义族；
- `formTags: Uint16Array`：视觉年龄、高度形态和必要的自然状态；
- `variantSeeds: Uint32Array`：交给 visual catalog 选择具体轮廓和 colorway 的稳定种子；
- `chunkOffsets: Uint32Array`：`16×16` 个 chunk 的连续范围索引。

物件记录先按 chunk、再按锚点 Y/X 和稳定 ID 排序。projection 查询一个 chunk 时只遍历对应连续区间；逻辑占地、排斥距离和候选噪声不进入 snapshot。

### 水系、斑块与植被簇

- 海洋、湖泊和河流类型、河流等级、流向以及入海口所需的逐格关系属于权威水系事实。
- 当前不创建海洋对象、湖泊对象或河流对象，也不保存水体持久 ID。
- 地表斑块和植被簇只是生成空间结构，不拥有长期 ID。snapshot 保存它们产生的最终材质格与真实物件。
- 世界 LOD 直接聚合 snapshot 中的真实逐格材质和稀疏物件，不读取已经丢弃的斑块/簇噪声。

### WorldRulesCatalog 与 VisualCatalog seam

`WorldRulesCatalog` 由 `WorldGenerator` 拥有，包含八种模板、地貌与生境规则、材质语义、物件生态条件、密度、尺寸族、逻辑占地和排斥距离。它只引用稳定语义族，不包含文件路径、atlas 页、像素轮廓或当前 variant 数量。

`VisualCatalog` 由资产管线拥有，包含这些语义族当前可用的具体视觉 variant。资产导入必须交叉验证：

- 所有生成规则引用的语义族都存在；
- visual manifest 声明的尺寸族、逻辑占地、锚点和最大溢出满足规则目录；
- placeholder 与正式素材不会因为画布、裁切或轮廓变化改变物件锚点与排斥关系。

生成器永远不读取 visual manifest；renderer 永远不读取生态密度或放置规则。

### RenderChunkPlan

`MapProjection` 按 chunk 和 LOD 返回只读、可丢弃的紧凑批次，不创建 Canvas、Pixi 对象或 GPU texture。计划按下列层组织：

1. 地表基础；
2. 地理过渡；
3. 低矮覆盖物；
4. 落地阴影；
5. 按底部锚点排序的直立物件；
6. 前景遮挡片；
7. 水面与环境效果；
8. 选择反馈。

每个批次只包含 renderer 必需的整数数据：visual handle、位置、拓扑遮罩、节奏 variant、排序键、colorway、shadow/foreground 引用和动画相位。大量地表命令必须使用 TypedArray 或等价紧凑批次，不创建逐 tile JavaScript 命令对象。Pixi 只执行计划，不查询 biome、规则目录或随机数。

### 动画时钟

- 所有必需和可选动画共享单调递增的视觉时钟，不引入游戏时间或模拟 Tick。
- 每个动画实例使用位置、世界 seed 和相位类别得到确定性偏移；同类素材不会全地图同步闪烁，也不会因加载顺序改变相位。
- 只有可见 chunk 更新动画。页面失焦时暂停视觉时钟；恢复时继续，不补算离屏帧。
- 低动态模式关闭可选植物动画，并降低必需水体动画的更新频率；世界视图始终静态。

### GenerationJob 失败状态

- 生成失败后 loading 停留在明确失败状态，并保留原 `templateId + seed`。
- 玩家可以使用相同输入重试，或返回模板选择；系统不得自动更换 seed 掩盖确定性错误。
- 失败、取消和被新任务取代是三种不同结果。它们都不得提交 snapshot 或遗留可见 chunk。

### Worker 所有权交接

- Worker 请求只包含 `jobId`、`templateId`、`seed` 和 `generatorVersion`；进度响应只包含任务 ID、阶段、已完成工作单元和总工作单元。
- 生成完成并通过内部校验后，Worker 使用 Transferable ArrayBuffer 一次性交出 snapshot 的所有 TypedArray 所有权；主线程不保留第二份副本，也不启用 SharedArrayBuffer。
- 主线程只接受当前活动 `jobId` 的完成消息。取消、失败或已被新请求取代的任务即使迟到，也必须被忽略并释放其 buffers。
- snapshot 交给主线程后，Worker 不再参与 projection、缓存或查询。

### MapSession 接口

`MapSession` 是 React 和地图运行时之间唯一的外部 seam，只暴露：

- `generate({ templateId, seed })`；
- `cancelGeneration()`；
- `setViewport(viewport)`；
- `replaceVisualBundle(bundle)`；
- `subscribe(listener)`；
- `destroy()`。

订阅状态只包含模板/seed、loading 阶段与进度、失败信息、当前 LOD 和少量可见诊断；不得包含 snapshot TypedArray、Pixi 对象、chunk 计划或缓存条目。相机手势、高频动画和 chunk 状态留在 `MapSession` 实现内部，不通过 React state 往返。

### 并行就绪门

- `GenerationJob`、正式 visual bundle 校验与必要 atlas 解码在 loading 中并行开始。
- 正式 visual bundle 失败会立刻切换为内置 P0 的校验与解码，不取消地图生成。
- 只有 snapshot、有效 `VisualCatalog` 和静态世界视图 texture 三者全部就绪，`MapSession` 才从 loading 进入世界状态。
- 区域与近景 chunk 不属于首次进入世界的就绪门；它们按当前视口在进入后渐进准备，但必须满足 `≤150ms` 可见细化门槛。

### GPU 表现策略

- 每个详细 chunk 将静态地表、地理过渡和静态低矮覆盖物预栅格化为一张原生 `4px/格` 的静态 texture。
- 树木、岩石等直立物件，以及它们的 shadow、foreground 和动画帧，只为可见与预取范围建立可排序 sprite batch。
- 允许动画的低矮植物不烘焙进静态 texture，而进入可见动态批次；其他低矮覆盖物进入静态 texture。
- Pixi 按 atlas、blend mode 和层级批处理，不能为了减少 draw call 改变锚点排序或跨 chunk 遮挡事实。

### 世界视图 texture

- 每个 `snapshotId + visualCatalogVersion` 组合只生成一张 `1024×1024` 静态世界视图 texture。
- texture 由地貌、生境、岸线、水系和聚合后的 `lod-world` 符号构成；它不直接缩小区域 texture，也不包含动画。
- 世界视图 texture 和当前可见 chunk 是缓存的最高保护等级。更换 visual catalog 后，新世界视图准备完成才原子替换旧 texture。

### MapCache

`MapCache` 是 projection 计划、静态 chunk texture、可见 sprite batch、atlas 引用和世界视图 texture 的唯一预算所有者：

- 每个条目声明估算 CPU/GPU 字节、构建成本、snapshot/catalog 版本、chunk、LOD 和最后使用时间；
- 淘汰评分综合可见性、视口距离、相机方向、最近使用时间和重建成本；
- 当前世界视图、当前可见 chunk 与正在完成的原子 visual swap 不得被淘汰；
- 总估算超过 `256MiB` 前必须主动淘汰，不能等待浏览器或 Pixi 的非确定回收；
- 销毁 GPU 条目时必须同步释放 texture/source，不只从 Pixi 容器移除。

### Projection 与上传调度

- 相机正在交互时，每帧分配给 projection 与 GPU 上传的总预算约 `4ms`；loading 或相机静止时可以提高到 `8ms`。
- chunk 任务按当前可见、预计进入视口、距离和构建阶段排序。离开预测视口两圈、且尚未接近完成的低优先任务可以取消。
- 已进入不可中断 GPU 上传尾段的任务允许完成，随后按正常缓存规则保留或淘汰，避免重复上传抖动。
- 区域与近景共享已解析物件、静态 chunk texture、visual handles 与 sprite 来源；近景只进行整数放大，并启用选择反馈和允许的动画细节，不建立第二套完整视觉缓存。

### 模板目录载体

- 八种模板作为 `WorldRulesCatalog` 内部的类型化只读数据随生成器发布，并在测试与启动校验中验证唯一 ID、参数范围和结构约束。
- 模板不是运行时 JSON、用户内容或 mod seam，也不得退化为散落在生成函数中的条件分支。
- 模板缩略图通过稳定模板 ID 在 `VisualCatalog` 中引用；缩略图美术可以替换，不改变生成参数。

### 世界内 visual bundle 原子替换

- 世界打开期间加载新 visual bundle 时，当前 catalog、世界视图和可见 chunk 保持可见并继续响应相机。
- 新 bundle 必须先完成完整校验、atlas 解码、新世界视图以及当前可见 chunk 的准备；随后用 `100–160ms` 短交叉淡化原子切换。
- 新 bundle 失败时释放其临时资源并保留旧 catalog 与旧画面，不进入全屏 loading，也不产生新 snapshot。
- 任一帧只能使用一个 `visualCatalogVersion`；禁止在同一世界画面中混用新旧资源。

### Snapshot 与固定种子验证

- snapshot checksum 覆盖 `templateId`、seed、generator version、世界尺寸、所有权威逐格数组，以及所有稀疏物件数组和 chunk offsets；不包含 visual catalog、相机、缓存或生成期临时场。
- 每个模板至少保留一组固定 seed 的精确 checksum fixture，同时验证海陆比例、连通性、水系、生境面积、物件密度、树冠间隙和对象排序等结构不变量。
- 有意改变生成规则时必须提升 generator version，并在审查实际差异后显式更新 fixtures；不得为了让测试通过而自动重录。

### MapProjection 验证

- 小型人工 snapshot 与每种模板的固定关键 chunk 使用精确 `RenderChunkPlan` golden，验证 visual handles、遮罩、位置、层、排序和相位。
- 属性测试覆盖完整 `47` 种拓扑、对角约束、halo 一致性、确定性 variant、洗牌袋、重复冷却、跨 chunk 物件排序和不同任务顺序的一致结果。
- 测试只跨 `MapProjection` 外部 interface 断言计划，不依赖内部 resolver 或缓存函数。

### Pixi renderer 验证

- 自动测试验证计划执行、层顺序、texture 创建/复用/销毁、visual swap、缓存淘汰、失焦动画暂停和 `destroy()` 后资源清空。
- 真实像素结果使用桌面真实浏览器的 `1×/4×` contact sheet、三档 LOD 截图和四组地图视觉验收板。
- 不要求不同浏览器或 GPU 的最终 framebuffer 逐像素完全相同，但必须保持最近邻采样、无裁切、无错层和语义事实一致。

### 性能降级顺序

接近内存或帧时间门槛时，只允许按顺序：

1. 缩小相机方向外的预取半径；
2. 降低可选植物动画更新频率；
3. 降低必需水体动画更新频率，但不关闭区域/近景水面；
4. 淘汰不可见近景 GPU 资源；
5. 淘汰不可见区域 texture 和成本较高的派生计划。

任何降级都不得删除当前可见地图物件、改变具体 variant/colorway、移动锚点、模糊像素、降低当前视口的地表分辨率，或切换到错误 LOD。世界视图和当前可见 chunk 始终受保护。

P0、P1、P2 各阶段必须分别满足当时素材规模下的 loading、内存、稳定帧时间和可见细化门槛；失败会阻断阶段完成和后续素材扩充，不只记录为风险。

### 替换旧原型的实施顺序

采用纵向替换，不在旧 `MapRenderer` 内继续打补丁，也不长期保留双链路：

1. 建立 schema、权威类型、`WorldRulesCatalog`、visual manifest 校验和接口测试；
2. 建立 P0 `VisualCatalog`、Worker snapshot、`MapSession`、模板入口与 loading；（已完成）
3. 完成“模板 → loading → 世界视图 → 一个区域 chunk”的新链路闭环，并把应用入口切到新 `MapSession`；（已完成）
4. 立即删除旧四张 SVG atlas、旧 atlas loaders、枚举行列约定和旧 `MapRenderer`，不保留 runtime flag 或兼容 adapter；（已完成）
5. 完成所有静态地表、地理过渡、稀疏物件、shadow、foreground、LOD、缓存和动画；
6. 使用 P1 完成温带草原/林地、完整水岸、高程和腐化视觉切片与性能验收；
7. 使用 P2 覆盖八生境，并完成完整世界、视觉与性能验收。

每一步只在前一步的接口测试、运行时证据和计划同步完成后推进。P0/P1/P2 是资产与验收成熟度，不是并存的三套运行时。

## MapSession 状态机

顶层状态只有：

```text
template-selection
  └─ generate ────────────────→ loading
loading
  ├─ ready ───────────────────→ world
  ├─ failed ──────────────────→ failed
  └─ cancel ──────────────────→ template-selection
failed
  ├─ retry same template/seed ─→ loading
  └─ back ────────────────────→ template-selection
world
  └─ confirm replacement ─────→ loading
any live state
  └─ destroy ─────────────────→ destroyed
```

- `destroyed` 是终态；之后所有命令均失败，迟到异步结果只能释放。
- loading 不保留旧世界作为并行状态，也不允许两个 snapshot 同时成为当前世界。
- visual bundle 原子替换是 `world` 内部的 `visualStatus: stable | preparing | fallback`，不创建第二个顶层状态。
- 取消只公开“已返回模板选择”的结果；失败公开稳定错误类别；任务队列、Worker 生命周期和缓存构建阶段不进入订阅状态。

## 浏览器与像素基线

- 正式 renderer 要求 WebGL2，不维护完整 Canvas2D renderer，也不提前要求 WebGPU。能力不足时进入 `gpu_unsupported`。
- renderer resolution 支持 `devicePixelRatio` 1 至 2，并封顶为 2；地图 texture 始终保持原生像素和最近邻采样。
- 相机动画期间允许短暂小数变换；交互停止和 LOD 落定后，相机平移与目标缩放对齐设备像素，避免静止画面发虚。
- 平移、滚轮缩放、LOD 阈值、迟滞和高频 viewport 更新由 Pixi/MapSession 内部持有。React 只接收状态或选择发生变化等低频通知。

## 观察命中与选择

- 首版保留世界格和地图物件的 hover/click 命中，用于视觉检查与后续扩展；不制作复杂 inspector 或玩法。
- 对外只暴露 `SelectionSummary`：`kind`、可选稳定物件 ID、世界格坐标和语义 ID。内部物件数组、visual handle、atlas frame 和排斥数据不得暴露。
- 命中与选择不会修改 snapshot。选择轮廓、脚点和提示属于 `RenderChunkPlan` 的选择反馈层。
- 世界 LOD 只允许命中世界格；区域与近景可以命中独立物件。同一物件跨区域/近景保持相同稳定 ID。

## 公开错误与诊断

`MapSession` 对 UI 只暴露稳定错误类别：

- `generation_failed`；
- `visual_bundle_invalid`；
- `gpu_unsupported`；
- `memory_budget_exceeded`；
- `render_failed`。

详细异常、Worker stack、atlas 页、文件路径、缓存统计和内部阶段只进入开发诊断。P0 回退通过非致命 `visualFallback: p0` 状态表达；内存压力可以成为诊断警告，但只有无法保护当前可见事实时才升级为 `memory_budget_exceeded`。用户可见文案在 loading/UI 视觉设计阶段单独编写，不直接显示内部错误文本。

## 源目录与唯一公共入口

新地图运行时统一收进 `src/map`：

```text
src/map/
  index.ts                 # 唯一公共入口
  session/                 # MapSession 与状态机
  model/                   # WorldSnapshot 权威类型
  generation/              # WorldGenerator 与 Worker adapter
  rules/                   # WorldRulesCatalog
  projection/              # MapProjection 与 RenderChunkPlan
  visual/                  # manifest schema、VisualCatalog 与导入校验
  render/                  # Pixi renderer、相机与命中
  cache/                   # MapCache 与调度
```

`src/map/index.ts` 只导出 `createMapSession`、`MapSession`、`MapSessionState`、`MapTemplateSummary`、`SelectionSummary` 和稳定错误类型。页面与应用壳不得深层 import 其他目录；各内部模块也不得绕过明确 interface 读取对方实现文件。

## 最终接口图

```text
React template/loading shell
        │ commands + low-frequency state
        ▼
┌──────────────────── MapSession ────────────────────┐
│ state machine · current snapshot · viewport · jobs │
└───────┬──────────────┬───────────────┬─────────────┘
        │              │               │
        ▼              ▼               ▼
 WorldGenerator   VisualCatalog    MapProjection
 (Worker adapter) (validated bundle) (pure chunk plans)
        │              │               │
        └──── snapshot ┴──── ready ─────┤
                                       ▼
                                  MapCache
                                       │
                                       ▼
                                Pixi MapRenderer
                          camera · hit test · WebGL2
```

## 规格状态

地图架构已经进入实施阶段，且不存在必须由正式美术制作者先回答的问题。P0 阶段 1–4 已完成世界到近景的浏览器可见地图层基线：

- 八种模板的具体生成参数需要在固定种子测试中调校；
- 阶段 3 只暴露一个代表性主大陆模板与固定验收种子；其余模板规则仍保留，但没有进入本阶段视觉验收；
- visual manifest schema、P0 manifest、八类 PNG contract atlas、浏览器解码/alpha 门槛与可重复 atlas 生成脚本已经建立；正式 contact sheet、密度板与跨 LOD 验收板尚未建立；
- `WorldSnapshot`、`WorldRulesCatalog`、`VisualCatalog`、真实 Worker snapshot、`MapSession`、分层 projection、世界 texture、完整可见 chunk 调度、受保护 LRU 缓存与 Pixi WebGL2 执行器均已接入应用入口；
- 正式美术制作者、最终像素轮廓和精确 palette 色值继续保持未决。

阶段 3 的网格马赛克和阶段 4 的混合 LOD 切片均已从根因修正。P1-1 现以固定 `continent + 0x1a2b3c4d + chunk(128,640)` 建立第一条可复现温带海岸视觉验收线，并通过完整 `p1-temperate-coast-4` bundle 原子替换 P0 运行时目录。地图事实、对象位置、projection 和缓存算法没有因美术升级而重写。

首次 P1-1 复验暴露的冷启动卡顿来自 `VisualCatalog` 对每个视觉查询反复扫描完整目录，以及详细 chunk 使用大量同步 Canvas 绘制调用，而不是树木事实本身。当前候选集按规范化查询缓存，atlas 已解码为像素源，chunk 在 `ImageData` 中合成后一次上传；可见 chunk 以 `8ms` 时间片优先构建，预取不能阻塞可见覆盖。降噪材质版固定浏览器场景实测 9 个可见详细 chunk 约 `59.3ms` 原子就绪，P95 帧时约 `15.8ms`。

地表 v3 在 `RenderChunkPlan` 增加确定性 overlay handle 与三段 shore band，不增加长期地图事实；renderer 以世界 seed 和绝对坐标计算跨 chunk 连续的量化材质场，因此不会重新生成物件或产生 chunk 接缝。`ground` debug 只改变 layer 可见性，不改变 projection、缓存或 snapshot。

P1-2 继续保持事实/视觉边界：`WorldSnapshot.environmentTheme` 只记录不规则侵染归属，`RenderChunkPlan` 才派生 `biomeBridges`、`elevationBands`、`themeBands` 和 effect handle。固定验收 chunk 为 `180/118/166`，structure debug 直接读取这些列。代表模板的山核与高地/山地物件密度属于生成事实，因此 generator version 已升至 `4`；交错色面、岩缘明暗和侵染裂纹仍是可替换视觉，不进入 snapshot。P1-2 已通过实际 Web 复验；下一步按湿热、干燥、寒冷三个区域切片补齐六种生境，再以独立 `lod-world` 投影完成世界远景和八模板完整世界验收。

P2-1 雨林/湿地已通过用户 Web 复验。P2-2 不改变 snapshot schema、生成种子语义或 chunk 调度：固定 `continent + seed 8` 的 chunk `126/141` 只为 projection 与相机提供可复现验收坐标。`p2-dry-2` catalog 在既有 551 个语义槽位上增加独立旱地地表与装饰候选，共 599 个可替换资产；旧湿热与温带候选仍按 biome tag 保持隔离。装饰精修只替换 manifest 后面的像素内容和 silhouette form 元数据，不移动任何物件，也不改变密度。atlas 构建按裁切后的 alpha mask 验证旱草、高草、灌木、仙人掌、小石、岩簇、树桩和枯树每族至少 3 种真实轮廓；浏览器仍通过同一 Pixi/WebGL2 链路验证草原、沙漠、ground-only、近景拖动和确定性重放。

P2-3 继续使用相同 snapshot、projection 与 renderer seam。生成器版本 5 只增加确定性寒冷山脊这一权威地形事实，使固定世界真实具备“寒冷 + 高地/山地”的交集；视觉目录仍只按 biome、ground material、landform 与语义族解析资源。`p2-cold-1` 共有 680 个资产，固定 chunk `36/24/38` 分别验证苔原雪岸、极地冰岸和寒冷山脊。atlas 坐标没有进入 snapshot，替换正式素材仍只需通过 manifest 的尺寸、锚点、占地、层级与引用检查。
