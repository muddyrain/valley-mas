import { Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type ExternalCoverImage,
  type ExternalImageProvider,
  searchExternalCoverImages,
} from '@/api/blog';
import type { Resource } from '@/api/resource';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PublicWallpaperPickerBody } from './PublicWallpaperPickerDialog';

type TabKey = 'wallpaper' | 'unsplash' | 'pexels' | 'pixabay' | 'wallhaven';

interface CoverPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCoverUrl?: string;
  onSelectResource: (resource: Resource) => void;
  onSelectExternalImage: (image: ExternalCoverImage) => void;
}

const TAB_OPTIONS: Array<{ key: TabKey; label: string }> = [
  { key: 'wallpaper', label: '我的资源池' },
  { key: 'unsplash', label: 'Unsplash' },
  { key: 'pexels', label: 'Pexels' },
  { key: 'pixabay', label: 'Pixabay' },
  { key: 'wallhaven', label: 'Wallhaven' },
];

const EXTERNAL_PAGE_SIZE = 20;

export function CoverPickerDialog({
  open,
  onOpenChange,
  currentCoverUrl,
  onSelectResource,
  onSelectExternalImage,
}: CoverPickerDialogProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('wallpaper');

  useEffect(() => {
    if (!open) return;
    setActiveTab('wallpaper');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[90vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>选择博客封面</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:p-5">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabKey)}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <TabsList className="shrink-0">
              {TAB_OPTIONS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="wallpaper" className="flex min-h-0 flex-1 flex-col">
              <PublicWallpaperPickerBody
                active={open && activeTab === 'wallpaper'}
                currentCoverUrl={currentCoverUrl}
                onSelect={onSelectResource}
              />
            </TabsContent>

            <TabsContent value="unsplash" className="flex min-h-0 flex-1 flex-col">
              <ExternalImagesPickerBody
                active={open && activeTab === 'unsplash'}
                provider="unsplash"
                currentCoverUrl={currentCoverUrl}
                onSelect={onSelectExternalImage}
              />
            </TabsContent>

            <TabsContent value="pexels" className="flex min-h-0 flex-1 flex-col">
              <ExternalImagesPickerBody
                active={open && activeTab === 'pexels'}
                provider="pexels"
                currentCoverUrl={currentCoverUrl}
                onSelect={onSelectExternalImage}
              />
            </TabsContent>

            <TabsContent value="pixabay" className="flex min-h-0 flex-1 flex-col">
              <ProviderComingSoon provider="Pixabay" />
            </TabsContent>

            <TabsContent value="wallhaven" className="flex min-h-0 flex-1 flex-col">
              <ProviderComingSoon provider="Wallhaven" />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ExternalImagesPickerBodyProps {
  active: boolean;
  provider: 'unsplash' | 'pexels';
  currentCoverUrl?: string;
  onSelect: (image: ExternalCoverImage) => void;
}

const DEFAULT_QUERY_BY_PROVIDER: Record<'unsplash' | 'pexels', string> = {
  unsplash: 'wallpaper',
  pexels: 'wallpaper',
};

function ExternalImagesPickerBody({
  active,
  provider,
  currentCoverUrl,
  onSelect,
}: ExternalImagesPickerBodyProps) {
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ExternalCoverImage[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const initialized = useMemo(() => query.length > 0, [query]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在 active / provider 切换时初始化默认关键词，query/queryInput 变化不应重触发
  useEffect(() => {
    if (!active) return;
    if (query || queryInput) return;
    const defaultQuery = DEFAULT_QUERY_BY_PROVIDER[provider];
    setQueryInput(defaultQuery);
    setQuery(defaultQuery);
    setPage(1);
  }, [active, provider]);

  useEffect(() => {
    if (!active) return;
    if (!query) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const result = await searchExternalCoverImages({
          provider,
          query,
          page,
          perPage: EXTERNAL_PAGE_SIZE,
        });
        if (cancelled) return;
        setImages(result.list || []);
        setTotal(result.total || 0);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error && err.message ? err.message : '搜索外部图源失败，请稍后再试';
          setErrorMessage(message);
          setImages([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [active, provider, query, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / EXTERNAL_PAGE_SIZE)), [total]);

  const submitSearch = () => {
    const next = queryInput.trim();
    if (!next) {
      toast.error('请输入搜索关键词');
      return;
    }
    setPage(1);
    setQuery(next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder={`在 ${provider === 'unsplash' ? 'Unsplash' : 'Pexels'} 中搜索封面`}
          className="h-9 min-w-[220px] flex-1"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submitSearch();
            }
          }}
        />
        <Button type="button" variant="outline" className="h-9 shrink-0" onClick={submitSearch}>
          <Search className="mr-1 h-4 w-4" />
          搜索
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-muted/45 p-3.5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: EXTERNAL_PAGE_SIZE }).map((_, index) => (
              <div
                key={`external-loading-${provider}-${index}`}
                className="aspect-[4/3] w-full animate-pulse rounded-xl bg-muted/70"
              />
            ))}
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
            {errorMessage}
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => {
              const selected = Boolean(
                currentCoverUrl &&
                  (image.previewUrl === currentCoverUrl || image.fullUrl === currentCoverUrl),
              );
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => onSelect(image)}
                  className={`group relative overflow-hidden rounded-xl border bg-card text-left transition hover:shadow-md ${
                    selected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                    <img
                      src={image.thumbnailUrl}
                      alt={image.attribution.name || 'cover'}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-1.5 text-xs">
                    <span className="truncate text-foreground">
                      {image.attribution.name || '匿名'}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {image.width}×{image.height}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : initialized ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            没有找到匹配的图片，换个关键词试试
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            输入关键词开始搜索
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          {provider === 'unsplash' ? 'Powered by Unsplash' : 'Powered by Pexels'} · 共 {total} 张，
          第 {Math.min(page, totalPages)} / {totalPages} 页
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
  );
}

function ProviderComingSoon({ provider }: { provider: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <div className="rounded-2xl border border-dashed border-border bg-muted/60 px-8 py-12 text-center">
        <p className="text-sm font-medium text-foreground">{provider} 接入即将上线</p>
        <p className="mt-2 text-xs text-muted-foreground">
          暂时先用 Unsplash / Pexels，或从我的资源池挑一张封面。
        </p>
      </div>
    </div>
  );
}

export type { ExternalImageProvider };
