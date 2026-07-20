# Pantry Drawer AI Augmentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Life Trace 库存编辑抽屉里加两个 AI 助手:A 一键补全字段(图+名称→分类/标签/单位/位置/保质期);B 备注润色(name+category+expiresAt→2-3 句储存/食用建议)。

**Architecture:**
- A 复用已存在的 `POST /life-trace/ai/pantry-photo-analysis` 接口,前端把当前 form 的字段作为 hint 传过去,得到 AI 输出后渲染成"逐项确认"差异面板,用户勾选后写回 form。
- B 新增 `POST /life-trace/ai/pantry-description` handler,走 `lifeai` 文本 chat,产出简洁实用建议。前端在备注输入框右上角加按钮触发。

**Tech Stack:** React 18 + TypeScript + Tailwind + shadcn UI + Zustand;Go 1.22 + Gin + lifeai/ARK SDK;复用 `prompts` 包风格。

---

## File Structure

**前端(apps/life-trace):**
- 新建 `src/components/PantryAiSuggestionsSheet.tsx`:逐项接受 AI 字段建议的 BottomSheet
- 修改 `src/components/PantryItemDrawer.tsx`:加两个入口按钮,集成 A 与 B
- 修改 `src/api/pantry.ts`:新增 `generatePantryDescription` 函数
- 修改 `src/lib/pantry.ts`(可选):提取"AI 字段差异计算"工具函数,如逻辑简短可直接放组件

**后端(server/internal/lifetrace):**
- 新建 `pantry_description_handler.go`:`GeneratePantryDescription` handler + 配置/解析/prompt
- 修改 `routes.go`:挂 `ai.POST("/pantry-description", handler.GeneratePantryDescription)`
- 新建 `pantry_description_handler_test.go`:prompt 与 parser 单测

**计划同步:**
- 修改 `apps/life-trace/docs/PLAN.md`:库存能力清单补充两条 AI 助手描述

---

## Task 1: 后端 — Pantry Description AI handler 与 prompt parser

**Files:**
- Create: `server/internal/lifetrace/pantry_description_handler.go`
- Create: `server/internal/lifetrace/pantry_description_handler_test.go`
- Modify: `server/internal/lifetrace/routes.go:33` (在 `recipes` 后面追加路由)

- [ ] **Step 1: 写失败的 parser 单测**

`server/internal/lifetrace/pantry_description_handler_test.go`:

```go
package lifetrace

import (
	"strings"
	"testing"
)

func TestParsePantryDescriptionAIResponse_ExtractsTipsAndNote(t *testing.T) {
	raw := "{\"note\":\"开封后冷藏并尽量在 5 天内饮用完毕。\",\"tips\":[\"冷藏 4 度保存\",\"避免阳光直射\",\"开封后 5 天内喝完\"]}"
	parsed, err := parsePantryDescriptionAIResponse(raw)
	if err != nil {
		t.Fatalf("expected ok, got err: %v", err)
	}
	if !strings.Contains(parsed.Note, "5 天") {
		t.Fatalf("expected note to mention 5 天, got %q", parsed.Note)
	}
	if len(parsed.Tips) != 3 {
		t.Fatalf("expected 3 tips, got %d", len(parsed.Tips))
	}
}

func TestParsePantryDescriptionAIResponse_RejectsEmpty(t *testing.T) {
	if _, err := parsePantryDescriptionAIResponse("not json"); err == nil {
		t.Fatal("expected error for non-json input")
	}
}

func TestBuildPantryDescriptionPrompt_IncludesContext(t *testing.T) {
	prompt := buildPantryDescriptionPrompt(pantryDescriptionRequest{
		Name:     "鲜牛奶",
		Category: "食品",
		Location: "冷藏",
	})
	if !strings.Contains(prompt, "鲜牛奶") {
		t.Fatal("prompt should include name")
	}
	if !strings.Contains(prompt, "冷藏") {
		t.Fatal("prompt should include location")
	}
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd server && go test ./internal/lifetrace/ -run TestParsePantryDescriptionAIResponse -v`
Expected: FAIL — undefined symbols

