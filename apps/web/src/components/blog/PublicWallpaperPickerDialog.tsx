import { Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getAllResources, type Resource } from '@/api/resource';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface PublicWallpaperPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCoverUrl?: string;
  onSelect: (resource: Resource) => void;
}

const PAGE_SIZE = 12;
type SortOrder = 'newest' | 'oldest';

export function PublicWallpaperPickerDialog({
  open,
  onOpenChange,
  currentCoverUrl,
  onSelect,
}: PublicWallpaperPickerDialogProps) {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const result = await getAllResources({
          page,
          pageSize: PAGE_SIZE,
          type: 'wallpaper',
          keyword: keyword || undefined,
          sort,
          includeTags: true,
        });
        if (cancelled) return;
        setResources(result.list || []);
        setTotal(result.total || 0);
      } catch {
        if (!cancelled) {
          toast.error('加载壁纸资源失败，请稍后重试');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, page, keyword, sort]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
  }, [open]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[90vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
          <DialogTitle>选择公用壁纸作为封面</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="搜索公用壁纸标题"
              className="h-9 min-w-[220px] flex-1"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setPage(1);
                  setKeyword(keywordInput.trim());
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0"
              onClick={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
              }}
            >
              <Search className="mr-1 h-4 w-4" />
              搜索
            </Button>
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setSort('newest');
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  sort === 'newest'
                    ? 'bg-theme-primary text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                新到旧
              </button>
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setSort('oldest');
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  sort === 'oldest'
                    ? 'bg-theme-primary text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                旧到新
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/45 p-3.5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {loading ? (
                Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <ResourceCardSkeleton
                    key={`wallpaper-loading-${index}`}
                    contentPadding="px-3 py-2.5"
                    type="wallpaper"
                  />
                ))
              ) : resources.length > 0 ? (
                resources.map((resource) => {
                  const selected = Boolean(currentCoverUrl && resource.url === currentCoverUrl);
                  return (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      selected={selected}
                      onClick={onSelect}
                      enablePreview={false}
                      showCreator
                      showTags
                      contentPadding="px-3 py-2.5"
                    />
                  );
                })
              ) : (
                <div className="col-span-full rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  暂无可用公用壁纸
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-500">
              共 {total} 张公用壁纸，第 {Math.min(page, totalPages)} / {totalPages} 页
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                下一页
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
