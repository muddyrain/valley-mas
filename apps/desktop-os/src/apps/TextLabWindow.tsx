import { useMemo, useState } from 'react';
import { useToolStore } from '../store/toolStore';
import { calculateTextStats, transformText } from '../tools/miniTools';
import './MiniApps.css';

const ACTIONS = [
  { id: 'upper', label: '大写' },
  { id: 'lower', label: '小写' },
  { id: 'slug', label: 'Slug' },
  { id: 'trim', label: '清理空白' },
  { id: 'encode', label: 'URL 编码' },
  { id: 'decode', label: 'URL 解码' },
];

export default function TextLabWindow() {
  const draft = useToolStore((s) => s.textLabDraft);
  const setDraft = useToolStore((s) => s.setTextLabDraft);
  const [status, setStatus] = useState('就绪');
  const stats = useMemo(() => calculateTextStats(draft), [draft]);

  async function copyText() {
    await navigator.clipboard?.writeText(draft);
    setStatus('已复制');
  }

  function applyAction(action: string) {
    setDraft(transformText(draft, action));
    setStatus('已处理');
  }

  return (
    <div className="dock-app-window mini-app text-lab-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>文本工坊</h2>
        </div>
        <span className="dock-app-window__badge">{status}</span>
      </header>

      <textarea
        className="mini-input mini-input--textarea text-lab-window__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="粘贴文本"
        spellCheck={false}
      />

      <div className="text-lab-stats">
        <span>字符 {stats.characters}</span>
        <span>无空格 {stats.charactersNoSpaces}</span>
        <span>词数 {stats.words}</span>
        <span>行数 {stats.lines}</span>
      </div>

      <section className="mini-app__panel">
        <div className="tool-grid">
          {ACTIONS.map((action) => (
            <button
              type="button"
              key={action.id}
              className="mini-tool-button"
              onClick={() => applyAction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="mini-actions">
          <button type="button" className="dock-app-window__button" onClick={copyText}>
            复制
          </button>
          <button type="button" className="mini-app__secondary" onClick={() => setDraft('')}>
            清空
          </button>
        </div>
      </section>
    </div>
  );
}
