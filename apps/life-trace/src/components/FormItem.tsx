import { ChevronDown, type LucideIcon, X } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode, useState } from 'react';
import { OptionPickerSheet } from '@/components/OptionPickerSheet';
import { Button } from '@/components/ui/button';
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

export function PickerFieldButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'h-11 min-w-0 w-full rounded-2xl border border-border bg-secondary px-4 text-left text-sm outline-none transition hover:bg-secondary/80 focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate">{children}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </span>
    </button>
  );
}

type SheetHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  onClose: () => void;
  closeDisabled?: boolean;
  className?: string;
};

export function SheetHeader({
  title,
  description,
  meta,
  icon: Icon,
  iconClassName,
  onClose,
  closeDisabled = false,
  className,
}: SheetHeaderProps) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai',
              iconClassName,
            )}
          >
            <Icon className="size-5" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          {meta ? <p className="mt-2 text-xs font-medium text-life-ai">{meta}</p> : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={closeDisabled}
        data-sheet-drag-ignore="true"
        onClick={onClose}
      >
        <X className="size-5" />
        <span className="sr-only">关闭</span>
      </Button>
    </div>
  );
}

type SheetActionsProps = {
  children: ReactNode;
  className?: string;
};

export function SheetActions({ children, className }: SheetActionsProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 pt-2 max-[360px]:grid-cols-1', className)}>
      {children}
    </div>
  );
}

type SheetSelectOption<T extends string> = {
  label: string;
  value: T;
  description?: string;
};

type SheetSelectFieldProps<T extends string> = Omit<FormItemProps, 'children'> & {
  value: T;
  options: ReadonlyArray<SheetSelectOption<T>>;
  onValueChange: (value: T) => void;
  pickerTitle?: string;
  pickerDescription?: string;
  disabled?: boolean;
  triggerClassName?: string;
};

type SheetSelectButtonProps<T extends string> = {
  value: T;
  options: ReadonlyArray<SheetSelectOption<T>>;
  onValueChange: (value: T) => void;
  pickerTitle: string;
  pickerDescription?: string;
  disabled?: boolean;
  className?: string;
};

export function SheetSelectButton<T extends string>({
  value,
  options,
  onValueChange,
  pickerTitle,
  pickerDescription,
  disabled = false,
  className,
}: SheetSelectButtonProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <PickerFieldButton disabled={disabled} className={className} onClick={() => setOpen(true)}>
        {selected?.label ?? value}
      </PickerFieldButton>
      <OptionPickerSheet
        open={open}
        title={pickerTitle}
        description={pickerDescription}
        value={value}
        options={[...options]}
        onOpenChange={setOpen}
        onSelect={onValueChange}
      />
    </>
  );
}

export function SheetSelectField<T extends string>({
  label,
  value,
  options,
  onValueChange,
  pickerTitle,
  pickerDescription,
  disabled = false,
  triggerClassName,
  ...formItemProps
}: SheetSelectFieldProps<T>) {
  return (
    <FormItem label={label} {...formItemProps}>
      <SheetSelectButton
        disabled={disabled}
        className={triggerClassName}
        value={value}
        options={options}
        pickerTitle={pickerTitle ?? (typeof label === 'string' ? label : '选择')}
        pickerDescription={pickerDescription}
        onValueChange={onValueChange}
      />
    </FormItem>
  );
}
