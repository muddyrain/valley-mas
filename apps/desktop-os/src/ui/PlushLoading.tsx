import './PlushLoading.css';

interface PlushLoadingProps {
  title?: string;
  description?: string;
  variant?: 'inline' | 'panel' | 'stage';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function PlushLoading({
  title = '加载中',
  description,
  variant = 'panel',
  size = 'md',
  className = '',
}: PlushLoadingProps) {
  return (
    <output
      className={`plush-loading plush-loading--${variant} plush-loading--${size} ${className}`}
      aria-live="polite"
    >
      <div className="plush-loading__surface">
        <div className="plush-loading__mark" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="plush-loading__copy">
          <span className="plush-loading__title">{title}</span>
          {description ? <span className="plush-loading__description">{description}</span> : null}
        </div>
      </div>
      <div className="plush-loading__track" aria-hidden>
        <span />
      </div>
      <div className="plush-loading__skeleton" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </output>
  );
}
