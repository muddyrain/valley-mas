import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { downloadResource, getResourceDetail, type Resource } from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import {
  RESOURCE_LICENSE_LABELS,
  RESOURCE_SOURCE_LABELS,
  type ResourceLicense,
  type ResourceSourceKind,
} from '@/utils/resourcePolicy';

export default function YujiImage() {
  const { id } = useParams<{ id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getResourceDetail(id, { suppressErrorToast: true })
      .then((data) => {
        if (!cancelled) setResource(data);
      })
      .catch(() => {
        if (!cancelled) setResource(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sourceLabel = resource?.sourceKind
    ? RESOURCE_SOURCE_LABELS[resource.sourceKind as ResourceSourceKind]
    : '来源待补充';
  const licenseLabel = resource?.license
    ? RESOURCE_LICENSE_LABELS[resource.license as ResourceLicense]
    : '许可尚未确认';

  const handleDownload = async () => {
    if (!resource?.downloadAllowed || downloading) return;
    try {
      setDownloading(true);
      const result = await downloadResource(resource.id);
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('暂时无法下载这张图片');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="yuji-viewer yuji-loading-surface">
      <BoxLoadingOverlay show={loading} title="正在打开影像" hint="很快就好" tone="dark" />
      {resource ? (
        <>
          <section className="yuji-viewer-stage" aria-label={resource.title}>
            <img src={resource.url} alt={resource.title} />
          </section>
          <aside className="yuji-viewer-details">
            <Link to="/gallery">← 返回图库</Link>
            <p>{resource.tags?.[0] || 'IMAGE'}</p>
            <h1>{resource.title}</h1>
            <dl>
              <div>
                <dt>规格</dt>
                <dd>
                  {resource.width && resource.height
                    ? `${resource.width} × ${resource.height}`
                    : '待补充'}
                </dd>
              </div>
              <div>
                <dt>作者</dt>
                <dd>{resource.userName || 'muddyrain'}</dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{sourceLabel}</dd>
              </div>
              <div>
                <dt>许可</dt>
                <dd>{licenseLabel}</dd>
              </div>
            </dl>
            {resource.sourceUrl ? (
              <a href={resource.sourceUrl} target="_blank" rel="noreferrer">
                查看原始出处 ↗
              </a>
            ) : null}
            <button
              type="button"
              disabled={!resource.downloadAllowed || downloading}
              onClick={() => void handleDownload()}
            >
              {resource.downloadAllowed
                ? downloading
                  ? '正在准备下载'
                  : '下载原图'
                : '下载未开放'}
            </button>
            <small>
              {resource.downloadAllowed
                ? '下载仅用于许可范围内的个人使用。'
                : resource.sourceUrl
                  ? '请通过原始出处查看授权与获取方式。'
                  : '确认来源与许可后开放下载或原始出处。'}
            </small>
          </aside>
        </>
      ) : !loading ? (
        <div className="yuji-viewer-missing">
          <p>这张图片暂时无法打开。</p>
          <Link to="/gallery">返回图库</Link>
        </div>
      ) : null}
    </main>
  );
}
