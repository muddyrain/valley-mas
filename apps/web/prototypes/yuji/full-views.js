window.YujiFullViews = (() => {
  const collectionTitle = '远行与晴空';

  function studioRail(active) {
    const railItem = (view, mark, label) => `
      <button class="rail-item ${active === view ? 'is-active' : ''}" data-view="${view}">
        <span>${mark}</span><small>${label}</small>
      </button>`;

    return `
      <aside class="task-rail" aria-label="创作室导航">
        <button class="rail-brand" data-view="studio-home" aria-label="创作室首页">雨</button>
        <nav>
          ${railItem('studio', '写', '文章')}
          ${railItem('studio-import', '图', '导入')}
          ${railItem('studio-image', '像', '生图')}
        </nav>
        <button class="rail-item rail-bottom"><span>验</span><small>实验室</small></button>
      </aside>`;
  }

  function studioTopbar(ctx, label, actions = '') {
    return `
      <header class="studio-topbar">
        <div class="studio-brand">
          ${ctx.wordmark()}
          <span>${label}</span>
        </div>
        <div class="save-state"><span class="save-dot"></span>私有空间</div>
        <div class="studio-actions">
          <button class="ghost-button" data-view="home">查看公开站</button>
          ${actions}
        </div>
      </header>`;
  }

  function articlesView(ctx) {
    const allArticles = [ctx.data.featured, ...ctx.data.articles];
    const visibleArticles =
      ctx.state.articleFilter === '全部'
        ? allArticles
        : allArticles.filter((article) => article.column === ctx.state.articleFilter);
    const filters = ['全部', ...new Set(allArticles.map((article) => article.column))];

    return `
      ${ctx.publicHeader('articles')}
      <main id="main-content" class="public-main index-page articles-index-page">
        <header class="index-hero writing-hero">
          <div class="index-label"><span>WRITING</span><span>技术与实践</span></div>
          <h1>文章</h1>
          <p>关于 React、LangGraph 与正在学习的东西。按专栏整理，也保留每一次理解发生变化的痕迹。</p>
        </header>

        <section class="index-toolbar" aria-label="文章专栏筛选">
          <p>按专栏阅读</p>
          <div class="filter-row">
            ${filters
              .map(
                (filter) =>
                  `<button class="${ctx.state.articleFilter === filter ? 'is-active' : ''}" data-action="article-filter" data-filter="${filter}">${filter}</button>`,
              )
              .join('')}
          </div>
        </section>

        <section class="writing-index" aria-label="文章列表">
          ${visibleArticles
            .map(
              (article, index) => `
                <article class="writing-index-item">
                  <button class="writing-index-hit" data-view="article" aria-label="阅读${article.title}"></button>
                  <span class="writing-number">${String(index + 1).padStart(2, '0')}</span>
                  <div class="writing-copy">
                    <div class="writing-meta"><span>${article.column}</span><time>${article.date}</time></div>
                    <h2>${article.title}</h2>
                    <p>${article.excerpt}</p>
                  </div>
                  <figure><img src="${article.cover}" alt="${article.title}封面" /></figure>
                  <span class="writing-open" aria-hidden="true">↗</span>
                </article>`,
            )
            .join('')}
        </section>
      </main>
      ${ctx.publicFooter()}`;
  }

  function galleryView(ctx) {
    const [lead, second, third, fourth] = ctx.data.images;
    return `
      ${ctx.publicHeader('gallery')}
      <main id="main-content" class="public-main index-page gallery-index-page">
        <header class="index-hero gallery-hero">
          <div class="index-label"><span>GALLERY</span><span>主题合集</span></div>
          <h1>图库</h1>
          <p>风景、游戏世界与想象中的人物。图片先被放进主题，再按观看的节奏重新相遇。</p>
        </header>

        <section class="collection-feature" aria-labelledby="collection-title">
          <button class="collection-hit" data-view="gallery-collection" aria-label="打开${collectionTitle}"></button>
          <figure class="collection-lead"><img src="${lead.src}" alt="${lead.title}" /></figure>
          <figure class="collection-secondary"><img src="${second.src}" alt="${second.title}" /></figure>
          <div class="collection-copy">
            <p>FEATURED COLLECTION</p>
            <h2 id="collection-title">${collectionTitle}</h2>
            <p>从春日花园到海拉鲁远眺，把明亮、开阔和一点想象放进同一段观看路径。</p>
            <span>打开合集 →</span>
          </div>
        </section>

        <section class="gallery-loose-grid" aria-label="最近加入的图片">
          <header>
            <p>RECENTLY ADDED</p>
            <h2>最近加入</h2>
          </header>
          ${ctx.imageFigure(third, 'gallery-loose-large', 2)}
          ${ctx.imageFigure(fourth, 'gallery-loose-small', 3)}
          ${ctx.imageFigure(second, 'gallery-loose-wide', 1)}
        </section>
      </main>
      ${ctx.publicFooter()}`;
  }

  function galleryCollectionView(ctx) {
    const [lead, ...rest] = ctx.data.images;
    return `
      ${ctx.publicHeader('gallery')}
      <main id="main-content" class="public-main collection-page">
        <header class="collection-hero">
          <button class="back-link" data-view="gallery">← 返回图库</button>
          <div class="collection-title-block">
            <p>COLLECTION</p>
            <h1>${collectionTitle}</h1>
            <p>从春日人物到远方山脉，一组关于晴空、花园和启程的图片。</p>
          </div>
          <button class="collection-hero-image" data-action="image-detail" data-image-index="0" aria-label="查看${lead.title}">
            <img src="${lead.src}" alt="${lead.title}" />
          </button>
        </header>

        <section class="collection-sequence" aria-label="合集图片">
          ${rest
            .map(
              (image, index) => `
                <figure class="sequence-item sequence-item-${index + 1}">
                  <button data-action="image-detail" data-image-index="${index + 1}" aria-label="查看${image.title}">
                    <img src="${image.src}" alt="${image.title}" />
                  </button>
                  <figcaption><span>0${index + 2}</span><strong>${image.title}</strong><small>${image.meta}</small></figcaption>
                </figure>`,
            )
            .join('')}
        </section>
      </main>
      ${ctx.publicFooter()}`;
  }

  function galleryItemView(ctx) {
    const image = ctx.data.images[ctx.state.selectedImageIndex] || ctx.data.images[0];
    return `
      <main id="main-content" class="image-viewer-page">
        <header class="viewer-header">
          ${ctx.wordmark()}
          <button data-view="gallery-collection">关闭</button>
        </header>
        <section class="viewer-stage" aria-label="${image.title}">
          <figure><img src="${image.src}" alt="${image.title}" /></figure>
          <div class="viewer-controls">
            <button data-action="gallery-prev" aria-label="上一张">←</button>
            <span>${String(ctx.state.selectedImageIndex + 1).padStart(2, '0')} / ${String(ctx.data.images.length).padStart(2, '0')}</span>
            <button data-action="gallery-next" aria-label="下一张">→</button>
          </div>
        </section>
        <aside class="viewer-details">
          <p class="viewer-kicker">${collectionTitle}</p>
          <h1>${image.title}</h1>
          <dl>
            <div><dt>规格</dt><dd>${image.meta}</dd></div>
            <div><dt>来源</dt><dd>待补充</dd></div>
            <div><dt>许可</dt><dd>尚未确认</dd></div>
          </dl>
          <button class="viewer-download" disabled>下载未开放</button>
          <p class="viewer-note">许可确认后显示下载或原始出处。</p>
        </aside>
      </main>`;
  }

  function aboutView(ctx) {
    return `
      ${ctx.publicHeader('about')}
      <main id="main-content" class="public-main about-page">
        <header class="about-hero">
          <div class="about-portrait"><img src="./assets/yuji-brand/avatar.png" alt="muddyrain 的 GitHub 头像" /></div>
          <div class="about-statement">
            <p>ABOUT / MUDDYRAIN</p>
            <h1>写代码，也收集让人停留片刻的画面。</h1>
            <p>雨迹放着技术笔记、正在学习的东西，以及我愿意再看一眼的影像。</p>
          </div>
        </header>

        <section class="about-notes">
          <div>
            <p class="section-label">正在关注</p>
            <ul><li>React 与组件设计</li><li>TypeScript</li><li>LangGraph</li><li>AI 辅助创作</li></ul>
          </div>
          <div>
            <p class="section-label">内容方式</p>
            <p>文章记录理解发生变化的时刻；图库保存值得回看的风景。更新没有固定周期，只在有东西值得留下时发生。</p>
          </div>
          <div class="about-contact">
            <p class="section-label">找到我</p>
            <a href="https://github.com/muddyrain" target="_blank" rel="noreferrer">GitHub · @muddyrain ↗</a>
          </div>
        </section>
      </main>
      ${ctx.publicFooter()}`;
  }

  function studioHomeView(ctx) {
    return `
      <main id="main-content" class="studio-shell studio-flow-shell">
        ${studioTopbar(ctx, '创作室')}
        <div class="studio-flow-layout">
          ${studioRail('studio-home')}
          <section class="studio-home-main">
            <header class="studio-welcome">
              <p>PRIVATE STUDIO</p>
              <h1>今天从哪里开始？</h1>
              <p>把内容带进来，剩下的重复工作交给辅助流程。</p>
            </header>
            <div class="primary-task-list">
              <button data-view="studio"><span>01</span><strong>写文章</strong><small>从 Markdown、观点或空白页开始</small><b>→</b></button>
              <button data-view="studio-import"><span>02</span><strong>导入图片</strong><small>一次确认来源、许可与主题</small><b>→</b></button>
              <button data-view="studio-image"><span>03</span><strong>AI 图片</strong><small>创作文章封面或图库草稿</small><b>→</b></button>
            </div>
            <div class="studio-home-lower">
              <section class="recent-work">
                <div class="studio-section-head"><p>最近打开</p><button data-view="articles">查看公开文章</button></div>
                <button data-view="studio"><span>React</span><strong>组件渲染性能优化</strong><small>继续编辑 →</small></button>
                <button data-view="articles"><span>LangGraph</span><strong>元数据标记</strong><small>浏览文章 →</small></button>
              </section>
              <aside class="idea-note">
                <p>选题建议</p>
                <strong>把“错误边界”补成一篇完整实践指南</strong>
                <span>基于最近文章生成 · 采用前仍需确认</span>
                <button data-view="studio">带到画布</button>
              </aside>
            </div>
          </section>
        </div>
      </main>`;
  }

  function studioImportView(ctx) {
    const importReady = Boolean(ctx.state.importSource && ctx.state.importLicense);
    return `
      <main id="main-content" class="studio-shell studio-flow-shell">
        ${studioTopbar(ctx, '图片导入', `<button class="ink-button" data-action="complete-import" ${importReady && ctx.state.importStatus !== 'done' ? '' : 'disabled'}>${ctx.state.importStatus === 'done' ? '已进入草稿' : '确认 4 张图片'}</button>`)}
        <div class="studio-flow-layout">
          ${studioRail('studio-import')}
          <section class="import-main">
            <header class="flow-heading">
              <p>BATCH IMPORT</p>
              <h1>一次说明，整批沿用。</h1>
              <p>先确定来源与许可，再检查标题和主题建议。</p>
            </header>

            <section class="batch-policy" aria-label="批次信息">
              <label>来源
                <select data-import-field="source">
                  <option value="" ${!ctx.state.importSource ? 'selected' : ''}>请选择来源</option>
                  <option value="AI 生成" ${ctx.state.importSource === 'AI 生成' ? 'selected' : ''}>AI 生成</option>
                  <option value="本人拍摄" ${ctx.state.importSource === '本人拍摄' ? 'selected' : ''}>本人拍摄</option>
                  <option value="授权收藏" ${ctx.state.importSource === '授权收藏' ? 'selected' : ''}>授权收藏</option>
                </select>
              </label>
              <label>许可
                <select data-import-field="license">
                  <option value="" ${!ctx.state.importLicense ? 'selected' : ''}>请选择许可</option>
                  <option value="允许站内下载" ${ctx.state.importLicense === '允许站内下载' ? 'selected' : ''}>允许站内下载</option>
                  <option value="仅预览并链接出处" ${ctx.state.importLicense === '仅预览并链接出处' ? 'selected' : ''}>仅预览并链接出处</option>
                </select>
              </label>
              <div><span>主题建议</span><strong>${collectionTitle}</strong><button>更换</button></div>
            </section>

            ${
              ctx.state.importStatus === 'done'
                ? '<div class="flow-success" role="status"><span>完成</span><strong>4 张图片已进入私有草稿</strong><button data-view="gallery">查看图库版式</button></div>'
                : ''
            }

            <section class="import-grid" aria-label="待导入图片">
              ${ctx.data.images
                .map(
                  (image, index) => `
                    <article class="import-item">
                      <label class="select-image"><input type="checkbox" checked aria-label="选择${image.title}" /><span>0${index + 1}</span></label>
                      <img src="${image.src}" alt="${image.title}" />
                      <label>标题<input value="${image.title}" /></label>
                      <div><span>AI 建议</span><button>${collectionTitle}</button><button>风景</button></div>
                    </article>`,
                )
                .join('')}
            </section>
          </section>
        </div>
      </main>`;
  }

  function studioImageView(ctx) {
    const purposes = [
      ['cover', '文章封面'],
      ['gallery', '加入图库'],
      ['free', '自由创作'],
    ];
    const resultReady = ctx.state.imageGeneration === 'ready';
    return `
      <main id="main-content" class="studio-shell studio-flow-shell">
        ${studioTopbar(ctx, 'AI 图片')}
        <div class="studio-flow-layout">
          ${studioRail('studio-image')}
          <section class="image-studio-main">
            <div class="image-brief-panel">
              <header class="flow-heading compact">
                <p>IMAGE BRIEF</p>
                <h1>先说用途，再描述画面。</h1>
              </header>
              <div class="purpose-tabs" role="group" aria-label="图片用途">
                ${purposes.map(([value, label]) => `<button class="${ctx.state.imagePurpose === value ? 'is-active' : ''}" data-action="image-purpose" data-purpose="${value}">${label}</button>`).join('')}
              </div>
              <label class="prompt-field">画面描述
                <textarea data-image-prompt>${ctx.escapeHTML(ctx.state.aiPrompt)}</textarea>
              </label>
              <fieldset class="style-direction">
                <legend>视觉方向</legend>
                <label><input type="radio" name="image-style" checked /><span>清透线稿<small>留白、细线与低饱和</small></span></label>
                <label><input type="radio" name="image-style" /><span>雾面场景<small>柔和光线与远景空间</small></span></label>
                <label><input type="radio" name="image-style" /><span>抽象结构<small>几何秩序与编辑构图</small></span></label>
              </fieldset>
              <button class="advanced-toggle" data-action="toggle-image-advanced">高级设置 <span>${ctx.state.imageAdvanced ? '−' : '+'}</span></button>
              ${
                ctx.state.imageAdvanced
                  ? '<div class="advanced-fields"><label>画幅<select><option>16:9</option><option>4:3</option><option>1:1</option></select></label><label>清晰度<select><option>标准</option><option>高</option></select></label><p>模型由当前任务自动选择。</p></div>'
                  : ''
              }
              ${ctx.state.imageError ? `<p class="field-error" role="alert">${ctx.state.imageError}</p>` : ''}
              <button class="generate-button" data-action="generate-image" ${ctx.state.imageGeneration === 'loading' ? 'disabled' : ''}>${ctx.state.imageGeneration === 'loading' ? '正在生成…' : resultReady ? '换一个方向' : '生成图片'}</button>
            </div>

            <section class="generation-stage ${ctx.state.imageGeneration}" aria-live="polite" aria-busy="${ctx.state.imageGeneration === 'loading'}">
              ${
                ctx.state.imageGeneration === 'loading'
                  ? '<div class="generation-loading"><span></span><p>正在建立构图与光线</p><small>结果会先保存在私有草稿</small></div>'
                  : resultReady
                    ? `<figure class="generated-result"><img src="${ctx.data.featured.cover}" alt="组件渲染性能优化封面结果" /><figcaption><span>${ctx.state.imagePurpose === 'cover' ? '文章封面' : ctx.state.imagePurpose === 'gallery' ? '图库草稿' : '自由创作'}</span><strong>${ctx.state.imageApplied ? '已设为文章封面' : '私有图片草稿'}</strong></figcaption></figure><div class="result-actions"><button data-action="generate-image">再生成一张</button><button class="primary" data-action="use-generated-cover" ${ctx.state.imageApplied ? 'disabled' : ''}>${ctx.state.imageApplied ? '已设为封面' : '设为封面'}</button></div>`
                    : '<div class="generation-empty"><span>16:9</span><p>生成结果会出现在这里</p><small>默认保持私有，确认后再进入文章或图库。</small></div>'
              }
            </section>
          </section>
        </div>
      </main>`;
  }

  return {
    aboutView,
    articlesView,
    galleryCollectionView,
    galleryItemView,
    galleryView,
    studioHomeView,
    studioImageView,
    studioImportView,
    studioRail,
  };
})();
