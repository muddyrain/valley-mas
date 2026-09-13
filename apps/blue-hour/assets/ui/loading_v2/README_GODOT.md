# 蓝时归航 Loading 2.0 · Godot UI 素材包

目标：把已定稿的二次元 Loading 视觉拆成可直接导入 Godot 的透明 PNG 层。
基础设计分辨率：1920×1080。

## 目录

- `core/`：实际可接入 Godot 的透明 PNG 素材。
- `reference/loading_final_reference.png`：最终效果图，仅用于对照，不要直接当成 Loading 整屏背景。
- `reference/asset_sheet_source.png`：拆分源素材表。
- `reference/transparent_assets_preview.jpg`：透明素材总览。
- `manifest.json`：素材尺寸、用途、建议 z_index。

## 关键实现约束

1. **不要把最终效果图作为整张背景播放。** 背景请由 Godot 用深海军蓝 `ColorRect + Gradient/Shader + Vignette` 实现，这样屏幕比例适配更稳定。
2. `07_character_group.png` 是主视觉整体层，当前包含 **女孩 + 猫 + 坐席箱体**。它适合整体做 2~3px 呼吸、0.15°以内摆动和轻微视差，不要再拆骨骼。
3. `16_foreground_crates.png` 是独立前景层，可比人物移动幅度更大，制造 2.5D 景深。
4. `17_lantern.png` 与 `18_lantern_glow.png` 分开使用。Glow 建议 `CanvasItemMaterial` Add 混合，Alpha 在约 0.65~0.95 间做随机缓动。
5. `13~15_particle_*.png` 用 `GPUParticles2D` 或对象池随机生成；同时在屏数量建议 6~12，生命周期 4~8s，避免太花。
6. `22~23_smoke_*.png` 低透明度慢速漂移即可，不要做大范围浓雾。
7. `02_progress_bar_bg.png` + `03_progress_bar_fill.png` 可用于 `TextureProgressBar`。百分比数字必须用 Godot `Label` 动态显示，不要烘焙成图片。
8. `04/05/06_check_*.png` 对应加载步骤的完成 / 等待 / 进行中状态。

## 不要切成图片的文字

以下内容请由 Godot `Label/RichTextLabel` 直接渲染，便于真实加载阶段切换：

- `正在读取归航记录…`
- `正在恢复幸存者档案…`
- `正在同步营地状态…`
- `正在整理物资记录…`
- `正在准备今日行动…`
- `欢迎回来。`
- `0~100%`
- 加载步骤文本 / 状态文本 / TIPS 文本 / TO A BRIGHTER TOMORROW

## 推荐层级

```text
LoadingScreen
├─ Background                         z=0   # Godot 原生深蓝渐变/暗角
├─ BackDecor                          z=10
│  ├─ Photo01 / Note01
│  ├─ Photo02 / Note02
│  └─ Ticket
├─ Smoke                              z=18
├─ CharacterGroup                     z=20
├─ ForegroundCrates                   z=30
├─ LanternGlow                        z=34
├─ Lantern                            z=35
├─ BlueParticles                      z=40
├─ DecorativeMarks                    z=55
├─ UI                                 z=60
│  ├─ Logo
│  ├─ LoadingTitle (Label)
│  ├─ TextureProgressBar
│  ├─ Percent (Label)
│  └─ LoadingSteps
└─ Transition                         z=100
```

## Godot 导入建议

- PNG：保持 Lossless；UI 不需要 mipmaps。
- 过滤：开启线性过滤，避免缩放锯齿。
- 不要对透明素材重新压成 JPG/WebP 有损格式。
- 设计锚点建议基于 1920×1080，再用 Control Anchors + `KEEP_ASPECT` 适配宽屏。
- 右侧美术区与左侧 UI 区分开做 CanvasItem/Tween，避免整屏一起移动。

## 推荐动画幅度

- CharacterGroup：Y ±2~3px / 3.5~4.5s；Scale 1.000→1.004；Rotation ±0.15°。
- ForegroundCrates：X/Y 4~7px 慢速视差。
- Photos/Notes：1~2px 浮动，周期错开。
- LanternGlow：Alpha 0.65~0.95，2~4s 随机缓动。
- CheckLoading：Scale 0.92→1.05 / Alpha 0.55→1.0 呼吸。
- Particles：缓慢斜向上飘 + 小角度旋转 + 淡入淡出。

备注：这一包优先保证“Codex 能直接接入 Godot 并实现动画”。动态文字没有烘焙进图片，是故意保留为程序 UI。
