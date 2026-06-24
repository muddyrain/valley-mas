import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogEvent, LogEventCategory } from '@/shared/types';
import { formatGameTime, LOG_CATEGORY_LABEL } from '@/shared/types';
import { useWorldSimStore } from '@/state';
import styles from './LogPanel.module.css';

type CategoryFilter = LogEventCategory | 'all';

const FILTERS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'occupy', label: '占领' },
  { key: 'lose', label: '失地' },
  { key: 'eliminate', label: '灭国' },
  { key: 'victory', label: '统一' },
];

export function LogPanel() {
  const logs = useWorldSimStore((s) => s.logs);
  const clearLogs = useWorldSimStore((s) => s.clearLogs);

  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  const filtered = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((log) => log.category === filter);
  }, [logs, filter]);

  const listRef = useRef<HTMLOListElement | null>(null);
  const lastSeenLength = useRef(0);

  useEffect(() => {
    if (!autoScroll) return;
    const el = listRef.current;
    if (!el) return;
    if (filtered.length !== lastSeenLength.current) {
      el.scrollTop = el.scrollHeight;
      lastSeenLength.current = filtered.length;
    }
  }, [filtered, autoScroll]);

  // 用户主动滚动时，如果离底太远，关闭自动滚；又滚回底部就自动恢复
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom > 24) {
      if (autoScroll) setAutoScroll(false);
    } else if (!autoScroll) {
      setAutoScroll(true);
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <span className={styles.title}>事件日志</span>
        <span className={styles.muted}>
          {filtered.length}/{logs.length} 条
        </span>
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={styles.filterBtn}
              data-active={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className={styles.spacer} />
        <label className={styles.autoScroll}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          自动滚动
        </label>
        <button type="button" onClick={clearLogs} disabled={logs.length === 0}>
          清空
        </button>
      </header>
      <ol className={styles.list} ref={listRef} onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <li className={styles.empty}>
            {logs.length === 0
              ? '暂无事件。开始推演后会写入占领 / 失地 / 灭国 / 统一等记录。'
              : '当前过滤下没有匹配条目。'}
          </li>
        ) : (
          filtered.map((log: LogEvent) => (
            <li key={log.id} className={styles.item} data-level={log.level}>
              <span className={styles.tick}>{formatGameTime(log.tick)}</span>
              <span className={styles.category} data-category={log.category ?? 'misc'}>
                {log.category ? LOG_CATEGORY_LABEL[log.category] : '事件'}
              </span>
              <span className={styles.message}>{log.message}</span>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
