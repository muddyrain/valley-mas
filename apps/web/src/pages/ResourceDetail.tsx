import {
  ArrowLeft,
  Calendar,
  Download,
  FileImage,
  Heart,
  Loader2,
  MonitorSmartphone,
  Share2,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  downloadResource,
  favoriteResource,
  getResourceDetail,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

const TYPE_LABEL: Record<string, string> = {
  wallpaper: '壁纸',
  avatar: '头像',
};

function formatSize(bytes?: number): string {
  if (!bytes) return '未知';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // 图片是否已加载完成（用于模糊渐入）
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setImgLoaded(false);
    getResourceDetail(id)
      .then((data) => {
        setResource(data);
        setFavorited(data.isFavorited ?? false);
      })
      .catch(() => toast.error('加载资源失败'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFavorite = async () => {
    if (!isAuthenticated) {
      toast.error('请先登录');
      navigate('/login');
      return;
    }
    if (!resource) return;
    // 乐观更新：先同步 UI，失败时回滚
    const prevFavorited = favorited;
    const delta = favorited ? -1 : 1;
    setFavorited(!favorited);
    setResource((prev) =>
      prev ? { ...prev, favoriteCount: Math.max(0, (prev.favoriteCount ?? 0) + delta) } : prev,
    );

    try {
      setFavoriteLoading(true);
      if (prevFavorited) {
        await unfavoriteResource(resource.id);
        toast.success('已取消收藏');
      } else {
        await favoriteResource(resource.id);
        toast.success('已收藏');
      }
    } catch {
      // 请求失败，回滚 UI
      setFavorited(prevFavorited);
      setResource((prev) =>
        prev ? { ...prev, favoriteCount: Math.max(0, (prev.favoriteCount ?? 0) - delta) } : prev,
      );
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!isAuthenticated) {
      toast.error('请先登录后下载');
      navigate('/login');
      return;
    }
    if (!resource) return;
    try {
      setDownloading(true);
      const { downloadUrl } = await downloadResource(resource.id);
      // 新 tab 打开下载链接
      window.open(downloadUrl, '_blank', 'noopener');
      setResource((prev) => (prev ? { ...prev, downloadCount: prev.downloadCount + 1 } : prev));
    } catch {
      // request.ts 已处理
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success('链接已复制到剪贴板');
    });
  };

  // ── 骨架屏 ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-24 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* 图片骨架 */}
            <div className="lg:col-span-3">
              <Skeleton className="w-full aspect-square rounded-2xl" />
            </div>
            {/* 信息骨架 */}
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-3 pt-4">
                <Skeleton className="h-11 flex-1 rounded-xl" />
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="h-11 w-11 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <FileImage className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-500">资源不存在或已被删除</h2>
          <Button variant="outline" onClick={() => navigate('/')} className="mt-4">
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 返回按钮 */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition-colors mb-6 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          返回
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ── 左：图片预览 ───────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-black shadow-2xl">
              {/* 模糊背景 */}
              <img
                src={resource.url}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-50 pointer-events-none select-none"
              />
              {/* 主图 */}
              <img
                src={resource.url}
                alt={resource.title}
                className={`relative h-full w-full object-contain transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)}
              />
              {/* 加载中占位 */}
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
                </div>
              )}
              {/* 类型标签 */}
              <div className="absolute top-3 left-3">
                <Badge className="bg-black/60 backdrop-blur-sm text-white border-0 text-xs px-2.5 py-1">
                  {TYPE_LABEL[resource.type] ?? resource.type}
                </Badge>
              </div>
            </div>
          </div>

          {/* ── 右：信息面板 ───────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* 标题 */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
                {resource.title}
              </h1>
              {resource.description && (
                <p className="text-gray-500 text-sm leading-relaxed">{resource.description}</p>
              )}
            </div>

            {/* 创作者信息 */}
            <button
              type="button"
              onClick={() =>
                resource.creatorCode ? navigate(`/creator/${resource.creatorCode}`) : undefined
              }
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-purple-200 hover:shadow-md transition-all text-left w-full"
            >
              <Avatar className="h-10 w-10 border-2 border-purple-100">
                <AvatarImage src={resource.creatorAvatar} className="object-cover" />
                <AvatarFallback className="bg-linear-to-br from-purple-400 to-indigo-600 text-white text-sm font-bold">
                  {resource.creatorName?.[0]?.toUpperCase() || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">创作者</p>
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {resource.creatorName || '未知创作者'}
                </p>
              </div>
              <User className="h-4 w-4 text-purple-400 shrink-0" />
            </button>

            {/* 统计信息 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="p-1.5 rounded-lg bg-purple-50">
                  <Download className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">下载次数</p>
                  <p className="text-base font-bold text-gray-800">{resource.downloadCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="p-1.5 rounded-lg bg-pink-50">
                  <Heart className="h-4 w-4 text-pink-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">收藏次数</p>
                  <p className="text-base font-bold text-gray-800">{resource.favoriteCount ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="p-1.5 rounded-lg bg-blue-50">
                  <FileImage className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">文件大小</p>
                  <p className="text-base font-bold text-gray-800">{formatSize(resource.size)}</p>
                </div>
              </div>
              {resource.width && resource.height ? (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className="p-1.5 rounded-lg bg-indigo-50">
                    <MonitorSmartphone className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">分辨率</p>
                    <p className="text-base font-bold text-gray-800">
                      {resource.width} × {resource.height}
                    </p>
                  </div>
                </div>
              ) : null}
              {resource.extension ? (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className="p-1.5 rounded-lg bg-emerald-50">
                    <FileImage className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">文件格式</p>
                    <p className="text-base font-bold text-gray-800 uppercase">
                      {resource.extension}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 上传时间 */}
            <div className="flex items-center gap-2 text-sm text-gray-400 px-1">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>上传于 {formatDate(resource.createdAt)}</span>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 mt-auto pt-2">
              {/* 下载 */}
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold h-11 rounded-xl shadow-md shadow-purple-500/20 hover:shadow-lg transition-all"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    下载中…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    下载资源
                  </>
                )}
              </Button>

              {/* 收藏 */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleFavorite}
                disabled={favoriteLoading}
                className={`h-11 w-11 rounded-xl border-2 transition-all ${
                  favorited
                    ? 'border-pink-400 bg-pink-50 text-pink-500 hover:bg-pink-100'
                    : 'border-gray-200 hover:border-pink-300 hover:text-pink-400'
                }`}
                title={favorited ? '取消收藏' : '收藏'}
              >
                {favoriteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className={`h-4 w-4 ${favorited ? 'fill-pink-500' : ''}`} />
                )}
              </Button>

              {/* 分享 */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                className="h-11 w-11 rounded-xl border-2 border-gray-200 hover:border-purple-300 hover:text-purple-500 transition-all"
                title="复制链接"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
