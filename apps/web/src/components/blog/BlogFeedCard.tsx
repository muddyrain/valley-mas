import { Calendar, FileText, Image as ImageIcon, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Post } from '@/api/blog';
import { DefaultBlogCover } from '@/pages/blog/components/DefaultBlogCover';
import { formatDate } from '@/utils/blog';

type ImageTextPayload = {
  pages?: Array<string | { text?: string }>;
};

function getPostPreviewText(post: Post) {
  if (post.excerpt?.trim()) return post.excerpt.trim();
  if (post.postType === 'image_text') {
    const raw = post.imageTextData || post.templateData;
    if (!raw) return '';
    try {
      const payload = JSON.parse(raw) as ImageTextPayload;
      const first = payload.pages?.[0];
      if (typeof first === 'string') return first.trim();
      return first?.text?.trim() || '';
    } catch {
      return '';
    }
  }
  return '';
}

interface BlogFeedCardProps {
  post: Post;
}

export function BlogFeedCard({ post }: BlogFeedCardProps) {
  const previewText = getPostPreviewText(post);
  const isImageText = post.postType === 'image_text';

  return (
    <Link
      to={`/blog/${post.id}`}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_16px_38px_rgba(79,70,229,0.16)]"
    >
      <div className="relative h-44 overflow-hidden border-b border-slate-100 bg-linear-to-br from-violet-100/70 via-sky-100/60 to-white">
        {post.cover ? (
          <img
            src={post.cover}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <DefaultBlogCover compact>
            <div className="relative flex h-full w-full items-center justify-center text-slate-500">
              {isImageText ? (
                <ImageIcon className="h-12 w-12" />
              ) : (
                <FileText className="h-12 w-12" />
              )}
            </div>
          </DefaultBlogCover>
        )}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white backdrop-blur">
          {isImageText ? (
            <ImageIcon className="h-3.5 w-3.5" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          {isImageText ? '图文创作' : '博客'}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <h3 className="line-clamp-2 text-lg font-semibold text-slate-900 transition-colors group-hover:text-violet-700">
          {post.title}
        </h3>
        <p className="line-clamp-3 min-h-[66px] text-sm leading-6 text-slate-600">
          {previewText || '这篇内容暂时没有摘要，点击查看完整正文。'}
        </p>
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
            <span className="truncate">{post.author?.nickname || '创作者'}</span>
          </div>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-600">
            {post.group?.name || '未分组'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(post.publishedAt || post.createdAt)}
          </div>
          <span className="text-slate-400">{isImageText ? '图文创作' : '博客文章'}</span>
        </div>
      </div>
    </Link>
  );
}