- [ ] **Step 3: 实现 handler**

`server/internal/lifetrace/pantry_description_handler.go`:

```go
package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"valley-server/internal/aiusage"
	"valley-server/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const lifeTracePantryDescriptionMaxTokens = 480

type pantryDescriptionRequest struct {
	Name      string   `json:"name"`
	Category  string   `json:"category"`
	Location  string   `json:"location"`
	Tags      []string `json:"tags"`
	ExpiresAt string   `json:"expiresAt"`
	OpenedAt  string   `json:"openedAt"`
	Note      string   `json:"note"`
}

type pantryDescriptionAIResponse struct {
	Note string   `json:"note"`
	Tips []string `json:"tips"`
}

func (h *Handler) GeneratePantryDescription(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok || userID == 0 {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req pantryDescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "请求内容不正确")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		fail(c, http.StatusBadRequest, "请先填写商品名称再让 AI 帮你润色")
		return
	}

	aiCfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		fail(c, http.StatusServiceUnavailable, errMsg)
		return
	}

	prompt := buildPantryDescriptionPrompt(req)
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-pantry-description", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceAIWithMaxTokens(aiCtx, aiCfg, prompt, lifeTracePantryDescriptionMaxTokens)
	if err != nil {
		logger.Error(c, "LifeTrace pantry description AI call failed", err, logrus.Fields{
			"source": aiCfg.Source,
			"model":  aiCfg.Model,
		})
		fail(c, http.StatusBadGateway, "AI 备注生成失败:"+err.Error())
		return
	}

	parsed, err := parsePantryDescriptionAIResponse(raw)
	if err != nil {
		logger.Error(c, "LifeTrace pantry description AI parse failed", err, logrus.Fields{
			"source": aiCfg.Source,
			"model":  modelName,
		})
		fail(c, http.StatusBadGateway, "AI 备注生成解析失败")
		return
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}
	success(c, gin.H{
		"note":     strings.TrimSpace(parsed.Note),
		"tips":     normalizeDescriptionTips(parsed.Tips),
		"source":   aiCfg.Source,
		"model":    modelName,
		"modelTag": buildAIModelTag(aiCfg.Source, modelName),
	})
}

func buildPantryDescriptionPrompt(req pantryDescriptionRequest) string {
	var b strings.Builder
	b.WriteString("你是 Life Trace 的家庭库存助手,任务是为一件库存写一段简短实用的中文备注。\n")
	b.WriteString("输出严格 JSON,字段:note(string,30-80 字,以储存方式/最佳食用期/常见注意事项为主,语气克制不夸张),tips(string[],2-3 条短建议,每条不超过 14 字)。\n\n")
	b.WriteString(fmt.Sprintf("商品名称:%s\n", strings.TrimSpace(req.Name)))
	if v := strings.TrimSpace(req.Category); v != "" {
		b.WriteString(fmt.Sprintf("分类:%s\n", v))
	}
	if v := strings.TrimSpace(req.Location); v != "" {
		b.WriteString(fmt.Sprintf("存放位置:%s\n", v))
	}
	if v := strings.TrimSpace(req.ExpiresAt); v != "" {
		b.WriteString(fmt.Sprintf("过期日:%s\n", v))
	}
	if v := strings.TrimSpace(req.OpenedAt); v != "" {
		b.WriteString(fmt.Sprintf("开封日:%s\n", v))
	}
	if len(req.Tags) > 0 {
		b.WriteString(fmt.Sprintf("标签:%s\n", strings.Join(req.Tags, "、")))
	}
	if v := strings.TrimSpace(req.Note); v != "" {
		b.WriteString(fmt.Sprintf("现有备注(可改写):%s\n", v))
	}
	b.WriteString("\n只输出 JSON,不要 markdown,不要多余文本。")
	return b.String()
}

func parsePantryDescriptionAIResponse(raw string) (pantryDescriptionAIResponse, error) {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return pantryDescriptionAIResponse{}, errors.New("missing JSON object")
	}
	var parsed pantryDescriptionAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return pantryDescriptionAIResponse{}, err
	}
	if strings.TrimSpace(parsed.Note) == "" && len(parsed.Tips) == 0 {
		return pantryDescriptionAIResponse{}, errors.New("empty AI output")
	}
	return parsed, nil
}

func normalizeDescriptionTips(tips []string) []string {
	result := make([]string, 0, len(tips))
	for _, t := range tips {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if len([]rune(t)) > 24 {
			t = string([]rune(t)[:24])
		}
		result = append(result, t)
		if len(result) >= 4 {
			break
		}
	}
	return result
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd server && go test ./internal/lifetrace/ -run "TestParsePantryDescriptionAIResponse|TestBuildPantryDescriptionPrompt" -v`
Expected: PASS

