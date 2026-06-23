import { useMemo } from 'react';
import { resourceToFinderItem } from '../../finder/data';
import { type BookmarkEntry, type RecentEntry, useBrowserStore } from '../../store/browserStore';
import { useResourceStore } from '../../store/resourceStore';
import EmptyState from '../../ui/EmptyState';
import PlushLoading from '../../ui/PlushLoading';
import SafariSection from './SafariSection';
import './SafariWindow.css';

const RECENTS_LIMIT = 12;
const BOOKMARKS_LIMIT = 12;

function entryHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function entryLabel(entry: { url: string; title: string | null }): string {
  const title = entry.title?.trim();
  if (title) return title;
  return entryHostname(entry.url);
}

function entryInitial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '·';
  return trimmed[0].toUpperCase();
}

interface RecentCardProps {
  entry: RecentEntry;
  onOpen: (url: string) => void;
  onRemove: (url: string) => void;
}

function RecentCard({ entry, onOpen, onRemove }: RecentCardProps) {
  const label = entryLabel(entry);
  const host = entryHostname(entry.url);
  return (
    <div className="safari-card">
      <button
        type="button"
        className="safari-card__hit"
        onClick={() => onOpen(entry.url)}
        title={entry.url}
      >
        <span className="safari-card__chip" aria-hidden>
          {entryInitial(label)}
        </span>
        <span className="safari-card__text">
          <span className="safari-card__title">{label}</span>
          <span className="safari-card__sub">{host}</span>
        </span>
      </button>
      <button
        type="button"
        className="safari-card__action"
        aria-label={`移除最近访问 ${label}`}
        title="从最近访问移除"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(entry.url);
        }}
      >
        ×
      </button>
    </div>
  );
}

interface BookmarkCardProps {
  entry: BookmarkEntry;
  onOpen: (url: string) => void;
  onRemove: (url: string) => void;
}

function BookmarkCard({ entry, onOpen, onRemove }: BookmarkCardProps) {
  const label = entryLabel(entry);
  const host = entryHostname(entry.url);
  return (
    <div className="safari-card">
      <button
        type="button"
        className="safari-card__hit"
        onClick={() => onOpen(entry.url)}
        title={entry.url}
      >
        <span className="safari-card__chip" aria-hidden>
          {entryInitial(label)}
        </span>
        <span className="safari-card__text">
          <span className="safari-card__title">{label}</span>
          <span className="safari-card__sub">{host}</span>
        </span>
      </button>
      <button
        type="button"
        className="safari-card__action"
        aria-label={`取消收藏 ${label}`}
        title="取消收藏"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(entry.url);
        }}
      >
        ★
      </button>
    </div>
  );
}

export default function SafariHome() {
  const resources = useResourceStore((s) => s.resources);
  const loading = useResourceStore((s) => s.loading);
  const error = useResourceStore((s) => s.error);

  const recents = useBrowserStore((s) => s.recents);
  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const openUrl = useBrowserStore((s) => s.openUrl);
  const removeRecent = useBrowserStore((s) => s.removeRecent);
  const removeBookmark = useBrowserStore((s) => s.removeBookmark);

  const shortcuts = useMemo(() => resources.slice(0, 8).map(resourceToFinderItem), [resources]);
  const visibleRecents = useMemo(() => recents.slice(0, RECENTS_LIMIT), [recents]);
  const visibleBookmarks = useMemo(() => bookmarks.slice(0, BOOKMARKS_LIMIT), [bookmarks]);

  let resourcesEmpty: React.ReactNode = null;
  if (loading) {
    resourcesEmpty = (
      <PlushLoading
        className="safari-browser__empty"
        title="正在载入资源"
        description="请稍候"
        variant="panel"
      />
    );
  } else if (error) {
    resourcesEmpty = (
      <EmptyState
        className="safari-browser__empty"
        icon="!"
        title="资源加载失败"
        description={error}
        tone="danger"
      />
    );
  } else if (shortcuts.length === 0) {
    resourcesEmpty = (
      <EmptyState
        className="safari-browser__empty"
        icon="◇"
        title="暂无资源"
        description="稍后再试"
      />
    );
  }

  return (
    <section className="safari-browser__home" aria-label="Safari 起始页">
      <div className="safari-browser__home-title">
        <div className="dock-app-window__eyebrow">Safari</div>
        <h2>起始页</h2>
      </div>

      <SafariSection id="resources" title="资源" empty={resourcesEmpty}>
        {shortcuts.length > 0 && (
          <div className="safari-browser__shortcuts">
            {shortcuts.map((item) => (
              <button
                type="button"
                key={item.id}
                className="safari-shortcut"
                onClick={() => openUrl(item.publicUrl ?? '')}
              >
                <img src={item.icon} alt="" aria-hidden />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        )}
      </SafariSection>

      <SafariSection id="recents" title="最近访问">
        {visibleRecents.length > 0 && (
          <div className="safari-cards">
            {visibleRecents.map((entry) => (
              <RecentCard key={entry.url} entry={entry} onOpen={openUrl} onRemove={removeRecent} />
            ))}
          </div>
        )}
      </SafariSection>

      <SafariSection id="bookmarks" title="收藏">
        {visibleBookmarks.length > 0 && (
          <div className="safari-cards">
            {visibleBookmarks.map((entry) => (
              <BookmarkCard
                key={entry.url}
                entry={entry}
                onOpen={openUrl}
                onRemove={removeBookmark}
              />
            ))}
          </div>
        )}
      </SafariSection>
    </section>
  );
}
