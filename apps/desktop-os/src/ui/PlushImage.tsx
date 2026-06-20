import { type ImgHTMLAttributes, useEffect, useState } from 'react';
import './PlushImage.css';

type PlushImageFit = 'contain' | 'cover';

interface PlushImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src' | 'className'> {
  src?: string | null;
  alt?: string;
  decorative?: boolean;
  fit?: PlushImageFit;
  retryKey?: string | number;
  className?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

export default function PlushImage({
  src,
  alt = '',
  decorative = false,
  fit = 'contain',
  retryKey,
  className = '',
  fallbackTitle = '图片暂不可见',
  fallbackDescription,
  showRetry = true,
  onRetry,
  onLoad,
  onError,
  loading = 'lazy',
  decoding = 'async',
  ...imageProps
}: PlushImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(() =>
    src ? 'loading' : 'error',
  );
  const [attempt, setAttempt] = useState(0);
  const resetKey = `${src ?? 'missing'}-${retryKey ?? 'static'}`;

  useEffect(() => {
    setStatus(src && resetKey ? 'loading' : 'error');
    setAttempt(0);
  }, [src, resetKey]);

  const imageKey = `${resetKey}-${attempt}`;

  return (
    <span
      className={`plush-image plush-image--${fit} is-${status} ${className}`}
      data-empty={!src || undefined}
    >
      {src ? (
        <img
          {...imageProps}
          key={imageKey}
          src={src}
          alt={decorative ? '' : alt}
          loading={loading}
          decoding={decoding}
          aria-hidden={decorative || undefined}
          onLoad={(event) => {
            setStatus('loaded');
            onLoad?.(event);
          }}
          onError={(event) => {
            setStatus('error');
            onError?.(event);
          }}
        />
      ) : null}
      {status === 'error' ? (
        <span className="plush-image__fallback">
          <span className="plush-image__mark" aria-hidden>
            <span />
          </span>
          <span className="plush-image__copy">
            <strong>{fallbackTitle}</strong>
            {fallbackDescription ? <small>{fallbackDescription}</small> : null}
          </span>
          {src && showRetry ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRetry?.();
                setStatus('loading');
                setAttempt((value) => value + 1);
              }}
            >
              重试
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