- [ ] **Step 5: 挂路由**

`server/internal/lifetrace/routes.go:33` 后追加一行:

```go
ai.POST("/pantry-description", handler.GeneratePantryDescription)
```

- [ ] **Step 6: 全量回归 lifetrace 包**

Run: `cd server && go test ./internal/lifetrace/...`
Expected: 全 PASS

- [ ] **Step 7: 提交**

```bash
git add server/internal/lifetrace/pantry_description_handler.go \
        server/internal/lifetrace/pantry_description_handler_test.go \
        server/internal/lifetrace/routes.go
git commit -m "feat(life-trace): 新增库存备注 AI 润色接口"
```

---

## Task 2: 前端 API 封装 + AI 字段差异工具

**Files:**
- Modify: `apps/life-trace/src/api/pantry.ts`(在最末尾追加 generatePantryDescription)
- Modify: `apps/life-trace/src/lib/pantry.ts`(追加 buildPantryAiFieldDiff 工具)

- [ ] **Step 1: 加 API 封装**

`apps/life-trace/src/api/pantry.ts` 文件末尾追加:

```ts
export type PantryDescriptionRequest = {
  name: string;
  category?: string;
  location?: string;
  tags?: string[];
  expiresAt?: string;
  openedAt?: string;
  note?: string;
};

export type PantryDescriptionResponse = {
  note: string;
  tips: string[];
  source?: string;
  model?: string;
  modelTag?: string;
};

export function generatePantryDescription(token: string, input: PantryDescriptionRequest) {
  return request<PantryDescriptionResponse>(token, '/life-trace/ai/pantry-description', {
    method: 'POST',
    body: input,
  });
}
```

(注意 `request` 函数从文件顶部 import,如果命名不同请对齐当前文件 — `request` 是 `pantry.ts` 已有的 helper,见 generatePantryThumbnail 调用方式。)

- [ ] **Step 2: 加 AI 字段差异工具**

`apps/life-trace/src/lib/pantry.ts` 文件末尾追加:

```ts
import type {
  NewPantryItemInput,
  PantryCategory,
  PantryLocation,
} from '@/types';
import type { PantryPhotoAnalysisResponse } from '@/api/pantry';

export type PantryAiFieldKey =
  | 'category'
  | 'tags'
  | 'unit'
  | 'location'
  | 'expiresAt'
  | 'note';

export type PantryAiFieldSuggestion = {
  key: PantryAiFieldKey;
  label: string;
  current: string;
  suggested: string;
  empty: boolean;
};

const validCategories: PantryCategory[] = ['食品', '日用品', '药品', '宠物', '其他'];
const validLocations: PantryLocation[] = [
  '冷藏',
  '冷冻',
  '厨房',
  '储物柜',
  '卫生间',
  '玄关',
  '其他',
];

function safeText(v?: string | null) {
  return (v ?? '').trim();
}

export function buildPantryAiFieldDiff(
  form: NewPantryItemInput,
  ai: PantryPhotoAnalysisResponse,
): PantryAiFieldSuggestion[] {
  const result: PantryAiFieldSuggestion[] = [];
  const push = (
    key: PantryAiFieldKey,
    label: string,
    current: string,
    suggested: string,
  ) => {
    const s = safeText(suggested);
    if (!s) return;
    if (s === safeText(current)) return;
    result.push({ key, label, current: safeText(current), suggested: s, empty: !safeText(current) });
  };

  const aiCategory = validCategories.includes(ai.category as PantryCategory)
    ? (ai.category as PantryCategory)
    : '';
  push('category', '分类', form.category ?? '', aiCategory);

  const aiLocation = validLocations.includes(ai.storageLocation as PantryLocation)
    ? (ai.storageLocation as PantryLocation)
    : '';
  push('location', '存放位置', form.location ?? '', aiLocation);

  push('unit', '单位', form.unit ?? '', ai.unit ?? '');
  push('expiresAt', '过期日', form.expiresAt ?? '', ai.expiresAt ?? '');

  const aiTags = (ai.tags ?? []).map(safeText).filter(Boolean);
  const currentTags = (form.tags ?? []).join('、');
  push('tags', '标签', currentTags, aiTags.join('、'));

  push('note', '备注', form.note ?? '', ai.summary ?? '');

  return result;
}
```

