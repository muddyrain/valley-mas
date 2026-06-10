import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-2xl border border-border bg-secondary px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
