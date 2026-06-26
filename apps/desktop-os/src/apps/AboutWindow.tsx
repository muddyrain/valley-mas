import './AboutWindow.css';

export default function AboutWindow() {
  return (
    <div className="about">
      <div className="about__hero" aria-hidden>
        🍎
      </div>
      <div className="about__info">
        <h1 className="about__title">macOS Plush</h1>
        <p className="about__sub">版本 0.1.0 · Nintendo Inspired</p>

        <dl className="about__meta">
          <div>
            <dt>设备</dt>
            <dd>MacBook Plush (M2, 2026)</dd>
          </div>
          <div>
            <dt>芯片</dt>
            <dd>Apple M2 (Felted)</dd>
          </div>
          <div>
            <dt>内存</dt>
            <dd>16 GB Cotton</dd>
          </div>
          <div>
            <dt>启动磁盘</dt>
            <dd>Macintosh Wool</dd>
          </div>
          <div>
            <dt>序列号</dt>
            <dd>PLUSH20260618</dd>
          </div>
        </dl>

        <div className="about__actions">
          <button type="button" className="about__btn">
            系统报告…
          </button>
          <button type="button" className="about__btn about__btn--primary">
            软件更新…
          </button>
        </div>
      </div>
    </div>
  );
}
