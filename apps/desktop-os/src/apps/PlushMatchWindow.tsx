import { useEffect, useState } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { formatTimer, useToolStore } from '../store/toolStore';
import {
  createMatchDeck,
  hideUnmatchedCards,
  type MatchCard,
  markMatchedCards,
  revealMatchCard,
} from '../tools/gameLogic';
import './MiniApps.css';

export default function PlushMatchWindow() {
  const [cards, setCards] = useState<MatchCard[]>(() => createMatchDeck());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const best = useToolStore((s) => s.plushMatchBest);
  const recordBest = useToolStore((s) => s.recordPlushMatchBest);
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);
  const complete = cards.every((card) => card.matched);
  const seconds = Math.floor((now - startedAt) / 1000);

  useEffect(() => {
    if (complete) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [complete]);

  useEffect(() => {
    if (!complete || moves === 0) return;
    recordBest(moves, seconds);
    pushNotification({
      app: '毛绒配对',
      title: '配对完成',
      body: `${moves} 步 · ${formatTimer(seconds)}`,
    });
  }, [complete, moves, pushNotification, recordBest, seconds]);

  function restart() {
    setCards(createMatchDeck());
    setSelectedIds([]);
    setMoves(0);
    setStartedAt(Date.now());
    setNow(Date.now());
  }

  function choose(card: MatchCard) {
    if (complete || card.revealed || card.matched || selectedIds.length >= 2) return;
    const nextIds = [...selectedIds, card.id];
    const nextCards = revealMatchCard(cards, card.id);
    setCards(nextCards);
    setSelectedIds(nextIds);

    if (nextIds.length !== 2) return;
    setMoves((value) => value + 1);
    const [a, b] = nextCards.filter((item) => nextIds.includes(item.id));
    if (a?.pairId && a.pairId === b?.pairId) {
      window.setTimeout(() => {
        setCards((items) => markMatchedCards(items, a.pairId));
        setSelectedIds([]);
      }, 260);
      return;
    }
    window.setTimeout(() => {
      setCards((items) => hideUnmatchedCards(items, [a.pairId, b.pairId]));
      setSelectedIds([]);
    }, 720);
  }

  return (
    <div className="dock-app-window mini-app plush-match-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小游戏</div>
          <h2>毛绒配对</h2>
        </div>
        <button type="button" className="mini-app__secondary" onClick={restart}>
          重开
        </button>
      </header>

      <div className="game-stats">
        <span>步数 {moves}</span>
        <span>用时 {formatTimer(seconds)}</span>
        <span>最佳 {best?.moves ? `${best.moves} 步` : '暂无'}</span>
      </div>

      <fieldset className="match-board">
        <legend className="mini-app__sr-only">毛绒配对棋盘</legend>
        {cards.map((card) => (
          <button
            type="button"
            key={card.id}
            className={`match-card ${card.revealed || card.matched ? 'is-open' : ''}`}
            onClick={() => choose(card)}
            aria-label={card.matched ? '已配对' : '翻开卡片'}
          >
            <span className="match-card__inner">
              <span className="match-card__face match-card__front">
                <i />
              </span>
              <span className="match-card__face match-card__back">
                <img src={card.image} alt="" />
              </span>
            </span>
          </button>
        ))}
      </fieldset>

      {complete ? <div className="game-complete">完成</div> : null}
    </div>
  );
}
