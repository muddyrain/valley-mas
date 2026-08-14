import { ArrowRight, ImagePlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyResources, type MyResource } from '@/api/resource';
import BatchUploadResourceDialog from '@/components/BatchUploadResourceDialog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Button } from '@/components/ui/button';

export default function StudioImageImport() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resources, setResources] = useState<MyResource[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecent = useCallback(() => {
    setLoading(true);
    return getMyResources({ page: 1, pageSize: 8, type: 'wallpaper' })
      .then((result) => setResources(result.list || []))
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
      <header className="max-w-3xl">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">BATCH IMPORT</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          一次说明，整批沿用。
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          选择图片后，批量整理标题和标签，再统一导入图库。
        </p>
      </header>

      <section className="mt-10 flex flex-col gap-4 border-y border-border py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          未完成的选择会保留在当前浏览器，下次打开可以继续整理和导入。
        </p>
        <Button type="button" onClick={() => setDialogOpen(true)} className="h-10 shrink-0 gap-2">
          <ImagePlus className="size-4" />
          选择图片
        </Button>
      </section>

      <section className="relative mt-12 min-h-52">
        <BoxLoadingOverlay show={loading} title="正在读取最近图片" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">最近导入</h2>
          <Link
            to="/studio/images/library"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            进入图片库 <ArrowRight className="size-4" />
          </Link>
        </div>
        {!loading && resources.length === 0 ? (
          <div className="flex min-h-44 items-center justify-center border border-dashed border-border text-sm text-muted-foreground">
            完成第一批导入后，图片会出现在这里。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {resources.map((resource) => (
              <article key={resource.id} className="overflow-hidden border border-border bg-card">
                <img
                  src={resource.thumbnailUrl || resource.url}
                  alt={resource.title}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{resource.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {resource.visibility === 'public' ? '已公开' : '私有草稿'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <BatchUploadResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          void loadRecent();
        }}
      />
    </div>
  );
}
