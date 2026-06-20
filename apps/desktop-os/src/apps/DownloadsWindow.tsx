import { getFinderItems } from '../finder/data';
import { useRevealInFinder } from './useRevealInFinder';
import './DockAppWindows.css';

export default function DownloadsWindow() {
  const downloads = getFinderItems('downloads');
  const revealInFinder = useRevealInFinder();

  return (
    <div className="dock-app-window downloads-window">
      <header className="downloads-window__header">
        <div>
          <div className="dock-app-window__eyebrow">下载</div>
          <h2>下载资料</h2>
          <p>网页资料、截图和云端文件的整理入口。</p>
        </div>
        <span className="dock-app-window__badge">{downloads.length} 项</span>
      </header>

      <section className="downloads-window__list" aria-label="下载资料">
        {downloads.map((item) => (
          <article className="download-row" key={item.id}>
            <img src={item.icon} alt="" aria-hidden />
            <div className="download-row__text">
              <span className="download-row__title">{item.title}</span>
              <span className="download-row__subtitle">{item.body}</span>
              {item.tags && (
                <div className="download-row__meta">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="dock-app-window__button"
              onClick={() => revealInFinder('downloads', item.id)}
            >
              在 Finder 中显示
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