- [ ] **Step 3: 跑前端类型检查**

Run: `pnpm --filter @valley/life-trace exec tsc --noEmit`
Expected: 通过(无输出)

- [ ] **Step 4: 提交**

```bash
git add apps/life-trace/src/api/pantry.ts apps/life-trace/src/lib/pantry.ts
git commit -m "feat(life-trace): 新增库存备注 AI 接口与字段差异工具"
```

---

## Task 3: 前端 — AI 字段建议 Sheet

**Files:**
- Create: `apps/life-trace/src/components/PantryAiSuggestionsSheet.tsx`

- [ ] **Step 1: 写组件**

参考 `OptionPickerSheet`/`PantryHouseholdSheet` 的风格。组件签名:

```ts
type PantryAiSuggestionsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: PantryAiFieldSuggestion[];
  onApply: (accepted: PantryAiFieldKey[]) => void;
  loading?: boolean;
  modelTag?: string;
};
```

UI 要点:
- BottomSheet + SheetHeader,标题"AI 字段建议",副标题"勾选要采用的字段,未勾选会保持当前值"
- 列表每行:左边是 label + 当前/建议两行(当前为空显示"未填",颜色用 muted-foreground;建议高亮 life-ai),右边一个 Checkbox(默认空白字段勾选,有冲突的字段不勾选)
- 底部一个"应用所选"按钮,点击触发 onApply 并关闭。
- 没有任何 suggestion 时,显示 EmptyState "AI 没有发现可补充的字段"

完整代码(写入 `apps/life-trace/src/components/PantryAiSuggestionsSheet.tsx`):

