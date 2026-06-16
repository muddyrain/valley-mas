# Seed Garden · Prompt 模板 v3.2

> 「语种园」图鉴植物离线批量出图的 prompt 模板。
> 用于在 **ChatGPT Pro / GPT Image 1** 中批量产出 1024×1024 图鉴主体图，**不在运行时调用图片生成 API**。

- 文档版本：v3.2（与设计文档 §7.3 对齐）
- 创建日期：2026-06-16
- 上游设计：[`2026-06-16-seed-garden-design.md`](./2026-06-16-seed-garden-design.md)（§7.1 风格定调、§7.2 资产规范、§7.3 Prompt 模板、§7.4 资产生产流程、§7.5 稀有度装饰、§7.6 图鉴卡 UI、§14.1 已验证视觉锚点）

---

## 1. 用途与边界

| 项 | 内容 |
|---|---|
| **用途** | 在 ChatGPT Pro 内调用 GPT Image 1，按本模板批量生成「概念植物」图鉴主体图，落盘到 `apps/seed-garden/public/assets/encyclopedia/` |
| **风格锚点** | Nintendo / Animal Crossing / Pikmin / Kirby 风格的 **soft 3D-stylized 2D illustration**，plush toy aesthetic，cel-shaded |
| **画布规格** | 1024 × 1024 正方形（1:1），主体居中、占画布 65%-75%、上下左右安全边距各 ≥ 15% |
| **背景** | 暖黄 `#FFE9B0` → 桃橙 `#FFD09A` 的径向渐晕，铺满四边，**不含卡框** |
| **描边** | 暖深棕 `#4A3A2C` 统一线宽 |
| **不要包含** | 文字、UI、卡框、白边、水彩、纯白背景、多主体 |
| **运行时是否调用** | **否**。只用于离线出图，前端直接加载 PNG/WebP 静态资产 |

> 已验证视觉锚点（设计文档 §14.1）：
>
> - 「未读消息·R」紫粉色铃铛 + 99+ 气泡 + 心口红点
> - 「周一早上·N」困倦咖啡豆 + 蒸汽 + 双脸蛋红晕 + 苔藓底座
>
> 这两张图风格一致地复刻了 v3.2 模板，可作为后续出图的参考样张。

---

## 2. 完整 Prompt 模板（一键复制）

下面是可以直接粘贴进 GPT Image 1 的完整英文模板。**每次出图时只需替换 `PLANT_VARIABLES` 的 5 个占位字段**，其它段落保持不变以保证风格统一。

```text
ART STYLE: Nintendo / Animal Crossing / Pikmin / Kirby inspired
  soft 3D-stylized 2D illustration, plush toy aesthetic,
  cel-shaded with soft gradient shading, glossy highlights,
  mobile game icon polish, chibi proportions, friendly and collectible feeling.

OUTLINE: warm dark brown #4A3A2C, consistent clean line weight (~6px equivalent),
  no sketchy or jittery strokes, slightly rounded corners.

BACKGROUND: full-bleed warm gradient, radial vignette,
  center color #FFE9B0, edge color #FFD09A,
  edge-to-edge fill, NO card frame, NO border, NO white margin,
  subtle warm soft glow around the subject.

COMPOSITION: 1:1 square, 1024 x 1024 px,
  single subject centered, subject occupies ~70% of canvas height,
  at least 15% safe margin on every side,
  subject standing on a tiny rounded soil / moss base when applicable,
  slight bottom contact shadow in warm brown.

NEGATIVE: NO text, NO letters, NO numbers, NO UI, NO HUD,
  NO card frame, NO border, NO watercolor, NO oil painting,
  NO photorealistic textures, NO pure white background,
  NO multiple subjects, NO logos, NO signatures, NO human figures.

PLANT_VARIABLES:
  Concept:           <CONCEPT>          // one short phrase, EN, the seed input
  Form:              <FORM>             // physical form of the plant (e.g. bell flower / coffee bean / venus flytrap / ginkgo)
  Signature element: <SIGNATURE>        // the iconic detail that makes the concept readable at a glance
  Mood:              <MOOD>             // emotional tone (e.g. shy, sleepy, sarcastic, dreamy, triumphant)
  Rarity:            <RARITY>           // N | R | SR | SSR; affects sparkle, aura and floating particles (see rarity table)
```

