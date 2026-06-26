import { useMemo, useState } from 'react';
import { useToolStore } from '../store/toolStore';
import './MiniApps.css';

export default function ClipboardWindow() {
  const snippets = useToolStore((s) => s.clipboardSnippets);
  const addSnippet = useToolStore((s) => s.addClipboardSnippet);
  const removeSnippet = useToolStore((s) => s.removeClipboardSnippet);
  const togglePinned = useToolStore((s) => s.toggleClipboardSnippetPinned);
  const clearSnippets = useToolStore((s) => s.clearClipboardSnippets);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('待保存');
  const sortedSnippets = useMemo(
    () =>
      [...snippets].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt,
      ),
    [snippets],
  );

  async function readClipboard() {
    try {
      const text = await navigator.clipboard?.readText();
      if (!text) {
        setStatus('剪贴板为空');
        return;
      }
      setDraft(text);
      addSnippet(text);
      setStatus('已读取');
    } catch {
      setStatus('读取被拒绝');
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard?.writeText(text);
    setStatus('已复制');
  }

  function saveDraft() {
    addSnippet(draft);
    setDraft('');
    setStatus('已保存');
  }

  return (
    <div className="dock-app-window mini-app clipboard-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>剪贴板</h2>
        </div>
        <span className="dock-app-window__badge">{status}</span>
      </header>

      <section className="mini-app__panel">
        <textarea
          className="mini-input mini-input--textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="临时片段"
          spellCheck={false}
        />
        <div className="mini-actions">
          <button type="button" className="dock-app-window__button" onClick={readClipboard}>
            读取
          </button>
          <button type="button" className="mini-app__secondary" onClick={saveDraft}>
            保存
          </button>
        </div>
      </section>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>片段</span>
          {snippets.length > 0 ? (
            <button type="button" className="mini-app__plain" onClick={clearSnippets}>
              清空
            </button>
          ) : null}
        </div>
        <div className="snippet-list">
          {sortedSnippets.length === 0 ? (
            <span className="mini-list__empty">暂无片段</span>
          ) : (
            sortedSnippets.map((item) => (
              <article key={item.id} className="snippet-card">
                <button
                  type="button"
                  className="snippet-card__text"
                  onClick={() => copyText(item.text)}
                >
                  {item.text}
                </button>
                <div className="snippet-card__actions">
                  <button
                    type="button"
                    className="mini-app__plain"
                    onClick={() => togglePinned(item.id)}
                  >
                    {item.pinned ? '取消置顶' : '置顶'}
                  </button>
                  <button
                    type="button"
                    className="mini-app__plain"
                    onClick={() => removeSnippet(item.id)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