```tsx
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { SheetHeader } from '@/components/FormItem';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PantryAiFieldKey, PantryAiFieldSuggestion } from '@/lib/pantry';

type PantryAiSuggestionsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: PantryAiFieldSuggestion[];
  onApply: (accepted: PantryAiFieldKey[]) => void;
  loading?: boolean;
  modelTag?: string;
};

export function PantryAiSuggestionsSheet({
  open,
  onOpenChange,
  suggestions,
  onApply,
  loading,
  modelTag,
}: PantryAiSuggestionsSheetProps) {
  const [selected, setSelected] = useState<Set<PantryAiFieldKey>>(new Set());

  useEffect(() => {
    if (!open) return;
    const next = new Set<PantryAiFieldKey>();
    for (const s of suggestions) {
      if (s.empty) next.add(s.key);
    }
    setSelected(next);
  }, [open, suggestions]);

  const toggle = (key: PantryAiFieldKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} overlayLabel="关闭 AI 字段建议" zIndexClassName="z-50">
      <SheetHeader
        title="AI 字段建议"
        description="勾选要采用的字段,空字段默认勾选,与当前值冲突的字段默认不勾选。"
        meta={modelTag ? `模型:${modelTag}` : undefined}
        onClose={() => onOpenChange(false)}
      />

      {suggestions.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="AI 没有发现需要补充的字段"
          description="当前内容已经比较完整,如果有图也请确认图片清晰。"
        />
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => {
            const checked = selected.has(s.key);
            return (
              <Card
                key={s.key}
                className={cn(
                  'cursor-pointer p-3 transition',
                  checked ? 'border-life-ai/45 bg-life-ai/5' : 'border-border',
                )}
                onClick={() => toggle(s.key)}
                role="button"
                aria-pressed={checked}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border',
                      checked ? 'border-life-ai bg-life-ai text-white' : 'border-border bg-card',
                    )}
                  >
                    {checked ? <Sparkles className="size-3" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      当前:<span className={cn(s.empty && 'italic')}>{s.empty ? '未填' : s.current}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-life-ai">建议:{s.suggested}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          取消
        </Button>
        <Button
          type="button"
          variant="ai"
          disabled={loading || selected.size === 0}
          onClick={() => {
            onApply(Array.from(selected));
            onOpenChange(false);
          }}
        >
          应用所选({selected.size})
        </Button>
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 2: 跑前端类型检查**

Run: `pnpm --filter @valley/life-trace exec tsc --noEmit`
Expected: 通过

- [ ] **Step 3: 提交**

```bash
git add apps/life-trace/src/components/PantryAiSuggestionsSheet.tsx
git commit -m "feat(life-trace): 新增库存 AI 字段建议确认 Sheet"
```

---

## Task 4: 前端 — Drawer 集成 AI 补全 + 备注润色

**Files:**
- Modify: `apps/life-trace/src/components/PantryItemDrawer.tsx`

- [ ] **Step 1: 加状态与 import**

在 `PantryItemDrawer.tsx` 顶部 import 区追加:

```ts
import { analyzePantryPhoto, generatePantryDescription } from '@/api/pantry';
import { buildPantryAiFieldDiff, formatPantryReminderSummary, getPantryPersistedStatus } from '@/lib/pantry';
import type { PantryAiFieldKey, PantryAiFieldSuggestion } from '@/lib/pantry';
import { PantryAiSuggestionsSheet } from '@/components/PantryAiSuggestionsSheet';
import { Wand2 } from 'lucide-react';
```

(把 `formatPantryReminderSummary, getPantryPersistedStatus` 从原 import 行移到合并后的这一行,避免重复 import。)

在组件内 hooks 区(其他 useState 后)追加:

```ts
const [aiAugmentLoading, setAiAugmentLoading] = useState(false);
const [aiAugmentError, setAiAugmentError] = useState('');
const [aiSuggestionsOpen, setAiSuggestionsOpen] = useState(false);
const [aiSuggestions, setAiSuggestions] = useState<PantryAiFieldSuggestion[]>([]);
const [aiSuggestionModelTag, setAiSuggestionModelTag] = useState('');
const [descriptionLoading, setDescriptionLoading] = useState(false);
const [descriptionError, setDescriptionError] = useState('');
```

- [ ] **Step 2: 加 handler — A 一键补全**

在组件内合适位置(handleGenerateThumbnail 附近)追加:

```ts
const handleAugmentFromAI = async () => {
  if (!token) {
    setAiAugmentError('请先登录后再使用 AI 补全');
    return;
  }
  if (!form.imageUrl && !form.name.trim()) {
    setAiAugmentError('请先添加图片或填写名称,AI 才能给出建议');
    return;
  }
  setAiAugmentLoading(true);
  setAiAugmentError('');
  try {
    const ai = await analyzePantryPhoto(token, {
      imageUrl: form.imageUrl || undefined,
      hint: [form.name, form.category, form.location].filter(Boolean).join(' / '),
      householdId: householdId,
    });
    const diff = buildPantryAiFieldDiff(form, ai);
    setAiSuggestions(diff);
    setAiSuggestionModelTag(ai.modelTag || '');
    setAiSuggestionsOpen(true);
  } catch (error) {
    setAiAugmentError(getLifeTraceErrorMessage(error, 'AI 字段补全失败'));
  } finally {
    setAiAugmentLoading(false);
  }
};

