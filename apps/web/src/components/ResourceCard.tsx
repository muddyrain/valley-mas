import {
  Calendar,
  Check,
  Download,
  Eye,
  Globe,
  Hash,
  Heart,
  Link,
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
          className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--color-foreground)/0.18)] bg-[hsl(var(--color-foreground)/0.14)] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--color-foreground)/0.92)] backdrop-blur-md"
        >
          <Hash className="h-3 w-3 opacity-80" />
          {tag}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="inline-flex items-center rounded-full border border-[hsl(var(--color-foreground)/0.14)] bg-[hsl(var(--color-background)/0.18)] px-2.5 py-1 text-[11px] text-[hsl(var(--color-foreground)/0.78)] backdrop-blur-md">
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
  contentPadding = 'px-4 py-3',
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
      className={`group h-60 py-0 cursor-pointer overflow-hidden rounded-[26px] border bg-card/84 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg ${
        selected
          ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.16)]'
          : 'border-border hover:border-accent'
      }`}
      onClick={handleCardClick}
      style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <div
        className={`relative h-full ${mediaAspectClass} overflow-hidden bg-[hsl(var(--color-card))]`}
        onClick={(e) => {
          if (selectable) return;
          if (!enablePreview) return;
          e.stopPropagation();
          setPreviewOpen(true);
        }}
      >
        <img
          src={imageSrc}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover scale-110 blur-2xl opacity-45"
        />
        <MediaLoadingOverlay show={!imageReady} />
        <img
          src={imageSrc}
          alt={resource.title}
          className={`relative h-full w-full object-cover transition-[transform,opacity] duration-500 ${imageReady ? 'opacity-100' : 'opacity-0'} group-hover:scale-[1.035]`}
          onLoad={() => setLoadedSrc(imageSrc)}
          onError={() => setLoadedSrc(imageSrc)}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-linear-to-t from-[hsl(var(--color-background)/0.72)] via-[hsl(var(--color-background)/0.14)] to-[hsl(var(--color-background)/0.8)] opacity-88 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute left-3 top-3 flex items-start gap-2">
          {selectable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(resource, !selected);
              }}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-all ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-[hsl(var(--color-foreground)/0.72)] bg-[hsl(var(--color-background)/0.28)] text-[hsl(var(--color-foreground)/0.9)] backdrop-blur-md hover:border-[hsl(var(--color-foreground))]'
              }`}
            >
              {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
            </button>
          ) : (
            <span className="inline-flex items-center rounded-full border border-[hsl(var(--color-foreground)/0.14)] bg-[hsl(var(--color-background)/0.26)] px-3 py-1 text-[11px] font-medium text-[hsl(var(--color-foreground)/0.92)] backdrop-blur-md">
              {TYPE_LABEL[resource.type] ?? resource.type}
            </span>
          )}

          {showVisibilityTag && visibilityMeta ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium shadow-sm backdrop-blur-md ${visibilityMeta.className}`}
            >
              <visibilityMeta.icon className="h-3 w-3" />
              {visibilityMeta.label}
            </span>
          ) : null}
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          {onFavorite ? (
            <Button
              size="xs"
              className={`h-8 rounded-full border px-2.5 backdrop-blur-md transition-all ${
                favored
                  ? 'border-destructive/30 bg-destructive/82 text-destructive-foreground hover:bg-destructive'
                  : 'border-foreground/18 bg-foreground/24 text-foreground hover:bg-foreground/34'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(e, resource);
              }}
            >
              <Heart className={`h-3.5 w-3.5 ${favored ? 'fill-destructive-foreground' : ''}`} />
            </Button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(resource);
              }}
              className="rounded-full border border-foreground/10 bg-foreground/16 p-2 text-foreground shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-foreground/24"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(resource);
              }}
              className="rounded-full border border-[hsl(var(--color-foreground)/0.18)] bg-[hsl(var(--color-background)/0.32)] p-2 text-[hsl(var(--color-foreground))] shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-destructive/82"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-2 px-3">
          <div
            className={`overflow-hidden rounded-[22px] border border-[hsl(var(--color-foreground)/0.12)] bg-linear-to-b from-[hsl(var(--color-background)/0.6)] to-[hsl(var(--color-background)/0.12)] backdrop-blur-xs transition-all duration-300 ${
              infoLayerVisible ? 'translate-y-0 group-hover:translate-y-0' : 'translate-y-0'
            }`}
          >
            <div className={contentPadding}>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3
                    ref={titleRef}
                    title={titleOverflow ? resource.title : undefined}
                    onMouseEnter={refreshTitleOverflow}
                    className="truncate text-sm font-semibold text-foreground sm:text-[15px]"
                  >
                    {resource.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground sm:hidden">
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {resource.downloadCount}
                    </span>
                    {showDate && resource.createdAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(resource.createdAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="hidden rounded-full border border-[hsl(var(--color-foreground)/0.12)] bg-[hsl(var(--color-foreground)/0.1)] px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur-sm sm:inline-flex hover:bg-primary duration-300">
                  <Eye className="mr-1 h-3 w-3" />
                  预览
                </span>
                <button
                  type="button"
                  className="hidden rounded-full border border-[hsl(var(--color-foreground)/0.12)] bg-[hsl(var(--color-foreground)/0.1)] px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur-sm sm:inline-flex hover:bg-primary duration-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/resource/${resource.id}`);
                  }}
                >
                  <Link className="mr-1 h-3 w-3" />
                  详情
                </button>
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
                    <Avatar className="h-5 w-5 shrink-0 border border-[hsl(var(--color-foreground)/0.14)]">
                      <AvatarImage src={resource.userAvatar} />
                      <AvatarFallback className="bg-[hsl(var(--color-foreground)/0.16)] text-[10px] text-foreground">
                        {resource.userName?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{resource.userName || '未知用户'}</span>
                  </div>
                ) : null}

                {(showDate && resource.createdAt) ||
                (showEngagement && (resource.viewCount || resource.likeCount)) ||
                showSize ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {showDate && resource.createdAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(resource.createdAt)}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {resource.downloadCount}
                    </span>
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
            <div className="mt-2 hidden items-center justify-between px-1 text-[11px] text-muted-foreground sm:flex">
              <div className="flex min-w-0 items-center gap-3">
                {showUser ? (
                  <span className="truncate">{resource.userName || '未知用户'}</span>
                ) : null}
                {!showUser ? (
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {resource.downloadCount}
                  </span>
                ) : null}
              </div>
              {showSize && resource.size ? (
                <span>{formatSize(resource.size)}</span>
              ) : (
                <Badge
                  variant="outline"
                  className="border-[hsl(var(--color-foreground)/0.14)] bg-[hsl(var(--color-foreground)/0.1)] px-2 py-0 text-[10px] text-muted-foreground backdrop-blur-sm"
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
  contentPadding = 'px-4 py-3',
  type,
  wideWallpaperOnDesktop = false,
}: {
  contentPadding?: string;
  type?: string;
  wideWallpaperOnDesktop?: boolean;
}) {
  const mediaAspectClass =
    wideWallpaperOnDesktop && type === 'wallpaper'
      ? 'aspect-[16/10] md:aspect-[16/9]'
      : getAspectClass(type ?? '', wideWallpaperOnDesktop);

  return (
    <div className="h-80 overflow-hidden rounded-[26px] border border-border bg-card/86 shadow-md">
      <Skeleton className={`${mediaAspectClass} h-full w-full`} />
      <div
        className={`-mt-20 px-4 ${contentPadding.includes('px-') || contentPadding.includes('py-') ? contentPadding : ''}`}
      >
        <div className="rounded-[20px] border border-[hsl(var(--color-foreground)/0.4)] bg-card/55 p-4 backdrop-blur-md">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}
