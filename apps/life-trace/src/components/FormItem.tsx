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
}: FormItemProps) {
  const labelContent = (
    <>
      {label}
      {required ? <span className="ml-1 text-life-alert">*</span> : null}
    </>
  );

  return (
    <div className={cn('min-w-0 space-y-3', className)}>
      {htmlFor ? (
        <label
          htmlFor={htmlFor}
          className={cn('block text-sm font-semibold leading-none', labelClassName)}
        >
          {labelContent}
        </label>
      ) : (
        <span className={cn('block text-sm font-semibold leading-none', labelClassName)}>
          {labelContent}
        </span>
      )}
      {description ? (
        <span className="block text-xs leading-5 text-muted-foreground">{description}</span>
      ) : null}
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
