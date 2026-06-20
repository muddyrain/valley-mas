import { useEffect, useState } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useToolStore } from '../store/toolStore';
import { createTidyItems, type TidyCategory, type TidyItem, tidyScore } from '../tools/gameLogic';
import './MiniApps.css';

const ZONES: Array<{ id: TidyCategory; label: string }> = [
  { id: 'focus', label: '专注区' },
  { id: 'tools', label: '工具区' },
  { id: 'fun', label: '娱乐区' },
];

export default function DeskTidyWindow() {
  const [items, setItems] = useState<TidyItem[]>(() => createTidyItems());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [running, setRunning] = useState(false);
  const best = useToolStore((s) => s.deskTidyBest);
  const recordBest = useToolStore((s) => s.recordDeskTidyBest);
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);
  const bestScore = best?.score ?? 0;
  const sortedCount = items.filter((item) => item.sorted).length;
  const complete = sortedCount === items.length;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    if (timeLeft > 0 && !complete) return;
    setRunning(false);
    recordBest(score);
    pushNotification({
      app: '桌面收纳',
      title: complete ? '收纳完成' : '时间到',
      body: `${score} 分`,
    });
  }, [complete, pushNotification, recordBest, running, score, timeLeft]);

  function restart() {
    setItems(createTidyItems());
    setSelectedId(null);
    setScore(0);
    setTimeLeft(30);
    setRunning(true);
  }

  function sortItem(itemId: string, zone: TidyCategory) {
    if (!running) return;
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || item.sorted) return;
    setScore((value) => tidyScore(value, item.category, zone));
    if (item.category === zone) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, sorted: true } : candidate,
        ),
      );
    }
    setSelectedId(null);
  }

  return (
    <div className="dock-app-window mini-app desk-tidy-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小游戏</div>
          <h2>桌面收纳</h2>
        </div>
        <button type="button" className="dock-app-window__button" onClick={restart}>
          {running ? '重开' : '开始'}
        </button>
      </header>

      <div className="game-stats">
        <span>时间 {timeLeft}s</span>
        <span>分数 {score}</span>
        <span>最佳 {bestScore}</span>
      </div>

      <section className="tidy-desk" aria-label="待收纳物品">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            draggable={!item.sorted}
            className={`tidy-item ${selectedId === item.id ? 'is-selected' : ''} ${
              item.sorted ? 'is-sorted' : ''
            }`}
            onClick={() => setSelectedId(item.sorted ? null : item.id)}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', item.id);
              setSelectedId(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section className="tidy-zones" aria-label="收纳区域">
        {ZONES.map((zone) => (
          <button
            type="button"
            key={zone.id}
            className="tidy-zone"
            onClick={() => {
              if (selectedId) sortItem(selectedId, zone.id);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              sortItem(e.dataTransfer.getData('text/plain'), zone.id);
            }}
          >
            {zone.label}
          </button>
        ))}
      </section>

      {!running && score > 0 ? <div className="game-complete">本局 {score} 分</div> : null}
    </div>
  );
}
