import type * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
