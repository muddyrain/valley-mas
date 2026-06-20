import { useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultWindowOptions } from '../apps/desktopApps';
import { useBrowserStore } from '../store/browserStore';
import { useFinderStore } from '../store/finderStore';
import { useResourceStore } from '../store/resourceStore';
import { useSpotlightStore } from '../store/spotlightStore';
import { useWindowStore } from '../store/windowStore';
import { type SpotlightItem, searchSpotlight } from './data';
import './Spotlight.css';

export default function Spotlight() {
  const isOpen = useSpotlightStore((s) => s.isOpen);
  const close = useSpotlightStore((s) => s.close);
  const revealFinderItem = useFinderStore((s) => s.revealItem);
  const openBrowserUrl = useBrowserStore((s) => s.openUrl);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const resources = useResourceStore((s) => s.resources);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchSpotlight(query, resources), [query, resources]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  function updateQuery(next: string) {
    setQuery(next);
    setActiveIndex(0);
  }

  function runItem(item: SpotlightItem) {
    switch (item.action.type) {
      case 'open-app':
        restoreOrFocus(item.action.appId, getDefaultWindowOptions(item.action.appId));
        break;
      case 'open-finder':
        revealFinderItem(item.action.path, item.action.selectedId);
        restoreOrFocus('finder', getDefaultWindowOptions('finder'));
        break;
      case 'calc':
        // 计算结果点击：暂时复制到查询框作为反馈
        updateQuery(item.action.result);
        return;
      case 'web-search':
        openBrowserUrl(item.action.query);
        restoreOrFocus('safari', getDefaultWindowOptions('safari'));
        break;
    }
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i + 1) % results.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) runItem(item);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="spotlight"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="spotlight__panel" role="dialog" aria-label="Spotlight 搜索">
        <div className="spotlight__searchbar">
          <span className="spotlight__icon" aria-hidden>
            🔍
          </span>
          <input
            ref={inputRef}
            className="spotlight__input"
            type="text"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Spotlight 搜索"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {results.length > 0 && (
          <ul className="spotlight__results">
            {results.map((item, i) => (
              <li
                key={item.id}
                className={`spotlight__row ${i === activeIndex ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => runItem(item)}
              >
                <img className="spotlight__row-icon" src={item.icon} alt="" />
                <div className="spotlight__row-text">
                  <span className="spotlight__row-title">{item.title}</span>
                  {item.subtitle && (
                    <span className="spotlight__row-subtitle">{item.subtitle}</span>
                  )}
                </div>
                <span className="spotlight__row-kind">{kindLabel(item.kind)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function kindLabel(kind: SpotlightItem['kind']) {
  switch (kind) {
    case 'app':
      return '应用';
    case 'folder':
      return '文件夹';
    case 'resource':
      return '资源';
    case 'calc':
      return '计算';
    case 'web':
      return '网页';
  }
}
