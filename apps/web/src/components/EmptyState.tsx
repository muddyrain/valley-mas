import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** 操作按钮文字，不传则不显示按钮 */
  actionLabel?: string;
  onAction?: () => void;
  /** 图标容器背景色，默认 bg-purple-100 */
  iconBg?: string;
  /** 图标颜色，默认 text-purple-400 */
  iconColor?: string;
  /** 外层容器的 padding，默认 py-24 */
  padding?: string;
}

/**
 * 通用空状态组件（暂无数据、加载失败等场景）
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  iconBg = 'bg-purple-100',
  iconColor = 'text-purple-400',
  padding = 'py-24',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${padding} text-center`}>
      <div
        className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${iconBg} mb-6`}
      >
        <Icon className={`h-12 w-12 ${iconColor}`} />
      </div>
      <h3 className="text-xl font-semibold text-gray-700 mb-2">{title}</h3>
      {description && <p className="text-gray-400 mb-6 max-w-xs leading-relaxed">{description}</p>}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 rounded-xl font-semibold shadow-md"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
