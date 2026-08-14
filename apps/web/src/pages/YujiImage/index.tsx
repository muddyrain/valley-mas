import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { downloadResource, getResourceDetail, type Resource } from '@/api/resource';
import YujiContentRevealStatus from '@/components/yuji/YujiContentRevealStatus';
import YujiContentState from '@/components/yuji/YujiContentState';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useYujiEditorialMotion } from '@/hooks/useYujiEditorialMotion';
import {
  RESOURCE_LICENSE_LABELS,
  RESOURCE_SOURCE_LABELS,
  type ResourceLicense,
  type ResourceSourceKind,
} from '@/utils/resourcePolicy';
import { getYujiImageTransitionStyle } from '@/utils/yujiViewTransition';

export default function YujiImage() {
  const { id } = useParams<{ id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const requestRef = useRef(0);
  const pageRef = useRef<HTMLElement>(null);

  const loadResource = useCallback(() => {
    if (!id) return Promise.resolve();
    const requestId = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    setResource(null);
    return getResourceDetail(id, { suppressErrorToast: true })
      .then((data) => {
        if (requestId === requestRef.current) setResource(data);
      })
      .catch(() => {
        if (requestId === requestRef.current) {
          setResource(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    void loadResource();
    return () => {
      requestRef.current += 1;
    };
  }, [loadResource]);

  const showLoading = useDelayedLoading(loading);
  useYujiEditorialMotion(pageRef, resource?.id || String(showLoading));

  const sourceLabel = resource?.sourceKind
    ? RESOURCE_SOURCE_LABELS[resource.sourceKind as ResourceSourceKind]
    : '';
  const licenseLabel = resource?.license
    ? RESOURCE_LICENSE_LABELS[resource.license as ResourceLicense]
    : '';

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
    <main ref={pageRef} className="yuji-viewer" aria-busy={loading}>
      {showLoading ? (
        <YujiContentRevealStatus
          className="yuji-viewer-reveal"
          label="影像正在显影"
          variant="viewer"
        />
      ) : null}
      {resource ? (
        <>
          <section className="yuji-viewer-stage" aria-label={resource.title}>
            <img
              src={resource.url}
              alt={resource.title}
              className="yuji-shared-image"
              data-yuji-reveal="media"
              style={getYujiImageTransitionStyle(resource.id)}
            />
          </section>
          <aside className="yuji-viewer-details" data-yuji-reveal="intro">
            <Link to="/gallery" viewTransition>
              ← 返回图库
            </Link>
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
              {sourceLabel ? (
                <div>
                  <dt>来源</dt>
                  <dd>{sourceLabel}</dd>
                </div>
              ) : null}
              {licenseLabel && sourceLabel ? (
                <div>
                  <dt>许可</dt>
                  <dd>{licenseLabel}</dd>
                </div>
              ) : null}
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
                  : '这张图片暂未开放下载。'}
            </small>
          </aside>
        </>
      ) : !loading ? (
        <div className="yuji-viewer-missing">
          <YujiContentState
            message={failed ? '这张影像暂时没有抵达。' : '这张影像已经不在这里了。'}
            onRetry={failed ? () => void loadResource() : undefined}
            tone="dark"
          />
          <Link to="/gallery" viewTransition>
            返回图库
          </Link>
        </div>
      ) : null}
    </main>
  );
}
