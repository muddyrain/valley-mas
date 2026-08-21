import { useLayoutEffect, useRef, useState } from 'react';
import type { Post } from '@/api/blog';
import { useYujiStage } from '@/features/yuji-stage/YujiStageContext';
import { YujiTransitionLink } from '@/features/yuji-transition/YujiPublicTransition';

function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(new Date(value))
    .replace(/\//g, '.');
}

interface YujiStageArticleCardProps {
  index: number;
  post: Post;
  scope: 'home' | 'index';
}

export default function YujiStageArticleCard({ index, post, scope }: YujiStageArticleCardProps) {
  const coverRef = useRef<HTMLElement>(null);
  const [coverWebglReady, setCoverWebglReady] = useState(false);
  const stage = useYujiStage();
  const registerCover = stage?.registerCover;

  useLayoutEffect(() => {
    const element = coverRef.current;
    if (!element || !post.cover || !registerCover) return;
    return registerCover({
      element,
      id: `${scope}:${post.id}`,
      setReady: setCoverWebglReady,
      src: post.cover,
    });
  }, [post.cover, post.id, registerCover, scope]);

  const href = `/articles/${post.id}`;
  const number = String(index + 1).padStart(2, '0');

  return (
    <article className="yuji-stage-article-card" data-card-index={number} data-yuji-reveal="scroll">
      <div className="yuji-stage-article-signal" aria-hidden="true">
        <span>{number}</span>
        <span>{post.group?.name || 'LOG'}</span>
      </div>

      <div className="yuji-stage-article-copy">
        <p className="yuji-meta-row">
          <span>{post.group?.name || '文章'}</span>
          <time>{formatDate(post.publishedAt || post.createdAt)}</time>
        </p>
        <h2>
          <YujiTransitionLink coverId={post.id} to={href}>
            {post.title}
          </YujiTransitionLink>
        </h2>
        {post.excerpt ? <p>{post.excerpt}</p> : null}
      </div>

      {post.cover ? (
        <figure
          className="yuji-stage-cover"
          data-webgl-ready={coverWebglReady || undefined}
          data-yuji-cover-id={post.id}
          ref={coverRef}
        >
          <YujiTransitionLink coverId={post.id} to={href} aria-label={`阅读${post.title}`}>
            <img
              src={post.cover}
              alt={`${post.title}封面`}
              decoding="async"
              fetchPriority={index < 2 ? 'high' : 'auto'}
              loading={index < 2 ? 'eager' : 'lazy'}
            />
          </YujiTransitionLink>
        </figure>
      ) : (
        <div className="yuji-stage-cover yuji-stage-cover-placeholder" aria-hidden="true">
          <span>{number}</span>
          <small>NO IMAGE / TEXT REMAINS</small>
        </div>
      )}

      <YujiTransitionLink
        className="yuji-stage-article-open"
        coverId={post.id}
        to={href}
        aria-label={`阅读${post.title}`}
      >
        <span>READ</span>
        <span aria-hidden="true">↗</span>
      </YujiTransitionLink>
    </article>
  );
}
