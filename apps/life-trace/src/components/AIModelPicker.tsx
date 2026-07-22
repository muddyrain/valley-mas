import { Check, ChevronDown, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type AvailableAIModel, listAvailableAIModels } from '@/api/aiModels';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const capabilityLabels: Record<string, string> = {
  text: '文本生成',
  vision: '图片理解',
  image_generation: '图片生成',
};

type AIModelPickerProps = {
  token?: string;
  capability: keyof typeof capabilityLabels;
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
};

export function AIModelPicker({
  token,
  capability,
  value,
  onValueChange,
  disabled = false,
  compact = false,
  className,
}: AIModelPickerProps) {
  const [models, setModels] = useState<AvailableAIModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setModels([]);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setFailed(false);
    void listAvailableAIModels(token, capability)
      .then((response) => {
        if (active) setModels(response.list);
      })
      .catch(() => {
        if (active) {
          setModels([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [capability, token]);

  const selected = useMemo(() => models.find((item) => item.id === value), [models, value]);

  useEffect(() => {
    if (loading || selected || models.length === 0) return;
    onValueChange(models[0].id);
  }, [loading, models, onValueChange, selected]);

  const label = selected
    ? `${selected.displayName} · ${selected.provider}`
    : loading
      ? '正在选择模型…'
      : failed
        ? '模型暂时不可用'
        : '暂无可用模型';

  return (
    <div className={cn(compact ? 'min-w-0' : 'space-y-2', className)}>
      {compact ? (
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0 text-life-ai" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <button
            type="button"
            className="shrink-0 font-semibold text-life-ai disabled:cursor-default disabled:text-muted-foreground"
            disabled={disabled || loading || models.length === 0}
            onClick={() => setOpen(true)}
          >
            切换
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          disabled={disabled || loading || models.length === 0}
          onClick={() => setOpen(true)}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      )}

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        overlayLabel="关闭模型选择"
        zIndexClassName="z-[80]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">选择模型</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              仅显示支持{capabilityLabels[capability]}的已启用模型。
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="size-5" />
          </Button>
        </div>

        <div className="space-y-2">
          {models.map((item) => {
            const active = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-[1.25rem] border px-4 py-3 text-left transition',
                  active
                    ? 'border-life-ai/35 bg-life-ai/10 text-foreground'
                    : 'border-border bg-secondary text-foreground',
                )}
                onClick={() => {
                  onValueChange(item.id);
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.displayName}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {item.provider} · {item.modelId}
                  </span>
                </span>
                {active ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-life-ai text-background">
                    <Check className="size-4" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
