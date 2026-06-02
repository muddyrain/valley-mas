import { Check, ChevronRight, X } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PickerOption<T extends string> = {
  label: string;
  value: T;
  description?: string;
};

type OptionPickerSheetProps<T extends string> = {
  open: boolean;
  title: string;
  description?: string;
  value: T;
  options: PickerOption<T>[];
  onOpenChange: (open: boolean) => void;
  onSelect: (value: T) => void;
};

export function OptionPickerSheet<T extends string>({
  open,
  title,
  description,
  value,
  options,
  onOpenChange,
  onSelect,
}: OptionPickerSheetProps<T>) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel={`关闭${title}选择器`}
      zIndexClassName="z-[70]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="size-5" />
        </Button>
      </div>

      <div className="space-y-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-[1.25rem] border px-4 py-3 text-left transition',
                active
                  ? 'border-life-ai/35 bg-life-ai/10 text-foreground'
                  : 'border-border bg-secondary text-foreground',
              )}
              onClick={() => {
                onSelect(option.value);
                onOpenChange(false);
              }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{option.label}</p>
                {option.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                ) : null}
              </div>
              {active ? (
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-life-ai text-background">
                  <Check className="size-4" />
                </div>
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-4 w-full"
        onClick={() => onOpenChange(false)}
      >
        取消
      </Button>
    </BottomSheet>
  );
}
