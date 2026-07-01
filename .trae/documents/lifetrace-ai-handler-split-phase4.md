# 第四刀 · lifetrace 剩余 prompt 下沉到 `lifetrace/ai/prompts/`

> 状态：**已落地（Task A-H 全部完成）**。基于 [第二刀](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/lifetrace-ai-handler-split-phase2.md) 落地结果自然延伸。第三刀（ai_client.go 双轨统一到共享 `internal/aiclient`）仍然 pending，本文件不涉及。

---

## Context

第一/二刀把 9 个 domain（today_advice / weekly_review / assistant / inbox / image_analysis / media_diary + 早期 3 个）的 prompt / parse / normalize 全部下沉到 `internal/lifetrace/ai/prompts/`，走 `PromptContract[I, O]` 三段式。剩余 7 个 domain 还留在各自 handler 里：

- recipe_video（recipe_video_handler.go）
- pantry_thumbnail（pantry_ai_handler.go）
- pantry_description（pantry_description_handler.go）
- recipe_suggestion（recipe_ai_handler.go）
- clothing_photo_analysis（closet_handler.go）
- pantry_photo_analysis（image_ai_handler.go）
- outfit_suggestion（closet_handler.go）

第四刀目标：**7 个 domain 的 prompt 字面量下沉到 prompts 包；Parse 视耦合度决定是否一并下沉；normalize 白名单留 handler 层**。行为零变化，只搬迁 + 加 shim。

**严格约束**：
- Prompt 字面量 1:1 搬运（CJK、标点、换行不改）
- Handler 保留同名 `buildXxx / parseXxx` 薄 shim，避免 test 断言和其他 handler 调用点批量重写
- `type xxx = prompts.Xxx` alias 复用类型（当上层引用旧类型名时）
- normalize 白名单（`normalizePantryCategory` / `normalizeClosetCategory` 等 handler 私有）**不下沉**，避免 prompts 反向依赖 handler
- 深度耦合 handler 内部类型（`model.LifeTraceClosetItem` / `pantryPhotoDetectedItem` 等）的 Parse 链**只下沉 Build**

**范围外（本刀不做）**：
- ai_client.go 双轨统一到共享 aiclient（留给第三刀）
- 测试文件按域拆分（沿用第一刀决定）

---

## 已落地成果

### 新增 prompts 文件

| 文件 | Domain | 覆盖能力 |
|---|---|---|
| [recipe_video.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/recipe_video.go) | recipe_video | BuildRecipeVideoHTMLPrompt（纯字符串输出） |
| [pantry_thumbnail.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/pantry_thumbnail.go) | pantry_thumbnail | BuildPantryThumbnailPrompt（图片 prompt，Location/Category 空值兜底） |
| [pantry_description.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/pantry_description.go) | pantry_description | Build + Parse + NormalizeTips（JSON 3 段式） |
| [recipe_suggestion.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/recipe_suggestion.go) | recipe_suggestion | Build + Parse + NormalizeRecipeSuggestions + NormalizeRecipeTextList + NormalizeRecipeDifficulty（含 Normalize context） |
| [clothing_photo_analysis.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/clothing_photo_analysis.go) | clothing_photo_analysis | Build + Parse 骨架（normalize 白名单留 handler） |
| [pantry_photo_analysis.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/pantry_photo_analysis.go) | pantry_photo_analysis | **只 Build**（Parse 300+ 行 normalize 链保留 handler，耦合 imageCropBox / detectedItem / dateHint） |
| [outfit_suggestion.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/outfit_suggestion.go) | outfit_suggestion | **只 Build**（Parse 深度耦合 `model.LifeTraceClosetItem` + `normalizeOutfitScene` / `buildOutfitTitle` / `buildRuleOutfitSummary`，保留 handler） |

### 改造过的 handler

| Handler | 改动 |
|---|---|
| [recipe_video_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/recipe_video_handler.go) | build shim 3 行；字面量已删 |
| [pantry_ai_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/pantry_ai_handler.go) | build shim 7 行；`normalizePantryCategory/Location` 前置在 shim |
| [pantry_description_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/pantry_description_handler.go) | build / parse / normalize 3 shim；type alias 保留 |
| [recipe_ai_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/recipe_ai_handler.go) | build / parse / normalize shim；type alias（`recipeSuggestionItem` / `recipeSuggestionAIResponse`）；孤儿 `normalizeRecipeDifficulty` 已清理 |
| [closet_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/closet_handler.go) | clothing build shim + parse 骨架 shim（normalize 白名单留原地）；outfit build shim（parse 完整保留） |
| [image_ai_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/image_ai_handler.go) | pantry_photo build shim；`lifeTracePantryPhotoAnalysisMaxTokens = prompts.PantryPhotoAnalysisMaxTokens` |

### 新增测试断言

[prompts_test.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/prompts_test.go) 新增 8 条断言：clothing Build（含 UseVision 两分支）+ clothing Parse + pantry_photo Build（barcode 有值/无值两分支）+ recipe_video Build + pantry_thumbnail Build + recipe_suggestion Parse（含 clamp）+ outfit_suggestion Build。

---

## 责任划分（重要）

- **prompts 包**：只处理**字面量拼装** + **JSON 结构解码** + **输出侧字段裁剪/兜底（TrimRunes、TextList 去重、numeric clamp）**
- **handler 层**：**白名单归一化**（`normalizePantryCategory` / `normalizeClosetCategory` / `normalizePantryLocation` 等）、**跨类型 merge**（`mergePrimaryPantryPhotoDetectedItem`）、**依赖 model.\* 结构的 wire-up**（`closetItemIDs`、`buildOutfitTitle`）

原则：**prompts 不反向依赖 handler**。当 Parse 后需要白名单 normalize 时，由 handler 侧 shim 在 `prompts.ParseXxxOutput` 返回后追加 normalize 步骤。

---

## 验证记录

- `cd server && go build ./...`：全绿
- `cd server && go test ./...`：全绿（所有包含 handler / prompts / aiclient 的包）
- `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py` 扫描 7 个 prompts 文件 + 4 个改动 handler + prompts_test.go：**PASS**
- CJK prompt 字面量与原文件逐字节比对（人工 review + 断言覆盖）：一致

---

## 遗留 / 后续

- **第三刀（未开工）**：`ai_client.go` 841 行私有 ark client 收编到 `internal/aiclient` 共享包；`ensureLifeTraceArkClient` / `callLifeTraceAIWithMaxTokens` / `callLifeTraceImageAI` 全部走公共路径。这一刀风险最高，需独立 plan。
- **未下沉的 Parse 链**：`parsePantryPhotoAnalysisAIResponse` + 3 级 normalize（300+ 行）、`parseOutfitSuggestionAIResponse`（57 行含 handler 私有函数调用）。理由：深度耦合 handler 内部类型，下沉收益低、风险高。
- 若未来想彻底解耦，需要先把 `imageCropBox` / `pantryPhotoDetectedItem` / `pantryPhotoDateHint` / `model.LifeTraceClosetItem` 摘要 struct 提到共享位置，再下沉 Parse。
