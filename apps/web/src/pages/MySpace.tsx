import {
  Download,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { deleteResource, getMyResources, type MyResource, uploadResource } from '@/api/resource';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

const RESOURCE_TYPES = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

// 文件大小格式化
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MySpace() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('');

  // 上传弹窗状态
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'wallpaper' | 'avatar'>('wallpaper');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<MyResource | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 权限检查
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'creator') {
      toast.error('该页面仅创作者可访问');
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  const loadResources = useCallback(
    async (type = activeType) => {
      try {
        setLoading(true);
        const data = await getMyResources({ type: type || undefined });
        setResources(data.list || []);
        setTotal(data.total || 0);
      } catch {
        toast.error('加载资源失败');
      } finally {
        setLoading(false);
      }
    },
    [activeType],
  );

  useEffect(() => {
    if (isAuthenticated && user?.role === 'creator') {
      loadResources(activeType);
    }
  }, [isAuthenticated, user, activeType, loadResources]);

  // 选择文件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('仅支持图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件大小不能超过 10MB');
      return;
    }
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // 拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('仅支持图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件大小不能超过 10MB');
      return;
    }
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // 提交上传
  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('请先选择文件');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('type', uploadType);
      await uploadResource(formData);
      toast.success('上传成功');
      setUploadOpen(false);
      resetUploadState();
      loadResources(activeType);
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setUploading(false);
    }
  };

  const resetUploadState = () => {
    setUploadFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadType('wallpaper');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 删除资源
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteResource(deleteTarget.id);
      toast.success('删除成功');
      setDeleteTarget(null);
      loadResources(activeType);
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setDeleting(false);
    }
  };

  if (!isAuthenticated || user?.role !== 'creator') {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
      {/* 头部 Banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-purple-600 via-indigo-600 to-purple-800">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 -left-4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
            <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
          </div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* 头像 */}
            <div className="relative">
              <div className="absolute -inset-2 bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full opacity-75 blur-xl" />
              <Avatar className="relative h-24 w-24 border-4 border-white/30 shadow-2xl ring-4 ring-purple-500/30">
                <AvatarImage src={user?.avatar} className="object-cover" />
                <AvatarFallback className="bg-linear-to-br from-purple-400 to-indigo-600 text-white text-3xl font-bold">
                  {(user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* 信息 */}
            <div className="flex-1 text-white">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                  {user?.nickname || user?.username}
                </h1>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1">
                  <Sparkles className="h-3 w-3 mr-1" />
                  我的创作空间
                </Badge>
              </div>
              <p className="text-purple-100 text-sm mb-5">
                在这里管理你上传的所有资源，上传新作品或删除旧内容。
              </p>
              {/* 统计 */}
              <div className="flex gap-4">
                <div className="bg-white/10 backdrop-blur-md rounded-xl px-5 py-3 border border-white/20">
                  <div className="flex items-center gap-2 text-purple-200 mb-1">
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">作品总数</span>
                  </div>
                  <div className="text-2xl font-bold">{total}</div>
                </div>
              </div>
            </div>

            {/* 上传按钮 */}
            <Button
              onClick={() => setUploadOpen(true)}
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl hover:scale-105 font-semibold px-8 transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              上传新资源
            </Button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 分类筛选 */}
        <div className="flex items-center gap-3 mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <span className="text-sm text-gray-500 font-medium mr-2">筛选：</span>
          {RESOURCE_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setActiveType(t.value)}
              className={`px-5 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeType === t.value
                  ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30 scale-105'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-400">共 {total} 个资源</span>
        </div>

        {/* 资源列表 */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-sm">
                <Skeleton className="aspect-3/4 w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-purple-100 mb-6">
              <ImageIcon className="h-12 w-12 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有上传任何资源</h3>
            <p className="text-gray-500 mb-8">点击上方按钮，上传你的第一个作品吧！</p>
            <Button
              onClick={() => setUploadOpen(true)}
              className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 font-semibold shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              立即上传
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {resources.map((resource) => (
              <Card
                key={resource.id}
                className="group overflow-hidden cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-1 border-2 border-transparent hover:border-purple-200 bg-white rounded-2xl"
              >
                <div className="aspect-3/4 overflow-hidden bg-linear-to-br from-purple-50 to-indigo-50 relative">
                  <img
                    src={resource.thumbnailUrl || resource.url}
                    alt={resource.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* 悬浮操作层 */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(resource)}
                      className="p-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all hover:scale-110"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {/* 类型标签 */}
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-black/50 backdrop-blur-sm text-white border-0 text-xs px-2 py-0.5">
                      {resource.type === 'wallpaper' ? '壁纸' : '头像'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium text-gray-900 truncate text-sm mb-1.5 group-hover:text-purple-600 transition-colors">
                    {resource.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3 text-purple-400" />
                      {resource.downloadCount}
                    </span>
                    <span>{formatSize(resource.size)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ===== 上传弹窗 ===== */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open) resetUploadState();
          setUploadOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Upload className="h-5 w-5 text-purple-600" />
              上传新资源
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* 类型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">资源类型</label>
              <div className="flex gap-3">
                {(['wallpaper', 'avatar'] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setUploadType(type)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${
                      uploadType === type
                        ? 'border-purple-600 bg-purple-50 text-purple-600'
                        : 'border-gray-200 text-gray-500 hover:border-purple-300'
                    }`}
                  >
                    {type === 'wallpaper' ? '🖼️ 壁纸' : '🙂 头像'}
                  </button>
                ))}
              </div>
            </div>

            {/* 文件拖拽区 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择图片</label>
              <div
                className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
                  previewUrl
                    ? 'border-purple-400 bg-purple-50/50'
                    : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/30'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="预览"
                      className={`w-full rounded-2xl object-cover ${
                        uploadType === 'wallpaper' ? 'max-h-56' : 'max-h-48'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFile(null);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="p-3 text-center text-xs text-gray-500">
                      {uploadFile?.name} · {formatSize(uploadFile?.size || 0)}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <ImageIcon className="h-12 w-12 mb-3 text-purple-300" />
                    <p className="text-sm font-medium text-gray-600 mb-1">点击或拖拽图片至此处</p>
                    <p className="text-xs">支持 JPG、PNG、WebP，最大 10MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  resetUploadState();
                  setUploadOpen(false);
                }}
                className="flex-1"
                disabled={uploading}
              >
                取消
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex-1 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-md"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    确认上传
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 删除确认弹窗 ===== */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              确认删除
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {deleteTarget && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 mb-4">
                <img
                  src={deleteTarget.thumbnailUrl || deleteTarget.url}
                  alt={deleteTarget.title}
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div>
                  <p className="font-medium text-gray-900 text-sm truncate max-w-45">
                    {deleteTarget.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {deleteTarget.downloadCount} 次下载 · {formatSize(deleteTarget.size)}
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-600">
              删除后将无法恢复，同时会从存储中永久移除。确认继续？
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="flex-1"
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  确认删除
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
