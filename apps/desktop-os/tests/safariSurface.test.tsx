import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { selectRenderableTabs } from '../src/apps/safari/iframeQuota';
import SafariSection from '../src/apps/safari/SafariSection';
import { type BrowserTab, useBrowserStore } from '../src/store/browserStore';

function makeTab(overrides: Partial<BrowserTab> & { id: string }): BrowserTab {
  return {
    currentUrl: `https://${overrides.id}.test`,
    addressInput: `https://${overrides.id}.test`,
    history: [],
    future: [],
    reloadKey: 0,
    status: 'loaded',
    title: null,
    favicon: null,
    lastActivatedAt: 0,
    ...overrides,
  };
}

describe('SafariWindow · iframe 配额选择', () => {
  beforeEach(() => {
    useBrowserStore.setState({
      tabs: [
        {
          id: 'home',
          currentUrl: null,
          addressInput: 'plush://start',
          history: [],
          future: [],
          reloadKey: 0,
          status: 'home',
          title: null,
          favicon: null,
          lastActivatedAt: 0,
        },
      ],
      activeTabId: 'home',
      recents: [],
      bookmarks: [],
      collapsedSections: { resources: false, recents: false, bookmarks: false },
    });
  });

  it('起始页 tab 不会进入 iframe 列表', () => {
    const home = makeTab({ id: 'home', currentUrl: null, status: 'home' });
    expect(selectRenderableTabs([home], home)).toEqual([]);
  });

  it('6 个非起始页 tab 时只渲染 4 个 iframe', () => {
    const tabs = Array.from({ length: 6 }, (_, i) =>
      makeTab({ id: `t${i}`, lastActivatedAt: i + 1 }),
    );
    const result = selectRenderableTabs(tabs, tabs[5]);

    expect(result).toHaveLength(4);
  });

  it('配额按 lastActivatedAt 倒序选择最近 4 个 tab', () => {
    const tabs = Array.from({ length: 6 }, (_, i) =>
      makeTab({ id: `t${i}`, lastActivatedAt: i + 1 }),
    );
    const active = tabs[5];
    const result = selectRenderableTabs(tabs, active);

    expect(result.map((t) => t.id)).toEqual(['t5', 't4', 't3', 't2']);
    expect(result.map((t) => t.id)).not.toContain('t0');
  });

  it('配额外的老 tab 被激活后重新出现在 iframe 列表里', () => {
    const tabs = Array.from({ length: 6 }, (_, i) =>
      makeTab({ id: `t${i}`, lastActivatedAt: i + 1 }),
    );
    const before = selectRenderableTabs(tabs, tabs[5]);
    expect(before.map((t) => t.id)).not.toContain('t0');

    const reactivated: BrowserTab[] = tabs.map((tab) =>
      tab.id === 't0' ? { ...tab, lastActivatedAt: 100 } : tab,
    );
    const newActive = reactivated.find((t) => t.id === 't0') as BrowserTab;
    const after = selectRenderableTabs(reactivated, newActive);

    expect(after.map((t) => t.id)).toContain('t0');
    expect(after.length).toBeLessThanOrEqual(4);
  });

  it('active tab 即使 lastActivatedAt 较旧也保证出现在列表里', () => {
    const tabs = Array.from({ length: 5 }, (_, i) =>
      makeTab({ id: `t${i}`, lastActivatedAt: i + 1 }),
    );
    const oldActive = makeTab({ id: 'old-active', lastActivatedAt: 0 });
    const all = [oldActive, ...tabs];
    const result = selectRenderableTabs(all, oldActive);

    expect(result.map((t) => t.id)).toContain('old-active');
  });

  it('store · 切换激活老 tab 后该 tab 出现在配额内', () => {
    const tabs: BrowserTab[] = Array.from({ length: 6 }, (_, i) =>
      makeTab({ id: `seed-${i}`, lastActivatedAt: i + 1 }),
    );
    useBrowserStore.setState({ tabs, activeTabId: 'seed-5' });

    const beforeState = useBrowserStore.getState();
    const beforeActive = beforeState.tabs.find((t) => t.id === beforeState.activeTabId) ?? null;
    const before = selectRenderableTabs(beforeState.tabs, beforeActive);
    expect(before.map((t) => t.id)).not.toContain('seed-0');

    useBrowserStore.getState().activateTab('seed-0');

    const afterState = useBrowserStore.getState();
    const afterActive = afterState.tabs.find((t) => t.id === afterState.activeTabId) ?? null;
    const after = selectRenderableTabs(afterState.tabs, afterActive);

    expect(afterActive?.id).toBe('seed-0');
    expect(after.map((t) => t.id)).toContain('seed-0');
    expect(after.length).toBeLessThanOrEqual(4);
  });
});

