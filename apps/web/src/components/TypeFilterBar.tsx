interface FilterOption {
  label: string;
  value: string;
}

interface TypeFilterBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  /** 右侧额外内容（如总数统计） */
  extra?: React.ReactNode;
  /** 左侧前缀文字，默认不显示 */
  prefix?: string;
  className?: string;
}

/**
 * 通用分类筛选 Tab 条
 * MySpace / CreatorProfile 筛选栏共用
 */
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
      className={`flex items-center gap-3 bg-white rounded-2xl shadow-sm border border-theme-shell-border p-4 ${className}`}
    >
      {prefix && <span className="text-sm text-gray-500 font-medium mr-1">{prefix}</span>}
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-5 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
            value === opt.value
              ? 'bg-theme-primary text-white shadow-md shadow-theme-primary/30 scale-105'
              : 'bg-theme-soft text-theme-primary-hover hover:bg-theme-soft-strong hover:scale-105'
          }`}
        >
          {opt.label}
        </button>
      ))}
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}
