import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllResources, type Resource } from '@/api/resource';
import YujiContentRevealStatus from '@/components/yuji/YujiContentRevealStatus';
import YujiContentState from '@/components/yuji/YujiContentState';
import { YujiTransitionLink } from '@/features/yuji-transition/YujiPublicTransition';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useYujiEditorialMotion } from '@/hooks/useYujiEditorialMotion';
import { distributeGalleryResources } from '@/utils/galleryMasonry';
import { getYujiImageTransitionStyle } from '@/utils/yujiViewTransition';

const GALLERY_PAGE_SIZE = 24;

function getGalleryColumnCount() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 3;
  if (window.matchMedia('(max-width: 720px)').matches) return 1;
  if (window.matchMedia('(max-width: 1100px)').matches) return 2;
  return 3;
}

function useGalleryColumnCount() {
  const [columnCount, setColumnCount] = useState(getGalleryColumnCount);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mobile = window.matchMedia('(max-width: 720px)');
    const laptop = window.matchMedia('(max-width: 1100px)');
    const update = () => setColumnCount(getGalleryColumnCount());
    mobile.addEventListener('change', update);
    laptop.addEventListener('change', update);
    return () => {
      mobile.removeEventListener('change', update);
      laptop.removeEventListener('change', update);
    };
  }, []);
  return columnCount;
}

export default function YujiGallery() {
  const [searchParams] = useSearchParams();
  const resourceType = searchParams.get('type') === 'avatar' ? 'avatar' : 'wallpaper';
  const pageRef = useRef<HTMLElement>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const continuationRef = useRef<HTMLDivElement>(null);
  const columnCount = useGalleryColumnCount();

  const loadResources = useCallback(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setLoadingMore(false);
    setFailed(false);
    setLoadMoreFailed(false);
    setResources([]);
    setPage(1);
    setTotal(0);
    loadingMoreRef.current = false;
    return getAllResources({
      page: 1,
      pageSize: GALLERY_PAGE_SIZE,
      includeTags: true,
      type: resourceType,
    })
      .then((data) => {
        if (requestId === requestRef.current) {
          const nextResources = data.list ?? [];
          setResources(nextResources);
          setTotal(data.total ?? nextResources.length);
        }
      })
      .catch(() => {
        if (requestId === requestRef.current) {
          setFailed(true);
          setResources([]);
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [resourceType]);

  const loadMoreResources = useCallback(() => {
    if (
      loading ||
      failed ||
      loadingMoreRef.current ||
      resources.length === 0 ||
      resources.length >= total
    ) {
      return Promise.resolve();
    }

    const requestId = requestRef.current;
    const nextPage = page + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreFailed(false);

    return getAllResources({
      page: nextPage,
      pageSize: GALLERY_PAGE_SIZE,
      includeTags: true,
      type: resourceType,
    })
      .then((data) => {
        if (requestId !== requestRef.current) return;
        const nextResources = data.list ?? [];
        setResources((current) => {
          const loadedIds = new Set(current.map((resource) => resource.id));
          return [...current, ...nextResources.filter((resource) => !loadedIds.has(resource.id))];
        });
        setPage(nextPage);
        setTotal(data.total ?? total);
      })
      .catch(() => {
        if (requestId === requestRef.current) setLoadMoreFailed(true);
      })
      .finally(() => {
        loadingMoreRef.current = false;
        if (requestId === requestRef.current) setLoadingMore(false);
      });
  }, [failed, loading, page, resourceType, resources.length, total]);

  useEffect(() => {
    void loadResources();
    return () => {
      requestRef.current += 1;
    };
  }, [loadResources]);

  const hasMore = resources.length > 0 && resources.length < total;

  useEffect(() => {
    const target = continuationRef.current;
    if (!target || !hasMore || loadMoreFailed || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMoreResources();
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMoreFailed, loadMoreResources]);

  const showLoading = useDelayedLoading(loading);
  const resourceColumns = useMemo(
    () => distributeGalleryResources(resources, columnCount),
    [columnCount, resources],
  );

  useYujiEditorialMotion(pageRef, `${resourceType}-${loading}-${resources.length}`);

  return (
    <main ref={pageRef} className="yuji-public-main yuji-index-page yuji-gallery-page">
      <header className="yuji-index-hero yuji-gallery-hero">
        <p className="yuji-index-label" data-yuji-reveal="intro">
          <span>GALLERY</span>
          <span>影像存档</span>
        </p>
        <h1 data-yuji-reveal="intro">图库</h1>
        <p data-yuji-reveal="intro">散落的风景、人物与想象，在这里按观看的节奏彼此相遇。</p>
        <nav className="yuji-gallery-type-filter" aria-label="影像类型" data-yuji-reveal="intro">
          <YujiTransitionLink
            coverId="gallery-wallpaper"
            to="/gallery"
            aria-current={resourceType === 'wallpaper' ? 'page' : undefined}
          >
            壁纸
          </YujiTransitionLink>
          <YujiTransitionLink
            coverId="gallery-avatar"
            to="/gallery?type=avatar"
            aria-current={resourceType === 'avatar' ? 'page' : undefined}
          >
            头像
          </YujiTransitionLink>
        </nav>
      </header>

      {loading ? (
        showLoading ? (
          <section className="yuji-gallery-developing" aria-label="图库内容加载中">
            <YujiContentRevealStatus label="影像正在显影" variant="gallery" />
          </section>
        ) : null
      ) : resources.length ? (
        <>
          <section
            className="yuji-gallery-grid"
            aria-label="影像列表"
            data-layout="stable-masonry"
            data-column-count={columnCount}
            data-resource-type={resourceType}
            style={{ '--yuji-gallery-column-count': columnCount } as React.CSSProperties}
          >
            {resourceColumns.map((column, lane) => (
              <div key={lane} className="yuji-gallery-column" data-masonry-column={lane}>
                {column.map((resource) => {
                  const index = resources.findIndex((item) => item.id === resource.id);
                  return (
                    <figure
                      key={resource.id}
                      className="yuji-gallery-item"
                      data-yuji-reveal="scroll"
                    >
                      <YujiTransitionLink
                        coverId={`gallery:${resource.id}`}
                        to={`/gallery/image/${resource.id}`}
                      >
                        <img
                          src={resource.thumbnailUrl || resource.url}
                          alt={resource.title}
                          decoding="async"
                          fetchPriority={index < 3 ? 'high' : 'auto'}
                          height={resource.height}
                          loading={index < 3 ? 'eager' : 'lazy'}
                          className="yuji-shared-image"
                          style={getYujiImageTransitionStyle(resource.id)}
                          width={resource.width}
                        />
                      </YujiTransitionLink>
                      <figcaption>
                        <strong>{resource.title}</strong>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            ))}
          </section>
          {hasMore || loadingMore || loadMoreFailed ? (
            <div ref={continuationRef} className="yuji-gallery-continuation">
              {loadingMore ? (
                <YujiContentRevealStatus label="更多影像正在显影" variant="inline" />
              ) : loadMoreFailed ? (
                <button type="button" onClick={() => void loadMoreResources()}>
                  重新试试
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <YujiContentState
          message={failed ? '影像暂时没有抵达。' : '新的影像还在路上。'}
          onRetry={failed ? () => void loadResources() : undefined}
        />
      )}
    </main>
  );
}
