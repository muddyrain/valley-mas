import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
        'space-y-3 rounded-[1.25rem] border border-border bg-secondary/60 p-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">保质期</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            可以选常见天数自动计算，也可以直接选择过期日期。
          </p>
        </div>
        {expiresAt ? (
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-life-ai transition hover:bg-background/70 disabled:opacity-50"
            onClick={() => onExpiresAtChange('')}
          >
            清空
          </button>
        ) : null}
      </div>

      <label className="block min-w-0 space-y-2">
        <span className="text-sm font-medium">生产/购买日期</span>
        <input
          id={`${idPrefix}-base-date`}
          type="date"
          value={baseDate}
          disabled={disabled}
          className="block h-11 min-w-0 w-full appearance-none rounded-2xl border border-border bg-card px-4 text-sm outline-none transition focus:border-ring disabled:opacity-60"
          onChange={(event) => updateBaseDate(event.target.value)}
        />
      </label>

      <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-2">
        {shelfLifeOptions.map((option) => (
          <button
            key={option.days}
            type="button"
            disabled={!canCalculate}
            className="h-10 rounded-2xl border border-border bg-card px-2 text-sm font-semibold text-muted-foreground transition hover:border-life-health/40 hover:text-life-health disabled:opacity-45 disabled:hover:border-border disabled:hover:text-muted-foreground"
            onClick={() => applyShelfLife(option.days)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7.25rem] gap-2 max-[360px]:grid-cols-1">
        <label className="block min-w-0 space-y-2">
          <span className="text-sm font-medium">自定义天数</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={customDays}
            disabled={disabled}
            placeholder="例如 180"
            className="block h-11 min-w-0 w-full rounded-2xl border border-border bg-card px-4 text-sm outline-none transition focus:border-ring disabled:opacity-60"
            onChange={(event) => setCustomDays(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!canCalculate || normalizedCustomDays <= 0}
          className="mt-7 h-11 rounded-2xl border border-life-health/30 bg-life-health/10 px-3 text-sm font-semibold text-life-health transition hover:bg-life-health/15 disabled:border-border disabled:bg-card disabled:text-muted-foreground disabled:opacity-50 max-[360px]:mt-0"
          onClick={() => applyShelfLife(normalizedCustomDays)}
        >
          计算
        </button>
      </div>

      <label className="block min-w-0 space-y-2">
        <span className="text-sm font-medium">过期日期</span>
        <div className="relative min-w-0">
          <input
            id={`${idPrefix}-expires-at`}
            type="date"
            value={expiresAt}
            disabled={disabled}
            className="block h-11 min-w-0 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-11 text-sm outline-none transition focus:border-ring disabled:opacity-60"
            onChange={(event) => onExpiresAtChange(event.target.value)}
          />
          {expiresAt ? (
            <button
              type="button"
              aria-label="清空过期日期"
              disabled={disabled}
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-background/70 hover:text-foreground disabled:opacity-50"
              onClick={() => onExpiresAtChange('')}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </label>

      {!baseDate ? (
        <p className="text-xs leading-5 text-muted-foreground">
          不知道生产/购买日期时，可以直接在过期日期里手动选择。
        </p>
      ) : null}
    </div>
  );
}
