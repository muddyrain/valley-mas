import {
  Hash,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
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

// ─── 标签徽章（统一主题色，无颜色依赖） ─────────────────────────────────────
function TagBadge({ tag, onClick }: { tag: ResourceTag; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border border-theme-soft-strong bg-theme-soft px-2.5 py-0.5 text-xs font-medium text-theme-primary ${onClick ? 'cursor-pointer transition hover:bg-theme-primary/10' : ''}`}
    >
      <Hash className="h-2.5 w-2.5" />
      {tag.name}
    </span>
  );
}

// ─── 资源绑定行 ──────────────────────────────────────────────────────────────
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
      const result = await aiMatchResourceTags(resource.id);
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
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-theme-soft-strong bg-theme-soft px-2.5 py-0.5 text-xs font-medium text-theme-primary transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Hash className="h-2.5 w-2.5" />
                      {tag.name}
                      <X className="ml-0.5 h-2.5 w-2.5 opacity-60" />
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* 候选标签池 */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">全部标签（点击选择）</p>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2">
                {allTags.length === 0 ? (
                  <span className="text-xs text-slate-400">暂无标签，请先在「标签库」中创建</span>
                ) : (
                  allTags.map((tag) => {
                    const selected = currentTags.some((t) => t.id === tag.id);
                    return (
                      <span
                        key={tag.id}
                        onClick={() => handleToggle(tag)}
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                          selected
                            ? 'border-theme-primary/40 bg-theme-primary/10 text-theme-primary'
                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-theme-soft-strong hover:bg-theme-soft hover:text-theme-primary'
                        }`}
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
  const [tagsTotal, setTagsTotal] = useState(0);
  const [tagsPage, setTagsPage] = useState(1);
  const [tagsKeyword, setTagsKeyword] = useState('');
  const [tagsInputKeyword, setTagsInputKeyword] = useState('');
  const tagsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TAGS_PAGE_SIZE = 24;

  // ── 创建 / 编辑标签弹窗 ──
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ResourceTag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagDescription, setTagDescription] = useState('');
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

  // 是否是管理员（只有管理员可增删改标签）
  const isAdmin = user?.role === 'admin';

  // 权限检查：管理员或创作者才能访问，普通用户跳走
  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'creator' && user?.role !== 'admin') {
      navigate('/');
      return;
    }
  }, [hasHydrated, isAuthenticated, user, navigate]);

  // 加载标签
  const loadTags = useCallback(
    async (page: number, keyword: string) => {
      try {
        setTagsLoading(true);
        const data = await getResourceTags({
          page,
          pageSize: TAGS_PAGE_SIZE,
          keyword: keyword || undefined,
        });
        setTags(data.list ?? []);
        setTagsTotal(data.total ?? 0);
      } catch {
        // 统一处理
      } finally {
        setTagsLoading(false);
      }
    },
    [TAGS_PAGE_SIZE],
  );

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
    if (!isAuthenticated || (user?.role !== 'creator' && user?.role !== 'admin')) return;
    void loadTags(tagsPage, tagsKeyword);
  }, [isAuthenticated, user, loadTags, tagsPage, tagsKeyword]);

  useEffect(() => {
    if (tab !== 'bind' || !isAuthenticated || (user?.role !== 'creator' && user?.role !== 'admin'))
      return;
    void loadResources(resourcePage, resourceKeyword);
  }, [tab, resourcePage, resourceKeyword, isAuthenticated, user, loadResources]);

  // ── 标签库搜索防抖 ──
  const handleTagsSearch = (val: string) => {
    setTagsInputKeyword(val);
    if (tagsDebounceRef.current) clearTimeout(tagsDebounceRef.current);
    tagsDebounceRef.current = setTimeout(() => {
      setTagsKeyword(val);
      setTagsPage(1);
    }, 300);
  };

  // ── 资源搜索防抖 ──
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
    setTagDescription('');
    setTagDialogOpen(true);
  };

  const openEditTagDialog = (tag: ResourceTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagDescription(tag.description ?? '');
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
        const updated = await updateResourceTag(editingTag.id, {
          name,
          description: tagDescription.trim(),
        });
        setTags((prev) => prev.map((t) => (t.id === editingTag.id ? updated : t)));
        toast.success('标签已更新');
      } else {
        const created = await createResourceTag({ name, description: tagDescription.trim() });
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

  const totalTagPages = Math.ceil(tagsTotal / TAGS_PAGE_SIZE);
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
                {isAdmin
                  ? '创建标签、给资源打标签，支持 AI 自动匹配，让资源更易被发现。'
                  : '查看全部标签，并为自己的资源绑定合适的标签。'}
              </p>
            </div>
          </div>
          {tab === 'tags' && isAdmin && (
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

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Tab 切换 */}
        <div className="flex w-fit gap-1 rounded-2xl border border-theme-shell-border bg-white/80 p-1 shadow-sm">
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
            {/* 工具栏：搜索 + 刷新 */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={tagsInputKeyword}
                  onChange={(e) => handleTagsSearch(e.target.value)}
                  placeholder="搜索标签名称或介绍…"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white/80 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30"
                />
              </div>
              <button
                type="button"
                onClick={() => void loadTags(tagsPage, tagsKeyword)}
                disabled={tagsLoading}
                title="刷新"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 transition hover:border-theme-soft-strong hover:bg-theme-soft hover:text-theme-primary disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${tagsLoading ? 'animate-spin' : ''}`} />
              </button>
              <span className="text-xs text-slate-400 shrink-0">共 {tagsTotal} 个标签</span>
            </div>

            {tagsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : tags.length === 0 ? (
              <div className="rounded-[28px] border border-theme-shell-border bg-white/72 px-6 shadow-[0_20px_50px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
                <EmptyState
                  icon={Tag}
                  title={tagsKeyword ? '没有匹配的标签' : '还没有标签'}
                  description={
                    tagsKeyword
                      ? `没有找到包含「${tagsKeyword}」的标签，换个关键词试试？`
                      : '先创建几个标签，例如「极简」「暗黑」「治愈」，然后去「资源绑定」页面给资源打标签。'
                  }
                  actionLabel={tagsKeyword ? undefined : '新建第一个标签'}
                  onAction={tagsKeyword ? undefined : openCreateTagDialog}
                />
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="group flex flex-col gap-2 rounded-2xl border border-theme-shell-border bg-white/86 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {/* 顶部：标签名 + 操作按钮 */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-theme-soft-strong bg-theme-soft px-3 py-1 text-sm font-semibold text-theme-primary">
                          <Hash className="h-3 w-3" />
                          {tag.name}
                        </span>
                        {isAdmin && (
                          <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
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
                        )}
                      </div>

                      {/* 介绍文字 */}
                      <p className="line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
                        {tag.description || <span className="italic text-slate-300">暂无介绍</span>}
                      </p>

                      {/* 底部：资源数 */}
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Tag className="h-3 w-3" />
                        <span>{tag.resourceCount} 个资源</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 分页 */}
                {totalTagPages > 1 && (
                  <div className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-2.5 text-xs text-slate-500">
                    <span>
                      第 {tagsPage} / {totalTagPages} 页，共 {tagsTotal} 个
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={tagsPage <= 1 || tagsLoading}
                        onClick={() => setTagsPage((p) => p - 1)}
                        className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
                      >
                        上一页
                      </button>
                      <button
                        type="button"
                        disabled={tagsPage >= totalTagPages || tagsLoading}
                        onClick={() => setTagsPage((p) => p + 1)}
                        className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </>
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

            {/* 介绍 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">标签介绍</label>
              <textarea
                value={tagDescription}
                onChange={(e) => setTagDescription(e.target.value)}
                placeholder="简单描述这个标签的含义，方便 AI 匹配"
                maxLength={100}
                rows={3}
                className="theme-input-border w-full resize-none rounded-md border px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30"
              />
              <p className="text-right text-xs text-slate-400">{tagDescription.length}/100</p>
            </div>

            {/* 预览 */}
            {tagName && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-400">预览：</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-theme-soft-strong bg-theme-soft px-2.5 py-0.5 text-xs font-medium text-theme-primary">
                  <Hash className="h-2.5 w-2.5" />
                  {tagName}
                </span>
              </div>
            )}

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
