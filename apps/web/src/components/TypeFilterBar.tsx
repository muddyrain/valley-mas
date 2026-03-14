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
      className={`flex items-center gap-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${className}`}
    >
      {prefix && <span className="text-sm text-gray-500 font-medium mr-1">{prefix}</span>}
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-5 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
            value === opt.value
              ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30 scale-105'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:scale-105'
          }`}
        >
          {opt.label}
        </button>
      ))}
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}