const applyAiSuggestions = (accepted: PantryAiFieldKey[]) => {
  const selectedSet = new Set(accepted);
  setForm((current) => {
    const next = { ...current };
    for (const s of aiSuggestions) {
      if (!selectedSet.has(s.key)) continue;
      if (s.key === 'tags') {
        next.tags = s.suggested.split('、').map((t) => t.trim()).filter(Boolean);
      } else if (s.key === 'category') {
        next.category = s.suggested as typeof current.category;
      } else if (s.key === 'location') {
        next.location = s.suggested as typeof current.location;
      } else if (s.key === 'unit') {
        next.unit = s.suggested;
      } else if (s.key === 'expiresAt') {
        next.expiresAt = s.suggested;
      } else if (s.key === 'note') {
        next.note = s.suggested;
      }
    }
    return next;
  });
  setTagText((current) => {
    const tagSuggestion = aiSuggestions.find((s) => s.key === 'tags');
    if (tagSuggestion && selectedSet.has('tags')) return tagSuggestion.suggested;
    return current;
  });
};
```

- [ ] **Step 3: 加 handler — B 备注润色**

```ts
const handlePolishDescription = async () => {
  if (!token) {
    setDescriptionError('请先登录后再使用 AI 润色');
    return;
  }
  if (!form.name.trim()) {
    setDescriptionError('请先填写商品名称');
    return;
  }
  setDescriptionLoading(true);
  setDescriptionError('');
  try {
    const ai = await generatePantryDescription(token, {
      name: form.name.trim(),
      category: form.category,
      location: form.location,
      tags: form.tags,
      expiresAt: form.expiresAt,
      openedAt: form.openedAt,
      note: form.note,
    });
    const next = ai.note?.trim();
    if (next) updateField('note', next);
  } catch (error) {
    setDescriptionError(getLifeTraceErrorMessage(error, 'AI 备注润色失败'));
  } finally {
    setDescriptionLoading(false);
  }
};
```

- [ ] **Step 4: 在表单 UI 中加入口**

在抽屉表单的「图片」TonePanel 之后(第二个 TonePanel,即 "封面图" tone="ai" 之前),加一个新 TonePanel:

```tsx
<TonePanel
  tone="ai"
  icon={Wand2}
  title="AI 字段补全"
  description="基于图片和当前已填字段,AI 帮你补充分类/标签/位置/保质期等空缺。"
  action={
    <Button
      type="button"
      variant="ai"
      size="sm"
      disabled={aiAugmentLoading || submitting || (!form.imageUrl && !form.name.trim())}
      onClick={() => void handleAugmentFromAI()}
    >
      {aiAugmentLoading ? <ActionLoadingIcon className="size-4" tone="ai" /> : <Sparkles className="size-4" />}
      {aiAugmentLoading ? '识别中...' : '一键补全'}
    </Button>
  }
>
  {aiAugmentError ? <p className="text-xs text-destructive">{aiAugmentError}</p> : null}
</TonePanel>
```

把"备注" FormItem 改造成带 AI 按钮的 TonePanel(或在 FormItem 右上角加按钮),最简方案:在 `<FormItem label="备注">` 内 Textarea 上方加一行小工具栏:

```tsx
<FormItem label="备注">
  <div className="mb-2 flex items-center justify-end">
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={descriptionLoading || submitting || !form.name.trim()}
      onClick={() => void handlePolishDescription()}
    >
      {descriptionLoading ? <ActionLoadingIcon className="size-3.5" tone="ai" /> : <Sparkles className="size-3.5" />}
      {descriptionLoading ? '润色中...' : 'AI 润色'}
    </Button>
  </div>
  <Textarea
    value={form.note}
    onChange={(event) => updateField('note', event.target.value)}
    rows={3}
    placeholder="例如:周末早餐要先喝掉。"
  />
  {descriptionError ? <p className="mt-1 text-xs text-destructive">{descriptionError}</p> : null}
