/**
 * EditResourceDialog
 * 编辑资源信息弹窗（标题、描述、类型、可见范围、标签）
 * 图片不可更换，如需替换请重新上传。
 */
import { Image as ImageIcon, Loader2, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type ResourceVisibility, updateResource } from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import ImagePreviewDialog from '@/components/ImagePreviewDialog';
import ResourceTagSelector from '@/components/ResourceTagSelector';
import { Button } from '@/components/ui/button';
import { openConfirmToast } from '@/components/ui/confirm-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// ── 资源的最小必要字段（可兼容 MyResource / Resource 等多种类型）──
export interface EditableResource {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  visibility?: ResourceVisibility;
  size: number;
  downloadCount: number;
  tags?: string[];
}

export interface EditResourceDialogProps {
  resource: EditableResource | null;
  onOpenChange: (open: boolean) => void;
  /** 保存成功后的回调，带回更新后的字段（可用于本地同步） */
  onSuccess?: (updated: {
    id: string;
    title: string;
    description: string;
    type: string;
    visibility: ResourceVisibility;
    tags: string[];
  }) => void;
}

// ── 常量 ──────────────────────────────────────────────────────────────
const VISIBILITY_OPTIONS: {
  value: ResourceVisibility;
  icon: string;
  label: string;
  desc: string;
}[] = [
  { value: 'private', icon: '🔒', label: '私密', desc: '仅自己可见' },
  { value: 'shared', icon: '🔗', label: '共享', desc: '有链接可见' },
  { value: 'public', icon: '🌐', label: '公开', desc: '所有人可见' },
];

