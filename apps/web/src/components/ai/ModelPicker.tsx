import { Check, ChevronsUpDown, Loader2, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type AvailableAIModel, listAvailableAIModels } from '@/api/ai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CAPABILITY_LABELS: Record<string, string> = {
  text: '文本生成',
  vision: '图片理解',
  image_generation: '图片生成',
  reference_image: '支持参考图',
  embedding: '向量检索',
  tool_call: '工具调用',
};

interface ModelPickerProps {
  value?: string;
  onValueChange: (modelID: string, model?: AvailableAIModel) => void;
  onModelChange?: (model?: AvailableAIModel) => void;
  onUnavailableValue?: (modelID: string) => void;
  capability: string;
  label?: string;
  catalog?: 'auth' | 'public';
  compact?: boolean;
  compactLabel?: string;
  compactTrigger?: boolean;
  autoSelectFirst?: boolean;
}

export function ModelPicker({
  value,
  onValueChange,
  onModelChange,
  onUnavailableValue,
  capability,
  label = '模型',
  catalog = 'auth',
  compact = false,
  compactLabel = '使用',
  compactTrigger = false,
  autoSelectFirst = false,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<AvailableAIModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  const refreshModels = useCallback(() => {
    setLoading(true);
    setFailed(false);
    return listAvailableAIModels(capability, catalog)
      .then((result) => {
        setModels(result.list);
      })
      .catch(() => {
        setModels([]);
        setFailed(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [capability, catalog]);

  const handleRefreshModels = useCallback(() => {
    void refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  const selectedModel = models.find((item) => item.id === value);

  useEffect(() => {
    onModelChange?.(selectedModel);
  }, [onModelChange, selectedModel]);
  const filteredModels = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return models;
    return models.filter((item) =>
      `${item.displayName} ${item.modelId} ${item.provider}`.toLocaleLowerCase().includes(keyword),
    );
  }, [models, query]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery('');
  };

  useEffect(() => {
    if (!autoSelectFirst || loading || models.length === 0 || selectedModel) return;
    if (value) onUnavailableValue?.(value);
    onValueChange(models[0].id, models[0]);
  }, [autoSelectFirst, loading, models, onUnavailableValue, onValueChange, selectedModel, value]);

  const selectedLabel = selectedModel
    ? `${selectedModel.displayName} · ${selectedModel.provider}`
    : `选择${label}`;

  return (
    <div className={compact ? 'min-w-0' : 'space-y-1.5'}>
      {compact ? (
        compactTrigger ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 max-w-[15rem] justify-between gap-1 px-2 text-xs font-normal"
            onClick={() => setOpen(true)}
          >
            <span className="min-w-0 truncate text-left">
              {selectedModel
                ? `${compactLabel} ${selectedLabel}`
                : loading
                  ? `正在选择${label}…`
                  : selectedLabel}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="min-w-0 truncate">
              {selectedModel
                ? `${compactLabel} ${selectedLabel}`
                : loading
                  ? `正在选择${label}…`
                  : selectedLabel}
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="shrink-0"
              onClick={() => setOpen(true)}
            >
              切换
            </Button>
          </div>
        )
      ) : (
        <>
          <Label>{label}</Label>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            onClick={() => setOpen(true)}
          >
            <span className="min-w-0 truncate text-left">{selectedLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex h-[min(42rem,82vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-5">
            <div className="flex items-center justify-between gap-3 pr-10">
              <DialogTitle>选择模型</DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="刷新模型列表"
                onClick={handleRefreshModels}
                disabled={loading}
                className="h-8 gap-1.5"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                刷新
              </Button>
            </div>
            <DialogDescription>仅展示已启用且适合当前任务的模型。</DialogDescription>
          </DialogHeader>
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="搜索模型名称或 Provider"
              />
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-3">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : failed ? (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                  模型列表暂时无法加载
                </p>
              ) : filteredModels.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                  没有可选择的模型
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredModels.map((item) => {
                    const selected = item.id === value;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        className={cn(
                          'h-auto w-full justify-start rounded-lg px-3 py-3 text-left',
                          selected && 'bg-accent text-accent-foreground',
                        )}
                        onClick={() => {
                          onValueChange(item.id, item);
                          setOpen(false);
                        }}
                      >
                        <span className="flex min-w-0 flex-1 items-start gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                            {item.provider.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium">{item.displayName}</span>
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                {item.provider}
                              </Badge>
                            </span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              {item.modelId}
                            </span>
                            <span className="mt-2 flex flex-wrap gap-1">
                              {item.capabilities.map((itemCapability) => (
                                <Badge
                                  key={itemCapability}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {CAPABILITY_LABELS[itemCapability] || itemCapability}
                                </Badge>
                              ))}
                              {item.imageQualities?.map((quality) => (
                                <Badge key={quality} variant="outline" className="text-[10px]">
                                  {quality} 目标输出
                                </Badge>
                              ))}
                            </span>
                          </span>
                          {selected ? (
                            <Check className="mt-1 size-4 shrink-0 text-primary" />
                          ) : null}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
