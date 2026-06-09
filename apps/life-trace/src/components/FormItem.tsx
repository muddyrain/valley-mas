import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FormItemProps = {
  label: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  density?: 'default' | 'compact';
};

export function FormItem({
  label,
  children,
  description,
  error,
  htmlFor,
  required = false,
  className,
  labelClassName,
  density = 'default',
}: FormItemProps) {
  const labelContent = (
    <>
      {label}
      {required ? <span className="ml-1 text-life-alert">*</span> : null}
    </>
  );

  const compact = density === 'compact';

  return (
    <div className={cn('min-w-0', compact ? 'space-y-2' : 'space-y-3', className)}>
      {htmlFor ? (
        <label
          htmlFor={htmlFor}
          className={cn(
            'block text-sm font-semibold',
            compact ? 'leading-5' : 'leading-none',
            labelClassName,
          )}
        >
          {labelContent}
        </label>
      ) : (
        <span
          className={cn(
            'block text-sm font-semibold',
            compact ? 'leading-5' : 'leading-none',
            labelClassName,
          )}
        >
          {labelContent}
        </span>
      )}
      {description ? (
        <span
          className={cn('block text-xs leading-5 text-muted-foreground', compact ? '-mt-1' : null)}
        >
          {description}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className={cn('block text-xs text-destructive', compact ? '-mt-0.5' : null)}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
