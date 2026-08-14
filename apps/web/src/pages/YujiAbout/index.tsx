import avatarUrl from '../../../prototypes/yuji/assets/yuji-brand/avatar.png';

export default function YujiAbout() {
  return (
    <main className="yuji-public-main yuji-about-page">
      <header className="yuji-about-hero">
        <figure>
          <img src={avatarUrl} alt="muddyrain 的 GitHub 头像" />
        </figure>
        <div>
          <p>ABOUT / MUDDYRAIN</p>
          <h1>写代码，也收集让人停留片刻的画面。</h1>
          <p>雨迹放着技术笔记、正在学习的东西，以及我愿意再看一眼的影像。</p>
        </div>
      </header>

      <section className="yuji-about-notes">
        <div>
          <p className="yuji-kicker">正在关注</p>
          <ul>
            <li>React 与组件设计</li>
            <li>TypeScript</li>
            <li>AI 辅助创作</li>
            <li>好看的风景与动画</li>
          </ul>
        </div>
        <div>
          <p className="yuji-kicker">内容方式</p>
          <p>
            文章记录理解发生变化的时刻；图库保存值得回看的风景。更新没有固定周期，只在有东西值得留下时发生。
          </p>
        </div>
        <div>
          <p className="yuji-kicker">找到我</p>
          <a href="https://github.com/muddyrain" target="_blank" rel="noreferrer">
            GitHub · @muddyrain ↗
          </a>
        </div>
      </section>
    </main>
  );
}
