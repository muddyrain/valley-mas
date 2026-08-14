interface YujiContentRevealStatusProps {
  className?: string;
  label: string;
  variant?: 'article' | 'feature' | 'gallery' | 'images' | 'inline' | 'viewer' | 'writing';
}

export default function YujiContentRevealStatus({
  className = '',
  label,
  variant = 'inline',
}: YujiContentRevealStatusProps) {
  return (
    <div
      className={`yuji-reveal-status ${className}`.trim()}
      data-variant={variant}
      role="status"
      aria-atomic="true"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <span className="yuji-reveal-shapes" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </span>
    </div>
  );
}
