import './EmptyState.css';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  tone?: 'neutral' | 'danger';
  className?: string;
}

export default function EmptyState({
  icon = '✦',
  title,
  description,
  tone = 'neutral',
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state--${tone} ${className}`}>
      <div className="empty-state__icon" aria-hidden>
        {icon}
      </div>
      <div className="empty-state__text">
        <div className="empty-state__title">{title}</div>
        {description ? <div className="empty-state__description">{description}</div> : null}
      </div>
    </div>
  );
}
