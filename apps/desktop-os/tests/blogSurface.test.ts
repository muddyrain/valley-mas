import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getDesktopApp } from '../src/apps/desktopApps';
import { buildDefaultDockItems } from '../src/store/dockStore';

function readSource(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('blog desktop surface', () => {
  it('registers Blog as a real Desktop OS app and default Dock target', () => {
    const appRegistry = readSource('src/apps/desktopApps.ts');
    const appRenderers = readSource('src/apps/appRenderers.tsx');
    const sizingSource = readSource('src/store/windowSizing.ts');
    const blogApp = getDesktopApp('blog');
    const dockItem = buildDefaultDockItems().find((item) => item.id === 'blog');

    expect(appRegistry).toContain("| 'blog'");
    expect(blogApp).toMatchObject({
      id: 'blog',
      title: '博客',
      icon: '/icons/blog.png',
      category: 'content',
      dockDefault: true,
    });
    expect(appRenderers).toContain('BlogWindow');
    expect(appRenderers).toContain('blog: () => <BlogWindow />');
    expect(sizingSource).toContain('blog: LARGE_PROFILE');
    expect(dockItem).toMatchObject({
      id: 'blog',
      label: '博客',
      icon: '/icons/blog.png',
      appId: 'blog',
      visible: true,
      pinned: true,
      canOpenWindow: true,
    });
  });

  it('adds a public blog reader and creator workflow without unsafe html or admin deletes', () => {
    const blogWindow = readSource('src/apps/BlogWindow.tsx');
    const blogApi = readSource('src/api/blog.ts');
    const blogStore = readSource('src/store/blogStore.ts');
    const blogStyles = readSource('src/apps/BlogWindow.css');
    const finderWindow = readSource('src/apps/FinderWindow.tsx');
    const scrollbarSource = readSource('src/ui/PlushScrollbar.tsx');
    const scrollbarStyles = readSource('src/ui/PlushScrollbar.css');
    const desktopPackage = readSource('package.json');

    expect(blogApi).toContain('/public/blog/posts');
    expect(blogApi).toContain('/admin/blog/posts');
    expect(blogApi).toContain('/admin/blog/cover/upload');
    expect(blogApi).toContain('postType');
    expect(blogApi).toContain('createBlogPost');
    expect(blogApi).toContain('uploadBlogCover');
    expect(blogStore).toContain('listBlogPosts');
    expect(blogStore).toContain('createPost');
    expect(blogStore).toContain('saving');
    expect(desktopPackage).toContain('"react-markdown"');
    expect(desktopPackage).toContain('"remark-gfm"');
    expect(blogWindow).toContain("from 'react-markdown'");
    expect(blogWindow).toContain("from 'remark-gfm'");
    expect(blogWindow).toContain('Public journal');
    expect(blogWindow).toContain('BlogHero');
    expect(blogWindow).toContain('BlogFilters');
    expect(blogWindow).toContain('BlogComposer');
    expect(blogWindow).toContain('accept=".md,.markdown,text/markdown,text/plain"');
    expect(blogWindow).toContain('accept="image/*"');
    expect(blogWindow).toContain('selectedTagIds');
    expect(blogWindow).toContain('toggleComposerTag');
    expect(blogWindow).toContain('uploadBlogCover');
    expect(blogWindow).toContain('onSaveDraft');
    expect(blogWindow).toContain('onPublish');
    expect(blogWindow).toContain('composerView');
    expect(blogWindow).toContain('fontScale');
    expect(blogWindow).toContain('isListCollapsed');
    expect(blogWindow).toContain('PanelLeftClose');
    expect(blogWindow).toContain('PanelLeftOpen');
    expect(blogWindow).toContain('blog-window__list-floating-toggle');
    expect(blogWindow).toContain('aria-expanded={!isListCollapsed}');
    expect(blogWindow).toContain('blog-window__hero-panel');
    expect(blogWindow).toContain('blog-window__mode-switch');
    expect(blogWindow).toContain('blog-window__layout--list-collapsed');
    expect(blogWindow).toContain('blog-reader__masthead');
    expect(blogWindow).toContain('blog-reader__shell');
    expect(blogWindow).toContain('blog-reader__aside');
    expect(blogWindow).toContain('blog-reader__paper');
    expect(blogWindow).toContain('blog-reader__outline');
    expect(blogWindow).toContain('getBlogToc');
    expect(blogWindow).toContain('大纲');
    expect(blogWindow).toContain('blog-reader__cover-frame');
    expect(blogWindow).toContain('fit="contain"');
    expect(blogWindow).toContain('PlushLoadMore');
    expect(blogWindow).toContain('blog-window__reader-loading');
    expect(blogWindow).toContain('blog-reader__markdown-image');
    expect(blogWindow).toContain('PlushScrollbar');
    expect(blogWindow).toContain('as="aside"');
    expect(blogWindow).toContain('as="main"');
    expect(blogWindow).toContain('contentClassName="blog-window__reader-content"');
    expect(finderWindow).toContain('className="finder__sidebar"');
    expect(finderWindow).toContain('className={`finder__browser finder__browser--');
    expect(finderWindow).toContain('className="finder__detail"');
    expect(scrollbarSource).toContain('OverlayScrollbarsComponent');
    expect(scrollbarSource).toContain("autoHide: 'scroll'");
    expect(scrollbarSource).toContain("theme: 'os-theme-plush'");
    expect(scrollbarStyles).toContain('.os-theme-plush .os-scrollbar-handle');
    expect(blogWindow).not.toContain('<pre className="blog-reader__body"');
    expect(blogStyles).toContain('.blog-window__reader-loading');
    expect(blogStyles).toContain('.blog-window__reader-content');
    expect(blogStyles).toContain(
      '.blog-window__reader-content:has(> .blog-window__reader-loading)',
    );
    expect(blogStyles).toContain('.blog-window__hero');
    expect(blogStyles).toContain('.blog-window__filter-strip');
    expect(blogStyles).toContain('.blog-window__layout--list-collapsed');
    expect(blogStyles).toContain('.blog-window__list-toggle');
    expect(blogStyles).toContain('.blog-window__list-floating-toggle');
    expect(blogStyles).toContain('.blog-window__list-body');
    expect(blogStyles).toContain('.blog-composer');
    expect(blogStyles).toContain('.blog-composer__side');
    expect(blogStyles).toContain('.blog-composer__workspace');
    expect(blogStyles).toContain('.blog-composer__editor');
    expect(blogStyles).toContain('.blog-composer__preview');
    expect(blogStyles).toContain('.blog-composer__tags button.is-active');
    expect(blogStyles).toContain('.blog-window__list-head');
    expect(blogStyles).toContain('.blog-reader__masthead');
    expect(blogStyles).toContain('.blog-reader__shell');
    expect(blogStyles).toContain('.blog-reader__paper');
    expect(blogStyles).toContain('.blog-reader__outline-panel');
    expect(blogStyles).toContain('.blog-reader__toc');
    expect(blogStyles).toContain('.blog-reader__cover-frame');
    expect(blogStyles).toContain('.window__body:has(.blog-window)');
    expect(blogStyles).toContain('display: flex');
    expect(blogStyles).toContain('width: 100%');
    expect(blogStyles).toContain('flex: 1 1 auto');
    expect(blogStyles).toContain('overflow: hidden');
    expect(blogStyles).toContain('.blog-window__layout > .plush-scrollbar-frame');
    expect(blogStyles).toContain('height: 100%');
    expect(blogStyles).toContain('box-sizing: border-box');
    expect(blogStyles).toContain('flex: 1');
    expect(blogStyles).toContain('.blog-window__list,');
    expect(blogStyles).toContain('.blog-window__reader');
    expect(blogStyles).not.toContain('scrollbar-gutter: stable');
    expect(blogStyles).toContain('.blog-reader__body table');
    expect(blogStyles).toContain('.blog-reader__body pre');
    expect(blogStyles).toContain('list-style: disc');
    expect(blogStyles).toContain('list-style: decimal');
    expect(blogStyles).toContain('.blog-reader__body li::marker');
    expect(blogStyles).toContain('.blog-reader__body h5');
    expect(blogStyles).toContain('.blog-reader__body hr');
    expect(blogStyles).toContain('.blog-reader__body strong');
    expect(blogStyles).toContain('section[data-footnotes]');
    expect(blogStyles).toContain('place-items: center');
    expect(blogWindow).not.toContain('dangerouslySetInnerHTML');
    expect(blogWindow).not.toContain('deletePost');
    expect(blogWindow).not.toContain('updatePost');
  });
});
