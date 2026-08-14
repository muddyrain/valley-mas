import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAllResources, type Resource } from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';

function getCollectionName(resource: Resource) {
  return resource.type === 'avatar' ? '人物与角色' : '风景与想象';
}

export default function YujiGallery() {
  const [searchParams] = useSearchParams();
  const selectedCollection = searchParams.get('collection') || '';
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllResources({ page: 1, pageSize: 24, includeTags: true })
      .then((data) => {
        if (!cancelled) setResources(data.list ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setResources([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const collections = useMemo(() => {
    const grouped = new Map<string, Resource[]>();
    for (const resource of resources) {
      const name = getCollectionName(resource);
      grouped.set(name, [...(grouped.get(name) || []), resource]);
    }
    return Array.from(grouped, ([name, items]) => ({ name, items }));
  }, [resources]);
  const activeCollection = collections.find((item) => item.name === selectedCollection);

  return (
    <main className="yuji-public-main yuji-index-page yuji-gallery-page">
      <div className="yuji-loading-surface">
        <BoxLoadingOverlay show={loading} title="正在整理图库" hint="很快就好" />
        <header className="yuji-index-hero yuji-gallery-hero">
          <p className="yuji-index-label">
            <span>GALLERY</span>
            <span>主题合集</span>
          </p>
          <h1>{activeCollection?.name || '图库'}</h1>
          <p>
            {activeCollection
              ? `属于“${activeCollection.name}”的影像，按观看的节奏排列在一起。`
              : '风景、游戏世界与想象中的人物。图片先被放进主题，再按观看的节奏重新相遇。'}
          </p>
        </header>

        {activeCollection ? (
          <>
            <div className="yuji-collection-back">
              <Link to="/gallery">← 返回全部合集</Link>
            </div>
            <section className="yuji-gallery-grid" aria-label={`${activeCollection.name}合集`}>
              {activeCollection.items.map((resource, index) => (
                <figure
                  key={resource.id}
                  className={`yuji-gallery-item yuji-gallery-item-${(index % 4) + 1}`}
                >
                  <Link to={`/gallery/image/${resource.id}`}>
                    <img src={resource.thumbnailUrl || resource.url} alt={resource.title} />
                  </Link>
                  <figcaption>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{resource.title}</strong>
                  </figcaption>
                </figure>
              ))}
            </section>
          </>
        ) : (
          <section className="yuji-collections" aria-label="主题合集">
            {collections.map((collection, index) => {
              const [lead, secondary] = collection.items;
              return (
                <article className="yuji-collection-card" key={collection.name}>
                  <Link
                    className="yuji-collection-hit"
                    to={`/gallery?collection=${encodeURIComponent(collection.name)}`}
                    aria-label={`打开${collection.name}`}
                  />
                  <figure className="yuji-collection-lead">
                    <img src={lead.thumbnailUrl || lead.url} alt={lead.title} />
                  </figure>
                  {secondary ? (
                    <figure className="yuji-collection-secondary">
                      <img src={secondary.thumbnailUrl || secondary.url} alt={secondary.title} />
                    </figure>
                  ) : null}
                  <div>
                    <p>COLLECTION / {String(index + 1).padStart(2, '0')}</p>
                    <h2>{collection.name}</h2>
                    <span>{collection.items.length} 张影像 · 打开合集 →</span>
                  </div>
                </article>
              );
            })}
            {!loading && collections.length === 0 ? (
              <p className="yuji-empty-copy">
                {failed ? '图库暂时无法加载，请稍后再试。' : '新的影像还在路上。'}
              </p>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
