import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { SheetActions, SheetHeader } from '@/components/FormItem';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { PantryAiFieldKey, PantryAiFieldSuggestion } from '@/lib/pantry';
import { cn } from '@/lib/utils';

type PantryAiSuggestionsSheetProps = {
  open: boolean;
  loading?: boolean;
  errorMessage?: string;
  modelTag?: string;
  suggestions: PantryAiFieldSuggestion[];
  onOpenChange: (open: boolean) => void;
  onApply: (selectedKeys: ReadonlySet<PantryAiFieldKey>) => void;
  onRetry?: () => void;
};

export function PantryAiSuggestionsSheet({
  open,
  loading = false,
  errorMessage,
  modelTag,
  suggestions,
  onOpenChange,
  onApply,
  onRetry,
}: PantryAiSuggestionsSheetProps) {
  const [selected, setSelected] = useState<Set<PantryAiFieldKey>>(new Set());

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(
      new Set(
        suggestions.filter((suggestion) => suggestion.defaultChecked).map((item) => item.key),
      ),
    );
  }, [open, suggestions]);

  const selectedCount = selected.size;
  const hasSuggestions = suggestions.length > 0;

  const orderedSuggestions = useMemo(() => suggestions, [suggestions]);

  const toggleSuggestion = (key: PantryAiFieldKey) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleApplyClick = () => {
    onApply(new Set(selected));
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel="关闭 AI 字段补全"
      zIndexClassName="z-[60]"
    >
      <SheetHeader
        title="AI 字段补全建议"
        description="勾选要采纳的字段，再决定是否覆盖。空白字段已默认帮你勾上。"
        meta={modelTag ? `来源：${modelTag}` : undefined}
        icon={Sparkles}
        onClose={() => onOpenChange(false)}
      />

      <div className="space-y-3">
        {loading ? (
          <EmptyState
            tone="ai"
            eyebrow="正在分析"
            title="AI 正在读取信息..."
            description="根据封面图、名称和分类回填，请稍等片刻。"
          />
        ) : errorMessage ? (
          <EmptyState
            tone="default"
            eyebrow="暂时失败"
            title="AI 字段补全失败"
            description={errorMessage}
            action={
              onRetry ? (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  重新尝试
                </Button>
              ) : null
            }
          />
        ) : !hasSuggestions ? (
          <EmptyState
            tone="ai"
            eyebrow="无需补全"
            title="目前看起来已经填得不错"
            description="AI 没有找到与现状不同的建议。"
          />
        ) : (
          orderedSuggestions.map((suggestion) => {
            const checked = selected.has(suggestion.key);
            return (
              <Card
                key={suggestion.key}
                className={cn(
                  'border p-4 transition-colors',
                  checked ? 'border-life-ai/40 bg-life-ai/5' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{suggestion.label}</span>
                      {suggestion.defaultChecked ? (
                        <span className="rounded-full bg-life-ai/10 px-2 py-0.5 text-[10px] font-medium text-life-ai">
                          建议补全
                        </span>
                      ) : (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          覆盖现有
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                      <div>
                        <span className="text-muted-foreground/80">当前：</span>
                        <span className="font-medium text-foreground">
                          {suggestion.currentDisplay}
                        </span>
                      </div>
                      <div>
                        <span className="text-life-ai/80">AI 建议：</span>
                        <span className="font-medium text-life-ai">
                          {suggestion.suggestionDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Switch
                    size="sm"
                    checked={checked}
                    onCheckedChange={() => toggleSuggestion(suggestion.key)}
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>

      <SheetActions className="mt-6">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button
          type="button"
          variant="ai"
          disabled={loading || selectedCount === 0 || !hasSuggestions}
          onClick={handleApplyClick}
        >
          <Sparkles className="size-4" />
          {selectedCount > 0 ? `应用 ${selectedCount} 项建议` : '应用建议'}
        </Button>
      </SheetActions>
    </BottomSheet>
  );
}
