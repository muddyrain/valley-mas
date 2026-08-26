import {
  Archive,
  ChevronDown,
  Download,
  File,
  FileCode2,
  FileImage,
  FileText,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type ArticlePackage,
  type ArticlePackageEntry,
  fetchArticlePackagePreview,
  getArticlePackagePreviewURL,
  requestArticlePackageDownload,
} from '@/api/blog';
import { Button } from '@/components/ui/button';
import { isSensitivePackagePath, renderSafePackageMarkdown } from '@/utils/articlePackagePreview';

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function displayPath(path: string, collapsibleRoot?: string) {
  if (!collapsibleRoot || !path.startsWith(`${collapsibleRoot}/`)) return path;
  return path.slice(collapsibleRoot.length + 1);
}

function previewLabel(entry: ArticlePackageEntry | null, sensitive: boolean) {
  if (!entry) return '文件预览';
  if (sensitive) return '已保护';
  switch (entry.previewKind) {
    case 'image':
      return '图片预览';
    case 'markdown':
      return 'Markdown';
    case 'text':
      return '文本预览';
    default:
      return '仅供下载';
  }
}

function EntryIcon({ entry, sensitive }: { entry: ArticlePackageEntry; sensitive: boolean }) {
  if (sensitive) return <LockKeyhole />;
  if (entry.previewKind === 'image') return <FileImage />;
  if (entry.previewKind === 'markdown') return <FileText />;
  if (entry.previewKind === 'text') return <FileCode2 />;
  return <File />;
}

