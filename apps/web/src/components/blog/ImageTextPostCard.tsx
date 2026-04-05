import {
  Calendar,
  Eye,
  Heart,
  Images,
  Lock,
  type LucideIcon,
  Sparkles,
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
    return { label: '公开可见', className: 'bg-theme-primary text-white', icon: Eye };
  }
  if (visibility === 'shared') {
    return { label: '口令访问', className: 'bg-sky-500/90 text-white', icon: Users };
  }
  return { label: '仅自己可见', className: 'bg-slate-900/80 text-white', icon: Lock };
}

function getStatusMeta(status?: string) {
  if (status === 'published')
    return { label: '已发布', className: 'bg-theme-soft text-theme-primary' };
  if (status === 'archived') return { label: '已归档', className: 'bg-slate-200 text-slate-700' };
  return { label: '草稿', className: 'bg-amber-100 text-amber-700' };
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
      <div className="relative flex h-[220px] items-center justify-center overflow-hidden rounded-[28px] border border-theme-soft-strong bg-[linear-gradient(180deg,var(--theme-primary-soft)_0%,white_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <img
          src={imageUrl}
          alt="图文预览"
          className="h-full w-full rounded-[22px] object-contain"
        />
        {stickerEmoji ? (
          <div className="absolute right-4 top-4 rounded-full bg-white/88 px-3 py-1 text-xl shadow-sm backdrop-blur">
            {stickerEmoji}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative h-[220px] rounded-[28px] border border-theme-soft-strong bg-[linear-gradient(180deg,var(--theme-primary-soft)_0%,white_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="absolute left-4 top-4 text-[10px] text-slate-400">图文预览</div>
      {stickerEmoji ? <div className="absolute right-4 top-4 text-xl">{stickerEmoji}</div> : null}
      <div className="mt-7 h-[150px] overflow-hidden whitespace-pre-wrap text-[15px] font-semibold leading-7 text-[#45372c]">
        {text}
      </div>
      <div className="absolute bottom-4 right-4 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] text-white backdrop-blur">
        图文卡片
      </div>
    </div>
  );
}

interface ImageTextPostCardProps {
  post: Post;
  mode?: 'public' | 'creator';
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
  const returnLabel = mode === 'creator' ? '返回创作空间' : '返回博客列表';

  return (
    <article
      className={`group overflow-hidden rounded-[30px] border border-theme-soft-strong bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-primary-soft)_60%,white)_0%,color-mix(in_srgb,var(--theme-primary-soft)_90%,white)_100%)] shadow-[0_18px_46px_rgba(var(--theme-primary-rgb),0.12)] transition-all duration-300 hover:-translate-y-1 hover:border-theme-primary hover:shadow-[0_22px_56px_rgba(var(--theme-primary-rgb),0.18)] ${className}`}
    >
      <Link
        to={`/blog/${post.id}`}
        state={{ returnTo, returnLabel, source: mode === 'creator' ? 'my-space' : 'blog-list' }}
        className="block"
      >
        <div className="relative overflow-hidden border-b border-theme-soft-strong px-5 pb-5 pt-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--theme-primary-rgb),0.18),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(var(--theme-primary-rgb),0.1),transparent_40%)]" />
          <div className="relative mb-4 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-theme-primary backdrop-blur">
                <Images className="h-3.5 w-3.5" />
                图文创作
              </span>
              {mode === 'creator' ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${visibilityMeta.className}`}
                >
                  <visibilityMeta.icon className="h-3.5 w-3.5" />
                  {visibilityMeta.label}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {!!payload?.stickerEmoji && (
                <span className="rounded-full bg-white/80 px-3 py-1 text-lg shadow-sm backdrop-blur">
                  {payload.stickerEmoji}
                </span>
              )}
              {mode === 'creator' ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className="relative grid gap-4 lg:grid-cols-[1.08fr_0.82fr]">
            <div className="flex min-h-[220px] flex-col rounded-[26px] border border-white/75 bg-white/78 p-5 backdrop-blur">
              <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-theme-soft px-2.5 py-1 text-[11px] font-medium text-theme-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {pages.length || 1} 页图文
              </div>
              <h3 className="line-clamp-2 text-[24px] font-semibold leading-9 text-slate-900 transition-colors group-hover:text-theme-primary">
                {post.title}
              </h3>
              <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {previewText}
              </p>
            </div>

            <div className="rounded-[26px] border border-white/80 bg-white/76 p-3 backdrop-blur">
              <PreviewSheet
                imageUrl={previewImage}
                text={pages[0] || previewText}
                stickerEmoji={payload?.stickerEmoji}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <div className="inline-flex min-w-0 items-center gap-1.5">
              {post.author?.avatar ? (
                <img
                  src={post.author.avatar}
                  alt={post.author.nickname || 'author'}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
                  <User className="h-3 w-3 text-slate-500" />
                </span>
              )}
              <span className="truncate">
                {mode === 'creator'
                  ? post.group?.name || '未分组'
                  : post.author?.nickname || '创作者'}
              </span>
            </div>

            <span className="rounded-full bg-theme-soft px-2.5 py-1 text-theme-primary">
              {mode === 'creator' ? '图文卡片' : post.group?.name || '灵感图文'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <div className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.publishedAt || post.createdAt)}
            </div>

            <div className="flex items-center gap-3 text-slate-400">
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

      {footer ? <div className="border-t border-theme-soft-strong p-4 pt-3">{footer}</div> : null}
    </article>
  );
}
