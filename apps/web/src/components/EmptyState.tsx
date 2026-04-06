import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** 操作文案，不传则不显示按钮 */
  actionLabel?: string;
  onAction?: () => void;
  /** 图标容器背景，默认跟随当前主题 */
  iconBg?: string;
  /** 图标颜色，默认跟随当前主题主色 */
  iconColor?: string;
  /** 外层留白，方便在不同空状态区块复用 */
  padding?: string;
  /** 允许页面覆盖 CTA 样式，但默认仍走主题按钮 */
  actionClassName?: string;
}

/** 通用空状态组件，默认跟随当前主题，适合个人中心与列表页复用 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  iconBg = 'bg-theme-soft',
  iconColor = 'text-theme-primary',
  padding = 'py-24',
  actionClassName = 'theme-btn-primary rounded-xl px-8 font-semibold',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${padding}`}>
      {/* 默认跟随当前主题，避免空状态按钮和图标永远固定成紫色 */}
      <div
        className={`mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full ${iconBg}`}
      >
        <Icon className={`h-12 w-12 ${iconColor}`} />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-slate-700">{title}</h3>
      {description ? (
        <p className="mb-6 max-w-xs leading-relaxed text-slate-500">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button onClick={onAction} className={actionClassName}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
