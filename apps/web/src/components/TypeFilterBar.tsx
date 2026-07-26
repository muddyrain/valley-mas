interface FilterOption {
  label: string;
  value: string;
}

interface TypeFilterBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  extra?: React.ReactNode;
  prefix?: string;
  className?: string;
}

export default function TypeFilterBar({
  options,
  value,
  onChange,
  extra,
  prefix,
  className = '',
}: TypeFilterBarProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-2 py-2 shadow-sm ${className}`}
    >
      {prefix && (
        <span className="mr-1 px-2 text-sm font-medium text-muted-foreground">{prefix}</span>
      )}
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`h-9 rounded-xl px-4 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
      {extra && (
        <div className="ml-1 border-l border-border pl-3 pr-2 text-sm text-muted-foreground">
          {extra}
        </div>
      )}
    </div>
  );
}
