import {
  Calendar,
  Eye,
  Heart,
  Images,
  Lock,
  type LucideIcon,
  Sparkles,
  Tag,
  User,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Post } from '@/api/blog';
import { formatDate } from '@/utils/blog';

type ImageTextPayload = {
  stickerEmoji?: string;
  partner?: string;
  pages?: Array<string | { text?: string; imageUrl?: string }>;
  images?: string[];
};

function parsePayload(post: Post): ImageTextPayload | null {
  const raw = post.imageTextData || post.templateData;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImageTextPayload;
  } catch {
    return null;
  }
}

function getVisibilityMeta(visibility?: Post['visibility']): {
  label: string;
  className: string;
  icon: LucideIcon;
} {
  if (visibility === 'public') {
    return { label: '公开可见', className: 'bg-primary text-primary-foreground', icon: Eye };
  }
  if (visibility === 'shared') {
    return { label: '口令访问', className: 'bg-primary/90 text-primary-foreground', icon: Users };
  }
  return { label: '仅自己可见', className: 'bg-foreground/80 text-primary-foreground', icon: Lock };
}

function getStatusMeta(status?: string) {
  if (status === 'published') return { label: '已发布', className: 'bg-accent text-primary' };
  if (status === 'archived')
    return { label: '已归档', className: 'bg-muted text-muted-foreground' };
  return { label: '草稿', className: 'bg-primary text-primary-foreground' };
}

function getPageText(payload: ImageTextPayload | null) {
  return (
    payload?.pages
      ?.map((item) => (typeof item === 'string' ? item : item?.text || ''))
      .filter(Boolean) || []
  );
}

function getPreviewImage(payload: ImageTextPayload | null, post: Post) {
  const firstPageImage = payload?.pages?.find(
    (item): item is { text?: string; imageUrl?: string } =>
      typeof item !== 'string' && !!item?.imageUrl,
  )?.imageUrl;
  return firstPageImage || payload?.images?.[0] || post.cover || '';
}

function PreviewSheet({
  imageUrl,
  text,
  stickerEmoji,
}: {
  imageUrl?: string;
  text: string;
  stickerEmoji?: string;
}) {
  if (imageUrl) {
    return (
      <div className="relative flex h-[220px] items-center justify-center overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(180deg,hsl(var(--primary) / 0.15)_0%,hsl(var(--background))_100%)] p-3 shadow-[inset_0_1px_0_hsl(var(--background)_/_0.8)]">
        <img
          src={imageUrl}
          alt="图文预览"
          className="h-full w-full rounded-[22px] object-contain"
        />
        {stickerEmoji ? (
          <div className="absolute right-4 top-4 rounded-full bg-card/88 px-3 py-1 text-xl shadow-sm backdrop-blur">
            {stickerEmoji}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative h-[220px] rounded-[28px] border border-border bg-[linear-gradient(180deg,hsl(var(--primary) / 0.15)_0%,hsl(var(--background))_100%)] p-4 shadow-[inset_0_1px_0_hsl(var(--background)/0.8)]">
      <div className="absolute left-4 top-4 text-[10px] text-muted-foreground">图文预览</div>
      {stickerEmoji ? <div className="absolute right-4 top-4 text-xl">{stickerEmoji}</div> : null}
      <div className="mt-7 h-[150px] overflow-hidden whitespace-pre-wrap text-[15px] font-semibold leading-7 text-foreground">
        {text}
      </div>
      <div className="absolute bottom-4 right-4 rounded-full bg-foreground/70 px-3 py-1 text-[11px] text-primary-foreground backdrop-blur">
        图文卡片
      </div>
    </div>
  );
}

interface ImageTextPostCardProps {
  post: Post;
  mode?: 'public' | 'admin';
  footer?: ReactNode;
  className?: string;
}

export function ImageTextPostCard({
  post,
  mode = 'public',
  footer,
  className = '',
}: ImageTextPostCardProps) {
  const location = useLocation();
  const payload = parsePayload(post);
  const pages = getPageText(payload);
  const previewImage = getPreviewImage(payload, post);
  const previewText =
    post.excerpt?.trim() || pages[0] || '这篇图文还没有生成摘要，点击查看完整内容。';
  const visibilityMeta = getVisibilityMeta(post.visibility);
  const statusMeta = getStatusMeta(post.status);
  const returnTo = `${location.pathname}${location.search}`;
  const returnLabel = mode === 'admin' ? '返回创作空间' : '返回博客列表';
  const authorName = post.author?.nickname || '用户';
  const groupName = post.group?.name || (mode === 'admin' ? '未分组' : '灵感图文');

  return (
    <article
      className={`group overflow-hidden rounded-[30px] border border-border bg-[linear-gradient(180deg,color-mix(in_srgb,hsl(var(--primary) / 0.15)_60%,hsl(var(--background)))_0%,color-mix(in_srgb,hsl(var(--primary) / 0.15)_90%,hsl(var(--background)))_100%)] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-xl ${className}`}
    >
      <Link
        to={`/blog/${post.id}`}
        state={{ returnTo, returnLabel, source: mode === 'admin' ? 'my-space' : 'blog-list' }}
        className="block"
      >
        <div className="relative overflow-hidden border-b border-border px-5 pb-5 pt-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary) / 0.18),transparent_42%),radial-gradient(circle_at_bottom_left,hsl(var(--primary) / 0.1),transparent_40%)]" />
          <div className="relative mb-4 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-3 py-1.5 text-xs font-semibold text-primary shadow-md backdrop-blur-sm">
                <Images className="h-4 w-4" />
                图文创作
              </span>
              {mode === 'public' && post.category?.name ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-md">
                  <Tag className="h-4 w-4" />
                  {post.category.name}
                </span>
              ) : null}
              {mode === 'admin' ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm ${visibilityMeta.className}`}
                >
                  <visibilityMeta.icon className="h-4 w-4" />
                  {visibilityMeta.label}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {!!payload?.stickerEmoji && (
                <span className="rounded-full bg-card/90 px-3 py-1 text-lg shadow-md backdrop-blur-sm">
                  {payload.stickerEmoji}
                </span>
              )}
              {mode === 'admin' ? (
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className="relative grid gap-4 lg:grid-cols-[1.08fr_0.82fr]">
            <div className="flex min-h-[220px] flex-col rounded-[26px] border border-border bg-card/78 p-5 backdrop-blur">
              <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {pages.length || 1} 页图文
              </div>
              <h3 className="line-clamp-2 text-[24px] font-semibold leading-9 text-foreground transition-colors group-hover:text-primary">
                {post.title}
              </h3>
              <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {previewText}
              </p>
            </div>

            <div className="rounded-[26px] border border-border bg-card/76 p-3 backdrop-blur">
              <PreviewSheet
                imageUrl={previewImage}
                text={pages[0] || previewText}
                stickerEmoji={payload?.stickerEmoji}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="inline-flex min-w-0 flex-1 items-center gap-1.5">
              {post.author?.avatar ? (
                <img
                  src={post.author.avatar}
                  alt={post.author.nickname || 'author'}
                  className="h-5 w-5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-3 w-3 text-muted-foreground" />
                </span>
              )}
              <span className="truncate font-medium text-muted-foreground">{authorName}</span>
            </div>

            <span className="inline-flex max-w-[46%] shrink-0 items-center rounded-full bg-accent px-2.5 py-1 text-primary">
              <span className="truncate">{groupName}</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.publishedAt || post.createdAt)}
            </div>

            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {post.viewCount || 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                {post.likeCount || 0}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {footer ? <div className="border-t border-border p-4 pt-3">{footer}</div> : null}
    </article>
  );
}
