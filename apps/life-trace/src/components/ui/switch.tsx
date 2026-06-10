'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

import { cn } from '@/lib/utils';

function Switch({
  className,
  size = 'default',
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-transparent p-1 outline-none transition-all after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive data-[size=sm]:h-7 data-[size=sm]:w-12 data-checked:bg-life-trace data-unchecked:bg-secondary data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6 rounded-full bg-foreground ring-0 transition-transform group-data-[size=sm]/switch:size-5 group-data-[size=default]/switch:data-checked:translate-x-6 group-data-[size=sm]/switch:data-checked:translate-x-5 group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 data-checked:bg-background"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
