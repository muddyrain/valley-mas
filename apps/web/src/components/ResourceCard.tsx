import { Calendar, Download, Eye, Globe, Heart, Lock, Pencil, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ImagePreviewDialog from '@/components/ImagePreviewDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/utils/blog';

export interface ResourceCardItem {
  id: string;
  title: string;
  url: string;
  type: string;
  visibility?: 'private' | 'shared' | 'public';
  downloadCount: number;
  viewCount?: number;
  likeCount?: number;
  favoriteCount?: number;
  createdAt?: string;
  size?: number;
  creatorName?: string;
  creatorAvatar?: string;
  isFavorited?: boolean;
}

interface ResourceCardProps<T extends ResourceCardItem = ResourceCardItem> {
  resource: T;
  isFavorited?: boolean;
  onFavorite?: (e: React.MouseEvent, resource: T) => void;
  onDelete?: (resource: T) => void;
  onEdit?: (resource: T) => void;
  showCreator?: boolean;
  showSize?: boolean;
  showDate?: boolean;
  showEngagement?: boolean;
  showVisibilityTag?: boolean;
  onClick?: (resource: T) => void;
  animationDelay?: number;
  contentPadding?: string;
  enablePreview?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  wallpaper: '壁纸',
  avatar: '头像',
};

const VISIBILITY_META = {
  public: {
    label: '公开可访问',
    className: 'bg-emerald-500/85 text-white',
    icon: Globe,
  },
  shared: {
    label: '口令访问',
    className: 'bg-sky-500/85 text-white',
    icon: Users,
  },
  private: {
    label: '仅自己可见',
    className: 'bg-slate-900/75 text-white',
    icon: Lock,
  },
} as const;

export function getAspectClass(_type: string) {
  return 'aspect-square';
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ResourceCard<T extends ResourceCardItem = ResourceCardItem>({
  resource,
  isFavorited,
  onFavorite,
  onDelete,
  onEdit,
  showCreator = false,
  showSize = false,
  showDate = false,
  showEngagement = false,
  showVisibilityTag = false,
  onClick,
  animationDelay,
  contentPadding = 'p-3',
  enablePreview = true,
}: ResourceCardProps<T>) {
  const navigate = useNavigate();
  const location = useLocation();
  const favored = isFavorited ?? resource.isFavorited ?? false;
  const [previewOpen, setPreviewOpen] = useState(false);
  const visibilityMeta = resource.visibility ? VISIBILITY_META[resource.visibility] : null;

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(resource);
    } else {
      navigate(`/resource/${resource.id}`, {
        state: {
          returnTo: `${location.pathname}${location.search}`,
          returnLabel: location.pathname.startsWith('/my-space') ? '返回创作空间' : '返回资源列表',
          source: location.pathname.startsWith('/my-space') ? 'my-space' : 'resources',
        },
      });
    }
  };

  return (
    <Card
      className="group overflow-hidden rounded-2xl border-2 border-transparent bg-white cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:border-purple-200 hover:shadow-2xl"
      onClick={handleCardClick}
      style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <div
        className={`relative ${getAspectClass(resource.type)} overflow-hidden bg-black`}
        onClick={(e) => {
          if (!enablePreview) return;
          e.stopPropagation();
          setPreviewOpen(true);
        }}
      >
        <img
          src={resource.url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover scale-110 blur-xl opacity-60"
        />
        <img
          src={resource.url}
          alt={resource.title}
          className="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-start justify-between gap-2">
          <span className="rounded-lg bg-black/65 px-2.5 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
            {TYPE_LABEL[resource.type] ?? resource.type}
          </span>
          {showVisibilityTag && visibilityMeta ? (
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium shadow-lg backdrop-blur-sm ${visibilityMeta.className}`}
            >
              <visibilityMeta.icon className="h-3 w-3" />
              {visibilityMeta.label}
            </span>
          ) : null}
        </div>

        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="absolute bottom-0 left-0 right-0 translate-y-2 p-3 text-white transition-transform duration-300 group-hover:translate-y-0">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 backdrop-blur-sm">
                  <Eye className="h-3 w-3" />
                  预览
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 backdrop-blur-sm">
                  <Download className="h-3 w-3" />
                  {resource.downloadCount}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {onFavorite && (
                  <Button
                    size="xs"
                    className={`h-7 border-0 px-2 backdrop-blur-sm transition-colors ${
                      favored
                        ? 'bg-pink-500/80 text-white hover:bg-pink-600/80'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFavorite(e, resource);
                    }}
                  >
                    <Heart className={`h-3.5 w-3.5 ${favored ? 'fill-white' : ''}`} />
                  </Button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(resource);
                    }}
                    className="rounded-full bg-blue-500/80 p-1.5 text-white shadow transition-all hover:scale-110 hover:bg-blue-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(resource);
                    }}
                    className="rounded-full bg-red-500/80 p-1.5 text-white shadow transition-all hover:scale-110 hover:bg-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CardContent className={contentPadding}>
        <h3 className="mb-1.5 truncate text-sm font-medium text-gray-900 transition-colors group-hover:text-purple-600">
          {resource.title}
        </h3>

        {showCreator && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-500">
            <Avatar className="h-4 w-4 shrink-0 border border-gray-200">
              <AvatarImage src={resource.creatorAvatar} />
              <AvatarFallback className="bg-purple-100 text-[9px] text-purple-600">
                {resource.creatorName?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{resource.creatorName || '未知创作者'}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3 text-purple-400" />
            {resource.downloadCount}
          </span>
          {showSize && resource.size ? (
            <span>{formatSize(resource.size)}</span>
          ) : (
            <Badge
              variant="outline"
              className="px-1.5 py-0 text-[10px] text-purple-600 border-purple-200"
            >
              {resource.type === 'wallpaper' ? '壁纸' : '头像'}
            </Badge>
          )}
        </div>

        {(showDate && resource.createdAt) ||
        (showEngagement && (resource.viewCount || resource.likeCount)) ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
            {showDate && resource.createdAt ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(resource.createdAt)}
              </span>
            ) : null}
            {showEngagement && typeof resource.viewCount === 'number' ? (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {resource.viewCount}
              </span>
            ) : null}
            {showEngagement && typeof resource.likeCount === 'number' ? (
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {resource.likeCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <ImagePreviewDialog
        open={previewOpen}
        src={resource.url}
        title={resource.title || '资源预览'}
        onOpenChange={setPreviewOpen}
      />
    </Card>
  );
}

export function ResourceCardSkeleton({
  contentPadding = 'p-3',
  type,
}: {
  contentPadding?: string;
  type?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <Skeleton className={`${getAspectClass(type ?? '')} w-full`} />
      <div className={`${contentPadding} space-y-2`}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
