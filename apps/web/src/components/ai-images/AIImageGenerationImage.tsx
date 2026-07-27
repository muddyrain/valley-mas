import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { getAIImageGenerationImageData } from '@/api/aiImages';
import { cn } from '@/lib/utils';

type AIImageGenerationImageProps = Omit<ComponentProps<'img'>, 'src'> & {
  generationId: string;
  src: string;
};

export function AIImageGenerationImage({
  generationId,
  src,
  alt,
  className,
  onError,
  onLoad,
  ...props
}: AIImageGenerationImageProps) {
  const [imageSource, setImageSource] = useState(src);
  const [unavailable, setUnavailable] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const fallbackAttempted = useRef(false);

  useEffect(() => {
    setImageSource(src);
    setUnavailable(false);
    setRecovering(false);
    fallbackAttempted.current = false;
  }, [src]);

  const handleError: NonNullable<ComponentProps<'img'>['onError']> = (event) => {
    onError?.(event);
    if (fallbackAttempted.current || recovering) {
      setUnavailable(true);
      return;
    }
    fallbackAttempted.current = true;
    setRecovering(true);
    void getAIImageGenerationImageData(generationId)
      .then(({ imageBase64 }) => {
        if (!imageBase64) throw new Error('empty image data');
        setImageSource(imageBase64);
        setUnavailable(false);
      })
      .catch(() => setUnavailable(true))
      .finally(() => setRecovering(false));
  };

  if (unavailable) {
    return (
      <div
        role="img"
        aria-label={alt || 'AI 生成图片'}
        className={cn(
          'flex items-center justify-center bg-muted/30 px-4 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        图片暂时无法访问
      </div>
    );
  }

  return (
    <img
      {...props}
      src={imageSource}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={onLoad}
    />
  );
}
