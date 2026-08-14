interface YujiContentStateProps {
  actionLabel?: string;
  className?: string;
  message: string;
  onRetry?: () => void;
  tone?: 'dark' | 'paper';
}

export default function YujiContentState({
  actionLabel = '重新试试',
  className = '',
  message,
  onRetry,
  tone = 'paper',
}: YujiContentStateProps) {
  return (
    <div
      className={`yuji-content-state is-${tone} ${className}`.trim()}
      role={onRetry ? 'alert' : 'status'}
    >
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
