import { Edit3, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createGroup, deleteGroup, type Group, getAdminGroups, updateGroup } from '@/api/blog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/useAuthStore';

export default function BlogGroupManage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<Group | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await getAdminGroups();
      setGroups(data || []);
    } catch {
      toast.error('加载分组失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'creator' && user?.role !== 'admin') {
      toast.error('仅创作者可管理博客分组');
      navigate('/');
      return;
    }
    void loadGroups();
  }, [isAuthenticated, navigate, user?.role]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error('请输入分组名称');
      return;
    }
    try {
      setCreating(true);
      await createGroup({ name, description: createDesc.trim() || undefined });
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteGroup(deleteTarget.id);
      toast.success('分组删除成功');
      setDeleteTarget(null);
      await loadGroups();
    } catch {
      toast.error('分组删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(165deg,#f8f7ff_0%,#f6faff_45%,#fbfbfd_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">博客分组管理</h1>
            <p className="mt-1 text-sm text-slate-500">创建、编辑、删除你的博客分组</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/my-space')} className="rounded-xl">
              返回创作空间
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" />
              新建分组
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
            <FolderTree className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-slate-500">还没有分组，先创建第一个分组吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-2xl border border-violet-200/70 bg-white p-5 shadow-[0_8px_22px_rgba(99,73,190,0.1)]"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">文章数：{group.postCount || 0}</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                    ID {group.id}
                  </span>
                </div>
                <p className="line-clamp-2 min-h-[40px] text-sm text-slate-600">
                  {group.description || '暂无分组描述'}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
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
                    variant="outline"
                    className="rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setDeleteTarget(group)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建博客分组</DialogTitle>
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
              placeholder="分组描述（可选）"
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
              placeholder="分组描述（可选）"
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除分组</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            确认删除「{deleteTarget?.name}」？分组下文章会自动取消分组，不会删除文章本身。
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              取消
            </Button>
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
