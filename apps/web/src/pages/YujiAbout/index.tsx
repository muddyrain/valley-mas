import { YUJI_GITHUB_AVATAR_URL, YUJI_GITHUB_PROFILE_URL } from '@/components/yuji/yujiAuthor';

export default function YujiAbout() {
  return (
    <main className="yuji-public-main yuji-about-page">
      <header className="yuji-about-hero">
        <figure>
          <img src={YUJI_GITHUB_AVATAR_URL} alt="muddyrain 的 GitHub 头像" />
        </figure>
        <div>
          <p>ABOUT / MUDDYRAIN</p>
          <h1>写点东西，也留住一些画面。</h1>
          <p>技术笔记、还没想明白的事情，和想留下来的风景。</p>
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
          <a href={YUJI_GITHUB_PROFILE_URL} target="_blank" rel="noreferrer">
            GitHub · @muddyrain ↗
          </a>
        </div>
      </section>
    </main>
  );
}
