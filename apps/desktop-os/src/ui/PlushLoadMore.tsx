import './PlushLoadMore.css';

type PlushLoadMoreStatus = 'more' | 'loading' | 'done';

interface PlushLoadMoreProps {
  status: PlushLoadMoreStatus;
  className?: string;
  onLoadMore?: () => void;
  moreLabel?: string;
  loadingLabel?: string;
  doneLabel?: string;
}

export default function PlushLoadMore({
  status,
  className = '',
  onLoadMore,
  moreLabel = '继续载入',
  loadingLabel = '正在载入更多',
  doneLabel = '已显示全部',
}: PlushLoadMoreProps) {
  const label = status === 'loading' ? loadingLabel : status === 'done' ? doneLabel : moreLabel;
  const canLoad = status === 'more' && onLoadMore;
  const classNames = `plush-load-more plush-load-more--${status} ${className}`.trim();

  const content = (
    <>
      <span className="plush-load-more__beads" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="plush-load-more__label">{label}</span>
      <span className="plush-load-more__trail" aria-hidden />
    </>
  );

  if (canLoad) {
    return (
      <button type="button" className={classNames} onClick={onLoadMore}>
        {content}
      </button>
    );
  }

  return (
    <output className={classNames} aria-live="polite">
      {content}
    </output>
  );
}
