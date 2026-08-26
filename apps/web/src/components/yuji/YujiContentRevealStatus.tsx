interface YujiContentRevealStatusProps {
  className?: string;
  label: string;
  showLabel?: boolean;
  variant?: 'article' | 'feature' | 'gallery' | 'images' | 'inline' | 'viewer' | 'writing';
}

export default function YujiContentRevealStatus({
  className = '',
  label,
  showLabel = false,
  variant = 'inline',
}: YujiContentRevealStatusProps) {
  const isWriting = variant === 'writing';

  return (
    <div
      className={`yuji-reveal-status ${className}`.trim()}
      data-variant={variant}
      role="status"
      aria-atomic="true"
      aria-live="polite"
      aria-label={label}
    >
      {isWriting ? (
        <div className="yuji-writing-reveal" aria-hidden="true">
          <div className="yuji-writing-reveal-heading">
            <span className="yuji-reveal-label">{label}</span>
            <span>ARTICLE INDEX / LOADING</span>
          </div>
          <div className="yuji-writing-reveal-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <span className="yuji-writing-reveal-card" key={index}>
                <span className="yuji-writing-reveal-signal">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="yuji-writing-reveal-copy">
                  <i className="yuji-writing-reveal-meta" />
                  <i className="yuji-writing-reveal-title" />
                  <i className="yuji-writing-reveal-title yuji-writing-reveal-title--short" />
                  <i className="yuji-writing-reveal-excerpt" />
                </span>
                <span className="yuji-writing-reveal-media" />
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <span className={showLabel ? 'yuji-reveal-label' : 'sr-only'}>{label}</span>
          <span className="yuji-reveal-shapes" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} />
            ))}
          </span>
        </>
      )}
    </div>
  );
}