</FormItem>
```

- [ ] **Step 5: 在表单尾部挂 PantryAiSuggestionsSheet**

在 `PantryItemDrawer` 返回的 fragment 末尾(已有 `OptionPickerSheet` 和 `ConfirmDialog`)加:

```tsx
<PantryAiSuggestionsSheet
  open={aiSuggestionsOpen}
  onOpenChange={setAiSuggestionsOpen}
  suggestions={aiSuggestions}
  onApply={applyAiSuggestions}
  loading={aiAugmentLoading}
  modelTag={aiSuggestionModelTag}
/>
```

- [ ] **Step 6: 跑前端 tsc + biome**

```bash
pnpm --filter @valley/life-trace exec tsc --noEmit
pnpm --filter @valley/life-trace exec biome check src/components/PantryItemDrawer.tsx src/components/PantryAiSuggestionsSheet.tsx src/api/pantry.ts src/lib/pantry.ts
```
Expected: 全通过

- [ ] **Step 7: 跑 encoding-guard**

```bash
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
  apps/life-trace/src/components/PantryItemDrawer.tsx \
  apps/life-trace/src/components/PantryAiSuggestionsSheet.tsx \
  apps/life-trace/src/api/pantry.ts \
  apps/life-trace/src/lib/pantry.ts
```
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add apps/life-trace/src/components/PantryItemDrawer.tsx
git commit -m "feat(life-trace): 库存抽屉接入 AI 字段补全与备注润色"
```

---

## Task 5: PLAN.md 同步

**Files:**
- Modify: `apps/life-trace/docs/PLAN.md`(库存能力清单段落)

- [ ] **Step 1: 在「仍在使用」条目附近补两条新能力**

在库存能力列表中追加:

```md
- 库存抽屉「AI 字段补全」:基于图片和已填字段调用 photo-analysis,识别后由用户在 AI 字段建议 Sheet 内逐项勾选采纳,空字段默认勾选,冲突字段需用户主动确认。
- 库存抽屉「AI 备注润色」:根据 name/category/location/expires_at/opened_at 生成 30-80 字储存与食用建议,直接写回备注框,内容可继续编辑。
```

- [ ] **Step 2: 跑 encoding-guard**

```bash
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/life-trace/docs/PLAN.md
```
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add apps/life-trace/docs/PLAN.md
git commit -m "docs(life-trace): 同步库存抽屉 AI 助手计划"
```

---

## Task 6: 终验

- [ ] **Step 1: Go 包全量回归**

```bash
cd server && go test ./internal/lifetrace/...
```
Expected: 全 PASS

- [ ] **Step 2: 前端 typecheck 全量**

```bash
pnpm --filter @valley/life-trace exec tsc --noEmit
```
Expected: 通过

- [ ] **Step 3: 手动验收 checklist(交付给用户)**

- 开抽屉新增,只填名称 + 上传图片,点"一键补全",AI Sheet 弹出,默认勾选空字段;勾选采纳后字段写入 form;关闭 Sheet 不勾选则不变。
- 抽屉「备注」框右上角"AI 润色"按钮,在没填名称时按钮 disabled;填名称后点按钮,Loading 切换,完成后 Textarea 出现 30-80 字建议。
- AI 错误时,对应位置显示红色 destructive 文案。
- 编辑已有库存触发上述功能,不影响"仍在使用"开关、提醒设置等已有交互。

---

## Self-Review

**Spec coverage:**
- [x] A 一键补全字段 → Task 2/3/4
- [x] B 备注 AI 润色 → Task 1/2/4
- [x] 确认面板逐项勾选 → Task 3
- [x] 实用建议文风 → Task 1 prompt
- [x] 计划同步 → Task 5
- [x] 校验 → Task 6

**Placeholders:** none

**Type consistency:**
- `PantryAiFieldKey` 在 `lib/pantry.ts` 定义,在 `PantryAiSuggestionsSheet` 与 `PantryItemDrawer` 一致使用。
- `PantryDescriptionResponse.note/tips` 与 server `pantryDescriptionAIResponse` 字段一致。
- `PantryPhotoAnalysisResponse` 字段(category/storageLocation/tags/unit/expiresAt/summary)已在 `api/pantry.ts` 中存在,Task 2 buildPantryAiFieldDiff 引用与之对齐。
