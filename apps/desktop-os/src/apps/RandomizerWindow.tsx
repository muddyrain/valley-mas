import { useMemo, useState } from 'react';
import { type RandomizerMode, useToolStore } from '../store/toolStore';
import './MiniApps.css';

const MODES: Array<{ id: RandomizerMode; label: string }> = [
  { id: 'list', label: '抽签' },
  { id: 'dice', label: '骰子' },
  { id: 'coin', label: '硬币' },
];

export default function RandomizerWindow() {
  const mode = useToolStore((s) => s.randomizerMode);
  const items = useToolStore((s) => s.randomizerItems);
  const history = useToolStore((s) => s.randomizerHistory);
  const setMode = useToolStore((s) => s.setRandomizerMode);
  const setItems = useToolStore((s) => s.setRandomizerItems);
  const addHistory = useToolStore((s) => s.addRandomizerHistory);
  const clearHistory = useToolStore((s) => s.clearRandomizerHistory);
  const [draft, setDraft] = useState(items.join('\n'));
  const [result, setResult] = useState('');
  const cleanItems = useMemo(
    () =>
      draft
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    [draft],
  );

  function roll() {
    let next = '';
    if (mode === 'dice') next = String(Math.floor(Math.random() * 6) + 1);
    if (mode === 'coin') next = Math.random() > 0.5 ? '正面' : '反面';
    if (mode === 'list') {
      const pool = cleanItems.length > 0 ? cleanItems : items;
      next = pool[Math.floor(Math.random() * pool.length)] ?? '暂无选项';
      setItems(pool);
    }
    setResult(next);
    addHistory(mode, next);
  }

  return (
    <div className="dock-app-window mini-app randomizer-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>抽签罐</h2>
        </div>
        <span className="dock-app-window__badge">{modeLabel(mode)}</span>
      </header>

      <fieldset className="mini-segmented">
        <legend className="mini-app__sr-only">抽取模式</legend>
        {MODES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === mode ? 'is-active' : ''}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </fieldset>

      {mode === 'list' ? (
        <textarea
          className="randomizer-window__textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
        />
      ) : null}

      <section className="randomizer-window__result" aria-label="抽取结果">
        <span>结果</span>
        <strong>{result || '等待抽取'}</strong>
      </section>

      <div className="mini-actions">
        <button type="button" className="dock-app-window__button" onClick={roll}>
          开始
        </button>
        {history.length > 0 ? (
          <button type="button" className="mini-app__secondary" onClick={clearHistory}>
            清除记录
          </button>
        ) : null}
      </div>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>最近结果</span>
        </div>
        <div className="mini-list">
          {history.length === 0 ? (
            <span className="mini-list__empty">暂无记录</span>
          ) : (
            history.slice(0, 5).map((item) => (
              <div key={item.id} className="mini-list__row">
                <span>{modeLabel(item.mode)}</span>
                <strong>{item.result}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function modeLabel(mode: RandomizerMode) {
  if (mode === 'dice') return '骰子';
  if (mode === 'coin') return '硬币';
  return '抽签';
}
