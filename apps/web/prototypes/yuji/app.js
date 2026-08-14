const contentData = {
  featured: {
    title: '组件渲染性能优化',
    excerpt:
      '本文介绍了 React 组件渲染性能优化的几种方法，包括 shouldComponentUpdate、PureComponent、React.memo、useCallback 和 useMemo，并通过示例说明如何避免不必要的重新渲染。',
    column: 'React',
    date: '2026.08.06',
    cover: './assets/content/cover-render-performance.webp',
  },
  articles: [
    {
      title: '元数据标记',
      excerpt:
        '本文介绍了元数据标记的概念，包括 tags 和 token 的使用，并展示了在 LLM 中利用 tags 进行内容处理的示例。',
      column: 'LangGraph',
      date: '2026.08.09',
      cover: './assets/content/cover-metadata.webp',
    },
    {
      title: '错误边界',
      excerpt:
        'React 错误边界用于捕获子组件树中的渲染错误并显示备用 UI，避免整个应用因为局部异常而崩溃。',
      column: 'React',
      date: '2026.08.06',
      cover: './assets/content/cover-error-boundary.webp',
    },
    {
      title: '高阶组件',
      excerpt: '高阶组件是 React 中用于复用组件逻辑的一种高级技巧。',
      column: 'React',
      date: '2026.08.05',
      cover: './assets/content/cover-metadata.webp',
    },
  ],
  images: [
    {
      title: '三月七的春日摄影之旅',
      src: './assets/content/gallery-march7.webp',
      meta: '3840 × 2160 · 壁纸',
    },
    {
      title: '林克与塞尔达远眺海拉鲁大陆',
      src: './assets/content/gallery-zelda.webp',
      meta: '3840 × 2160 · 壁纸',
    },
    {
      title: '美少女战士晴空花园回眸',
      src: './assets/content/gallery-sailor.webp',
      meta: '3840 × 2160 · 壁纸',
    },
    {
      title: '芙宁娜的海边假日',
      src: './assets/content/gallery-furina.webp',
      meta: '1672 × 941 · 壁纸',
    },
  ],
};

const prototypeState = {
  view: window.location.hash.replace('#/', '') || 'home',
  layout: window.localStorage.getItem('yuji-layout') || 'whitespace',
  theme: window.localStorage.getItem('yuji-theme') || 'light',
  motion: window.localStorage.getItem('yuji-motion') !== 'off',
  tweaksOpen: false,
  viewsOpen: false,
  mobileNavOpen: false,
  searchOpen: false,
  searchTerm: '',
  suggestion: 'pending',
  publishOpen: false,
  publishStatus: 'draft',
  articleFilter: '全部',
  selectedImageIndex: 0,
  importSource: '',
  importLicense: '',
  importStatus: 'editing',
  imagePurpose: 'cover',
  imageAdvanced: false,
  aiPrompt: '一张表现 React 组件更新边界的文章封面，清透留白，用有秩序的结构表现组件之间的关系。',
  imageGeneration: 'idle',
  imageApplied: false,
  imageError: '',
};

let imageGenerationTimer;

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function wordmark() {
  return `
    <a class="brand" href="#/home" data-view="home" aria-label="雨迹首页">
      <img class="brand-mark brand-mark-light" src="./assets/yuji-brand/wordmark.svg" alt="雨迹，文章与影像" />
      <img class="brand-mark brand-mark-dark" src="./assets/yuji-brand/wordmark-dark.svg" alt="雨迹，文章与影像" />
    </a>
  `;
}

function publicHeader(activeView) {
  const articlesActive = ['articles', 'article'].includes(activeView);
  const galleryActive = ['gallery', 'gallery-collection'].includes(activeView);
  return `
    <header class="site-header">
      <div class="header-inner">
        ${wordmark()}
        <nav class="desktop-nav" aria-label="主要导航">
          <button class="nav-link ${activeView === 'home' ? 'is-active' : ''}" data-view="home">首页</button>
          <button class="nav-link ${articlesActive ? 'is-active' : ''}" data-view="articles">文章</button>
          <button class="nav-link ${galleryActive ? 'is-active' : ''}" data-view="gallery">图库</button>
          <button class="nav-link ${activeView === 'about' ? 'is-active' : ''}" data-view="about">关于</button>
        </nav>
        <div class="header-actions">
          <button class="text-action" data-action="open-search">搜索</button>
          <a class="byline" href="https://github.com/muddyrain" target="_blank" rel="noreferrer">by @muddyrain ↗</a>
          <button class="menu-button" data-action="toggle-mobile-nav" aria-expanded="${prototypeState.mobileNavOpen}">菜单</button>
        </div>
      </div>
      <nav class="mobile-nav ${prototypeState.mobileNavOpen ? 'is-open' : ''}" aria-label="移动端导航">
        <button data-view="home">首页</button>
        <button data-view="articles">文章</button>
        <button data-view="gallery">图库</button>
        <button data-view="about">关于</button>
        <button data-action="open-search">搜索</button>
      </nav>
    </header>
  `;
}

