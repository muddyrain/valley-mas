import { Download, Eye, Heart, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface ResourceCardItem {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  downloadCount: number;
  size?: number;
  creatorName?: string;
  creatorAvatar?: string;
  isFavorited?: boolean;
}

interface ResourceCardProps<T extends ResourceCardItem = ResourceCardItem> {
  resource: T;
  /** 是否已收藏（外部控制，优先级高于 resource.isFavorited） */
  isFavorited?: boolean;
  /** 收藏/取消收藏回调 */
  onFavorite?: (e: React.MouseEvent, resource: T) => void;
  /** 删除回调（传入时显示删除按钮，适用于我的空间） */
  onDelete?: (resource: T) => void;
  /** 编辑回调（传入时显示编辑按钮，适用于我的空间） */
  onEdit?: (resource: T) => void;
  /** 显示创作者信息（头像 + 名称），默认 false */
  showCreator?: boolean;
  /** 显示文件大小，默认 false */
  showSize?: boolean;
  /** 卡片点击跳转，默认跳转 /resource/:id */
  onClick?: (resource: T) => void;
  /** 动画延迟（ms） */
  animationDelay?: number;
  /** 卡片底部内容区 padding，默认 p-3 */
  contentPadding?: string;
}

const TYPE_LABEL: Record<string, string> = {
  wallpaper: '🖼️ 壁纸',
  avatar: '👤 头像',
};

/** 根据资源类型返回合适的宽高比 class（骨架屏复用） */
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
  onClick,
  animationDelay,
  contentPadding = 'p-3',
}: ResourceCardProps<T>) {
  const navigate = useNavigate();
  const favored = isFavorited ?? resource.isFavorited ?? false;

  const handleClick = () => {
    if (onClick) {
      onClick(resource);
    } else {
      navigate(`/resource/${resource.id}`);
    }
  };

  return (
    <Card
      className="group overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 border-2 border-transparent hover:border-purple-200 bg-white rounded-2xl"
      onClick={handleClick}
      style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      {/* 图片区域：统一正方形，模糊背景 + object-contain 保证完整展示 */}
      <div className={`relative ${getAspectClass(resource.type)} overflow-hidden bg-black`}>
        {/* 模糊背景层（放大裁剪原图填满空白区域） */}
        <img
          src={resource.thumbnailUrl || resource.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover scale-110 blur-xl opacity-60 pointer-events-none select-none"
        />
        {/* 主图：完整显示，不裁剪 */}
        <img
          src={resource.thumbnailUrl || resource.url}
          alt={resource.title}
          className="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* 资源类型标签 */}
        <div className="absolute top-2.5 right-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-sm text-white text-xs font-medium shadow-lg">
            {TYPE_LABEL[resource.type] ?? resource.type}
          </span>
        </div>

        {/* Hover 遮罩 */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <div className="flex items-center justify-between text-xs gap-2">
              {/* 左侧：下载量 + 预览 */}
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <Eye className="w-3 h-3" />
                  预览
                </span>
                <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <Download className="w-3 h-3" />
                  {resource.downloadCount}
                </span>
              </div>

              {/* 右侧：收藏 / 删除 */}
              <div className="flex items-center gap-1.5">
                {onFavorite && (
                  <Button
                    size="xs"
                    className={`backdrop-blur-sm border-0 h-7 px-2 transition-colors ${
                      favored
                        ? 'bg-pink-500/80 hover:bg-pink-600/80 text-white'
                        : 'bg-white/20 hover:bg-white/30 text-white'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFavorite(e, resource);
                    }}
                  >
                    <Heart className={`w-3.5 h-3.5 ${favored ? 'fill-white' : ''}`} />
                  </Button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(resource);
                    }}
                    className="p-1.5 rounded-full bg-blue-500/80 hover:bg-blue-600 text-white shadow transition-all hover:scale-110"
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
                    className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-600 text-white shadow transition-all hover:scale-110"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部信息 */}
      <CardContent className={contentPadding}>
        <h3 className="font-medium text-sm text-gray-900 truncate mb-1.5 group-hover:text-purple-600 transition-colors">
          {resource.title}
        </h3>

        {/* 创作者信息行 */}
        {showCreator && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
            <Avatar className="h-4 w-4 border border-gray-200 shrink-0">
              <AvatarImage src={resource.creatorAvatar} />
              <AvatarFallback className="text-[9px] bg-purple-100 text-purple-600">
                {resource.creatorName?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{resource.creatorName || '未知创作者'}</span>
          </div>
        )}

        {/* 下载量 + 文件大小 / 类型标签 */}
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
              className="text-[10px] border-purple-200 text-purple-600 px-1.5 py-0"
            >
              {resource.type === 'wallpaper' ? '壁纸' : '头像'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** 骨架屏占位卡片 */
export function ResourceCardSkeleton({
  contentPadding = 'p-3',
  type,
}: {
  contentPadding?: string;
  type?: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
      <Skeleton className={`${getAspectClass(type ?? '')} w-full`} />
      <div className={`${contentPadding} space-y-2`}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