> 使用方式：
>
> 1. 复制以上完整代码块到 ChatGPT Pro。
> 2. 把 `<CONCEPT>` / `<FORM>` / `<SIGNATURE>` / `<MOOD>` / `<RARITY>` 替换为本次要画的概念变量。
> 3. **追加**对应稀有度的装饰描述（见第 3 节稀有度装饰表）。
> 4. 提交，得到 1024×1024 图。
> 5. 按第 5 节「使用约定」命名并落盘。

---

## 3. 替换变量与稀有度装饰

### 3.1 五个 PLANT_VARIABLES 字段

| 变量 | 含义 | 示例 |
|---|---|---|
| **Concept** | 用户输入的概念词，转成简短英文短语 | `unread message`, `monday morning`, `KPI`, `first love` |
| **Form** | 植物的整体物理形态（决定外观骨架） | `bell flower`, `coffee bean creature`, `venus flytrap`, `ginkgo tree sapling` |
| **Signature element** | 让人一眼看懂概念的标志性细节 | `red dot on chest like a notification badge`, `floating "99+" speech bubble`, `office tie around the stem` |
| **Mood** | 植物的情绪基调，影响表情、姿态 | `shy and longing`, `sleepy and reluctant`, `sarcastic and tired`, `dreamy and starry-eyed` |
| **Rarity** | 稀有度（N / R / SR / SSR），决定装饰强度 | 见下表 |

### 3.2 稀有度装饰差异化表（来自设计文档 §7.5）

| 稀有度 | sparkle | aura | 其他特征 |
|---|---|---|---|
| **N** | 1 颗小 sparkle | 无 aura | 极简、无额外粒子 |
| **R** | 3 颗 sparkle | faint inner aura（淡淡内发光） | 无飘浮粒子 |
| **SR** | 5 颗 sparkle | inner + outer halo（内外双层光环） | 少量 bokeh dots（散景光斑） |
| **SSR** | 5+ 颗 sparkle | full halo + light ribbon（完整光环 + 光丝飘带） | 飘浮粒子、星点流光 |

### 3.3 把稀有度装饰拼进 prompt 的示范

把下列对应稀有度的英文片段**追加**到 `PLANT_VARIABLES` 之后，作为单独一段 `RARITY_DECOR:`：

```text
# N
RARITY_DECOR: 1 tiny sparkle near the subject, no aura, no floating particles, minimal extra decoration.

# R
RARITY_DECOR: 3 sparkles around the subject, faint inner aura glow in warm pastel tone, no floating particles.

# SR
RARITY_DECOR: 5 sparkles around the subject, inner glow + outer halo (double-layer aura), a few soft bokeh light dots floating in the background.

# SSR
RARITY_DECOR: 5+ sparkles, full halo with thin curved light ribbon wrapping around the subject, multiple floating particles and starry streaks, premium legendary card feeling.
```

---

## 4. Worked Examples

> 说明：「未读消息·R」与「周一早上·N」对应设计文档 §14.1 的**已验证视觉锚点**；
> 「KPI·SR」与「初恋·SSR」是基于本模板设计的新概念，标注为**期望产出**，需要出图后回看是否对齐风格再决定是否入库。

---

### 4.1 未读消息 · R 🔵（已验证锚点）

**设计思路（30-60 字）：** Concept 选 `unread message`，Form 用紫粉色铃铛花强化「待回复的提示」，Signature 是胸口红点 + 头顶 `99+` 气泡的双重通知信号，Mood 设为 `shy and longing`，体现欲言又止的情绪。

