import { Calendar, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FormItem } from '@/components/FormItem';
import { cn } from '@/lib/utils';

const shelfLifeOptions = [
  { label: '7天', days: 7 },
  { label: '30天', days: 30 },
  { label: '90天', days: 90 },
  { label: '180天', days: 180 },
  { label: '365天', days: 365 },
];

type PantryExpiryDateFieldProps = {
  idPrefix: string;
  expiresAt: string;
  disabled?: boolean;
  initialBaseDate?: string;
  className?: string;
  onBaseDateChange?: (value: string) => void;
  onExpiresAtChange: (value: string) => void;
};

type DateInputWithClearProps = {
  id: string;
  value: string;
  disabled: boolean;
  clearLabel: string;
  onChange: (value: string) => void;
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function DateInputWithClear({
  id,
  value,
  disabled,
  clearLabel,
  onChange,
}: DateInputWithClearProps) {
  return (
    <div className="relative min-w-0">
      <input
        id={id}
        type="date"
        value={value}
        disabled={disabled}
        className={cn(
          'block h-11 min-w-0 w-full appearance-none rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-ring disabled:opacity-60',
          value ? 'pr-[4.25rem]' : 'pr-10',
          value
            ? '[&::-webkit-calendar-picker-indicator]:right-9'
            : '[&::-webkit-calendar-picker-indicator]:right-3',
          '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:z-10 [&::-webkit-calendar-picker-indicator]:size-7 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
        )}
        onChange={(event) => onChange(event.target.value)}
      />
      <Calendar
        className={cn(
          '-translate-y-1/2 pointer-events-none absolute top-1/2 size-4 text-foreground',
          value ? 'right-10' : 'right-3.5',
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          disabled={disabled}
          className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
          onClick={() => onChange('')}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function PantryExpiryDateField({
  idPrefix,
  expiresAt,
  disabled = false,
  initialBaseDate = '',
  className,
  onBaseDateChange,
  onExpiresAtChange,
}: PantryExpiryDateFieldProps) {
  const [baseDate, setBaseDate] = useState(initialBaseDate);
  const [customDays, setCustomDays] = useState('');

  useEffect(() => {
    setBaseDate(initialBaseDate);
  }, [initialBaseDate]);

  const updateBaseDate = (value: string) => {
    setBaseDate(value);
    onBaseDateChange?.(value);
  };

  const normalizedCustomDays = useMemo(() => {
    const parsed = Number.parseInt(customDays, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [customDays]);

  const applyShelfLife = (days: number) => {
    if (!baseDate) {
      return;
    }
    onExpiresAtChange(addDays(baseDate, days));
  };

  const canCalculate = Boolean(baseDate) && !disabled;

  return (
    <div
      className={cn(
        'space-y-4 rounded-[1.25rem] border border-border bg-card/95 p-4 shadow-sm shadow-background/20',
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">保质期</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            可用常见天数自动计算，也可以直接选择过期日期。
          </p>
        </div>
      </div>

      <FormItem label="生产/购买日期">
        <DateInputWithClear
          id={`${idPrefix}-base-date`}
          value={baseDate}
          disabled={disabled}
          clearLabel="清空生产或购买日期"
          onChange={(value) => updateBaseDate(value)}
        />
      </FormItem>

      <div className="grid grid-cols-5 gap-2 max-[390px]:grid-cols-3 max-[330px]:grid-cols-2">
        {shelfLifeOptions.map((option) => (
          <button
            key={option.days}
            type="button"
            disabled={!canCalculate}
            className={cn(
              'h-10 rounded-2xl border px-2 text-sm font-semibold transition',
              canCalculate
                ? 'cursor-pointer border-life-health/35 bg-life-health/10 text-life-health shadow-[0_8px_24px_rgba(245,158,11,0.08)] hover:border-life-health/60 hover:bg-life-health/15 hover:shadow-[0_10px_28px_rgba(245,158,11,0.12)]'
                : 'cursor-not-allowed border-border bg-background text-muted-foreground opacity-45',
            )}
            onClick={() => applyShelfLife(option.days)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_6rem] items-end gap-2 max-[360px]:grid-cols-1">
        <FormItem label="自定义天数">
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={customDays}
            disabled={disabled}
            placeholder="例如 180"
            className="block h-11 min-w-0 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-ring disabled:opacity-60"
            onChange={(event) => setCustomDays(event.target.value)}
          />
        </FormItem>
        <button
          type="button"
          disabled={!canCalculate || normalizedCustomDays <= 0}
          className="h-11 rounded-2xl border border-life-health/30 bg-life-health/10 px-3 text-sm font-semibold text-life-health transition hover:bg-life-health/15 disabled:border-border disabled:bg-background disabled:text-muted-foreground disabled:opacity-50"
          onClick={() => applyShelfLife(normalizedCustomDays)}
        >
          计算
        </button>
      </div>

      <FormItem label="过期日期">
        <DateInputWithClear
          id={`${idPrefix}-expires-at`}
          value={expiresAt}
          disabled={disabled}
          clearLabel="清空过期日期"
          onChange={onExpiresAtChange}
        />
      </FormItem>

      {!baseDate ? (
        <p className="text-xs leading-5 text-muted-foreground">
          不知道生产/购买日期时，可以直接在过期日期里手动选择。
        </p>
      ) : null}
    </div>
  );
}
