import { Heart, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Post } from '@/api/blog';
import { cn } from '@/lib/utils';

type ImageTextPayload = {
  pages?: string[];
};

function parsePreviewText(post: Post) {
  if (post.postType === 'image_text' && post.templateData) {
    try {
      const payload = JSON.parse(post.templateData) as ImageTextPayload;
      const firstPage = payload.pages?.[0]?.trim();
      if (firstPage) return firstPage;
    } catch {
      // ignore invalid templateData
    }
  }
  return (post.excerpt || post.title || '').trim();
}

function buildPreviewLines(text: string, maxLineLength = 9, maxLines = 5) {
  const compact = text.replace(/\s+/g, '');
  if (!compact) return ['暂无内容'];
  const lines: string[] = [];
  for (let i = 0; i < compact.length && lines.length < maxLines; i += maxLineLength) {
    lines.push(compact.slice(i, i + maxLineLength));
  }
  return lines;
}

function textSizeClass(totalLength: number) {
  if (totalLength <= 24) return 'text-[42px] leading-[1.3]';
  if (totalLength <= 40) return 'text-[34px] leading-[1.35]';
  if (totalLength <= 56) return 'text-[30px] leading-[1.36]';
  return 'text-[26px] leading-[1.38]';
}

interface ExternalPreviewPostCardProps {
  post: Post;
  className?: string;
}

export function ExternalPreviewPostCard({ post, className }: ExternalPreviewPostCardProps) {
  const previewText = parsePreviewText(post);
  const lines = buildPreviewLines(previewText);
  const fullText = lines.join('');

  return (
    <Link
      to={`/blog/${post.id}`}
      className={cn(
        'group block rounded-[22px] border border-slate-200 bg-white p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.12)]',
        className,
      )}
    >
      <div className="rounded-[18px] border border-slate-200 bg-[#f9f9f6] p-4">
        <div className="relative mx-auto h-[360px] w-full max-w-[270px] overflow-hidden rounded-2xl border border-[#e4dfd3] bg-[#f7f5ef] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]">
          <div className="absolute left-5 top-4 text-[46px] leading-none text-[#e6e0d2]">“</div>
          <div
            className={cn(
              'relative z-10 mt-12 font-semibold tracking-tight text-[#3d3a38]',
              textSizeClass(fullText.length),
            )}
          >
            {lines.map((line, index) => (
              <p key={`${post.id}-${index}`}>{line}</p>
            ))}
          </div>

          <div className="absolute bottom-5 right-5 h-1.5 w-10 rounded-full bg-[#ede4cf]" />
        </div>
      </div>

      <div className="mt-3 px-1">
        <h3 className="line-clamp-1 text-lg font-semibold text-slate-900 group-hover:text-violet-700">
          {post.title}
        </h3>
        <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
          <div className="inline-flex min-w-0 items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{post.author?.nickname || '创作者'}</span>
          </div>
          <div className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            <span>{post.likeCount || 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
