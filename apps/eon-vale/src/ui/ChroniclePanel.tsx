import { History, MapPin, X } from 'lucide-react';
import type {
  WorldEvent,
  WorldHistoryArchive,
  WorldHistoryEntry,
  WorldHistoryFilter,
  WorldHistoryLink,
} from '@/shared/gameTypes';

const FILTERS: Array<{ value: WorldHistoryFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'kingdom', label: '王国' },
  { value: 'village', label: '村庄' },
  { value: 'population', label: '人口' },
  { value: 'ecology', label: '生态' },
  { value: 'disaster', label: '灾难' },
  { value: 'favorites', label: '收藏人物' },
];

export function ChroniclePanel({
  archive,
  filter,
  notifications,
  onFilter,
  onNavigate,
  onClose,
}: {
  archive: WorldHistoryArchive | null;
  filter: WorldHistoryFilter;
  notifications: WorldEvent[];
  onFilter: (filter: WorldHistoryFilter) => void;
  onNavigate: (link: WorldHistoryLink, event: WorldHistoryEntry) => void;
  onClose: () => void;
}) {
  return (
    <aside className="chronicle-panel history-archive" data-testid="history-archive">
      <div className="chronicle-heading">
        <span>
          <small>世界纪事</small>
          <strong>历史档案</strong>
        </span>
        <button type="button" onClick={onClose} aria-label="收起历史档案">
          <X size={15} />
        </button>
      </div>
      {notifications.length > 0 && (
        <section className="history-notices" aria-label="重要通知">
          <small>重要通知</small>
          {notifications
            .slice(-3)
            .reverse()
            .map((event) => (
              <span key={event.id}>{event.message}</span>
            ))}
        </section>
      )}
      <div className="history-filters" role="tablist" aria-label="历史分类">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            className={filter === item.value ? 'active' : ''}
            onClick={() => onFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="history-event-list">
        {archive?.entries.map((event) => (
          <article key={event.id} data-testid={`history-event-${event.id}`}>
            <span className="history-event-date">第 {Math.floor(event.tick / 20)} 日</span>
            <strong>{event.message}</strong>
            {event.links.length > 0 && (
              <div className="history-links">
                {event.links.map((link, index) => (
                  <button
                    key={`${link.kind}-${link.lifeId ?? link.id ?? link.warId ?? link.cell}-${index}`}
                    type="button"
                    data-testid={`history-link-${link.kind}-${link.lifeId ?? link.id ?? link.warId ?? link.cell}`}
                    disabled={!link.available}
                    onClick={() => onNavigate(link, event)}
                  >
                    {link.kind === 'location' ? <MapPin size={10} /> : <History size={10} />}
                    {link.label}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
        {archive && archive.entries.length === 0 && (
          <p>{filter === 'favorites' ? '收藏人物还没有经历记录。' : '这个分类还没有历史事实。'}</p>
        )}
        {!archive && <p>正在整理档案……</p>}
      </div>
    </aside>
  );
}
