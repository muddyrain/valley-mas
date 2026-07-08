import {
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
import { Badge } from '@/components/ui/badge';
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
  const visibleTags = tags.slice(0, 3);
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
        <span className="inline-flex items-center rounded-full border border-background/60 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur-sm">
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

  const footerMetaVisible =
    showSize || showDate || showEngagement || showUser || showVisibilityTag || selectable;

  const infoLayerVisible = showUser || showDate || showEngagement || showTags || showVisibilityTag;

  const mediaAspectClass =
    wideWallpaperOnDesktop && resource.type === 'wallpaper'
      ? 'aspect-[16/10] md:aspect-[16/9]'
      : getAspectClass(resource.type, wideWallpaperOnDesktop);

  return (
    <Card
      className={`group h-64 py-0 cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        selected
          ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.16)]'
          : 'border-border hover:border-accent/80'
      }`}
      onClick={handleCardClick}
      style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <div
        className={`relative h-full ${mediaAspectClass} overflow-hidden bg-muted`}
        onClick={(e) => {
          if (selectable) return;
          if (!enablePreview) return;
          e.stopPropagation();
          setPreviewOpen(true);
        }}
      >
        <MediaLoadingOverlay show={!imageReady} />
        <img
          src={imageSrc}
          alt={resource.title}
          className={`relative h-full w-full object-cover transition-[transform,opacity] duration-500 ${imageReady ? 'opacity-100' : 'opacity-0'} group-hover:scale-[1.03]`}
          onLoad={() => setLoadedSrc(imageSrc)}
          onError={() => setLoadedSrc(imageSrc)}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

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
                  : 'bg-background/80 text-foreground backdrop-blur-sm hover:bg-background'
              }`}
            >
              {selected ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
            </button>
          ) : (
            <span className="inline-flex items-center rounded-full border border-background/60 bg-background/85 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-sm">
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
                  : 'bg-background/70 text-foreground hover:bg-background'
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
              className="rounded-full bg-background/70 backdrop-blur-sm hover:bg-background"
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
              variant="destructive"
              className="rounded-full bg-background/70 hover:bg-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(resource);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="absolute inset-x-3 bottom-3">
          <div
            className={`overflow-hidden rounded-xl border border-background/40 bg-background/85 backdrop-blur-md transition-all duration-300 shadow-lg ${
              infoLayerVisible ? 'translate-y-0 group-hover:translate-y-0' : 'translate-y-0'
            }`}
          >
            <div className="px-4 py-3">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3
                    ref={titleRef}
                    title={titleOverflow ? resource.title : undefined}
                    onMouseEnter={refreshTitleOverflow}
                    className="truncate text-sm font-semibold text-foreground"
                  >
                    {resource.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground sm:hidden">
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
                <Button
                  size="sm"
                  variant="default"
                  className="hidden rounded-full bg-primary/90 px-3 py-1 text-xs font-medium shadow-sm transition-all hover:bg-primary hover:scale-105 sm:inline-flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!enablePreview) return;
                    setPreviewOpen(true);
                  }}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  预览
                </Button>
              </div>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  infoLayerVisible
                    ? 'max-h-0 opacity-0 sm:mt-0 sm:max-h-0 sm:translate-y-2 sm:group-hover:mt-3 sm:group-hover:max-h-44 sm:group-hover:translate-y-0 sm:group-hover:opacity-100'
                    : 'max-h-0 opacity-0'
                }`}
              >
                {showUser ? (
                  <div className="flex items-center gap-2 text-xs text-foreground">
                    <Avatar className="h-5 w-5 shrink-0 border border-border">
                      <AvatarImage src={resource.userAvatar} />
                      <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                        {resource.userName?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium">{resource.userName || '未知用户'}</span>
                  </div>
                ) : null}

                {(showDate && resource.createdAt) ||
                (showEngagement && (resource.viewCount || resource.likeCount)) ||
                showSize ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

          {footerMetaVisible ? (
            <div className="mt-2 hidden items-center justify-between px-1 text-xs text-muted-foreground sm:flex">
              <div className="flex min-w-0 items-center gap-3">
                {showUser ? (
                  <span className="truncate font-medium">{resource.userName || '未知用户'}</span>
                ) : null}
                {!showUser ? (
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3.5 w-3.5" />
                    {resource.downloadCount}
                  </span>
                ) : null}
              </div>
              {showSize && resource.size ? (
                <span>{formatSize(resource.size)}</span>
              ) : (
                <Badge
                  variant="outline"
                  className="border-border bg-card/50 px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {resource.type === 'wallpaper' ? '壁纸' : '头像'}
                </Badge>
              )}
            </div>
          ) : null}
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
    <div className="h-64 overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <Skeleton className={`${mediaAspectClass} h-full w-full`} />
      <div className="-mt-16 px-4">
        <div className="rounded-xl border border-border bg-card/80 p-4 backdrop-blur-md">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}