function readSource(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function resetBrowserStore(partial: Partial<ReturnType<typeof useBrowserStore.getState>> = {}) {
  useBrowserStore.setState({
    tabs: [
      {
        id: 'home',
        currentUrl: null,
        addressInput: 'plush://start',
        history: [],
        future: [],
        reloadKey: 0,
        status: 'home',
        title: null,
        favicon: null,
        lastActivatedAt: 0,
      },
    ],
    activeTabId: 'home',
    recents: [],
    bookmarks: [],
    collapsedSections: { resources: false, recents: false, bookmarks: false },
    ...partial,
  });
}

describe('SafariSection · 折叠与空状态', () => {
  beforeEach(() => {
    resetBrowserStore();
  });

  it('children 为空且未传 empty 时整个 section 不渲染', () => {
    const html = renderToStaticMarkup(
      <SafariSection id="recents" title="最近访问">
        {null}
      </SafariSection>,
    );

    expect(html).toBe('');
  });

  it('传入 empty 槽时即使 children 为空也渲染分组头与 empty', () => {
    const html = renderToStaticMarkup(
      <SafariSection id="resources" title="资源" empty={<div data-testid="empty">暂无</div>}>
        {null}
      </SafariSection>,
    );

    expect(html).toContain('safari-section__head');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-testid="empty"');
    expect(html).toContain('暂无');
  });

  it('折叠态下不渲染 body(SafariSection 通过 collapsed 分支控制)', () => {
    resetBrowserStore();
    useBrowserStore.getState().toggleSection('recents');
    expect(useBrowserStore.getState().collapsedSections.recents).toBe(true);

    const source = readSource('src/apps/safari/SafariSection.tsx');
    expect(source).toContain('collapsedSections[id]');
    expect(source).toContain('toggleSection');
    expect(source).toMatch(/!collapsed\s*&&\s*\(/);
    expect(source).toContain('aria-expanded={!collapsed}');
  });

  it('展开态下渲染 children 而非 empty', () => {
    const html = renderToStaticMarkup(
      <SafariSection id="bookmarks" title="收藏" empty={<span>fallback</span>}>
        <div data-testid="bookmark-card">收藏一条</div>
      </SafariSection>,
    );

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('safari-section__body');
    expect(html).toContain('收藏一条');
    expect(html).not.toContain('fallback');
  });
});

describe('SafariHome · 起始页三分组装配', () => {
  it('SafariHome 通过 SafariSection 渲染三个分组', () => {
    const source = readSource('src/apps/safari/SafariHome.tsx');

    expect(source).toContain('id="resources"');
    expect(source).toContain('title="资源"');
    expect(source).toContain('id="recents"');
    expect(source).toContain('title="最近访问"');
    expect(source).toContain('id="bookmarks"');
    expect(source).toContain('title="收藏"');
    expect(source).toContain("from './SafariSection'");
  });

  it('"资源"分组始终渲染:loading/error/empty 通过 SafariSection 的 empty 槽承载', () => {
    const source = readSource('src/apps/safari/SafariHome.tsx');

    expect(source).toContain('resourcesEmpty');
    expect(source).toContain('empty={resourcesEmpty}');
    expect(source).toContain('正在载入资源');
    expect(source).toContain('资源加载失败');
    expect(source).toContain('暂无资源');
  });

  it('最近访问 / 收藏 分组在空状态下不传 empty,确保隐藏分组头', () => {
    const source = readSource('src/apps/safari/SafariHome.tsx');

    expect(source).toMatch(/<SafariSection\s+id="recents"\s+title="最近访问">/);
    expect(source).toMatch(/<SafariSection\s+id="bookmarks"\s+title="收藏">/);
    expect(source).not.toMatch(/<SafariSection\s+id="recents"[^>]*\bempty=/);
    expect(source).not.toMatch(/<SafariSection\s+id="bookmarks"[^>]*\bempty=/);
  });

  it('卡片视觉与按钮挂载到 RecentCard / BookmarkCard 上', () => {
    const source = readSource('src/apps/safari/SafariHome.tsx');

    expect(source).toContain('RECENTS_LIMIT = 12');
    expect(source).toContain('BOOKMARKS_LIMIT = 12');
    expect(source).toContain('aria-label={`移除最近访问');
    expect(source).toContain('aria-label={`取消收藏');
    expect(source).toContain('onRemove={removeRecent}');
    expect(source).toContain('onRemove={removeBookmark}');
    expect(source).toContain('onOpen={openUrl}');
  });

  it('SafariWindow 起始页 block 已替换为 <SafariHome />,不再内联渲染 home block', () => {
    const source = readSource('src/apps/SafariWindow.tsx');

    expect(source).toContain("from './safari/SafariHome'");
    expect(source).toContain('<SafariHome />');
    expect(source).not.toContain('safari-browser__home-title');
    expect(source).not.toContain('resourceToFinderItem');
  });
});

describe('SafariEmbedFallback · 失败页装配', () => {
  it('渲染 4 个 PlushButton:新窗口打开 / 重试 / 复制链接 / 加入收藏', () => {
    const source = readSource('src/apps/safari/SafariEmbedFallback.tsx');

    expect(source).toContain('新窗口打开');
    expect(source).toContain('重试');
    expect(source).toContain('复制链接');
    expect(source).toContain('加入收藏');
    expect((source.match(/<PlushButton/g) ?? []).length).toBe(4);
  });

  it('文案与 EmptyState tone="danger" 配置正确', () => {
    const source = readSource('src/apps/safari/SafariEmbedFallback.tsx');

    expect(source).toContain('网站可能拒绝在 Safari 内嵌入显示');
    expect(source).toContain('X-Frame-Options 或 CSP frame-ancestors');
    expect(source).toContain('tone="danger"');
    expect(source).toContain("from '../../ui/EmptyState'");
  });

  it('复制链接走 navigator.clipboard 主路径,catch 后退到 document.execCommand("copy")', () => {
    const source = readSource('src/apps/safari/SafariEmbedFallback.tsx');

    expect(source).toContain('navigator.clipboard');
    expect(source).toContain('writeText');
    expect(source).toContain("document.execCommand('copy')");
    expect(source).toContain('已复制');
    expect(source).toContain('COPY_HINT_MS = 3000');
    expect(source).toContain('clearTimeout');
  });

  it('加入收藏调 addBookmark;已收藏时按钮文案变"已收藏"且 disabled', () => {
    const source = readSource('src/apps/safari/SafariEmbedFallback.tsx');

    expect(source).toContain('addBookmark(url, title)');
    expect(source).toContain('已收藏');
    expect(source).toMatch(/bookmarks\.some\(\(b\)\s*=>\s*b\.url\s*===\s*url\)/);
    expect(source).toContain('disabled={isBookmarked}');
  });

  it('SafariWindow 在 status === "embed-limited" 时挂载 <SafariEmbedFallback />,与 loading 态分离', () => {
    const source = readSource('src/apps/SafariWindow.tsx');

    expect(source).toContain("from './safari/SafariEmbedFallback'");
    expect(source).toContain("status === 'embed-limited'");
    expect(source).toContain('<SafariEmbedFallback');
    expect(source).toContain('onRetry={refresh}');
    expect(source).toContain('safari-browser__loading');
    expect(source).not.toContain('网页可能限制嵌入显示');
  });
});

describe('DesktopGlobalEvents · Safari 快捷键路由', () => {
  it('守卫 focusedAppId === "safari" 与 4 个 key 字面量', () => {
    const source = readSource('src/components/DesktopGlobalEvents.tsx');

    expect(source).toContain("from '../store/browserStore'");
    expect(source).toContain("from '../store/windowStore'");
    expect(source).toContain("focusedAppId !== 'safari'");
    expect(source).toContain("key !== 't'");
    expect(source).toContain("key !== 'w'");
    expect(source).toContain("key !== 'l'");
    expect(source).toContain("key !== 'r'");
  });

  it('4 个动作分别路由到 newTab / closeTab / 地址栏 focus / refresh', () => {
    const source = readSource('src/components/DesktopGlobalEvents.tsx');

    expect(source).toContain('browser.newTab()');
    expect(source).toContain('browser.closeTab(browser.activeTabId)');
    expect(source).toContain("querySelector<HTMLInputElement>('[data-safari-address-input]')");
    expect(source).toContain('input.focus()');
    expect(source).toContain('input.select()');
    expect(source).toContain('browser.refresh()');
  });

  it('除 Cmd+L 外,事件目标位于地址栏内时不触发(避免吃键)', () => {
    const source = readSource('src/components/DesktopGlobalEvents.tsx');

    expect(source).toContain('isInsideAddressBar');
    expect(source).toContain('[data-safari-address-input]');
    expect(source).toMatch(/key\s*!==\s*'l'\s*&&\s*isInsideAddressBar/);
  });

  it('SafariWindow 地址栏 input 标记 data-safari-address-input', () => {
    const source = readSource('src/apps/SafariWindow.tsx');

    expect(source).toContain('data-safari-address-input');
  });
});
