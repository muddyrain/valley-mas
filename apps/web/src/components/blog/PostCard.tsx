import { Calendar, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { PostMeta } from '@/types/blog';
import { formatDate } from '@/utils/blog';

interface PostCardProps {
  post: PostMeta;
  className?: string;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article
      className={cn(
        'group relative bg-card rounded-xl overflow-hidden',
        'border border-border/50',
        'hover:shadow-lg hover:border-primary/20',
        'transition-all duration-300',
      )}
    >
      <Link to={`/blog/${post.id}`} className="block">
        {post.cover && (
          <div className="relative h-48 overflow-hidden">
            <img
              src={post.cover}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/90 text-primary-foreground">
                {post.category}
              </span>
            </div>
          </div>
        )}

        <div className="p-5">
          <h2 className="text-xl font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>

          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{post.excerpt}</p>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <time>{formatDate(post.date)}</time>
              </div>
              {post.authorName && (
                <div className="inline-flex min-w-0 items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  <span className="truncate">{post.authorName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
