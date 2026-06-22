import type * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SelectContent, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './PlushPrimitives.css';

export type PlushTone = 'primary' | 'neutral' | 'accent' | 'danger';

export type PlushButtonProps = React.ComponentProps<typeof Button> & {
  tone?: PlushTone;
  loading?: boolean;
  loadingLabel?: React.ReactNode;
  unstyled?: boolean;
};

export function PlushButton({
  className,
  tone = 'primary',
  loading = false,
  loadingLabel,
  unstyled = false,
  disabled,
  children,
  ...props
}: PlushButtonProps) {
  const dataLoading = loading ? 'true' : undefined;
  const ariaBusy = loading || undefined;
  const isDisabled = loading || disabled;
  const indicator = loading ? (
    <span className="plush-button__loading" aria-hidden>
      <span className="plush-button__dot" />
      <span className="plush-button__dot" />
      <span className="plush-button__dot" />
    </span>
  ) : null;
  const label = (
    <span className="plush-button__label">{loading && loadingLabel ? loadingLabel : children}</span>
  );

  if (unstyled) {
    const { type, ...rest } = props as React.ComponentProps<typeof Button>;
    return (
      <button
        type={type ?? 'button'}
        data-tone={tone}
        data-loading={dataLoading}
        aria-busy={ariaBusy}
        disabled={isDisabled}
        className={cn('plush-button-bare', loading && 'plush-button-bare--loading', className)}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {indicator}
        {label}
      </button>
    );
  }

  return (
    <Button
      data-tone={tone}
      data-loading={dataLoading}
      aria-busy={ariaBusy}
      disabled={isDisabled}
      className={cn('plush-button', loading && 'plush-button--loading', className)}
      {...props}
    >
      {indicator}
      {label}
    </Button>
  );
}

export function PlushCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={cn('plush-card', className)} {...props} />;
}

export function PlushDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return <DialogContent className={cn('plush-dialog-content', className)} {...props} />;
}

export function PlushMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return <DropdownMenuContent className={cn('plush-menu-content', className)} {...props} />;
}

export function PlushInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn('plush-field', className)} {...props} />;
}

export function PlushTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return <Textarea className={cn('plush-field', className)} {...props} />;
}

export function PlushSelectTrigger({
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return <SelectTrigger className={cn('plush-field', className)} {...props} />;
}

export function PlushSelectContent({
  className,
  ...props
}: React.ComponentProps<typeof SelectContent>) {
  return <SelectContent className={cn('plush-menu-content', className)} {...props} />;
}

export function PlushSkeleton({ className, ...props }: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn('plush-skeleton', className)} {...props} />;
}

export {
  CardContent as PlushCardContent,
  CardDescription as PlushCardDescription,
  CardFooter as PlushCardFooter,
  CardHeader as PlushCardHeader,
  CardTitle as PlushCardTitle,
  Dialog as PlushDialog,
  DialogClose as PlushDialogClose,
  DialogDescription as PlushDialogDescription,
  DialogFooter as PlushDialogFooter,
  DialogHeader as PlushDialogHeader,
  DialogTitle as PlushDialogTitle,
  DialogTrigger as PlushDialogTrigger,
  DropdownMenu as PlushMenu,
  DropdownMenuGroup as PlushMenuGroup,
  DropdownMenuItem as PlushMenuItem,
  DropdownMenuLabel as PlushMenuLabel,
  DropdownMenuSeparator as PlushMenuSeparator,
  DropdownMenuShortcut as PlushMenuShortcut,
  DropdownMenuSub as PlushMenuSub,
  DropdownMenuSubContent as PlushMenuSubContent,
  DropdownMenuSubTrigger as PlushMenuSubTrigger,
  DropdownMenuTrigger as PlushMenuTrigger,
  Separator as PlushSeparator,
  Slider as PlushSlider,
  Switch as PlushSwitch,
  Tabs as PlushTabs,
  TabsContent as PlushTabsContent,
  TabsList as PlushTabsList,
  TabsTrigger as PlushTabsTrigger,
  Tooltip as PlushTooltip,
  TooltipContent as PlushTooltipContent,
  TooltipProvider as PlushTooltipProvider,
  TooltipTrigger as PlushTooltipTrigger,
};
