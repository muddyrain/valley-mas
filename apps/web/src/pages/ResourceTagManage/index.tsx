import {
  AlertCircle,
  CheckCircle2,
  Hash,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import ResourceTagUpsertDialog from '@/components/ResourceTagUpsertDialog';
import { Button } from '@/components/ui/button';
import { openConfirmToast } from '@/components/ui/confirm-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useUrlPaginationQuery } from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-primary-soft) 28%, white) 44%, var(--theme-page-cool) 100%)',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tagsPager = useUrlPaginationQuery({ pageKey: 'tagsPage', keywordKey: 'tagsKeyword' });
  const resourcePager = useUrlPaginationQuery({
    pageKey: 'resourcePage',
    keywordKey: 'resourceKeyword',
  });
  const { hasHydrated, isAuthenticated, user } = useAuthStore();

  // ── 标签库 ──
  const [tags, setTags] = useState<ResourceTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsTotal, setTagsTotal] = useState(0);
  const [tagsInputKeyword, setTagsInputKeyword] = useState(tagsPager.keyword);
  const tagsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TAGS_PAGE_SIZE = 24;

  // ── 创建 / 编辑标签弹窗 ──
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ResourceTag | null>(null);

  // ── 批量导入弹窗 ──
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchInput, setBatchInput] = useState('');
  // 解析后的预览条目
  type BatchItem = {
    name: string;
    description: string;
    status: 'pending' | 'success' | 'error' | 'duplicate';
    error?: string;
  };
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone] = useState(false);

  // ── 删除标签 ──
  const [deleting, setDeleting] = useState(false);

  // ── 资源列表（用于绑定标签） ──
  const [resources, setResources] = useState<(MyResource & { tags?: ResourceTag[] })[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [inputKeyword, setInputKeyword] = useState(resourcePager.keyword);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;

  const tagsKeyword = tagsPager.keyword;
  const tagsPage = tagsPager.page;
  const resourceKeyword = resourcePager.keyword;
  const resourcePage = resourcePager.page;
  const tab = searchParams.get('tab') === 'bind' ? 'bind' : 'tags';

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

  useEffect(() => {
    setTagsInputKeyword(tagsKeyword);
  }, [tagsKeyword]);

  useEffect(() => {
    setInputKeyword(resourceKeyword);
  }, [resourceKeyword]);

  // ── 标签库搜索防抖 ──
  const handleTagsSearch = (val: string) => {
    setTagsInputKeyword(val);
    if (tagsDebounceRef.current) clearTimeout(tagsDebounceRef.current);
    tagsDebounceRef.current = setTimeout(() => {
      tagsPager.setKeyword(val, true);
    }, 300);
  };

  // ── 资源搜索防抖 ──
  const handleSearch = (val: string) => {
    setInputKeyword(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      resourcePager.setKeyword(val, true);
    }, 300);
  };

  // ── 标签对话框 ──
  const openCreateTagDialog = () => {
    setEditingTag(null);
    setTagDialogOpen(true);
  };

  const openEditTagDialog = (tag: ResourceTag) => {
    setEditingTag(tag);
    setTagDialogOpen(true);
  };

  const handleTagDelete = async (target: ResourceTag) => {
    try {
      setDeleting(true);
      await deleteResourceTag(target.id);
      setTags((prev) => prev.filter((t) => t.id !== target.id));
      toast.success('标签已删除');
    } catch {
      // 统一处理
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteConfirm = (target: ResourceTag) => {
    if (deleting) return;
    openConfirmToast({
      title: `确认删除标签「${target.name}」？`,
      description: '所有使用该标签的资源关联也会被清除，操作不可撤销。',
      confirmText: '确认删除',
      cancelText: '取消',
      confirmVariant: 'danger',
      onConfirm: () => handleTagDelete(target),
    });
  };

  const handleResourceTagsChange = (resourceId: string, newTags: ResourceTag[]) => {
    setResources((prev) => prev.map((r) => (r.id === resourceId ? { ...r, tags: newTags } : r)));
  };

  // ── 批量导入 ──

  /** 将文本框内容解析成 { name, description } 列表 */
  const parseBatchInput = (text: string): BatchItem[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // 去掉行首序号（"1. " / "1、" 等）
        const cleaned = line.replace(/^\d+[.、．\s]+/, '').trim();
        // 用中文冒号或英文冒号做分隔，取第一个
        const colonIdx = cleaned.search(/[：:]/);
        if (colonIdx <= 0) {
          // 没有冒号：整行作为名称，无描述
          return { name: cleaned, description: '', status: 'pending' as const };
        }
        const rawName = cleaned.slice(0, colonIdx).trim();
        const desc = cleaned.slice(colonIdx + 1).trim();
        // 名称中可能含括号备注，如"我的世界（Minecraft）"→ 保留全名
        return { name: rawName, description: desc, status: 'pending' as const };
      })
      .filter((item) => item.name.length > 0 && item.name.length <= 30);
  };

  const handleBatchPreview = () => {
    const items = parseBatchInput(batchInput);
    if (items.length === 0) {
      toast.error('未能识别到有效标签，请检查格式');
      return;
    }
    setBatchItems(items);
  };

  const handleBatchImport = async () => {
    if (batchItems.length === 0) return;
    setBatchRunning(true);
    setBatchDone(false);
    const results: BatchItem[] = [...batchItems];
    const createdTags: ResourceTag[] = [];
    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      if (item.status !== 'pending') continue;
      try {
        const created = await createResourceTag({ name: item.name, description: item.description });
        results[i] = { ...item, status: 'success' };
        createdTags.push(created);
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? '';
        const isDuplicate =
          msg.includes('已存在') || msg.includes('duplicate') || msg.includes('already');
        results[i] = { ...item, status: isDuplicate ? 'duplicate' : 'error', error: msg };
      }
      // 每条完成后只刷新进度列表，不触发列表请求
      setBatchItems([...results]);
    }
    setBatchRunning(false);
    setBatchDone(true);
    const successCount = results.filter((r) => r.status === 'success').length;
    const dupCount = results.filter((r) => r.status === 'duplicate').length;
    const errCount = results.filter((r) => r.status === 'error').length;
    if (successCount > 0)
      toast.success(
        `成功创建 ${successCount} 个标签${dupCount > 0 ? `，${dupCount} 个已存在跳过` : ''}`,
      );
    if (errCount > 0) toast.error(`${errCount} 个标签创建失败`);
    // 全部完成后一次性合并到标签列表，不重新请求接口
    if (createdTags.length > 0) {
      setTags((prev) => [...createdTags.reverse(), ...prev]);
    }
  };

  const resetBatchDialog = () => {
    setBatchInput('');
    setBatchItems([]);
    setBatchRunning(false);
    setBatchDone(false);
  };

  const totalTagPages = Math.max(1, Math.ceil(tagsTotal / TAGS_PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(resourceTotal / PAGE_SIZE));

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      {/* Banner */}
      <PageBanner padding="py-10" maxWidth="max-w-6xl">
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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => {
                  resetBatchDialog();
                  setBatchDialogOpen(true);
                }}
                className="rounded-2xl bg-white/20 border border-white/40 px-5 font-semibold text-white shadow-lg hover:bg-white/30 backdrop-blur-sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                批量导入
              </Button>
              <Button
                type="button"
                onClick={openCreateTagDialog}
                className="rounded-2xl bg-white px-5 font-semibold text-theme-primary shadow-lg hover:bg-white/92"
              >
                <Plus className="mr-2 h-4 w-4" />
                新建标签
              </Button>
            </div>
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
              onClick={() => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set('tab', key);
                setSearchParams(nextParams);
              }}
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
                              onClick={() => openDeleteConfirm(tag)}
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
                        onClick={() => tagsPager.setPage(Math.max(1, tagsPage - 1))}
                        className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
                      >
                        上一页
                      </button>
                      <button
                        type="button"
                        disabled={tagsPage >= totalTagPages || tagsLoading}
                        onClick={() => tagsPager.setPage(Math.min(totalTagPages, tagsPage + 1))}
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
                        onClick={() => resourcePager.setPage(Math.max(1, resourcePage - 1))}
                        className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
                      >
                        上一页
                      </button>
                      <button
                        type="button"
                        disabled={resourcePage >= totalPages || resourcesLoading}
                        onClick={() =>
                          resourcePager.setPage(Math.min(totalPages, resourcePage + 1))
                        }
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
      <ResourceTagUpsertDialog
        open={tagDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditingTag(null);
          }
          setTagDialogOpen(nextOpen);
        }}
        mode={editingTag ? 'edit' : 'create'}
        initialValue={
          editingTag
            ? {
                name: editingTag.name,
                description: editingTag.description,
              }
            : undefined
        }
        onSubmit={(payload) => {
          if (editingTag) {
            return updateResourceTag(editingTag.id, payload);
          }
          return createResourceTag(payload);
        }}
        onSuccess={(tag) => {
          if (editingTag) {
            setTags((prev) => prev.map((item) => (item.id === editingTag.id ? tag : item)));
          } else {
            setTags((prev) => [tag, ...prev]);
          }
          setEditingTag(null);
        }}
      />
      {/* ── 批量导入标签弹窗 ── */}
      <Dialog
        open={batchDialogOpen}
        onOpenChange={(v) => {
          if (!batchRunning) {
            setBatchDialogOpen(v);
            if (!v) resetBatchDialog();
          }
        }}
      >
        <DialogContent className="max-w-160!">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-theme-primary" />
              批量导入标签
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 格式说明 */}
            <div className="rounded-xl border border-theme-primary/20 bg-theme-soft px-4 py-3 text-xs text-slate-600 leading-5">
              <p className="font-semibold text-theme-primary mb-1">格式说明</p>
              <p>
                每行一条，格式为{' '}
                <code className="bg-white/80 px-1 rounded text-slate-700">标签名称：标签描述</code>
                （中英文冒号均可）
              </p>
              <p className="mt-0.5 text-slate-400">
                名称不超过 30 字 · 描述可选 · 重复标签自动跳过
              </p>
            </div>

            {/* 输入区 */}
            {!batchItems.length && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">粘贴标签内容</label>
                <textarea
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder={`二次元：标准的动漫风格，开启跨次元的视觉之旅。\n少女：洋溢青春气息，记录美好且纯粹的少女感。\n空灵：干净、透明、不食人间烟火的感觉。`}
                  rows={10}
                  className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 font-mono"
                />
                <p className="text-right text-xs text-slate-400">
                  已输入 {batchInput.split('\n').filter((l) => l.trim()).length} 行
                </p>
              </div>
            )}

            {/* 预览 / 执行进度 */}
            {batchItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">
                    识别结果（共 {batchItems.length} 条）
                  </label>
                  {!batchRunning && !batchDone && (
                    <button
                      type="button"
                      onClick={() => setBatchItems([])}
                      className="text-xs text-slate-400 hover:text-slate-600 transition"
                    >
                      重新编辑
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                  {batchItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                        item.status === 'success'
                          ? 'bg-emerald-50 border border-emerald-100'
                          : item.status === 'duplicate'
                            ? 'bg-amber-50 border border-amber-100'
                            : item.status === 'error'
                              ? 'bg-rose-50 border border-rose-100'
                              : 'bg-white border border-slate-100'
                      }`}
                    >
                      {/* 状态图标 */}
                      <div className="mt-0.5 shrink-0">
                        {item.status === 'pending' && batchRunning ? (
                          <Loader2 className="h-3.5 w-3.5 text-theme-primary animate-spin" />
                        ) : item.status === 'pending' ? (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300" />
                        ) : item.status === 'success' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : item.status === 'duplicate' ? (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-rose-500" />
                        )}
                      </div>
                      {/* 内容 */}
                      <div className="min-w-0 flex-1 w-120">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              item.status === 'success'
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.status === 'duplicate'
                                  ? 'bg-amber-100 text-amber-700'
                                  : item.status === 'error'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-theme-soft text-theme-primary border border-theme-soft-strong'
                            }`}
                          >
                            <Hash className="h-2.5 w-2.5" />
                            {item.name}
                          </span>
                          {item.status === 'duplicate' && (
                            <span className="text-xs text-amber-500">已存在，跳过</span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-xs text-rose-500">
                              {item.error || '创建失败'}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 统计 */}
                {batchDone && (
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600">
                      成功 {batchItems.filter((i) => i.status === 'success').length}
                    </span>
                    {batchItems.filter((i) => i.status === 'duplicate').length > 0 && (
                      <span className="text-amber-500">
                        已存在 {batchItems.filter((i) => i.status === 'duplicate').length}
                      </span>
                    )}
                    {batchItems.filter((i) => i.status === 'error').length > 0 && (
                      <span className="text-rose-500">
                        失败 {batchItems.filter((i) => i.status === 'error').length}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={batchRunning}
                onClick={() => {
                  setBatchDialogOpen(false);
                  resetBatchDialog();
                }}
              >
                {batchDone ? '关闭' : '取消'}
              </Button>
              {!batchItems.length ? (
                <Button type="button" disabled={!batchInput.trim()} onClick={handleBatchPreview}>
                  解析预览
                </Button>
              ) : !batchDone ? (
                <Button
                  type="button"
                  disabled={batchRunning}
                  onClick={() => void handleBatchImport()}
                  className="theme-btn-primary"
                >
                  {batchRunning ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      导入中…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 h-4 w-4" />
                      确认导入 {batchItems.length} 条
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    resetBatchDialog();
                    setBatchDialogOpen(false);
                  }}
                >
                  完成
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