```text
ART STYLE: Nintendo / Animal Crossing / Pikmin / Kirby inspired
  soft 3D-stylized 2D illustration, plush toy aesthetic,
  cel-shaded with soft gradient shading, glossy highlights,
  mobile game icon polish, chibi proportions, friendly and collectible feeling.

OUTLINE: warm dark brown #4A3A2C, consistent clean line weight (~6px equivalent),
  no sketchy or jittery strokes, slightly rounded corners.

BACKGROUND: full-bleed warm gradient, radial vignette,
  center color #FFE9B0, edge color #FFD09A,
  edge-to-edge fill, NO card frame, NO border, NO white margin,
  subtle warm soft glow around the subject.

COMPOSITION: 1:1 square, 1024 x 1024 px,
  single subject centered, subject occupies ~70% of canvas height,
  at least 15% safe margin on every side,
  subject standing on a tiny rounded soil / moss base when applicable,
  slight bottom contact shadow in warm brown.

NEGATIVE: NO text, NO letters, NO numbers, NO UI, NO HUD,
  NO card frame, NO border, NO watercolor, NO oil painting,
  NO photorealistic textures, NO pure white background,
  NO multiple subjects, NO logos, NO signatures, NO human figures.

PLANT_VARIABLES:
  Concept:           unread message
  Form:              violet-pink chibi bell flower with a small soft face inside the bell, two tiny leaf arms
  Signature element: a glowing red notification dot on the bell's chest area, plus a floating round speech-bubble shape above the head suggesting "99+" (rendered as abstract dot pattern, NO actual text)
  Mood:              shy and longing, slightly leaning forward as if waiting for a reply
  Rarity:            R

RARITY_DECOR: 3 sparkles around the subject, faint inner aura glow in warm pastel tone, no floating particles.
```

> **期望出图样貌：** 居中一朵紫粉色铃铛花，铃铛内有一张害羞的小脸，胸口位置有醒目红点，头顶飘浮一颗带圆形抽象斑点的气泡（不要包含真的「99+」文字），3 颗散落 sparkle，淡淡内发光，背景为暖黄到桃橙径向渐晕。

---

### 4.2 周一早上 · N ☕（已验证锚点）

**设计思路（30-60 字）：** Concept `monday morning`，Form 用拟人化咖啡豆胚芽，Signature 是头顶冒蒸汽 + 双颊红晕表达困意，Mood `sleepy and reluctant`，配苔藓底座强化早晨潮湿气息。

```text
ART STYLE: Nintendo / Animal Crossing / Pikmin / Kirby inspired
  soft 3D-stylized 2D illustration, plush toy aesthetic,
  cel-shaded with soft gradient shading, glossy highlights,
  mobile game icon polish, chibi proportions, friendly and collectible feeling.

OUTLINE: warm dark brown #4A3A2C, consistent clean line weight (~6px equivalent),
  no sketchy or jittery strokes, slightly rounded corners.

BACKGROUND: full-bleed warm gradient, radial vignette,
  center color #FFE9B0, edge color #FFD09A,
  edge-to-edge fill, NO card frame, NO border, NO white margin,
  subtle warm soft glow around the subject.

COMPOSITION: 1:1 square, 1024 x 1024 px,
  single subject centered, subject occupies ~70% of canvas height,
  at least 15% safe margin on every side,
  subject standing on a tiny rounded soil / moss base when applicable,
  slight bottom contact shadow in warm brown.

NEGATIVE: NO text, NO letters, NO numbers, NO UI, NO HUD,
  NO card frame, NO border, NO watercolor, NO oil painting,
  NO photorealistic textures, NO pure white background,
  NO multiple subjects, NO logos, NO signatures, NO human figures.

PLANT_VARIABLES:
  Concept:           monday morning
  Form:              chibi roasted coffee bean creature with two tiny leaf arms and stubby leaf feet, the bean shell forms a soft plush body
  Signature element: curling steam wisps rising from the top of the bean, half-closed sleepy eyes, and two round rosy blush patches on the cheeks
  Mood:              sleepy and reluctant, gently leaning to one side as if about to fall asleep again
  Rarity:            N

RARITY_DECOR: 1 tiny sparkle near the subject, no aura, no floating particles, minimal extra decoration.
```

> **期望出图样貌：** 居中一颗拟人化的咖啡豆，半闭的困眼、两团圆圆的红晕、头顶上升的两三缕蒸汽，脚下踩着小小苔藓底座，整体非常极简（仅 1 颗 sparkle、无 aura），背景为暖色径向渐晕。

---

### 4.3 KPI · SR 🟣（期望产出）

