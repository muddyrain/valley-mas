import { Edit3, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createGroup,
  deleteGroup,
  type Group,
  type GroupType,
  getAdminGroups,
  updateGroup,
} from '@/api/blog';
import PanelLoadingOverlay from '@/components/PanelLoadingOverlay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { openConfirmToast } from '@/components/ui/confirm-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { enumParam, useUrlQueryState } from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const GROUP_TYPE_META: Record<
  GroupType,
  {
    title: string;
    description: string;
    empty: string;
    createTitle: string;
    manageLabel: string;
  }
> = {
  blog: {
    title: '博客分组管理',
    description: '整理博客的栏目与内容归类，让创作空间和列表页更清晰。',
    empty: '还没有博客分组，先创建一个吧。',
    createTitle: '新建博客分组',
    manageLabel: '博客',
  },
  image_text: {
    title: '图文分组管理',
    description: '整理图文创作的主题分组，避免和博客栏目混在一起。',
    empty: '还没有图文分组，先创建一个吧。',
    createTitle: '新建图文分组',
    manageLabel: '图文',
  },
};

function resolveGroupType(raw: string | null): GroupType {
  return raw === 'image_text' ? 'image_text' : 'blog';
}

export default function BlogGroupManage() {
  const navigate = useNavigate();
  const {
    values: { type },
    setValue,
  } = useUrlQueryState({
    type: enumParam(['blog', 'image_text'] as const, 'blog'),
  });
  const { isAuthenticated } = useAuthStore();
  const groupType = resolveGroupType(type);
  const meta = useMemo(() => GROUP_TYPE_META[groupType], [groupType]);

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const showGroupsOverlay = loading && groups.length > 0;

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<Group | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminGroups({ groupType });
      setGroups(data || []);
    } catch {
      toast.error('加载分组失败');
    } finally {
      setLoading(false);
    }
  }, [groupType]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadGroups();
  }, [isAuthenticated, loadGroups]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error('请输入分组名称');
      return;
    }
    try {
      setCreating(true);
      await createGroup({
        name,
        groupType,
        description: createDesc.trim() || undefined,
      });
      toast.success('分组创建成功');
      setCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
      await loadGroups();
    } catch {
      toast.error('分组创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) {
      toast.error('请输入分组名称');
      return;
    }
    try {
      setUpdating(true);
      await updateGroup(editTarget.id, {
        name,
        description: editDesc.trim() || '',
      });
      toast.success('分组更新成功');
      setEditTarget(null);
      await loadGroups();
    } catch {
      toast.error('分组更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (target: Group) => {
    try {
      setDeleting(true);
      await deleteGroup(target.id);
      toast.success('分组删除成功');
      await loadGroups();
    } catch {
      toast.error('分组删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteConfirm = (target: Group) => {
    if (deleting) return;
    openConfirmToast({
      title: `确认删除「${target.name}」？`,
      description: '该分组下的内容会取消分组，不会删除内容本身。',
      confirmText: '确认删除',
      cancelText: '取消',
      confirmVariant: 'danger',
      onConfirm: () => handleDelete(target),
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <Card className="mb-6 rounded-2xl border border-border bg-card shadow-sm">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="mb-4 inline-flex rounded-xl border border-border bg-muted/35 p-1">
                  <button
                    type="button"
                    onClick={() => setValue('type', 'blog')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      groupType === 'blog'
                        ? 'bg-foreground text-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    博客分组
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('type', 'image_text')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      groupType === 'image_text'
                        ? 'bg-foreground text-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    图文分组
                  </button>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {meta.title}
                  </h1>
                  {!loading ? (
                    <span className="text-sm text-muted-foreground">{groups.length} 个分组</span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {meta.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-space')}
                  className="rounded-xl border-border"
                >
                  返回创作空间
                </Button>
                <Button onClick={() => setCreateOpen(true)} className="rounded-xl">
                  <Plus className="mr-1.5 h-4 w-4" />
                  新建分组
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          {loading && groups.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center">
              <FolderTree className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">{meta.empty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="group flex min-h-52 flex-col rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {meta.manageLabel}
                    </span>
                    <span
                      title={`ID ${group.id}`}
                      className="max-w-22 truncate text-xs text-muted-foreground"
                    >
                      #{group.id.slice(-6)}
                    </span>
                  </div>
                  <div className="mt-5">
                    <h3 className="truncate text-lg font-semibold text-foreground">{group.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold tabular-nums text-foreground">
                        {group.postCount || 0}
                      </span>
                      <span className="text-xs text-muted-foreground">篇内容</span>
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                    {group.description || '暂未填写分组说明'}
                  </p>
                  <div className="mt-auto flex items-center gap-1 border-t border-border pt-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg text-foreground hover:bg-muted"
                      onClick={() => {
                        setEditTarget(group);
                        setEditName(group.name);
                        setEditDesc(group.description || '');
                      }}
                    >
                      <Edit3 className="mr-1 h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => openDeleteConfirm(group)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <PanelLoadingOverlay
            show={showGroupsOverlay}
            title="正在同步分组列表..."
            hint="变更已提交，列表马上更新"
            className="rounded-[24px]"
          />
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{meta.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="分组名称"
            />
            <Input
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="分组说明（可选）"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                取消
              </Button>
              <Button onClick={() => void handleCreate()} disabled={creating}>
                创建
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑分组</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="分组名称"
            />
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="分组说明（可选）"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTarget(null)} disabled={updating}>
                取消
              </Button>
              <Button onClick={() => void handleUpdate()} disabled={updating}>
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
