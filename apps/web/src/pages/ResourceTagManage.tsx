import { Hash, Loader2, Pencil, Plus, Sparkles, Tag, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  aiMatchResourceTags,
  createResourceTag,
  deleteResourceTag,
  getMyResources,
  getResourceTags,
  getResourceTagsById,
  type MyResource,
  type ResourceTag,
  setResourceTags,
  updateResourceTag,
} from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-primary-soft) 28%, white) 44%, var(--theme-page-cool) 100%)',
};

const BANNER_BACKGROUND = {
  background:
    'linear-gradient(135deg, rgba(var(--theme-primary-rgb),0.97) 0%, color-mix(in srgb, rgba(var(--theme-secondary-rgb),1) 36%, var(--theme-primary-hover)) 54%, var(--theme-primary-deep) 100%)',
};

// 预设颜色
const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#64748b',
  '#0ea5e9',
];

function TagBadge({ tag, onClick }: { tag: ResourceTag; onClick?: () => void }) {
  const bg = tag.color || '#6366f1';
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${onClick ? 'cursor-pointer' : ''}`}
      style={{ backgroundColor: bg + '18', color: bg, border: `1px solid ${bg}40` }}
    >
      <Hash className="h-2.5 w-2.5" />
      {tag.name}
    </span>
  );
}

// ─── 资源选择器（绑定标签用） ─────────────────────────────────────────
function ResourceRow({
  resource,
  allTags,
  onTagsChange,
}: {
  resource: MyResource & { tags?: ResourceTag[] };
  allTags: ResourceTag[];
  onTagsChange: (resourceId: string, tags: ResourceTag[]) => void;
}) {
  const [currentTags, setCurrentTags] = useState<ResourceTag[]>(resource.tags ?? []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // 同步外部数据
  useEffect(() => {
    setCurrentTags(resource.tags ?? []);
  }, [resource.tags]);

  const handleToggle = (tag: ResourceTag) => {
    setCurrentTags((prev) =>
      prev.some((t) => t.id === tag.id) ? prev.filter((t) => t.id !== tag.id) : [...prev, tag],
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await setResourceTags(
        resource.id,
        currentTags.map((t) => t.id),
      );
      setCurrentTags(result);
      onTagsChange(resource.id, result);
      setOpen(false);
      toast.success('标签已保存');
    } catch {
      // request.ts 统一处理
    } finally {
      setSaving(false);
    }
  };

  const handleAiMatch = async () => {
    try {
      setAiLoading(true);
      const result = await aiMatchResourceTags(resource.id, resource.url);
      setCurrentTags(result.tags);
      onTagsChange(resource.id, result.tags);
      toast.success(`AI 匹配了 ${result.tags.length} 个标签`);
      setOpen(false);
    } catch {
      // request.ts 统一处理
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-theme-shell-border bg-white/80 p-3 shadow-sm transition hover:shadow-md">
      {/* 缩略图 */}
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        <img
          src={resource.thumbnailUrl || resource.url}
          alt={resource.title}
          className="h-full w-full object-cover"
        />
      </div>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{resource.title}</p>
        <p className="text-xs text-slate-400">{resource.type === 'wallpaper' ? '壁纸' : '头像'}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {currentTags.length === 0 ? (
            <span className="text-xs text-slate-400">暂无标签</span>
          ) : (
            currentTags.map((tag) => <TagBadge key={tag.id} tag={tag} />)
          )}
        </div>
      </div>

      {/* 编辑按钮 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-xl border border-theme-soft-strong bg-white/75 p-2 text-theme-primary transition hover:bg-theme-soft"
      >
        <Tag className="h-4 w-4" />
      </button>

      {/* 标签选择弹窗 */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!saving && !aiLoading) setOpen(v);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-theme-primary" />
              编辑标签 · {resource.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 已选标签 */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">已选标签</p>
              <div className="flex min-h-8 flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                {currentTags.length === 0 ? (
                  <span className="text-xs text-slate-400">点击下方标签添加</span>
                ) : (
                  currentTags.map((tag) => (
                    <span
                      key={tag.id}
                      onClick={() => handleToggle(tag)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:opacity-80"
                      style={{
                        backgroundColor: (tag.color || '#6366f1') + '18',
                        color: tag.color || '#6366f1',
                        border: `1px solid ${tag.color || '#6366f1'}40`,
                      }}
                    >
                      <Hash className="h-2.5 w-2.5" />
                      {tag.name}
                      <X className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* 候选标签池 */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">全部标签（点击选择）</p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2">
                {allTags.length === 0 ? (
                  <span className="text-xs text-slate-400">暂无标签，请先在「标签库」中创建</span>
                ) : (
                  allTags.map((tag) => {
                    const selected = currentTags.some((t) => t.id === tag.id);
                    return (
                      <span
                        key={tag.id}
                        onClick={() => handleToggle(tag)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition"
                        style={{
                          backgroundColor: selected
                            ? (tag.color || '#6366f1') + '25'
                            : (tag.color || '#6366f1') + '10',
                          color: tag.color || '#6366f1',
                          border: `1px solid ${tag.color || '#6366f1'}${selected ? '70' : '30'}`,
                          opacity: selected ? 1 : 0.7,
                        }}
                      >
                        <Hash className="h-2.5 w-2.5" />
                        {tag.name}
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAiMatch}
                disabled={aiLoading || saving}
                className="rounded-xl gap-1.5 text-theme-primary border-theme-soft-strong"
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                AI 自动匹配
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                  className="rounded-xl"
                >
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-xl"
                >
                  {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  保存
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────
export default function ResourceTagManage() {
  const navigate = useNavigate();
  const { hasHydrated, isAuthenticated, user } = useAuthStore();

  // ── 标签库 ──
  const [tags, setTags] = useState<ResourceTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  // ── 创建 / 编辑标签弹窗 ──
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ResourceTag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);
  const [tagSubmitting, setTagSubmitting] = useState(false);

  // ── 删除标签 ──
  const [deleteTarget, setDeleteTarget] = useState<ResourceTag | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── 资源列表（用于绑定标签） ──
  const [resources, setResources] = useState<(MyResource & { tags?: ResourceTag[] })[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcePage, setResourcePage] = useState(1);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [resourceKeyword, setResourceKeyword] = useState('');
  const [inputKeyword, setInputKeyword] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;

  // ── Tab ──
  const [tab, setTab] = useState<'tags' | 'bind'>('tags');

  // 权限检查
  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'creator') {
      navigate('/');
      return;
    }
  }, [hasHydrated, isAuthenticated, user, navigate]);

  // 加载标签
  const loadTags = useCallback(async () => {
    try {
      setTagsLoading(true);
      const data = await getResourceTags({ pageSize: 200 });
      setTags(data.list ?? []);
    } catch {
      // 统一处理
    } finally {
      setTagsLoading(false);
    }
  }, []);

  // 加载资源（用于绑定 tab）
  const loadResources = useCallback(async (page: number, keyword: string) => {
    try {
      setResourcesLoading(true);
      const data = await getMyResources({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
      });
      const list = data.list ?? [];

      // 批量拉取每条资源当前绑定的标签
      const withTags = await Promise.all(
        list.map(async (r) => {
          try {
            const resTags = await getResourceTagsById(r.id);
            return { ...r, tags: resTags };
          } catch {
            return { ...r, tags: [] };
          }
        }),
      );
      setResources(withTags);
      setResourceTotal(data.total ?? 0);
    } catch {
      // 统一处理
    } finally {
      setResourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'creator') return;
    void loadTags();
  }, [isAuthenticated, user, loadTags]);

  useEffect(() => {
    if (tab !== 'bind' || !isAuthenticated || user?.role !== 'creator') return;
    void loadResources(resourcePage, resourceKeyword);
  }, [tab, resourcePage, resourceKeyword, isAuthenticated, user, loadResources]);

  // ── 搜索防抖 ──
  const handleSearch = (val: string) => {
    setInputKeyword(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setResourceKeyword(val);
      setResourcePage(1);
    }, 300);
  };

  // ── 标签对话框 ──
  const openCreateTagDialog = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor(PRESET_COLORS[0]);
    setTagDialogOpen(true);
  };

  const openEditTagDialog = (tag: ResourceTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color || PRESET_COLORS[0]);
    setTagDialogOpen(true);
  };

  const handleTagSubmit = async () => {
    const name = tagName.trim();
    if (!name) {
      toast.error('请输入标签名称');
      return;
    }
    if (name.length > 30) {
      toast.error('标签名称不超过 30 个字符');
      return;
    }
    try {
      setTagSubmitting(true);
      if (editingTag) {
        const updated = await updateResourceTag(editingTag.id, { name, color: tagColor });
        setTags((prev) => prev.map((t) => (t.id === editingTag.id ? updated : t)));
        toast.success('标签已更新');
      } else {
        const created = await createResourceTag({ name, color: tagColor });
        setTags((prev) => [created, ...prev]);
        toast.success('标签已创建');
      }
      setTagDialogOpen(false);
    } catch {
      // 统一处理
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleTagDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteResourceTag(deleteTarget.id);
      setTags((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success('标签已删除');
      setDeleteTarget(null);
    } catch {
      // 统一处理
    } finally {
      setDeleting(false);
    }
  };

  const handleResourceTagsChange = (resourceId: string, newTags: ResourceTag[]) => {
    setResources((prev) => prev.map((r) => (r.id === resourceId ? { ...r, tags: newTags } : r)));
  };

  const totalPages = Math.ceil(resourceTotal / PAGE_SIZE);

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      {/* Banner */}
      <PageBanner backgroundStyle={BANNER_BACKGROUND} padding="py-10" maxWidth="max-w-6xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-white/30 bg-white/18 p-3 shadow-lg backdrop-blur-md">
              <Tag className="h-7 w-7 text-white" />
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">资源标签管理</h1>
              <p className="mt-1 text-sm text-white/82">
                创建标签、给资源打标签，支持 AI 自动匹配，让资源更易被发现。
              </p>
            </div>
          </div>
          {tab === 'tags' && (
            <Button
              type="button"
              onClick={openCreateTagDialog}
              className="rounded-2xl bg-white px-5 font-semibold text-theme-primary shadow-lg hover:bg-white/92"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建标签
            </Button>
          )}
        </div>
      </PageBanner>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Tab 切换 */}
        <div className="flex gap-1 rounded-2xl border border-theme-shell-border bg-white/80 p-1 shadow-sm w-fit">
          {(
            [
              ['tags', '标签库'],
              ['bind', '资源绑定'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
                tab === key
                  ? 'bg-theme-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ══ Tab: 标签库 ══ */}
        {tab === 'tags' && (
          <>
            {tagsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : tags.length === 0 ? (
              <div className="rounded-[28px] border border-theme-shell-border bg-white/72 px-6 shadow-[0_20px_50px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
                <EmptyState
                  icon={Tag}
                  title="还没有标签"
                  description="先创建几个标签，例如「极简」「暗黑」「治愈」，然后去「资源绑定」页面给资源打标签。"
                  actionLabel="新建第一个标签"
                  onAction={openCreateTagDialog}
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between rounded-2xl border border-theme-shell-border bg-white/86 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 色块 */}
                      <div
                        className="h-8 w-8 shrink-0 rounded-xl shadow-sm"
                        style={{ backgroundColor: tag.color || '#6366f1' }}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{tag.name}</p>
                        <p className="text-xs text-slate-400">{tag.resourceCount} 个资源</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5 ml-2">
                      <button
                        type="button"
                        onClick={() => openEditTagDialog(tag)}
                        className="rounded-xl p-1.5 text-slate-400 transition hover:bg-theme-soft hover:text-theme-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tag)}
                        className="rounded-xl p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ Tab: 资源绑定 ══ */}
        {tab === 'bind' && (
          <div className="space-y-4">
            {/* 搜索栏 */}
            <div className="flex items-center gap-2">
              <div className="relative max-w-xs flex-1">
                <input
                  value={inputKeyword}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="搜索资源标题…"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white/80 pl-9 pr-3 text-sm text-slate-700 outline-none ring-0 transition placeholder:text-slate-400 focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30"
                />
                <Hash className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
              <span className="text-xs text-slate-400">共 {resourceTotal} 个资源</span>
            </div>

            {resourcesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : resources.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-12 text-center text-sm text-slate-400">
                没有符合条件的资源
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  {resources.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      allTags={tags}
                      onTagsChange={handleResourceTagsChange}
                    />
                  ))}
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-2.5 text-xs text-slate-500">
                    <span>
                      第 {resourcePage} / {totalPages} 页
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={resourcePage <= 1 || resourcesLoading}
                        onClick={() => setResourcePage((p) => p - 1)}
                        className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
                      >
                        上一页
                      </button>
                      <button
                        type="button"
                        disabled={resourcePage >= totalPages || resourcesLoading}
                        onClick={() => setResourcePage((p) => p + 1)}
                        className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── 创建 / 编辑标签弹窗 ── */}
      <Dialog
        open={tagDialogOpen}
        onOpenChange={(v) => {
          if (!tagSubmitting) setTagDialogOpen(v);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTag ? '编辑标签' : '新建标签'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* 名称 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">标签名称 *</label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="例如：极简、暗黑、治愈系"
                maxLength={30}
                className="theme-input-border h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleTagSubmit();
                }}
              />
            </div>

            {/* 颜色 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">标签颜色</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTagColor(c)}
                    className={`h-6 w-6 rounded-full transition ${
                      tagColor === c
                        ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* 自定义颜色 */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
                />
                <span className="text-xs text-slate-400">自定义颜色</span>
                <span
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: tagColor + '18',
                    color: tagColor,
                    border: `1px solid ${tagColor}40`,
                  }}
                >
                  <Hash className="h-2.5 w-2.5" />
                  {tagName || '预览'}
                </span>
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTagDialogOpen(false)}
                disabled={tagSubmitting}
              >
                取消
              </Button>
              <Button type="button" onClick={() => void handleTagSubmit()} disabled={tagSubmitting}>
                {tagSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editingTag ? '保存' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 删除确认 ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!deleting && !v) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除标签</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm leading-6 text-slate-600">
              确认删除标签「<span className="font-medium text-slate-800">{deleteTarget?.name}</span>
              」？ 所有使用该标签的资源关联也会被清除，操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={() => void handleTagDelete()}
                disabled={deleting}
                className="bg-rose-500 text-white hover:bg-rose-600"
              >
                {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                确认删除
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
