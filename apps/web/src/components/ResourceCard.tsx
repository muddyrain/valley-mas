import {
  ArrowUpRight,
  Calendar,
  Check,
  Download,
  Eye,
  Globe,
  Hash,
  Heart,
  Lock,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ImagePreviewDialog from '@/components/ImagePreviewDialog';
import MediaLoadingOverlay from '@/components/MediaLoadingOverlay';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/utils/blog';

export interface ResourceCardItem {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  visibility?: 'private' | 'shared' | 'public';
  downloadCount: number;
  viewCount?: number;
  likeCount?: number;
  favoriteCount?: number;
  createdAt?: string;
  size?: number;
  userName?: string;
  userAvatar?: string;
  isFavorited?: boolean;
  tags?: string[];
}

interface ResourceCardProps<T extends ResourceCardItem = ResourceCardItem> {
  resource: T;
  isFavorited?: boolean;
  onFavorite?: (e: React.MouseEvent, resource: T) => void;
  onDelete?: (resource: T) => void;
  onEdit?: (resource: T) => void;
  showUser?: boolean;
  showSize?: boolean;
  showDate?: boolean;
  showEngagement?: boolean;
  showVisibilityTag?: boolean;
  showTags?: boolean;
  onClick?: (resource: T) => void;
  animationDelay?: number;
  contentPadding?: string;
  enablePreview?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (resource: T, selected: boolean) => void;
  wideWallpaperOnDesktop?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  wallpaper: '壁纸',
  avatar: '头像',
};

const VISIBILITY_META = {
  public: {
    label: '公开可访问',
    className: 'bg-primary text-primary-foreground',
    icon: Globe,
  },
  shared: {
    label: '口令访问',
    className: 'bg-accent text-primary',
    icon: Users,
  },
  private: {
    label: '仅自己可见',
    className: 'bg-muted text-muted-foreground',
    icon: Lock,
  },
} as const;

export function getAspectClass(_type: string, _wideWallpaperOnDesktop = false) {
  return 'aspect-[4/3]';
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ResourceTagCloud({ tags }: { tags: string[] }) {
  const visibleTags = tags.slice(0, 5);
  const hiddenCount = Math.max(tags.length - visibleTags.length, 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-background/60 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm"
        >
          <Hash className="h-3 w-3" />
          {tag}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span
          title={`${hiddenCount} more tags`}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-background/60 bg-background/80 px-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm"
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

export default function ResourceCard<T extends ResourceCardItem = ResourceCardItem>({
  resource,
  isFavorited,
  onFavorite,
  onDelete,
  onEdit,
  showUser = false,
  showSize = false,
  showDate = false,
  showEngagement = false,
  showVisibilityTag = false,
  showTags = false,
  onClick,
  animationDelay,
  enablePreview = true,
  selectable = false,
  selected = false,
  onSelect,
  wideWallpaperOnDesktop = false,
}: ResourceCardProps<T>) {
  const navigate = useNavigate();
  const location = useLocation();
  const favored = isFavorited ?? resource.isFavorited ?? false;
  const [previewOpen, setPreviewOpen] = useState(false);
  const imageSrc = resource.thumbnailUrl ?? resource.url;
  const [loadedSrc, setLoadedSrc] = useState('');
  const imageReady = loadedSrc === imageSrc;
  const visibilityMeta = resource.visibility ? VISIBILITY_META[resource.visibility] : null;
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [titleOverflow, setTitleOverflow] = useState(false);

  const refreshTitleOverflow = useCallback(() => {
    const titleNode = titleRef.current;
    if (!titleNode) {
      setTitleOverflow(false);
      return;
    }
    setTitleOverflow(titleNode.scrollWidth > titleNode.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    const titleNode = titleRef.current;
    if (!titleNode) {
      setTitleOverflow(false);
      return;
    }

    refreshTitleOverflow();

    const observer = new ResizeObserver(refreshTitleOverflow);
    observer.observe(titleNode);
    return () => observer.disconnect();
  }, [refreshTitleOverflow]);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectable) {
      onSelect?.(resource, !selected);
      return;
    }
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

  const infoLayerVisible = showUser || showDate || showEngagement || showTags || showVisibilityTag;

  const mediaAspectClass =
    wideWallpaperOnDesktop && resource.type === 'wallpaper'
      ? 'aspect-[16/10] md:aspect-[16/9]'
      : getAspectClass(resource.type, wideWallpaperOnDesktop);

  return (
    <Card
      className={`group h-44 py-0 cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:h-64 ${
        selected
          ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.16)]'
          : 'border-border hover:border-accent/80'
      }`}
      onClick={handleCardClick}
      style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <div className={`relative h-full ${mediaAspectClass} overflow-hidden bg-muted`}>
        <MediaLoadingOverlay show={!imageReady} />
        <img
          src={imageSrc}
          alt={resource.title}
          className={`relative h-full w-full object-cover transition-[transform,opacity] duration-500 ${imageReady ? 'opacity-100' : 'opacity-0'} group-hover:scale-[1.03]`}
          onLoad={() => setLoadedSrc(imageSrc)}
          onError={() => setLoadedSrc(imageSrc)}
          loading="lazy"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-300 group-hover:from-black/95" />

        <div className="absolute left-3 top-3 flex items-start gap-2">
          {selectable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(resource, !selected);
              }}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-background/60 shadow-md transition-all ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-white/20 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55'
              }`}
            >
              {selected ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
            </button>
          ) : (
            <span className="inline-flex items-center rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white shadow-md backdrop-blur-sm">
              {TYPE_LABEL[resource.type] ?? resource.type}
            </span>
          )}

          {showVisibilityTag && visibilityMeta ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-sm ${visibilityMeta.className}`}
            >
              <visibilityMeta.icon className="h-3.5 w-3.5" />
              {visibilityMeta.label}
            </span>
          ) : null}
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {onFavorite ? (
            <Button
              size="icon-sm"
              variant={favored ? 'default' : 'secondary'}
              className={`rounded-full backdrop-blur-sm transition-all ${
                favored
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'border border-white/20 bg-black/35 text-white hover:bg-black/55 hover:text-white'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(e, resource);
              }}
            >
              <Heart className={`h-4 w-4 ${favored ? 'fill-destructive-foreground' : ''}`} />
            </Button>
          ) : null}
          {onEdit ? (
            <Button
              size="icon-sm"
              variant="secondary"
              className="rounded-full border border-white/20 bg-black/35 text-white shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:bg-black/55 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(resource);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              size="icon-sm"
              variant="ghost"
              className="rounded-full border border-destructive/45 bg-black/35 text-destructive shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(resource);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end px-4 pb-4 pt-16">
          <div
            className={`w-full overflow-hidden transition-all duration-300 ${
              infoLayerVisible ? 'translate-y-0 group-hover:translate-y-0' : 'translate-y-0'
            }`}
          >
            <div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3
                    ref={titleRef}
                    title={titleOverflow ? resource.title : undefined}
                    onMouseEnter={refreshTitleOverflow}
                    className="truncate text-sm font-semibold text-white drop-shadow-sm"
                  >
                    {resource.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-white/75 sm:hidden">
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      {resource.downloadCount}
                    </span>
                    {showDate && resource.createdAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(resource.createdAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="pointer-events-auto hidden shrink-0 items-center gap-1.5 sm:flex">
                  {!selectable ? (
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      className="rounded-full border border-white/20 bg-black/35 text-white shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:bg-black/55 hover:text-white"
                      onClick={handleCardClick}
                      title="查看详情"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span className="sr-only">详情</span>
                    </Button>
                  ) : null}
                  {enablePreview ? (
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      className="rounded-full border border-white/20 bg-black/35 text-white shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:bg-black/55 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewOpen(true);
                      }}
                      title="预览"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="sr-only">预览</span>
                    </Button>
                  ) : null}
                </div>
              </div>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  infoLayerVisible
                    ? 'max-h-0 opacity-0 sm:mt-0 sm:max-h-0 sm:translate-y-2 sm:group-hover:mt-3 sm:group-hover:max-h-44 sm:group-hover:translate-y-0 sm:group-hover:opacity-100'
                    : 'max-h-0 opacity-0'
                }`}
              >
                {showUser ? (
                  <div className="flex items-center gap-2 text-xs text-white">
                    <Avatar className="h-5 w-5 shrink-0 border border-white/25">
                      <AvatarImage src={resource.userAvatar} />
                      <AvatarFallback className="bg-white/15 text-[10px] text-white/80">
                        {resource.userName?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium">{resource.userName || '未知用户'}</span>
                  </div>
                ) : null}

                {(showDate && resource.createdAt) ||
                (showEngagement && (resource.viewCount || resource.likeCount)) ||
                showSize ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
                    {showDate && resource.createdAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(resource.createdAt)}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      {resource.downloadCount}
                    </span>
                    {showEngagement && typeof resource.viewCount === 'number' ? (
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {resource.viewCount}
                      </span>
                    ) : null}
                    {showEngagement && typeof resource.likeCount === 'number' ? (
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" />
                        {resource.likeCount}
                      </span>
                    ) : null}
                    {showSize && resource.size ? <span>{formatSize(resource.size)}</span> : null}
                  </div>
                ) : null}

                {showTags && resource.tags && resource.tags.length > 0 ? (
                  <div className="mt-3">
                    <ResourceTagCloud tags={resource.tags} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImagePreviewDialog
        open={previewOpen}
        src={resource.url}
        resourceId={resource.id}
        title={resource.title || '资源预览'}
        onOpenChange={setPreviewOpen}
      />
    </Card>
  );
}

export function ResourceCardSkeleton({
  type,
  wideWallpaperOnDesktop = false,
}: {
  type?: string;
  wideWallpaperOnDesktop?: boolean;
}) {
  const mediaAspectClass =
    wideWallpaperOnDesktop && type === 'wallpaper'
      ? 'aspect-[16/10] md:aspect-[16/9]'
      : getAspectClass(type ?? '', wideWallpaperOnDesktop);

  return (
    <div className="h-44 overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:h-64">
      <Skeleton className={`${mediaAspectClass} h-full w-full`} />
    </div>
  );
}
