import type { ReactNode } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  tone?: 'neutral' | 'danger';
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon = '✦',
  title,
  description,
  tone = 'neutral',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`empty-state empty-state--${tone} ${action ? 'empty-state--has-action' : ''} ${className}`.trim()}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <div className="empty-state__icon" aria-hidden>
        {icon}
      </div>
      <div className="empty-state__text">
        <div className="empty-state__title">{title}</div>
        {description ? <div className="empty-state__description">{description}</div> : null}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