**设计思路（30-60 字）：** Concept `KPI`，Form 选食人花强化职场吞噬感，Signature 是花口里咬着一条领带 + 数据图表叶脉，Mood `sarcastic and tired`，整体调性带讽刺幽默。

```text
ART STYLE: Nintendo / Animal Crossing / Pikmin / Kirby inspired
  soft 3D-stylized 2D illustration, plush toy aesthetic,
  cel-shaded with soft gradient shading, glossy highlights,
  mobile game icon polish, chibi proportions, friendly and collectible feeling.

OUTLINE: warm dark brown #4A3A2C, consistent clean line weight (~6px equivalent),
  no sketchy or jittery strokes, slightly rounded corners.

BACKGROUND: full-bleed warm gradient, radial vignette,
  center color #FFE9B0, edge color #FFD09A,
  edge-to-edge fill, NO card frame, NO border, NO white margin,
  subtle warm soft glow around the subject.

COMPOSITION: 1:1 square, 1024 x 1024 px,
  single subject centered, subject occupies ~70% of canvas height,
  at least 15% safe margin on every side,
  subject standing on a tiny rounded soil / moss base when applicable,
  slight bottom contact shadow in warm brown.

NEGATIVE: NO text, NO letters, NO numbers, NO UI, NO HUD,
  NO card frame, NO border, NO watercolor, NO oil painting,
  NO photorealistic textures, NO pure white background,
  NO multiple subjects, NO logos, NO signatures, NO human figures.

PLANT_VARIABLES:
  Concept:           KPI
  Form:              chibi venus flytrap plush creature with a wide toothy mouth, plump green body, two tiny leaf arms
  Signature element: a striped office necktie loosely hanging out of the flytrap mouth, and the side leaves shaped like abstract bar-chart and arrow-up patterns (purely decorative, NO numbers, NO text)
  Mood:              sarcastic and tired, one droopy eye, the other half-rolled
  Rarity:            SR

RARITY_DECOR: 5 sparkles around the subject, inner glow + outer halo (double-layer aura), a few soft bokeh light dots floating in the background.
```

> **期望出图样貌（未验证）：** 居中一只 Q 版食人花，嘴里咬着一条松垮的条纹领带，左右叶片暗示柱状图与上升箭头但不出现数字文字，表情讽刺疲惫，5 颗 sparkle、内外双层 aura、若干散景光斑，整体保持暖色渐晕背景。**首次出图后需回看是否对齐风格锚点，再决定是否入库。**

---

### 4.4 初恋 · SSR 🌟（期望产出）

**设计思路（30-60 字）：** Concept `first love`，Form 选银杏树苗（叶片自带心形联想），Signature 是星光 + 心形光圈 + 淡粉色花瓣雨，Mood `dreamy and starry-eyed`，整体调性梦幻、传说级。

```text
ART STYLE: Nintendo / Animal Crossing / Pikmin / Kirby inspired
  soft 3D-stylized 2D illustration, plush toy aesthetic,
  cel-shaded with soft gradient shading, glossy highlights,
  mobile game icon polish, chibi proportions, friendly and collectible feeling.

OUTLINE: warm dark brown #4A3A2C, consistent clean line weight (~6px equivalent),
  no sketchy or jittery strokes, slightly rounded corners.

BACKGROUND: full-bleed warm gradient, radial vignette,
  center color #FFE9B0, edge color #FFD09A,
  edge-to-edge fill, NO card frame, NO border, NO white margin,
  subtle warm soft glow around the subject.

COMPOSITION: 1:1 square, 1024 x 1024 px,
  single subject centered, subject occupies ~70% of canvas height,
  at least 15% safe margin on every side,
  subject standing on a tiny rounded soil / moss base when applicable,
  slight bottom contact shadow in warm brown.

NEGATIVE: NO text, NO letters, NO numbers, NO UI, NO HUD,
  NO card frame, NO border, NO watercolor, NO oil painting,
  NO photorealistic textures, NO pure white background,
  NO multiple subjects, NO logos, NO signatures, NO human figures.

PLANT_VARIABLES:
  Concept:           first love
  Form:              chibi ginkgo tree sapling, plump round trunk with a tiny shy face, fan-shaped golden-pink leaves
  Signature element: a few leaves subtly shaped like soft hearts, a faint heart-shaped glow halo behind the canopy, and gentle pink-gold petal rain drifting around
  Mood:              dreamy and starry-eyed, soft blush on the cheeks, eyes shaped like tiny stars
  Rarity:            SSR

RARITY_DECOR: 5+ sparkles, full halo with thin curved light ribbon wrapping around the subject, multiple floating particles and starry streaks, premium legendary card feeling.
```

