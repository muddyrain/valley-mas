import { CheckCircle2, type LucideIcon } from 'lucide-react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { cn } from '@/lib/utils';

type SettingInputProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: 'ai' | 'trace' | 'health' | 'plan';
  placeholder?: string;
  type?: 'text' | 'time';
  onChange: (value: string) => void;
};

const toneClasses = {
  ai: {
    icon: 'bg-life-ai/10 text-life-ai',
    border: 'focus-within:border-life-ai/60 focus-within:shadow-[0_0_28px_rgba(6,182,212,0.12)]',
  },
  trace: {
    icon: 'bg-life-trace/10 text-life-trace',
    border:
      'focus-within:border-life-trace/60 focus-within:shadow-[0_0_28px_rgba(16,185,129,0.12)]',
  },
  health: {
    icon: 'bg-life-health/10 text-life-health',
    border:
      'focus-within:border-life-health/60 focus-within:shadow-[0_0_28px_rgba(245,158,11,0.12)]',
  },
  plan: {
    icon: 'bg-life-plan/10 text-life-plan',
    border: 'focus-within:border-life-plan/60 focus-within:shadow-[0_0_28px_rgba(139,92,246,0.12)]',
  },
};

export function SettingInput({
  label,
  value,
  icon: Icon,
  tone,
  placeholder,
  type = 'text',
  onChange,
}: SettingInputProps) {
  return (
    <label
      className={cn(
        'group block rounded-[1.35rem] border border-border bg-card/80 p-4 transition duration-300',
        'hover:border-foreground/20 hover:bg-card',
        toneClasses[tone].border,
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-2xl transition group-focus-within:scale-105',
            toneClasses[tone].icon,
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
          {type === 'time' ? (
            <span className="relative mt-1 block h-7">
              <span className="block h-7 truncate text-base font-semibold text-foreground">
                {value || placeholder}
              </span>
              <input
                type="time"
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                step={60}
                className="absolute inset-0 h-7 w-full cursor-pointer opacity-0"
              />
            </span>
          ) : (
            <input
              type={type}
              value={value}
              placeholder={placeholder}
              onChange={(event) => onChange(event.target.value)}
              className="mt-1 h-7 w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
          )}
        </span>
      </span>
    </label>
  );
}

export function SettingToggle({
  label,
  detail,
  active,
  icon: Icon,
  onToggle,
}: {
  label: string;
  detail: string;
  active: boolean;
  icon: LucideIcon;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'group flex w-full items-center justify-between gap-4 rounded-[1.35rem] border p-4 text-left transition duration-300',
        active
          ? 'border-life-trace/35 bg-life-trace/10 shadow-[0_18px_52px_rgba(16,185,129,0.08)]'
          : 'border-border bg-card/80 hover:border-foreground/20 hover:bg-card',
      )}
      onClick={onToggle}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-2xl transition duration-300 group-hover:scale-105',
            active ? 'bg-life-trace text-background' : 'bg-secondary text-muted-foreground',
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{label}</span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">{detail}</span>
        </span>
      </span>
      <span
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-full p-1 transition duration-300',
          active ? 'bg-life-trace' : 'bg-secondary',
        )}
      >
        <span
          className={cn(
            'block size-6 rounded-full bg-foreground transition duration-300',
            active ? 'translate-x-6 bg-background shadow-[0_0_18px_rgba(250,250,250,0.25)]' : '',
          )}
        />
      </span>
    </button>
  );
}

export function SegmentedOption<T extends string>({
  value,
  label,
  detail,
  active,
  onSelect,
}: {
  value: T;
  label: string;
  detail?: string;
  active: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'min-h-16 rounded-[1.1rem] border px-3 py-2 text-left transition duration-300',
        active
          ? 'border-life-ai/45 bg-life-ai/10 text-life-ai shadow-[0_14px_42px_rgba(6,182,212,0.08)]'
          : 'border-border bg-card/80 text-muted-foreground hover:border-foreground/20 hover:bg-card',
      )}
      aria-pressed={active}
      onClick={() => onSelect(value)}
    >
      <span className="block text-sm font-semibold">{label}</span>
      {detail ? (
        <span className="mt-1 block text-xs leading-4 text-muted-foreground">{detail}</span>
      ) : null}
    </button>
  );
}

export function SyncStatus({
  loading,
  saving,
  error,
}: {
  loading: boolean;
  saving: boolean;
  error: string;
}) {
  if (!loading && !saving && !error) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-life-trace/25 bg-life-trace/10 px-3 py-1.5 text-xs font-semibold text-life-trace">
        <CheckCircle2 className="size-3.5" />
        云端已同步
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full border px-3 py-1.5 text-xs font-semibold',
        error
          ? 'border-life-alert/35 bg-life-alert/10 text-life-alert'
          : 'border-life-ai/30 bg-life-ai/10 text-life-ai',
      )}
    >
      {!error ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 -left-1/2 w-1/2 animate-[life-profile-sheen_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/15 to-transparent motion-reduce:animate-none"
        />
      ) : null}
      <span className="relative flex items-center gap-2">
        {error ? null : <ActionLoadingIcon tone="ai" />}
        {error ? error : loading ? '同步云端偏好' : '保存偏好中'}
      </span>
    </div>
  );
}