export function ArticlePackageSummaryCard({
  postId,
  articlePackage,
}: {
  postId: string;
  articlePackage: ArticlePackage;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState(() => searchParams.has('file'));
  const [content, setContent] = useState('');
  const [imageURL, setImageURL] = useState('');
  const imageURLRef = useRef('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const entries = useMemo(
    () => (articlePackage.entries || []).filter((entry) => !entry.directory),
    [articlePackage.entries],
  );
  const requestedPath = searchParams.get('file') || '';
  const selected = useMemo(() => {
    const requested = entries.find((entry) => entry.path === requestedPath);
    if (requested) return requested;
    const defaultEntry = entries.find((entry) => entry.path === articlePackage.defaultPath);
    return defaultEntry || null;
  }, [articlePackage.defaultPath, entries, requestedPath]);
  const selectedIsSensitive = Boolean(
    selected && (selected.sensitive || isSensitivePackagePath(selected.path)),
  );

  const setSelectedPath = useCallback(
    (path?: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (path) next.set('file', path);
          else next.delete('file');
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (expanded && selected && selected.path !== requestedPath) setSelectedPath(selected.path);
    if (expanded && requestedPath && !selected) setSelectedPath();
  }, [expanded, requestedPath, selected, setSelectedPath]);

  useEffect(() => {
    let active = true;
    if (imageURLRef.current) URL.revokeObjectURL(imageURLRef.current);
    imageURLRef.current = '';
    setImageURL('');
    setContent('');
    if (!expanded || !selected || selected.previewKind === 'metadata' || selectedIsSensitive) {
      return () => undefined;
    }
    setPreviewLoading(true);
    void fetchArticlePackagePreview(postId, selected.path)
      .then(async ({ blob }) => {
        if (!active) return;
        if (selected.previewKind === 'image') {
          const nextImageURL = URL.createObjectURL(blob);
          imageURLRef.current = nextImageURL;
          setImageURL(nextImageURL);
        } else setContent(await blob.text());
      })
      .catch(() => {
        if (active) toast.error('文件预览失败，请稍后重试');
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [expanded, postId, selected, selectedIsSensitive]);

  useEffect(
    () => () => {
      if (imageURLRef.current) URL.revokeObjectURL(imageURLRef.current);
    },
    [],
  );

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const result = await requestArticlePackageDownload(postId);
      window.location.assign(result.url);
    } catch {
      toast.error('文章配套包暂时无法下载，请稍后重试');
    } finally {
      setDownloading(false);
    }
  };

  const selectFile = (entry: ArticlePackageEntry) => setSelectedPath(entry.path);
  const markdownHTML =
    selected?.previewKind === 'markdown' && !selectedIsSensitive
      ? renderSafePackageMarkdown(content, selected.path, entries, (path) =>
          getArticlePackagePreviewURL(postId, path),
        )
      : '';

  return (
    <section
      className="yuji-article-package-shell"
      data-expanded={expanded ? 'true' : 'false'}
      aria-label="文章配套包"
    >
      <div className="yuji-article-package">
        <div className="yuji-article-package__icon" aria-hidden="true">
          <Archive />
        </div>
        <div className="yuji-article-package__body">
          <p>文章配套包</p>
          <h2>{articlePackage.originalName}</h2>
          <span>
            {formatBytes(articlePackage.size)} · {articlePackage.entryCount} 个文件 ·{' '}
            {formatUpdatedAt(articlePackage.updatedAt)} 更新
          </span>
        </div>
        <div className="yuji-article-package__actions">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="yuji-article-package__toggle"
            aria-expanded={expanded}
            aria-controls="yuji-article-package-preview"
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (!next) setSelectedPath();
            }}
          >
            <ChevronDown aria-hidden="true" />
            {expanded ? '收起' : '预览文件'}
          </Button>
          <Button
            type="button"
            size="default"
            className="yuji-article-package__download"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            下载 ZIP
          </Button>
        </div>
        <p className="yuji-article-package__license">许可证以包内 LICENSE 或文章说明为准</p>
      </div>

      {expanded ? (
        <div className="yuji-article-package-inline" id="yuji-article-package-preview">
          <select
            className="yuji-package-mobile-select"
            aria-label="选择预览文件"
            value={selected?.path || ''}
            onChange={(event) => {
              const entry = entries.find((item) => item.path === event.target.value);
              if (entry) selectFile(entry);
            }}
          >
            {entries.map((entry) => (
              <option key={entry.path} value={entry.path}>
                {displayPath(entry.path, articlePackage.collapsibleRoot)}
              </option>
            ))}
          </select>

          <div className="yuji-package-browser">
            <nav aria-label="配套包文件">
              {entries.map((entry) => (
                <button
                  type="button"
                  key={entry.path}
                  className={entry.path === selected?.path ? 'is-active' : ''}
                  aria-current={entry.path === selected?.path ? 'true' : undefined}
                  onClick={() => selectFile(entry)}
                >
                  <EntryIcon
                    entry={entry}
                    sensitive={Boolean(entry.sensitive || isSensitivePackagePath(entry.path))}
                  />
                  <span>{displayPath(entry.path, articlePackage.collapsibleRoot)}</span>
                </button>
              ))}
            </nav>
            <section className="yuji-package-preview" aria-busy={previewLoading}>
              <header className="yuji-package-preview__toolbar">
                <span title={selected?.path}>
                  {selected
                    ? displayPath(selected.path, articlePackage.collapsibleRoot)
                    : '尚未选择文件'}
                </span>
                <small>{previewLabel(selected, selectedIsSensitive)}</small>
              </header>
              <div className="yuji-package-preview__body">
                {previewLoading ? (
                  <div className="yuji-package-preview__state">
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    <strong>正在读取文件</strong>
                    <span>内容加载完成后会显示在这里</span>
                  </div>
                ) : null}
                {!previewLoading && selectedIsSensitive ? (
                  <div className="yuji-package-preview__state is-sensitive">
                    <LockKeyhole aria-hidden="true" />
                    <strong>敏感文件已隐藏</strong>
                    <span>为避免配置或密钥泄露，此文件不提供在线预览</span>
                  </div>
                ) : null}
                {!previewLoading && !selectedIsSensitive && selected?.previewKind === 'metadata' ? (
                  <div className="yuji-package-preview__state">
                    <File aria-hidden="true" />
                    <strong>这个文件暂不支持预览</strong>
                    <span>文件仍保留在配套包中，可下载后在本地打开</span>
                  </div>
                ) : null}
                {!previewLoading &&
                !selectedIsSensitive &&
                selected?.previewKind === 'image' &&
                imageURL ? (
                  <img src={imageURL} alt={selected.path} />
                ) : null}
                {!previewLoading && !selectedIsSensitive && selected?.previewKind === 'markdown' ? (
                  <article dangerouslySetInnerHTML={{ __html: markdownHTML }} />
                ) : null}
                {!previewLoading && !selectedIsSensitive && selected?.previewKind === 'text' ? (
                  <pre>
                    <code>{content}</code>
                  </pre>
                ) : null}
                {!previewLoading && !selected ? (
                  <div className="yuji-package-preview__state">
                    <File aria-hidden="true" />
                    <strong>选择一个文件开始预览</strong>
                    <span>支持文本、Markdown 和常见图片格式</span>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