> **期望出图样貌（未验证）：** 居中一棵 Q 版银杏小树，金粉相间的扇形叶（部分隐隐成心形），冠层后透出淡淡心形光晕，环绕飘浮的粉金花瓣雨与星点流光，星眸表情，5+ sparkle、完整 halo + 光丝飘带，整体梦幻传奇感。**首次出图后需回看是否对齐风格锚点，再决定是否入库。**

---

## 5. 使用约定

### 5.1 命名规范

- 文件名：`<concept_key>_<stage>.png`
- `concept_key`：蛇形小写英文，简短可读，例如：`unread_message`、`monday_morning`、`kpi`、`first_love`
- `stage`：当前阶段编号，`1` = 萌芽、`2` = 中期、`3` = 成熟态；阶段数视稀有度（3-5）

示例：

```
unread_message_1.png
unread_message_2.png
unread_message_3.png
monday_morning_1.png
kpi_3.png
first_love_5.png
```

### 5.2 落盘路径

按稀有度归档到对应子目录：

```
apps/seed-garden/public/assets/encyclopedia/
├─ N/    monday_morning_*.png
├─ R/    unread_message_*.png
├─ SR/   kpi_*.png
└─ SSR/  first_love_*.png
```

### 5.3 同步更新 `manifest.json`

每张新图入库后，必须在 `apps/seed-garden/public/assets/encyclopedia/manifest.json` 追加一个条目，字段对齐设计文档 §5.3：

```json
{
  "key": "unread_message",
  "name_zh": "未读消息",
  "rarity": "R",
  "concept_tags": ["loneliness", "waiting", "social", "shy", "longing"],
  "stages": {
    "1": "R/unread_message_1.png",
    "2": "R/unread_message_2.png",
    "3": "R/unread_message_3.png"
  },
  "palette_hint": "violet pink"
}
```

字段说明：

| 字段 | 含义 |
|---|---|
| `key` | 蛇形小写英文，与文件名前缀一致 |
| `name_zh` | 中文展示名（图鉴卡显示） |
| `rarity` | `N` / `R` / `SR` / `SSR` |
| `concept_tags` | 5-10 个语义标签，用于 `assetMatcher.ts` 的标签重合度匹配 |
| `stages` | 阶段编号 → 相对路径 |
| `palette_hint` | 主色调提示，用于卡片背景微调 |

### 5.4 ⚠️ 红线提醒

- **本模板仅用于离线批量出图**，不得在运行时调用任何图片生成 API（Gemini / GPT Image / DALL·E / 火山等）。
- 运行时只通过 `assetMatcher` 在 `manifest.json` 中做语义匹配，命中已有 PNG。
- 设计目标是 **0 现金成本** 与 **风格 100% 一致**，任何「在线生图」方案都会破坏这两条约束。
- 出图后请把原始 prompt 与替换变量记录下来（例如保留在 PR 描述或单独的 `prompt-log.md` 内），方便日后回溯与微调。

---

## 6. 与设计文档的引用关系

| 本文档章节 | 上游来源 |
|---|---|
| §1 用途与边界 | 设计文档 §7.1 风格定调、§7.2 资产规范 |
| §2 完整 Prompt 模板 | 设计文档 §7.3 Prompt 模板 v3.2 |
| §3 替换变量与稀有度装饰 | 设计文档 §7.3 PLANT_VARIABLES、§7.5 稀有度装饰差异化 |
| §4 Worked Examples | 设计文档 §14.1 已验证视觉锚点（前两个）+ 本文档新增（后两个，标注期望产出） |
| §5.1-§5.3 使用约定 | 设计文档 §7.4 资产生产流程、§5.3 资产库 manifest |
| §5.4 红线 | 设计文档 §6.1 选型总览（AI 图片：不在运行时调用） |

— END —
