import { FileText, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type AIPrompt, getAPIErrorMessage, listAIPrompts } from '@/api/aiWorkbench';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface PromptLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (content: string) => void;
}

export function PromptLibraryDialog({ open, onOpenChange, onInsert }: PromptLibraryDialogProps) {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void listAIPrompts()
      .then(({ list }) => {
        if (!active) return;
        setPrompts(list);
        setSelectedID((current) =>
          list.some((item) => item.id === current) ? current : list[0]?.id || null,
        );
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载提示词库失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const filteredPrompts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return prompts;
    return prompts.filter((item) =>
      `${item.name} ${item.description}`.toLocaleLowerCase().includes(keyword),
    );
  }, [prompts, query]);
  const selected = prompts.find((item) => item.id === selectedID) || null;

  const handleInsert = () => {
    if (!selected) return;
    onInsert(selected.content);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(46rem,86vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>提示词库</DialogTitle>
          <DialogDescription>选择一条提示词，插入到当前节点的系统提示词末尾。</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="搜索提示词"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
              {loading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : filteredPrompts.length === 0 ? (
                <p className="px-3 py-8 text-sm text-muted-foreground">没有可用提示词</p>
              ) : (
                filteredPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${prompt.id === selectedID ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
                    onClick={() => setSelectedID(prompt.id)}
                  >
                    <span className="flex items-start gap-2">
                      <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{prompt.name}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {prompt.description || '未填写描述'}
                        </span>
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto p-6">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold">{selected.name}</h3>
                  {selected.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                  ) : null}
                </div>
                <pre className="min-h-64 whitespace-pre-wrap rounded-lg border border-border bg-muted/25 p-4 text-sm leading-6 text-foreground">
                  {selected.content}
                </pre>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                从左侧选择一条提示词
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={!selected} onClick={handleInsert}>
            插入提示词
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