const TYPE_OPTIONS = [
  { value: 'wallpaper', icon: '🖼️', label: '壁纸', desc: '横版大图' },
  { value: 'avatar', icon: '🙂', label: '头像', desc: '方形裁切' },
] as const;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────
export default function EditResourceDialog({
  resource,
  onOpenChange,
  onSuccess,
}: EditResourceDialogProps) {
  const open = !!resource;

  // 表单状态
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('');
  const [visibility, setVisibility] = useState<ResourceVisibility>('private');
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const closeConfirmToastIdRef = useRef<string | number | null>(null);
  const closeConfirmTimeoutRef = useRef<number | null>(null);

  const clearCloseConfirmGuard = () => {
    closeConfirmToastIdRef.current = null;
    if (closeConfirmTimeoutRef.current !== null) {
      window.clearTimeout(closeConfirmTimeoutRef.current);
      closeConfirmTimeoutRef.current = null;
    }
  };

  // 标签状态（字符串数组，随 resource 变化重置）
  const [tags, setTags] = useState<string[]>([]);

  // resource 变化时重置表单
  useEffect(() => {
    if (!resource) {
      setPreviewOpen(false);
      return;
    }
    setTitle(resource.title);
    setDesc(resource.description ?? '');
    setType(resource.type);
    setVisibility(resource.visibility ?? 'private');
    setTags(resource.tags ?? []);
    setSaving(false);
  }, [resource]);

  // 提交保存
  const handleSubmit = async () => {
    if (!resource) return;
    try {
      setSaving(true);
      await updateResource(resource.id, {
        title: title.trim() || undefined,
        description: desc.trim() || undefined,
        type: type || undefined,
        visibility,
        tags,
      });
      toast.success('修改成功');
      onSuccess?.({
        id: resource.id,
        title: title.trim() || resource.title,
        description: desc.trim() || resource.description || '',
        type: type || resource.type,
        visibility,
        tags,
      });
      onOpenChange(false);
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setSaving(false);
    }
  };

  const requestDialogClose = () => {
    if (saving) return;
    if (closeConfirmToastIdRef.current !== null) return;
    closeConfirmToastIdRef.current = openConfirmToast({
      title: '确认关闭编辑弹窗？',
      description: '关闭后，当前未保存的修改将丢失。',
      confirmText: '确认关闭',
      cancelText: '继续编辑',
      onConfirm: () => {
        clearCloseConfirmGuard();
        onOpenChange(false);
      },
      onCancel: clearCloseConfirmGuard,
    });
    closeConfirmTimeoutRef.current = window.setTimeout(() => {
      clearCloseConfirmGuard();
    }, 8200);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          clearCloseConfirmGuard();
          onOpenChange(true);
          return;
        }
        requestDialogClose();
      }}
    >
      <DialogContent className="flex h-[90vh] w-[90vw] max-w-4xl flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-4xl">
        {/* ── 顶部标题栏 ── */}
        <div className="shrink-0 border-b border-border bg-[linear-gradient(135deg,hsl(var(--primary) / 0.10)_0%,hsl(var(--primary) / 0.03)_100%)] px-6 py-4 flex items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shadow-[0_4px_12px_hsl(var(--primary) / 0.18)]">
            <Pencil className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-foreground leading-tight">
              编辑资源信息
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{resource?.title}</p>
          </div>
        </div>

        {/* ── 左右双栏 ── */}
        <div className="flex min-h-0 flex-1 divide-x divide-border overflow-hidden">
          {/* ── 左栏：图片预览（只读） ── */}
          <div className="flex w-[48%] shrink-0 flex-col gap-3 p-6 bg-muted/40">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              图片预览
            </p>
            <button
              type="button"
              onClick={() => resource && setPreviewOpen(true)}
              className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-border bg-card flex items-center justify-center group disabled:cursor-default"
              disabled={!resource}
            >
              {resource && (
                <img
                  src={resource.thumbnailUrl ?? resource.url}
                  alt={resource.title}
                  className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.01]"
                />
              )}
              {resource && (
                <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm opacity-90 group-hover:opacity-100">
                  点击预览
                </div>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-black/40 px-3 py-1 text-[10px] text-white/80 backdrop-blur-sm whitespace-nowrap">
                  🔒 图片不可更换，如需替换请重新上传
                </span>
              </div>
            </button>
            {resource && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatSize(resource.size)}</span>
                <span className="text-border">·</span>
                <span>{resource.downloadCount} 次下载</span>
              </div>
            )}
          </div>

          {/* ── 右栏：表单 ── */}
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,hsl(var(--card) / 0.68),hsl(var(--card) / 0.95))]">
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* 资源类型 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  资源类型
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-center transition-all duration-150 ${
                        type === opt.value
                          ? 'border-primary bg-accent shadow-[0_0_0_3px_hsl(var(--primary) / 0.10)]'
                          : 'border-border bg-card hover:border-border hover:bg-accent/50'
                      }`}
                    >
                      <span className="text-xl leading-none">{opt.icon}</span>
                      <span
                        className={`text-sm font-semibold leading-none ${type === opt.value ? 'text-primary' : 'text-foreground'}`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {opt.desc}
                      </span>
                      {type === opt.value && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 可见范围 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  可见范围
                </label>
                <div className="flex flex-col gap-2">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setVisibility(opt.value)}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-all duration-150 ${
                        visibility === opt.value
                          ? 'border-primary bg-accent shadow-[0_0_0_3px_hsl(var(--primary) / 0.10)]'
                          : 'border-border bg-card hover:border-border hover:bg-accent/50'
                      }`}
                    >
                      <span className="text-base leading-none">{opt.icon}</span>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-semibold leading-none ${visibility === opt.value ? 'text-primary' : 'text-foreground'}`}
                        >
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 资源标题 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  资源标题{' '}
                  <span className="text-destructive normal-case tracking-normal font-normal">
                    *
                  </span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="给这个资源起个名字"
                  maxLength={100}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  描述{' '}
                  <span className="normal-case tracking-normal font-normal text-muted-foreground">
                    （可选）
                  </span>
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="简单描述一下这个资源的用途、风格或来源…"
                  maxLength={255}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>

              {/* ── 标签 ── */}
              <ResourceTagSelector
                value={tags}
                onChange={setTags}
                aiPreUpload={{
                  type: type || resource?.type || 'wallpaper',
                  title,
                  description: desc,
                }}
              />
            </div>

            {/* ── 底部操作栏 ── */}
            <div className="shrink-0 flex items-center gap-3 border-t border-border bg-muted/60 px-6 py-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl"
                disabled={saving}
              >
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-2 rounded-xl font-semibold shadow-[0_4px_16px_hsl(var(--primary) / 0.28)] disabled:shadow-none transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中…
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    保存修改
                  </>
                )}
              </Button>
            </div>
            <BoxLoadingOverlay
              show={saving}
              title="正在保存资源信息..."
              hint="保存后会自动刷新当前资源状态"
              className="rounded-none"
            />
          </div>
        </div>
      </DialogContent>
      <ImagePreviewDialog
        open={previewOpen}
        src={resource?.url}
        resourceId={resource?.id}
        title={resource?.title || '资源预览'}
        onOpenChange={setPreviewOpen}
      />
    </Dialog>
  );
}
