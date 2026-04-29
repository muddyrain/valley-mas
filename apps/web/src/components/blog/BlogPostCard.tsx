import {
  Calendar,
  Eye,
  FileText,
  FolderTree,
  Heart,
  Image as ImageIcon,
  Lock,
  type LucideIcon,
  User,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Post } from '@/api/blog';
import { createPlainTextExcerpt, formatDate } from '@/utils/blog';
import { BlogCoverMedia } from './BlogCoverMedia';

type ImageTextPayload = {
  pages?: Array<string | { text?: string }>;
};

function getPostPreviewText(post: Post) {
  if (post.excerpt?.trim()) return createPlainTextExcerpt(post.excerpt.trim(), 110);
  if (post.postType === 'image_text') {
    const raw = post.imageTextData || post.templateData;
    if (!raw) return '';
    try {
      const payload = JSON.parse(raw) as ImageTextPayload;
      const first = payload.pages?.[0];
      if (typeof first === 'string') return createPlainTextExcerpt(first.trim(), 110);
      return createPlainTextExcerpt(first?.text?.trim() || '', 110);
    } catch {
      return '';
    }
  }
  return '';
}

function getPostStatusMeta(status?: string) {
  if (status === 'published') {
    return { label: '已发布', className: 'bg-theme-soft text-theme-primary' };
  }
  if (status === 'archived') {
    return { label: '已归档', className: 'bg-slate-200 text-slate-700' };
  }
  return { label: '草稿', className: 'bg-amber-100 text-amber-700' };
}

function getVisibilityMeta(visibility?: Post['visibility']): {
  label: string;
  className: string;
  icon: LucideIcon;
} {
  if (visibility === 'public') {
    return { label: '公开', className: 'bg-theme-primary text-white', icon: Eye };
  }
  if (visibility === 'shared') {
    return {
      label: '口令访问',
      className: 'bg-sky-500/85 text-white',
      icon: Users,
    };
  }
  return { label: '私密', className: 'bg-slate-900/75 text-white', icon: Lock };
}

interface BlogPostCardProps {
  post: Post;
  mode?: 'public' | 'creator';
  footer?: ReactNode;
  className?: string;
}

export function BlogPostCard({ post, mode = 'public', footer, className = '' }: BlogPostCardProps) {
  const location = useLocation();
  const previewText = getPostPreviewText(post);
  const isImageText = post.postType === 'image_text';
  const typeLabel = isImageText ? '图文创作' : '博客';
  const TypeIcon = isImageText ? ImageIcon : FileText;
  const visibilityMeta = getVisibilityMeta(post.visibility);
  const statusMeta = getPostStatusMeta(post.status);
  const returnTo = `${location.pathname}${location.search}`;
  const returnLabel = mode === 'creator' ? '返回创作空间' : '返回博客列表';
  const authorName = post.author?.nickname || '创作者';
  const groupName = post.group?.name || '未分组';

  return (
    <article
      className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-theme-soft-strong hover:shadow-[0_16px_38px_rgba(var(--theme-primary-rgb),0.16)] ${className}`}
    >
      <Link
        to={`/blog/${post.id}`}
        state={{ returnTo, returnLabel, source: mode === 'creator' ? 'my-space' : 'blog-list' }}
        className="block"
      >
        <div className="relative overflow-hidden border-b border-slate-100 bg-theme-soft">
          <BlogCoverMedia
            src={post.cover}
            alt={post.title}
            hoverZoom
            fallback={
              <div className="relative flex h-full w-full items-center justify-center text-slate-500">
                <TypeIcon className="h-12 w-12" />
              </div>
            }
          />
          <div className="absolute left-3 right-3 top-3 z-20 flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white backdrop-blur">
                <TypeIcon className="h-3.5 w-3.5" />
                {typeLabel}
              </span>
              {mode === 'public' && post.group?.name ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs text-theme-primary backdrop-blur">
                  <FolderTree className="h-3.5 w-3.5" />
                  {post.group.name}
                </span>
              ) : null}
              {mode === 'creator' ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs backdrop-blur ${visibilityMeta.className}`}
                >
                  <visibilityMeta.icon className="h-3.5 w-3.5" />
                  {visibilityMeta.label}
                </span>
              ) : null}
            </div>

            {mode === 'creator' ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
              >
                {statusMeta.label}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <h3 className="line-clamp-2 text-lg font-semibold text-slate-900 transition-colors group-hover:text-theme-primary">
            {post.title}
          </h3>

          <p className="line-clamp-3 min-h-[66px] text-sm leading-6 text-slate-600">
            {previewText || '这篇内容暂时没有摘要，点击查看完整正文。'}
          </p>

          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <div className="inline-flex min-w-0 flex-1 items-center gap-1.5">
              {post.author?.avatar ? (
                <img
                  src={post.author.avatar}
                  alt={post.author.nickname || 'author'}
                  className="h-5 w-5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <User className="h-3 w-3 text-slate-500" />
                </span>
              )}
              <span className="truncate font-medium text-slate-600">{authorName}</span>
            </div>

            <span className="inline-flex max-w-[46%] shrink-0 items-center rounded-full bg-theme-soft px-2 py-0.5 text-theme-primary">
              <span className="truncate">{groupName}</span>
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

      {footer ? <div className="border-t border-slate-100 p-4 pt-3">{footer}</div> : null}
    </article>
  );
}
