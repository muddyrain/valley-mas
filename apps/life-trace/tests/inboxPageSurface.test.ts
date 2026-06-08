import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');
const todayPageSource = readFileSync(resolve(__dirname, '../src/pages/TodayPage.tsx'), 'utf8');
const profilePageSource = readFileSync(resolve(__dirname, '../src/pages/ProfilePage.tsx'), 'utf8');
const inboxPagePath = resolve(__dirname, '../src/pages/InboxPage.tsx');

describe('inbox page surface', () => {
  it('registers the secondary inbox route and entries', () => {
    expect(existsSync(inboxPagePath)).toBe(true);
    expect(appSource).toContain('path="/inbox"');
    expect(todayPageSource).toContain("navigate('/inbox')");
    expect(profilePageSource).toContain("navigate('/inbox')");
  });

  it('keeps developer analysis copy out of the visible inbox UI', () => {
    const inboxPageSource = existsSync(inboxPagePath) ? readFileSync(inboxPagePath, 'utf8') : '';

    expect(inboxPageSource).not.toContain('这个页面');
    expect(inboxPageSource).not.toContain('用于快速收集');
    expect(inboxPageSource).not.toContain('AI 整理为');
  });
});
