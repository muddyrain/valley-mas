# HAOQI.DESIGN 指针流光机制一手来源核查

> 核查日期：2026-08-21  
> 范围：只核查鼠标移动触发的背景流光 / 拖尾、公开 `FluidPushPass`、运行参数与停算边界，并与 Valley MAS 当前工作树实现对照。  
> 结论时效：生产 bundle 会随部署变化；下文的公开代码证据绑定到本次页面实际引用的 chunk。

## 证据分级

- **Codrops 明示**：Haoqi 本人撰写的技术文章正文明确陈述，可视为作者对设计与架构的第一手说明。
- **公开代码直接证据**：`haoqi.design` 首页公开加载的生产 JavaScript chunk 中可直接读到的类、shader、默认值与运行分支。它能证明本次部署的行为，但不是稳定 API。
- **当前仓库代码**：2026-08-21 本地工作树中的 Valley MAS 实现；其中部分文件仍是未提交改动，本文只描述当前文件内容。
- **未确认**：文章和公开代码都不足以支持的结论，不作为实现事实使用。

## 核心结论

1. **Codrops 只明确到输入架构，没有披露流体 pass 细节。**文章说明同一指针会驱动 DOM 坐标、相机视差、玻璃边缘光和一个 fluid effect；全局 PointerBus 把浏览器坐标统一转换成 `0..1` UV，并维护 `inside`，在离开窗口、失焦或页面隐藏时回中。文章没有出现 `FluidPushPass` 名称，也没有给出流体求解链、shader、四次色散采样、默认参数、600ms 闲置门槛或移动端 / reduced-motion 分支。[Codrops 原文](https://tympanus.net/codrops/2026/08/15/inside-haoqi-design-letting-dom-and-webgl-share-a-retro-futurist-stage/)
2. **当前公开部署确有名为 `FluidPushPass` 的全屏后处理。**它读取 composer 的 `tDiffuse`，用速度场位移整幅已合成画面，并做 4 次带通道权重的复采样和额外光谱高光；它不是一个独立的加法光平面。[官网](https://haoqi.design/) · [本次公开生产 chunk](https://haoqi.design/_next/static/chunks/4d3f3b68dbbde33a.js)
3. **速度场采用多 pass 压力投影，但默认涡量增强为零。**公开部署按 curl → vorticity / pointer splat → divergence → pressure → pressure gradient → advection 的顺序更新半浮点速度场；然而生产实例以空配置 `new FluidPushPass({})` 创建，默认 `curlStrength=0`。因此“存在 curl / vorticity pass”是事实，“当前默认依靠非零涡量增强制造旋涡”不是事实。
4. **流体由桌面指针位移唤醒，不由滚动注入。**公开代码把指针 UV 转成 DPR 修正后的像素坐标，以相邻帧位置差作为 splat；位移平方大于 1 时刷新活跃时间。移动端、`prefers-reduced-motion: reduce`、实色全屏覆盖态或超过 600ms 未出现有效位移时，`uEffectEnabled` 关闭。滚动 / section 状态会影响全屏覆盖与 lens flare 的接管，但没有证据显示滚动速度被注入流体速度场。
5. **Valley MAS 已按本次证据完成拓扑纠偏。**核查开始时，full tier 仍是固定 `160 × 96` 的两个 HalfFloat ping-pong target 加独立 `AdditiveBlending` 光平面；当前工作树已改为按画幅比例调整的八 target 压力投影链，并将速度用于整幅 WebGL scene 位移与透明区主题流光。balanced tier 仍不运行流体求解，只绘制三条固定 ray 与指数型 pointer glow。

## Codrops 正文明确到什么程度

### 已明确

- 技术栈包含 Three.js / React Three Fiber 与 custom shaders / post-processing。
- 指针输入由一个全局 PointerBus 统一，浏览器坐标只转换一次，再同时供 React 快照和 WebGL 的 mutable `Vector2` 消费。
- 同一 pointer state 驱动 DOM 坐标读数、相机视差、玻璃 rim light 和 fluid effect。
- PointerBus 维护 `inside`；指针离窗、页面失焦或 tab 隐藏时 UV 回到中心，使效果从统一初态恢复，而不是复用陈旧坐标。

以上均来自作者本人撰写的 [Codrops 技术文章](https://tympanus.net/codrops/2026/08/15/inside-haoqi-design-letting-dom-and-webgl-share-a-retro-futurist-stage/)。

### 正文没有披露

- `FluidPushPass` 名称或其在 EffectComposer 中的顺序；
- curl、vorticity、divergence、pressure、gradient、advection 各 pass；
- HalfFloat target、模拟分辨率、pressure iteration 数；
- 指针 splat 半径 / 力度、速度耗散与色散强度；
- 4 次 `tDiffuse` 复采样；
- 600ms 闲置门槛、移动端和 reduced-motion 停算条件。

因此，这些实现细节必须标为“公开代码直接证据”，不能写成“Codrops 文章披露”。

## `FluidPushPass` 的公开代码直接证据

### 可复现快照

- 首页在 2026-08-21 实际引用：[`4d3f3b68dbbde33a.js`](https://haoqi.design/_next/static/chunks/4d3f3b68dbbde33a.js)
- 本次下载内容 SHA-256：`f092a9e10e37d9cb0a72c9e41a149d43ad663bbf3ab16928fcc0ae46d6005d7f`
- chunk 中的类名被压缩为局部符号，但构造器明确调用 `super("FluidPushPass")`；首页运行组件以空配置实例化它，所以以下“默认值”也是本次部署实际采用的初始值。

### 模拟链

活跃帧的顺序可直接从 `render` 方法确认：

1. 从 `velocityRead` 计算 curl；
2. vorticity pass 读取 curl，同时在指针附近注入 pointer delta；
3. 从该速度计算 divergence；
4. 清空 pressure A，并执行 4 次 Jacobi pressure iteration；
5. 从速度中减去 pressure gradient，写入 projected velocity；
6. 对 projected velocity 做半拉格朗日式 backtrace / advection 与耗散，写入 `velocityWrite`，随后交换 read / write；
7. display pass 读取 `tDiffuse` 与最新速度场，输出到 composer 的下一 buffer 或屏幕。

速度 read / write、curl、vorticity、divergence、pressure A / B、projected velocity 都是 `RGBA + HalfFloatType + LinearFilter` 的无 depth / stencil render target。模拟短边基准为 160，另一边按 viewport aspect ratio 扩展；它不是固定 `160 × 160`。

默认 `curlStrength=0` 使第二步中的 curl force 为零，但 pointer splat 仍在同一个 vorticity material 中注入，所以 pass 仍有实际作用。不能仅凭 pass 名称推断当前默认启用了非零涡量约束。

### 显示合成

display shader 的关键拓扑是：

- 输入为 composer 的 `tDiffuse`，而不是自行生成的一张背景光纹理；
- 从速度场得到 displacement 和 velocity magnitude；
- 固定循环 4 次，沿位移方向以不同偏移重采样 `tDiffuse`，并用不同 RGB 权重累加；
- 根据速度强度再加入 spectral highlight；
- `uEffectEnabled=0` 时位移和光谱高光归零，结果等价于传递原始 `tDiffuse`。

这意味着用户看到的“流光”不是单纯画在背景上的亮斑，而是对当前 composer 画面进行速度驱动的全屏位移 / 色散。公开 chunk 里另有 14 点的像素化 pointer overlay trail；它只在实色覆盖态启用，不应与这里的流体速度拖尾混为一谈。

### 本次部署默认参数

| 构造参数 | 默认值 | 实际派生 / 含义 |
| --- | ---: | --- |
| `strength` | `0.3` | display uniform 为 `strength / 0.3 = 1` |
| `radius` | `1.5` | splat radius uniform 为 `max(0.002 × radius, 0.0005) = 0.003` |
| `velocityScale` | `1` | splat force uniform 为 `max(3000 × velocityScale, 0) = 3000` |
| `chromaticStrength` | `0.002` | chromatic boost uniform 为 `chromaticStrength / 0.004 = 0.5` |
| `pressureIterations` | `4` | 每个活跃帧执行 4 次 pressure iteration |
| `curlStrength` | `0` | curl 仍被计算，但 curl force 默认不贡献速度 |
| `velocityDissipation` | `3` | advection 后按固定 `0.016` 时间步做耗散 |
| `simResolution` | `160` | 模拟短边基准，长边按视口宽高比调整 |

此外，EffectComposer 使用 `multisampling=0`、`UnsignedByteType` framebuffer；流体自己的模拟 targets 单独使用 HalfFloat。用于像素坐标换算的 DPR 被限制为不超过 2。

### 触发与停算边界

- 只有非移动端且未命中 `prefers-reduced-motion: reduce` 时，pointer UV 才转换成带 DPR 的像素坐标并计算帧间 delta。
- delta length squared 大于 1 才刷新“最后有效移动”时间；600ms 内保持流体 effect enabled，让已有速度继续投影、平流和耗散。
- 超过 600ms、移动端、reduced-motion 或实色覆盖态时，`setEffectEnabled(false)`；这会跳过整条流体模拟链，并令 display shader 传递未位移的 `tDiffuse`。
- 指针离开后不再产生新 delta，但公开代码会先把旧 delta 乘以 `0.9`，而 600ms 门槛仍按最后一次有效移动计算。因此不能把行为简化成“离开窗口立即清空速度场”。
- pass 是否成为最终 screen pass 还与 lens flare / bright section 状态有关。`enabled`、`renderToScreen` 与 `effectEnabled` 是不同开关；看到 pass 仍挂在 composer 上，不等于流体模拟仍在运行。

上述结论均来自本次 [公开生产 chunk](https://haoqi.design/_next/static/chunks/4d3f3b68dbbde33a.js)，而非 Codrops 正文。

## 与 Valley MAS 当前实现的差异

| 维度 | HAOQI.DESIGN 当前公开部署 | Valley MAS `full` tier | Valley MAS `balanced` tier |
| --- | --- | --- | --- |
| 模拟资源 | 8 个按视口比例调整的 HalfFloat targets；短边基准 160 | 8 个按视口比例调整的 HalfFloat targets；短边基准 160 | 无流体 target |
| 速度更新 | curl、vorticity / splat、divergence、4 次 pressure、gradient、advection 多 pass | curl、pointer impulse、divergence、4 次 pressure、gradient、advection 多 pass | 无速度更新 |
| 默认涡量 | pass 存在，但 `curlStrength=0` | pass 存在，当前 `uCurlForce=0` | 不适用 |
| 画面输出 | 全屏后处理 `tDiffuse`，4 次位移 / 色散复采样 | 全画布 WebGL scene 位移 / RGB 复采样；透明区额外输出低透明度主题流光 | 独立透明 plane；三条固定 ray + `exp(-10 × distance)` pointer glow |
| 活跃衰减 | 600ms 内布尔启用，依靠速度耗散自然收尾；之后 shader 传递原画面 | 600ms 内布尔启用并持续投影 / 平流；之后 pass 直通原画面 | 无模拟停算问题 |
| 设备降级 | 移动端和 reduced-motion 禁用流体求解 | 仅首页 `full` 档且首屏未完成退场时运行 | 小视口 / 低设备信号进入该档，使用静态 ray 近似 |

当前仓库证据：

- [`StagePostProcess.tsx`](../../apps/web/src/features/yuji-stage/StagePostProcess.tsx)：full tier 在唯一 R3F 帧循环内更新八个 HalfFloat target，并把压力投影速度场用于整幅 WebGL scene 的轻度位移、RGB 复采样和透明区主题流光。
- [`stageFluid.ts`](../../apps/web/src/features/yuji-stage/stageFluid.ts)：模拟画幅保持真实宽高比、短边基准 `160`；只在首页、指针活跃且首屏未完成退场时启用 pass。
- [`YujiStageCanvas.tsx`](../../apps/web/src/features/yuji-stage/YujiStageCanvas.tsx)：所有动态档共享固定 ray 的 `LightField`；full tier 关闭旧的局部径向 pointer glow，由 `StagePostProcess` 统一承担流体反馈。
- [`stageMotion.ts`](../../apps/web/src/features/yuji-stage/stageMotion.ts)：本地流体 activity 的 600ms 启停窗口。
- [`stagePerformance.ts`](../../apps/web/src/features/yuji-stage/stagePerformance.ts)：无 WebGL或 reduced-motion 进入 `static`；视口小于 760px、设备内存不高于 4GB 或逻辑核不高于 4 时进入 `balanced`，否则为 `full`。

本节记录的是研究后完成的纠偏结果：Valley MAS `full` 档现在与公开部署在“按画幅比例求解的压力投影速度场 + 全画布 WebGL 位移”这一拓扑上对齐，同时保留自身的透明 Canvas、主题流光、原创材质和无 Composer 架构。它不是 Haoqi shader 的逐行复制；`balanced` 档仍是固定光线加径向 pointer glow。

## 未确认项

- 未确认 Haoqi 开发仓库中的未压缩源码结构、类文件名或注释；公开 chunk 只能证明部署产物。
- 未确认这些默认参数是否通过未公开的构建环境或调试面板在其他部署中改写；本次首页以空配置实例化，故只对本次 snapshot 成立。
- 未确认肉眼观察到的每一束背景亮光都由 `FluidPushPass` 单独产生；同一 composer 还包含 lens flare、玻璃与其他场景内容。能确认的是流体 pass 如何扭曲最终输入。
- 未确认滚动会向流体速度场施力；公开代码只显示滚动相关覆盖 / section 状态会决定停算或与 lens flare 的输出接管。
- 未确认生产站在所有路由、所有 GPU 和 Safari / iOS 上保持相同行为与性能；本文没有把视觉观察或单机 FPS 当作代码事实。

## 来源

1. Haoqi Wen, [Inside HAOQI.DESIGN: Letting DOM and WebGL Share a Retro-Futurist Stage](https://tympanus.net/codrops/2026/08/15/inside-haoqi-design-letting-dom-and-webgl-share-a-retro-futurist-stage/), Codrops, 2026-08-15。
2. [HAOQI.DESIGN 首页](https://haoqi.design/)，用于确认本次部署实际引用的 chunk。
3. [`4d3f3b68dbbde33a.js`](https://haoqi.design/_next/static/chunks/4d3f3b68dbbde33a.js)，2026-08-21 公开生产快照，SHA-256 见上文。
4. Valley MAS 当前工作树：[`StagePostProcess.tsx`](../../apps/web/src/features/yuji-stage/StagePostProcess.tsx)、[`stageFluid.ts`](../../apps/web/src/features/yuji-stage/stageFluid.ts)、[`YujiStageCanvas.tsx`](../../apps/web/src/features/yuji-stage/YujiStageCanvas.tsx)、[`stageMotion.ts`](../../apps/web/src/features/yuji-stage/stageMotion.ts)、[`stagePerformance.ts`](../../apps/web/src/features/yuji-stage/stagePerformance.ts)。
