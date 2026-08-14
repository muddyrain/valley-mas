import { ArrowRight, ImagePlus, Link2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyResources, type MyResource } from '@/api/resource';
import BatchUploadResourceDialog from '@/components/BatchUploadResourceDialog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RESOURCE_LICENSE_LABELS,
  RESOURCE_SOURCE_LABELS,
  type ResourceLicense,
  type ResourcePolicy,
  type ResourceSourceKind,
  validateResourcePolicy,
} from '@/utils/resourcePolicy';

const initialPolicy: ResourcePolicy = { sourceKind: '', sourceUrl: '', license: '' };

export default function StudioImageImport() {
  const [policy, setPolicy] = useState<ResourcePolicy>(initialPolicy);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resources, setResources] = useState<MyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const policyError = validateResourcePolicy(policy);

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
          先确认来源与许可，再批量检查标题和标签。
        </p>
      </header>

      <section className="mt-10 grid gap-5 border-y border-border py-6 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
        <label className="space-y-2 text-sm font-medium">
          <span>来源</span>
          <select
            value={policy.sourceKind}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                sourceKind: event.target.value as ResourceSourceKind | '',
              }))
            }
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">请选择来源</option>
            {Object.entries(RESOURCE_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>许可</span>
          <select
            value={policy.license}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                license: event.target.value as ResourceLicense | '',
              }))
            }
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">请选择许可</option>
            {Object.entries(RESOURCE_LICENSE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Link2 className="size-4 text-muted-foreground" /> 原始出处
          </span>
          <Input
            value={policy.sourceUrl}
            onChange={(event) =>
              setPolicy((current) => ({ ...current, sourceUrl: event.target.value }))
            }
            placeholder={policy.sourceKind === 'licensed' ? 'https://…' : '可选'}
            disabled={!policy.sourceKind}
          />
        </label>

        <Button
          type="button"
          disabled={Boolean(policyError)}
          onClick={() => setDialogOpen(true)}
          className="h-10 gap-2"
          title={policyError || undefined}
        >
          <ImagePlus className="size-4" />
          选择图片
        </Button>
      </section>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" />
        AI 只建议标题和标签，不判断版权或分发许可。
      </div>

      <section className="relative mt-12 min-h-52">
        <BoxLoadingOverlay show={loading} title="正在读取最近图片" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">最近导入</h2>
          <Link
            to="/gallery"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            查看公开图库 <ArrowRight className="size-4" />
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
        policy={policy}
        onSuccess={() => {
          setDialogOpen(false);
          void loadRecent();
        }}
      />
    </div>
  );
}
