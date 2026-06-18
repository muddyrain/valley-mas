import { useEffect, useMemo, useRef, useState } from 'react';
import { useSpotlightStore } from '../store/spotlightStore';
import { useWindowStore } from '../store/windowStore';
import { type SpotlightItem, searchSpotlight } from './data';
import './Spotlight.css';

export default function Spotlight() {
  const isOpen = useSpotlightStore((s) => s.isOpen);
  const close = useSpotlightStore((s) => s.close);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchSpotlight(query), [query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function runItem(item: SpotlightItem) {
    switch (item.action.type) {
      case 'open-app':
        restoreOrFocus(item.action.appId);
        break;
      case 'open-folder':
        openWindow('about', { title: `${item.action.name}`, width: 560, height: 380 });
        break;
      case 'calc':
        // 计算结果点击：暂时复制到查询框作为反馈
        setQuery(item.action.result);
        return;
      case 'web-search':
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(item.action.query)}`,
          '_blank',
        );
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
            onChange={(e) => setQuery(e.target.value)}
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
    case 'calc':
      return '计算';
    case 'web':
      return '网页';
  }
}
