import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DefaultBlogCover } from '@/pages/blog/components/DefaultBlogCover';

export const BLOG_COVER_OUTPUT_WIDTH = 1600;
export const BLOG_COVER_OUTPUT_HEIGHT = 900;
export const BLOG_COVER_ASPECT_CLASS = 'aspect-[16/9]';
export const BLOG_COVER_OUTPUT_SIZE_TEXT = `${BLOG_COVER_OUTPUT_WIDTH} x ${BLOG_COVER_OUTPUT_HEIGHT}`;

type BlogCoverMediaProps = {
  src?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
  compactFallback?: boolean;
  hoverZoom?: boolean;
};

export function BlogCoverMedia({
  src,
  alt,
  className,
  imageClassName,
  fallback,
  compactFallback = true,
  hoverZoom = false,
}: BlogCoverMediaProps) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-theme-soft',
        BLOG_COVER_ASPECT_CLASS,
        className,
      )}
    >
      {src ? (
        <>
          <img
            src={src}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-3xl"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.32),rgba(255,255,255,0.06)_48%,transparent_78%)]" />
          <img
            src={src}
            alt={alt}
            className={cn(
              'relative z-10 h-full w-full object-cover',
              hoverZoom && 'transition-transform duration-500 group-hover:scale-[1.015]',
              imageClassName,
            )}
          />
        </>
      ) : (
        <DefaultBlogCover compact={compactFallback} className="h-full w-full">
          {fallback}
        </DefaultBlogCover>
      )}
    </div>
  );
}