function imageFigure(image, className = '', imageIndex = contentData.images.indexOf(image)) {
  return `
    <figure class="editorial-image ${className}">
      <button class="image-button" data-action="image-detail" data-image-index="${imageIndex}" aria-label="查看${image.title}">
        <img src="${image.src}" alt="${image.title}" />
      </button>
      <figcaption>
        <span>${image.title}</span>
        <span>${image.meta}</span>
      </figcaption>
    </figure>
  `;
}

function homeView() {
  const featured = contentData.featured;
  return `
    ${publicHeader('home')}
    <main id="main-content" class="public-main home-page">
      <section class="editorial-hero" aria-labelledby="feature-title">
        <div class="feature-copy">
          <div class="section-kicker"><span>当前专题</span><span>组件更新边界</span></div>
          <h1 id="feature-title">${featured.title}</h1>
          <p class="feature-deck">${featured.excerpt}</p>
          <div class="feature-meta">
            <span>${featured.column}</span>
            <span>${featured.date}</span>
          </div>
          <button class="read-link" data-view="article">阅读全文 <span aria-hidden="true">→</span></button>
        </div>
        <div class="feature-media" aria-label="专题影像">
          <figure class="feature-cover">
            <img src="${featured.cover}" alt="${featured.title}封面" />
            <figcaption><span>FEATURE / 01</span><span>文章封面</span></figcaption>
          </figure>
          <figure class="feature-secondary">
            <img src="${contentData.images[1].src}" alt="${contentData.images[1].title}" />
            <figcaption>${contentData.images[1].title}</figcaption>
          </figure>
        </div>
        <div class="hero-index" aria-hidden="true">01</div>
      </section>

      <section class="recent-section" aria-labelledby="recent-title">
        <header class="section-heading">
          <p>RECENT WRITING</p>
          <h2 id="recent-title">近来的文章</h2>
          <button class="underlined-action" data-view="articles">查看全部</button>
        </header>
        <div class="article-ledger">
          ${contentData.articles
            .map(
              (article, index) => `
                <article class="ledger-item">
                  <button class="ledger-hit" data-view="article" aria-label="阅读${article.title}"></button>
                  <span class="ledger-index">0${index + 1}</span>
                  <div class="ledger-copy">
                    <div class="ledger-meta"><span>${article.column}</span><time>${article.date}</time></div>
                    <h3>${article.title}</h3>
                    <p>${article.excerpt}</p>
                  </div>
                  <div class="ledger-thumb"><img src="${article.cover}" alt="" /></div>
                  <span class="ledger-arrow" aria-hidden="true">↗</span>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="gallery-section" id="gallery" aria-labelledby="gallery-title">
        <header class="section-heading gallery-heading">
          <p>CURATED IMAGES</p>
          <h2 id="gallery-title">风景经过这里</h2>
          <p class="section-intro">风景、游戏世界与想象中的人物，按观看时的心情重新排在一起。</p>
        </header>
        <div class="image-composition">
          ${imageFigure(contentData.images[0], 'image-wide', 0)}
          ${imageFigure(contentData.images[1], 'image-tall', 1)}
          ${imageFigure(contentData.images[2], 'image-small', 2)}
          ${imageFigure(contentData.images[3], 'image-offset', 3)}
        </div>
      </section>

      <section class="about-strip" id="about" aria-labelledby="about-title">
        <div class="about-avatar"><img src="./assets/yuji-brand/avatar.png" alt="muddyrain 的 GitHub 头像" /></div>
        <div class="about-copy">
          <p class="section-label">ABOUT</p>
          <h2 id="about-title">写代码，也收集让人停留片刻的画面。</h2>
          <p>这里放着技术笔记、正在学习的东西，以及我愿意再看一眼的影像。</p>
        </div>
        <button class="about-link" data-view="about">更多关于我 →</button>
      </section>
    </main>
    ${publicFooter()}
  `;
}

function articleView() {
  return `
    ${publicHeader('article')}
    <main id="main-content" class="article-page">
      <article>
        <header class="article-hero">
          <button class="back-link" data-view="home">← 返回首页</button>
          <div class="article-title-wrap">
            <div class="article-identity"><span>React</span><time>2026.08.06</time></div>
            <h1>组件渲染<br />性能优化</h1>
            <p>${contentData.featured.excerpt}</p>
          </div>
          <figure class="article-cover">
            <img src="${contentData.featured.cover}" alt="组件渲染性能优化封面" />
          </figure>
          <div class="article-author">
            <img src="./assets/yuji-brand/avatar.png" alt="" />
            <span>by @muddyrain</span>
          </div>
        </header>

        <div class="article-layout">
          <aside class="article-toc" aria-label="文章目录">
            <p>目录</p>
            <a href="#why-render">为什么会重新渲染</a>
            <a href="#class-components">类组件的边界</a>
            <a href="#react-memo">React.memo</a>
            <a href="#hooks">useCallback 与 useMemo</a>
          </aside>
          <div class="article-body">
            <p class="lead">在本小节，我们将会探讨组件在渲染时，如何优化渲染性能问题。</p>
            <p>涉及到的内容包含 <code>shouldComponentUpdate</code>、<code>PureComponent</code>、<code>React.memo</code>、<code>useMemo</code> 和 <code>useCallback</code>。</p>

            <h2 id="why-render">为什么会重新渲染</h2>
            <p>一个简单的计数器，即使再次把状态设置为同一个值，类组件仍可能重新执行渲染。这个结果并没有带来新的界面，因此是可以避免的工作。</p>
            <pre><code>shouldComponentUpdate(nextProps, nextState) {
  if (
    objectEqual(this.props, nextProps) &&
    objectEqual(this.state, nextState)
  ) {
    return false
  }
  return true
}</code></pre>

            <h2 id="class-components">类组件的边界</h2>
            <p><code>PureComponent</code> 通过浅层比较属性和状态来实现同一类优化。不过，浅比较也意味着直接修改数组或对象不会产生新的引用，组件可能因此错过更新。</p>
            <blockquote>我们应该返回一个新的数组，而不是继续把原来的数组赋值给状态。</blockquote>

            <h2 id="react-memo">React.memo</h2>
            <p>函数组件可以使用 <code>React.memo</code> 记住上一次渲染结果。当传入的属性没有变化时，组件不必再次执行。</p>
            <pre><code>function ChildComponent(props) {
  return &lt;div&gt;{props.counter}&lt;/div&gt;
}

export default React.memo(ChildComponent)</code></pre>

            <h2 id="hooks">useCallback 与 useMemo</h2>
            <p><code>useCallback</code> 主要缓存函数，<code>useMemo</code> 主要缓存计算结果。它们只有在依赖变化时才更新缓存，不应该被当成每个组件的默认装饰。</p>

            <footer class="article-end">
              <span>React</span><span>性能优化</span><span>组件设计</span>
            </footer>
          </div>
          <aside class="article-margin-note">
            <span>NOTE 01</span>
            <p>先找到真实的重复渲染，再决定是否引入缓存。</p>
          </aside>
        </div>

        <section class="article-related" aria-labelledby="related-title">
          <header><p>RELATED WRITING</p><h2 id="related-title">继续阅读</h2><button data-view="articles">全部文章 →</button></header>
          <div>
            ${contentData.articles
              .slice(0, 2)
              .map(
                (article, index) =>
                  `<article><span>0${index + 1}</span><div><small>${article.column} · ${article.date}</small><h3>${article.title}</h3><p>${article.excerpt}</p></div></article>`,
              )
              .join('')}
          </div>
        </section>
      </article>
    </main>
    ${publicFooter()}
  `;
}

function suggestionBlock() {
  if (prototypeState.suggestion === 'accepted') {
    return `<div class="suggestion-result" role="status"><span>已接受</span><button data-action="reset-suggestion">撤销</button></div>`;
  }
  if (prototypeState.suggestion === 'rejected') {
    return `<div class="suggestion-result" role="status"><span>已忽略这条建议</span><button data-action="reset-suggestion">恢复</button></div>`;
  }
  return `
    <section class="inline-suggestion" aria-labelledby="suggestion-title">
      <div class="suggestion-label">AI 改写建议</div>
      <div class="diff-copy">
        <p class="diff-before">这个结果并没有带来新的界面，所以是没有必要的。</p>
        <p class="diff-after" id="suggestion-title">这次渲染没有产生新的界面，因此可以被安全地跳过。</p>
      </div>
      <div class="suggestion-actions">
        <button class="primary-small" data-action="accept-suggestion">接受</button>
        <button data-action="reject-suggestion">忽略</button>
        <button>精简</button>
      </div>
    </section>
  `;
}

function studioView() {
  return `
    <main id="main-content" class="studio-shell">
      <header class="studio-topbar">
        <div class="studio-brand">
          ${wordmark()}
          <span>创作室</span>
        </div>
        <div class="save-state"><span class="save-dot"></span>已自动保存</div>
        <div class="studio-actions">
          <button class="ghost-button" data-view="home">预览</button>
          <button class="ink-button" data-action="toggle-publish">发布检查</button>
        </div>
      </header>

      <div class="studio-layout ${prototypeState.publishOpen ? 'publish-open' : ''}">
        <aside class="task-rail" aria-label="创作室导航">
          <button class="rail-brand" data-view="studio-home" aria-label="创作室首页">雨</button>
          <nav>
            <button class="rail-item is-active" data-view="studio"><span>写</span><small>文章</small></button>
            <button class="rail-item" data-view="studio-import"><span>图</span><small>导入</small></button>
            <button class="rail-item" data-view="studio-image"><span>像</span><small>生图</small></button>
          </nav>
          <button class="rail-item rail-bottom"><span>验</span><small>实验室</small></button>
        </aside>

        <section class="writing-canvas" aria-label="文章内容画布">
          <div class="canvas-toolbar">
            <button>正文</button><button>标题</button><button>引用</button><span></span><button>撤销</button>
          </div>
          <div class="document-sheet">
            <div class="document-meta"><span>React</span><span>草稿</span></div>
            <h1 contenteditable="true" spellcheck="false">组件渲染性能优化</h1>
            <p class="document-deck" contenteditable="true" spellcheck="false">避免不必要的重新渲染，不是为了追逐数字，而是让组件的更新边界更清楚。</p>
            <hr />
            <h2 contenteditable="true" spellcheck="false">为什么会重新渲染</h2>
            <p contenteditable="true" spellcheck="false">一个简单的计数器，即使再次把状态设置为同一个值，类组件仍可能重新执行渲染。这个结果并没有带来新的界面，所以是没有必要的。</p>
            ${suggestionBlock()}
            <p contenteditable="true" spellcheck="false"><code>PureComponent</code> 通过浅层比较属性和状态来处理这类场景，但它也要求我们尊重不可变数据的边界。</p>
          </div>
        </section>

        <aside class="context-panel" aria-label="文章上下文">
          <div class="panel-section">
            <p class="panel-kicker">封面</p>
            <img class="cover-preview" src="${contentData.featured.cover}" alt="当前文章封面" />
            <button class="underlined-action">换一个方向</button>
          </div>
          <div class="panel-section">
            <p class="panel-kicker">发布内容</p>
            <dl class="publish-summary">
              <div><dt>专栏</dt><dd>React</dd></div>
              <div><dt>标签</dt><dd>性能优化 · 组件设计</dd></div>
              <div><dt>状态</dt><dd>草稿</dd></div>
            </dl>
          </div>
          <button class="advanced-button">高级设置 <span>＋</span></button>
        </aside>

        <aside class="publish-drawer" aria-label="发布检查">
          <button class="drawer-close" data-action="toggle-publish" aria-label="关闭发布检查">×</button>
          <p class="panel-kicker">发布检查</p>
          <h2>准备好让它被看见了吗？</h2>
          <ul class="check-list">
            <li><span>01</span><div><strong>正文</strong><small>标题与正文已完成</small></div><b>完成</b></li>
            <li><span>02</span><div><strong>专栏</strong><small>React</small></div><b>完成</b></li>
            <li><span>03</span><div><strong>封面</strong><small>已选择当前封面</small></div><b>完成</b></li>
            <li><span>04</span><div><strong>摘要</strong><small>沿用当前引言</small></div><b>完成</b></li>
          </ul>
          ${prototypeState.publishStatus === 'published' ? '<div class="publish-success" role="status"><span>已发布</span><strong>文章已经出现在公开站</strong></div>' : ''}
          <button class="publish-button" data-action="publish-article" ${prototypeState.publishStatus === 'published' ? 'disabled' : ''}>${prototypeState.publishStatus === 'published' ? '发布完成' : '发布文章'}</button>
          <button class="preview-button" data-view="home">打开公开预览</button>
        </aside>
      </div>
    </main>
  `;
}

function publicFooter() {
  return `
    <footer class="site-footer">
      <div>${wordmark()}</div>
      <p>雨迹 · by @muddyrain</p>
      <nav aria-label="页脚导航"><button data-view="home">首页</button><button data-view="articles">文章</button><button data-view="gallery">图库</button><button data-view="about">关于</button></nav>
    </footer>
  `;
}

function searchDialog() {
  if (!prototypeState.searchOpen) return '';
  const term = prototypeState.searchTerm.trim().toLowerCase();
  const searchableArticles = [contentData.featured, ...contentData.articles];
  const articleResults = searchableArticles
    .filter(
      (article) =>
        !term ||
        article.title.toLowerCase().includes(term) ||
        article.column.toLowerCase().includes(term) ||
        article.excerpt.toLowerCase().includes(term),
    )
    .map((article) => ({ ...article, kind: '文章', view: 'article' }));
  const imageResults = contentData.images
    .map((image, index) => ({ ...image, index, kind: '图片' }))
    .filter((image) => !term || image.title.toLowerCase().includes(term));
  const collectionResults =
    !term || '远行与晴空'.includes(term)
      ? [{ title: '远行与晴空', kind: '合集', meta: '主题合集', view: 'gallery-collection' }]
      : [];
  const results = [...articleResults, ...collectionResults, ...imageResults].slice(0, 7);
  return `
    <div class="dialog-backdrop" data-action="close-search">
      <section class="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title" data-dialog>
        <div class="dialog-head"><p id="search-title">搜索雨迹</p><button data-action="close-search" aria-label="关闭搜索">×</button></div>
        <label class="search-field"><span>关键词</span><input autofocus value="${escapeHTML(prototypeState.searchTerm)}" data-search-input placeholder="React、远行、三月七…" /></label>
        <div class="search-results">
          ${
            results.length
              ? results
                  .map((result) =>
                    result.kind === '图片'
                      ? `<button data-action="image-detail" data-image-index="${result.index}"><span>${result.kind}</span><strong>${result.title}</strong><small>${result.meta}</small></button>`
                      : `<button data-view="${result.view}"><span>${result.kind}</span><strong>${result.title}</strong><small>${result.column || result.meta} ${result.date || ''}</small></button>`,
                  )
                  .join('')
              : '<p class="empty-search">没有找到相关内容</p>'
          }
        </div>
      </section>
    </div>
  `;
}

function tweaksPanel() {
  return `
    <button class="prototype-trigger tweaks-trigger" data-action="toggle-tweaks" aria-expanded="${prototypeState.tweaksOpen}">Tweaks</button>
    ${
      prototypeState.tweaksOpen
        ? `<aside class="tweaks-panel prototype-panel" aria-label="原型参数">
            <div class="prototype-panel-head"><strong>Tweaks</strong><button data-action="toggle-tweaks">×</button></div>
            <label>首页版式
              <select data-setting="layout">
                <option value="whitespace" ${prototypeState.layout === 'whitespace' ? 'selected' : ''}>留白</option>
                <option value="columns" ${prototypeState.layout === 'columns' ? 'selected' : ''}>分栏</option>
                <option value="poster" ${prototypeState.layout === 'poster' ? 'selected' : ''}>海报</option>
              </select>
            </label>
            <label>主题
              <select data-setting="theme">
                <option value="light" ${prototypeState.theme === 'light' ? 'selected' : ''}>浅色</option>
                <option value="dark" ${prototypeState.theme === 'dark' ? 'selected' : ''}>深色</option>
              </select>
            </label>
            <label class="toggle-row"><span>动效</span><input type="checkbox" data-setting="motion" ${prototypeState.motion ? 'checked' : ''} /></label>
          </aside>`
        : ''
    }
  `;
}

function viewsPanel() {
  return `
    <button class="prototype-trigger views-trigger" data-action="toggle-views" aria-expanded="${prototypeState.viewsOpen}">Views</button>
    ${
      prototypeState.viewsOpen
        ? `<aside class="views-panel prototype-panel" aria-label="原型页面">
            <div class="prototype-panel-head"><strong>Views</strong><button data-action="toggle-views">×</button></div>
            <p class="views-group">公共站</p>
            <button data-view="home"><span>01</span>公共首页</button>
            <button data-view="articles"><span>02</span>文章列表</button>
            <button data-view="article"><span>03</span>文章详情</button>
            <button data-view="gallery"><span>04</span>图库首页</button>
            <button data-view="gallery-collection"><span>05</span>主题合集</button>
            <button data-view="gallery-item"><span>06</span>单图查看</button>
            <button data-view="about"><span>07</span>关于</button>
            <p class="views-group">创作室</p>
            <button data-view="studio-home"><span>08</span>创作室首页</button>
            <button data-view="studio"><span>09</span>内容画布</button>
            <button data-view="studio-import"><span>10</span>图片导入</button>
            <button data-view="studio-image"><span>11</span>AI 图片</button>
          </aside>`
        : ''
    }
  `;
}

function imageToast() {
  return `<div class="prototype-toast" role="status" hidden data-image-toast></div>`;
}

function applyDocumentState() {
  document.documentElement.dataset.theme = prototypeState.theme;
  document.documentElement.dataset.layout = prototypeState.layout;
  document.documentElement.dataset.motion = prototypeState.motion ? 'on' : 'off';
}

function normalizeView(view) {
  const views = [
    'home',
    'articles',
    'article',
    'gallery',
    'gallery-collection',
    'gallery-item',
    'about',
    'studio-home',
    'studio',
    'studio-import',
    'studio-image',
  ];
  return views.includes(view) ? view : 'home';
}

function fullViewContext() {
  return {
    data: contentData,
    state: prototypeState,
    escapeHTML,
    imageFigure,
    publicFooter,
    publicHeader,
    wordmark,
  };
}

function render() {
  applyDocumentState();
  prototypeState.view = normalizeView(prototypeState.view);
  const app = document.querySelector('#app');
  const ctx = fullViewContext();
  const fullViews = window.YujiFullViews;
  const renderers = {
    home: homeView,
    articles: () => fullViews.articlesView(ctx),
    article: articleView,
    gallery: () => fullViews.galleryView(ctx),
    'gallery-collection': () => fullViews.galleryCollectionView(ctx),
    'gallery-item': () => fullViews.galleryItemView(ctx),
    about: () => fullViews.aboutView(ctx),
    'studio-home': () => fullViews.studioHomeView(ctx),
    studio: studioView,
    'studio-import': () => fullViews.studioImportView(ctx),
    'studio-image': () => fullViews.studioImageView(ctx),
  };
  const viewMarkup = renderers[prototypeState.view]();

  app.innerHTML = `${viewMarkup}${searchDialog()}${viewsPanel()}${tweaksPanel()}${imageToast()}`;
}

function navigateTo(view) {
  prototypeState.view = normalizeView(view);
  prototypeState.mobileNavOpen = false;
  prototypeState.searchOpen = false;
  window.location.hash = `/${prototypeState.view}`;
  render();
  window.scrollTo({ top: 0, behavior: prototypeState.motion ? 'smooth' : 'auto' });
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button, a');
  if (!target) return;

  if (target.dataset.view) {
    event.preventDefault();
    navigateTo(target.dataset.view);
    return;
  }

  const action = target.dataset.action;
  if (!action) return;

  if (action === 'toggle-tweaks') {
    prototypeState.tweaksOpen = !prototypeState.tweaksOpen;
    render();
  }
  if (action === 'toggle-views') {
    prototypeState.viewsOpen = !prototypeState.viewsOpen;
    render();
  }
  if (action === 'toggle-mobile-nav') {
    prototypeState.mobileNavOpen = !prototypeState.mobileNavOpen;
    render();
  }
  if (action === 'open-search') {
    prototypeState.searchOpen = true;
    render();
    window.requestAnimationFrame(() => document.querySelector('[data-search-input]')?.focus());
  }
  if (action === 'close-search' && !event.target.closest('[data-dialog]')) {
    prototypeState.searchOpen = false;
    render();
  }
  if (action === 'close-search' && target.closest('.dialog-head')) {
    prototypeState.searchOpen = false;
    render();
  }
  if (action === 'accept-suggestion') {
    prototypeState.suggestion = 'accepted';
    render();
  }
  if (action === 'reject-suggestion') {
    prototypeState.suggestion = 'rejected';
    render();
  }
  if (action === 'reset-suggestion') {
    prototypeState.suggestion = 'pending';
    render();
  }
  if (action === 'toggle-publish') {
    prototypeState.publishOpen = !prototypeState.publishOpen;
    render();
  }
  if (action === 'publish-article') {
    prototypeState.publishStatus = 'published';
    render();
  }
  if (action === 'article-filter') {
    prototypeState.articleFilter = target.dataset.filter;
    render();
  }
  if (action === 'image-detail') {
    prototypeState.selectedImageIndex = Number(target.dataset.imageIndex) || 0;
    navigateTo('gallery-item');
  }
  if (action === 'gallery-prev' || action === 'gallery-next') {
    const direction = action === 'gallery-next' ? 1 : -1;
    prototypeState.selectedImageIndex =
      (prototypeState.selectedImageIndex + direction + contentData.images.length) %
      contentData.images.length;
    render();
  }
  if (action === 'complete-import') {
    if (!prototypeState.importSource || !prototypeState.importLicense) return;
    prototypeState.importStatus = 'done';
    render();
  }
  if (action === 'image-purpose') {
    prototypeState.imagePurpose = target.dataset.purpose;
    render();
  }
  if (action === 'toggle-image-advanced') {
    prototypeState.imageAdvanced = !prototypeState.imageAdvanced;
    render();
  }
  if (action === 'generate-image') {
    const promptInput = document.querySelector('[data-image-prompt]');
    const prompt = promptInput ? promptInput.value.trim() : prototypeState.aiPrompt.trim();
    prototypeState.aiPrompt = prompt;
    if (!prompt) {
      prototypeState.imageError = '请先写下想要的画面。';
      prototypeState.imageGeneration = 'idle';
      render();
      return;
    }
    prototypeState.imageError = '';
    prototypeState.imageGeneration = 'loading';
    prototypeState.imageApplied = false;
    render();
    window.clearTimeout(imageGenerationTimer);
    imageGenerationTimer = window.setTimeout(() => {
      prototypeState.imageGeneration = 'ready';
      render();
    }, 900);
  }
  if (action === 'use-generated-cover') {
    prototypeState.imageApplied = true;
    render();
  }
});

document.addEventListener('input', (event) => {
  if (event.target.matches('[data-image-prompt]')) {
    prototypeState.aiPrompt = event.target.value;
    return;
  }
  if (!event.target.matches('[data-search-input]')) return;
  prototypeState.searchTerm = event.target.value;
  const activeElement = document.activeElement;
  render();
  window.requestAnimationFrame(() => {
    const input = document.querySelector('[data-search-input]');
    input?.focus();
    if (activeElement) input?.setSelectionRange(input.value.length, input.value.length);
  });
});

document.addEventListener('change', (event) => {
  const importField = event.target.dataset.importField;
  if (importField) {
    if (importField === 'source') prototypeState.importSource = event.target.value;
    if (importField === 'license') prototypeState.importLicense = event.target.value;
    prototypeState.importStatus = 'editing';
    render();
    return;
  }
  const setting = event.target.dataset.setting;
  if (!setting) return;
  if (setting === 'layout') prototypeState.layout = event.target.value;
  if (setting === 'theme') prototypeState.theme = event.target.value;
  if (setting === 'motion') prototypeState.motion = event.target.checked;
  window.localStorage.setItem('yuji-layout', prototypeState.layout);
  window.localStorage.setItem('yuji-theme', prototypeState.theme);
  window.localStorage.setItem('yuji-motion', prototypeState.motion ? 'on' : 'off');
  render();
});

window.addEventListener('hashchange', () => {
  prototypeState.view = normalizeView(window.location.hash.replace('#/', ''));
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  prototypeState.searchOpen = false;
  prototypeState.tweaksOpen = false;
  prototypeState.viewsOpen = false;
  prototypeState.mobileNavOpen = false;
  render();
});

render();
