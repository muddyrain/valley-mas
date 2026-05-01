# 任务列表 · TASKS

本文件追踪 Toy Climb Arena 的开发任务。  
完成的任务用 `[x]` 标记，待办用 `[ ]`，进行中用 `[~]`。

---

## 里程碑 0.1 — 工程迁移（当前）

- [x] 从 `packages/climber-game` 迁移源码到 `apps/toy-climb-arena`
- [x] 配置 Vite + TypeScript 独立工程
- [x] 保留角色模型（peach.glb / daisy.glb）
- [x] 保留 Mixamo idle/run/jump 动画逻辑（在 characterRig.ts 中）
- [x] 保留现有物理碰撞系统（climberPhysics.ts）
- [x] 保留现有控制逻辑（ClimberArcadeExperience）
- [x] 保留 setpieces 资源（barrel_tower, beam_hazard 等 11 个）
- [x] 初始化 docs/GAME_DESIGN.md
- [x] 初始化 docs/LEVEL_DESIGN_RULES.md
- [x] 初始化 docs/TASKS.md
- [x] 初始化 docs/ASSET_GUIDE.md
- [x] 添加 AGENTS.md

---

## 里程碑 0.2 — 玩具世界视觉改造

- [x] 替换场景背景颜色为暖白（#FFF9F0）+ FogExp2 轻雾
- [x] 为地面添加暖木色拼接地板（#C8934A / #B07D3A）
- [x] 调整 AmbientLight / DirectionalLight 为暖色调（暖黄光 + 冷蓝补光）
- [x] 为所有平台添加乐高凸点装饰（CylinderGeometry，按表面格数排列）
- [x] 添加 12 个彩色散落积木地面装饰（无碰撞）
- [ ] HUD 界面玩具化改造（圆角、鲜艳配色、卡通字体）
- [ ] 添加背景装饰元素（远景玩具城市轮廓/彩色积木堆）

---

## 里程碑 0.3 — 关卡机制

- [x] 移动平台（4个，sin 往复，碰撞体实时同步，凸点跟随）
- [x] 弹跳板（2个，粉色，boostVelocity，压缩-弹出动画）
- [x] 不稳定平台（3个，idle→shaking→falling→resetting 状态机）
- [x] 存档点系统（首次触达闪烁 + 重生位置更新）
- [x] 落地粒子（黄色，22颗，0.4s 淡出）
- [x] 存档点激活粒子（蓝色，30颗，球形爆发，0.6s 淡出）
- [ ] **运行时浏览器全流程验收**（攀爬/弹跳/不稳定/存档/通关）
- [ ] 关卡难度曲线调优（验收后依据体感调整平台间距/机制密度）
- [ ] 跳跃/落地/通关粒子进一步细化（拖尾、颜色多样化）

---

## 里程碑 0.4 — 音效与氛围

- [x] BGM 背景音乐循环（C大调合成循环，triangle 波，Web Audio API）
- [x] 补充音效：弹跳板弹起（playBounce）、不稳定平台坠落（playUnstableFall）
- [x] 存档点激活专属音效（playCheckpoint）
- [ ] 通关庆典音效强化

---

## 里程碑 0.5 — 新角色与选择界面

- [ ] 调研玩具风格角色模型（CC0 授权）
- [ ] 制作或采购玩具人偶角色 GLB 模型
- [ ] 集成新角色，保留现有 Mixamo 动画系统
- [ ] 新增角色选择界面

---

## 里程碑 0.6 — 多人框架

- [ ] 设计多人网络架构（WebSocket / WebRTC）
- [ ] 实现本地多人（同屏分屏）原型
- [ ] 实现远程玩家位置同步（幽灵模式）
- [ ] 房间系统：创建/加入房间
- [ ] 简单排行榜展示

---

## 里程碑 0.7 — 关卡编辑器

- [ ] 设计关卡编辑 DSL
- [ ] 实现可视化关卡编辑器（Three.js 内嵌）
- [ ] 支持关卡导出/导入 JSON
- [ ] 社区关卡分享功能

---

## 已知技术债务

- [x] createClimberPrototype.ts 拆分：particleSystem.ts + groundScene.ts（2485→2156 行）
- [ ] setpieceCatalog.ts 硬编码资源路径，需改为动态注册
- [ ] characterAssets.ts 中 fallback URL 列表需清理
- [ ] 音频系统（prototypeAudio.ts）音效内容待丰富（不稳定平台晃动音效）
