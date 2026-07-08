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
      className={`inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/80 backdrop-blur-sm p-1.5 shadow-sm ${className}`}
    >
      {prefix && (
        <span className="mr-1.5 px-2 text-sm font-medium text-muted-foreground">{prefix}</span>
      )}
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:bg-accent hover:text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
      {extra && <div className="ml-2">{extra}</div>}
    </div>
  );
}
