/**
 * EditResourceDialog
 * 编辑资源信息弹窗（标题、描述、类型、可见范围、标签）
 * 图片不可更换，如需替换请重新上传。
 */
import { Hash, Image as ImageIcon, Loader2, Pencil, Sparkles, Tag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  aiMatchResourceTags,
  getResourceTags,
  getResourceTagsById,
  type ResourceTag,
  type ResourceVisibility,
  setResourceTags,
  updateResource,
} from '@/api/resource';
import { Button } from '@/components/ui/button';
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

  // 标签状态
  const [tags, setTags] = useState<ResourceTag[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [tagKeyword, setTagKeyword] = useState('');
  const [tagResults, setTagResults] = useState<ResourceTag[]>([]);
  const [tagSearching, setTagSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // resource 变化时重置表单
  useEffect(() => {
    if (!resource) return;
    setTitle(resource.title);
    setDesc(resource.description ?? '');
    setType(resource.type);
    setVisibility(resource.visibility ?? 'private');
    setTags([]);
    setTagKeyword('');
    setTagResults([]);
    setSaving(false);
    setAiLoading(false);

    getResourceTagsById(resource.id)
      .then((t) => setTags(t))
      .catch(() => {
        /* 静默失败 */
      });
  }, [resource]);

  // 标签搜索（300ms 防抖）
  const handleTagKeyword = (kw: string) => {
    setTagKeyword(kw);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!kw.trim()) {
      setTagResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setTagSearching(true);
        const res = await getResourceTags({ keyword: kw.trim(), pageSize: 20 });
        setTagResults(res.list ?? []);
      } catch {
        // 静默失败
      } finally {
        setTagSearching(false);
      }
    }, 300);
  };

  // AI 自动匹配
  const handleAiMatch = async () => {
    if (!resource) return;
    try {
      setAiLoading(true);
      const result = await aiMatchResourceTags(resource.id);
      setTags(result.tags);
      toast.success(`AI 匹配了 ${result.tags.length} 个标签`);
    } catch {
      // 统一处理
    } finally {
      setAiLoading(false);
    }
  };

  // 提交保存
  const handleSubmit = async () => {
    if (!resource) return;
    try {
      setSaving(true);
      await Promise.all([
        updateResource(resource.id, {
          title: title.trim() || undefined,
          description: desc.trim() || undefined,
          type: type || undefined,
          visibility,
        }),
        setResourceTags(
          resource.id,
          tags.map((t) => t.id),
        ),
      ]);
      toast.success('修改成功');
      onSuccess?.({
        id: resource.id,
        title: title.trim() || resource.title,
        description: desc.trim() || resource.description || '',
        type: type || resource.type,
        visibility,
      });
      onOpenChange(false);
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving && !aiLoading) onOpenChange(false);
      }}
    >
      <DialogContent className="flex h-[90vh] w-[90vw] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* ── 顶部标题栏 ── */}
        <div className="shrink-0 border-b border-slate-100 bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10)_0%,rgba(var(--theme-primary-rgb),0.03)_100%)] px-6 py-4 flex items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-2xl bg-theme-primary/10 flex items-center justify-center shadow-[0_4px_12px_rgba(var(--theme-primary-rgb),0.18)]">
            <Pencil className="h-4.5 w-4.5 text-theme-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-slate-900 leading-tight">编辑资源信息</div>
            <p className="mt-0.5 text-xs text-slate-500 truncate">{resource?.title}</p>
          </div>
        </div>

        {/* ── 左右双栏 ── */}
        <div className="flex min-h-0 flex-1 divide-x divide-slate-100 overflow-hidden">
          {/* ── 左栏：图片预览（只读） ── */}
          <div className="flex w-[48%] shrink-0 flex-col gap-3 p-6 bg-slate-50/40">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              图片预览
            </p>
            <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
              {resource && (
                <img
                  src={resource.thumbnailUrl ?? resource.url}
                  alt={resource.title}
                  className="h-full w-full object-contain"
                />
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-black/40 px-3 py-1 text-[10px] text-white/80 backdrop-blur-sm whitespace-nowrap">
                  🔒 图片不可更换，如需替换请重新上传
                </span>
              </div>
            </div>
            {resource && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatSize(resource.size)}</span>
                <span className="text-slate-300">·</span>
                <span>{resource.downloadCount} 次下载</span>
              </div>
            )}
          </div>

          {/* ── 右栏：表单 ── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 资源类型 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
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
                          ? 'border-theme-primary bg-theme-soft shadow-[0_0_0_3px_rgba(var(--theme-primary-rgb),0.10)]'
                          : 'border-slate-200 bg-white hover:border-theme-shell-border hover:bg-theme-soft/40'
                      }`}
                    >
                      <span className="text-xl leading-none">{opt.icon}</span>
                      <span
                        className={`text-sm font-semibold leading-none ${type === opt.value ? 'text-theme-primary' : 'text-slate-700'}`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-slate-400 leading-tight">{opt.desc}</span>
                      {type === opt.value && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-theme-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 可见范围 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
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
                          ? 'border-theme-primary bg-theme-soft shadow-[0_0_0_3px_rgba(var(--theme-primary-rgb),0.10)]'
                          : 'border-slate-200 bg-white hover:border-theme-shell-border hover:bg-theme-soft/40'
                      }`}
                    >
                      <span className="text-base leading-none">{opt.icon}</span>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-semibold leading-none ${visibility === opt.value ? 'text-theme-primary' : 'text-slate-700'}`}
                        >
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 资源标题 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  资源标题{' '}
                  <span className="text-red-400 normal-case tracking-normal font-normal">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="给这个资源起个名字"
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                />
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  描述{' '}
                  <span className="normal-case tracking-normal font-normal text-slate-400">
                    （可选）
                  </span>
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="简单描述一下这个资源的用途、风格或来源…"
                  maxLength={255}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                />
              </div>

              {/* ── 标签 ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Tag className="h-3 w-3" />
                    标签
                    {tags.length > 0 && (
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded-full normal-case tracking-normal ${tags.length >= 10 ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {tags.length}/10
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    disabled={!resource || aiLoading}
                    onClick={handleAiMatch}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-primary-rgb),0.06))] border border-theme-primary/25 px-2.5 py-1 text-xs font-medium text-theme-primary transition-all hover:bg-theme-primary hover:text-white hover:border-theme-primary hover:shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.30)] disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {aiLoading ? 'AI 匹配中…' : 'AI 自动匹配'}
                  </button>
                </div>

                {/* 已选标签 */}
                <div className="flex min-h-8 flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                  {tags.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      搜索并添加标签，或使用 AI 自动匹配
                    </span>
                  ) : (
                    tags.map((tag) => (
                      <span
                        key={tag.id}
                        onClick={() => setTags((prev) => prev.filter((t) => t.id !== tag.id))}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:opacity-70 bg-theme-soft text-theme-primary border border-theme-soft-strong"
                      >
                        <Hash className="h-2.5 w-2.5" />
                        {tag.name}
                        <X className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                      </span>
                    ))
                  )}
                </div>

                {/* 实时搜索框 */}
                <div className="relative">
                  <input
                    type="text"
                    value={tagKeyword}
                    onChange={(e) => handleTagKeyword(e.target.value)}
                    placeholder="搜索标签…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 pr-8"
                  />
                  {tagSearching && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 animate-spin" />
                  )}
                </div>

                {/* 搜索结果 */}
                {tagResults.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-white p-2 max-h-28 overflow-y-auto">
                    {tags.length >= 10 && (
                      <p className="w-full text-xs text-red-400 px-1 py-0.5">
                        已达上限（最多 10 个标签），请先移除部分标签
                      </p>
                    )}
                    {tagResults.map((tag) => {
                      const selected = tags.some((t) => t.id === tag.id);
                      const reachedLimit = !selected && tags.length >= 10;
                      return (
                        <span
                          key={tag.id}
                          title={tag.description || tag.name}
                          onClick={() => {
                            if (reachedLimit) return;
                            setTags((prev) =>
                              selected ? prev.filter((t) => t.id !== tag.id) : [...prev, tag],
                            );
                          }}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${reachedLimit ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'} ${selected ? 'bg-theme-soft text-theme-primary border border-theme-soft-strong' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                        >
                          <Hash className="h-2.5 w-2.5" />
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>
                )}
                {tagKeyword && !tagSearching && tagResults.length === 0 && (
                  <p className="text-xs text-slate-400 px-1">未找到匹配的标签</p>
                )}
              </div>
            </div>

            {/* ── 底部操作栏 ── */}
            <div className="shrink-0 flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
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
                className="flex-2 rounded-xl theme-btn-primary font-semibold shadow-[0_4px_16px_rgba(var(--theme-primary-rgb),0.28)] disabled:shadow-none transition-all"
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
