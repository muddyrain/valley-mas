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
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  downloadResource,
  favoriteResource,
  getMyResources,
  getResourceDetail,
  type MyResource,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import ImagePreviewDialog from '@/components/ImagePreviewDialog';
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

function mapMyResourceToDetail(
  resource: MyResource,
  currentUser?: { id?: string; nickname?: string; username?: string; avatar?: string },
): Resource {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description || '',
    url: resource.url,
    type: resource.type as Resource['type'],
    visibility: resource.visibility,
    downloadCount: resource.downloadCount,
    viewCount: 0,
    likeCount: 0,
    favoriteCount: 0,
    userId: currentUser?.id || '',
    creatorName: currentUser?.nickname || currentUser?.username || '我',
    creatorAvatar: currentUser?.avatar || '',
    tags: [],
    createdAt: resource.createdAt,
    size: resource.size,
    isFavorited: false,
  };
}

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/resources';
  const returnLabel =
    (location.state as { returnLabel?: string } | null)?.returnLabel || '返回资源列表';

  const handleReturn = useCallback(() => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(returnTo);
  }, [navigate, returnTo]);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      setImgLoaded(false);
      try {
        let data: Resource;
        try {
          data = await getResourceDetail(id, { suppressErrorToast: true });
        } catch (error) {
          if (user?.role !== 'creator') throw error;
          const mine = await getMyResources(
            { page: 1, pageSize: 1000 },
            { suppressErrorToast: true },
          );
          const matched = mine.list.find((item) => item.id === id);
          if (!matched) throw error;
          data = mapMyResourceToDetail(matched, user || undefined);
        }
        setResource(data);
        setFavorited(data.isFavorited ?? false);
      } catch (error) {
        console.error('Failed to load resource:', error);
        setResource(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, user]);

  const handleFavorite = async () => {
    if (!isAuthenticated) {
      toast.error('请先登录');
      navigate('/login');
      return;
    }
    if (!resource) return;

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
      window.open(downloadUrl, '_blank', 'noopener');
      setResource((prev) => (prev ? { ...prev, downloadCount: prev.downloadCount + 1 } : prev));
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success('链接已复制到剪贴板');
    });
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-6 h-8 w-24" />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Skeleton className="aspect-square w-full rounded-2xl" />
            </div>
            <div className="space-y-4 lg:col-span-2">
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
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <FileImage className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-500">
            资源不存在，或当前账号没有权限访问
          </h2>
          <Button variant="outline" onClick={handleReturn} className="mt-4">
            {returnLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-4rem)]"
      style={{
        background:
          'linear-gradient(135deg, var(--theme-page-start), var(--theme-primary-soft) 50%, var(--theme-page-cool))',
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleReturn}
          className="group mb-6 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-theme-primary"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          {returnLabel}
        </button>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div
              className="relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl bg-black shadow-2xl"
              onClick={() => setPreviewOpen(true)}
            >
              <img
                src={resource.url}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover scale-110 blur-2xl opacity-50"
              />
              <img
                src={resource.url}
                alt={resource.title}
                className={`relative h-full w-full object-contain transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)}
              />
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                </div>
              )}
              <div className="absolute left-3 top-3">
                <Badge className="border-0 bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                  {TYPE_LABEL[resource.type] ?? resource.type}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-2">
            <div>
              <h1 className="mb-2 text-2xl font-bold leading-tight text-gray-900">
                {resource.title}
              </h1>
              {resource.description && (
                <p className="text-sm leading-relaxed text-gray-500">{resource.description}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                resource.creatorCode ? navigate(`/creator/${resource.creatorCode}`) : undefined
              }
              className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-all hover:border-theme-shell-border hover:shadow-md"
            >
              <Avatar className="h-10 w-10 border-2 border-theme-soft-strong">
                <AvatarImage src={resource.creatorAvatar} className="object-cover" />
                <AvatarFallback className="theme-avatar-fallback text-sm font-bold text-white">
                  {resource.creatorName?.[0]?.toUpperCase() || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-xs text-gray-400">创作者</p>
                <p className="truncate text-sm font-semibold text-gray-800">
                  {resource.creatorName || '未知创作者'}
                </p>
              </div>
              <User className="h-4 w-4 shrink-0 theme-icon-accent" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="rounded-lg bg-theme-soft p-1.5">
                  <Download className="h-4 w-4 text-theme-primary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">下载次数</p>
                  <p className="text-base font-bold text-gray-800">{resource.downloadCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="rounded-lg bg-pink-50 p-1.5">
                  <Heart className="h-4 w-4 text-pink-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">收藏次数</p>
                  <p className="text-base font-bold text-gray-800">{resource.favoriteCount ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="rounded-lg bg-theme-soft p-1.5">
                  <FileImage className="h-4 w-4 text-theme-primary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">文件大小</p>
                  <p className="text-base font-bold text-gray-800">{formatSize(resource.size)}</p>
                </div>
              </div>
              {resource.width && resource.height ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="rounded-lg bg-theme-soft p-1.5">
                    <MonitorSmartphone className="h-4 w-4 text-theme-primary" />
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
                <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="rounded-lg bg-emerald-50 p-1.5">
                    <FileImage className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">文件格式</p>
                    <p className="text-base font-bold uppercase text-gray-800">
                      {resource.extension}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 px-1 text-sm text-gray-400">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>上传于 {formatDate(resource.createdAt)}</span>
            </div>

            <div className="mt-auto flex gap-3 pt-2">
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="theme-btn-primary h-11 flex-1 rounded-xl font-semibold text-white shadow-md transition-all hover:shadow-lg"
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    下载中...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    下载资源
                  </>
                )}
              </Button>

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

              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                className="h-11 w-11 rounded-xl border-2 border-gray-200 transition-all hover:border-theme-shell-border hover:text-theme-primary"
                title="复制链接"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ImagePreviewDialog
        open={previewOpen}
        src={resource.url}
        title={resource.title || '资源预览'}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
